// src/execute.js
const fs = require('node:fs');
const path = require('node:path');
const { walk } = require('../lib/walk');

function lineOf(content, idx) {
  return content.slice(0, idx).split('\n').length;
}

// Detect whether the matched char just before the captured URL group was a backtick.
function urlKindAt(content, matchIndex, capturedUrl) {
  const at = content.indexOf(capturedUrl, matchIndex);
  const prev = at > 0 ? content[at - 1] : '';
  return prev === '`' ? 'template' : 'literal';
}

// Compose a route prefix (e.g. NestJS @Controller('scraper')) with a method-level path.
// composePath('scraper', 'system/status') -> '/scraper/system/status'; ('', '/api/x') -> '/api/x'.
function composePath(prefix, p) {
  const a = String(prefix || '').replace(/^\/+|\/+$/g, '');
  const b = String(p || '').replace(/^\/+|\/+$/g, '');
  return '/' + [a, b].filter(Boolean).join('/');
}

// Convert a file path (relative to a routed base dir) into its URL route, for file-based routing
// frameworks (Next.js pages-api/app-router, SvelteKit, etc.). Generic — no framework hardcoded.
//   'ably/auth.ts'                          -> '/ably/auth'
//   'foo/index.ts'                          -> '/foo'      (index = the dir itself)
//   'activities/[entityType]/[id].ts'       -> '/activities/:entityType/:id'
//   'blog/[...slug].ts'                     -> '/blog/*'   (catch-all)
//   'app/users/route.ts'                    -> '/app/users' (app-router route file = its dir)
function deriveFileRoute(relFromBase) {
  let p = String(relFromBase).replace(/\\/g, '/').replace(/\.(t|j)sx?$/, '');
  p = p.replace(/(^|\/)(index|route)$/, ''); // index.ts / route.ts resolve to the containing dir (or root)
  p = p.replace(/\[\.\.\.[^\]]+\]/g, '*'); // [...slug] catch-all
  p = p.replace(/\[([^\]]+)\]/g, ':$1'); // [param] dynamic segment
  return '/' + p.replace(/^\/+/, '');
}

// Walk file-routed dirs declared in patternSet.fileRoutes and emit synthetic routes.
// Each config: { baseDir, routePrefix, exts?, method? }. method defaults to 'ANY' since a
// single file usually handles multiple HTTP verbs (matched leniently in wire()).
function fileRoutesFromRepo(patternSet, root) {
  const out = [];
  for (const fr of patternSet.fileRoutes || []) {
    const baseAbs = path.join(root, fr.baseDir);
    const exts = fr.exts || ['.ts', '.js'];
    let files = [];
    try {
      files = walk(baseAbs, { include: exts });
    } catch {
      continue; // baseDir absent in this repo — skip silently (stack-agnostic)
    }
    for (const abs of files) {
      const relFromBase = path.relative(baseAbs, abs).replace(/\\/g, '/');
      if (/(^|\/)(_|\.)/.test(relFromBase)) continue; // _app, _middleware, dotfiles
      if (/\.(test|spec|d)\.[tj]sx?$/.test(relFromBase)) continue;
      // filePattern (e.g. 'route' for Next app-router): ONLY files with that basename are endpoints —
      // page.tsx/layout.tsx in the same tree are UI, not API. (Declared in configs since v1; enforcement
      // was missing, which would have minted /users/page routes the moment an app/ dir was scanned.)
      if (fr.filePattern && relFromBase.replace(/\.(t|j)sx?$/, '').split('/').pop() !== fr.filePattern) continue;
      const route = composePath(fr.routePrefix || '', deriveFileRoute(relFromBase));
      out.push({
        file: path.relative(root, abs).replace(/\\/g, '/'),
        line: 1,
        method: fr.method || 'ANY',
        route,
        handler: '',
        source: 'file-route',
      });
    }
  }
  return out;
}

// Find the file-level route prefix (first match of any routePrefixPattern), e.g. @Controller('base').
function firstPrefix(content, prefixPatterns) {
  for (const p of prefixPatterns || []) {
    const re = new RegExp(p.regex, (p.flags || '').includes('g') ? p.flags : (p.flags || '') + 'g');
    const m = re.exec(content);
    if (m) return m[p.prefixGroup] || '';
  }
  return '';
}

// The prefix of the NEAREST @Controller declared BEFORE `index` — so a file with multiple
// @Controller classes prefixes each route with its own controller (the firstPrefix-for-whole-file
// approach mis-prefixed routes in multi-controller files; the agents caught this).
function prefixAt(content, prefixPatterns, index) {
  let best = '';
  let bestPos = -1;
  for (const p of prefixPatterns || []) {
    const re = new RegExp(p.regex, (p.flags || '').includes('g') ? p.flags : (p.flags || '') + 'g');
    let m;
    while ((m = re.exec(content)) !== null) {
      if (m.index < index && m.index > bestPos) { bestPos = m.index; best = m[p.prefixGroup] || ''; }
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
  return best;
}

// Find the HTTP method inside THIS call's parentheses (balanced), so a fetch(url, {method})
// is detected without bleeding into adjacent calls. Returns fallback if none.
function methodInCall(content, matchIndex, fallback) {
  const open = content.indexOf('(', matchIndex);
  if (open === -1) return fallback;
  let depth = 0, end = -1;
  for (let i = open; i < content.length && i < open + 2000; i++) {
    const ch = content[i];
    if (ch === '(') depth++;
    else if (ch === ')') { depth--; if (depth === 0) { end = i; break; } }
  }
  const span = end === -1 ? content.slice(open, open + 400) : content.slice(open, end + 1);
  const mm = span.match(/method:\s*['"`]([A-Za-z]+)['"`]/);
  return mm ? mm[1] : fallback;
}

// Is the match inside a line comment? (a `//` earlier on its line, not part of `://`).
// Skips false positives like `// BE registers this as @Post('me/onboarding')`.
function inLineComment(content, idx) {
  const lineStart = content.lastIndexOf('\n', idx - 1) + 1;
  const prefix = content.slice(lineStart, idx);
  return /(^|[^:])\/\//.test(prefix) || /^\s*\*/.test(prefix); // // line comment OR block-comment continuation line
}

function runPatterns(content, file, patterns, build) {
  const out = [];
  for (const p of patterns) {
    // Per-pattern extension scoping: a pattern may declare ext:['.go'] / ['.ts',...] so shape-identical
    // syntax in another language never cross-fires (gin's r.GET("/x") in .go is a ROUTE; openapi-fetch's
    // client.GET('/x') in .ts is an FE CALL — same regex shape, opposite meaning). No ext = all files.
    if (p.ext && !p.ext.some((e) => file.endsWith(e))) continue;
    const re = new RegExp(p.regex, p.flags && p.flags.includes('g') ? p.flags : (p.flags || '') + 'g');
    let m;
    while ((m = re.exec(content)) !== null) {
      if (!inLineComment(content, m.index)) out.push(build(m, { content, file, index: m.index, pattern: p }));
      if (m.index === re.lastIndex) re.lastIndex++; // guard against zero-width loops
    }
  }
  return out;
}

function executePatterns(patternSet, files) {
  const feCalls = [];
  const routes = [];
  const surfaces = [];

  for (const { path: file, content } of files) {
    feCalls.push(...runPatterns(content, file, patternSet.feCallPatterns, (m, ctx) => {
      const url = m[ctx.pattern.urlGroup];
      // Method precedence: explicit `method:` key inside THIS call's parentheses (fetch(url,{method}))
      // > the pattern's methodGroup (typed clients: the verb IS the function name — client.get/.post,
      //   found missing in field testing where 833 hey-api SDK calls were invisible)
      // > the pattern's methodHint (default GET). methodInCall is bounded to the matching ')'.
      const hinted = ctx.pattern.methodGroup ? String(m[ctx.pattern.methodGroup] || 'GET') : (ctx.pattern.methodHint || 'GET');
      const method = methodInCall(content, ctx.index, hinted).toUpperCase();
      return {
        file, line: lineOf(content, ctx.index),
        method,
        url, urlKind: urlKindAt(content, ctx.index, url),
      };
    }));

    routes.push(...runPatterns(content, file, patternSet.routePatterns, (m, ctx) => {
      const route = composePath(prefixAt(content, patternSet.routePrefixPatterns, ctx.index), m[ctx.pattern.routeGroup]);
      // Route sanity filter — regex extraction over arbitrary source also hits non-route strings:
      // template literals (`/${r.method} ${r.route}`), config keys (viper.Get("db.host") via the Go
      // Title-case pattern), prose. A real route path has no whitespace/interpolation/quotes. (field testing).
      if (/[\s${}`'"\\]/.test(route) || route.length > 200) return null;
      return {
        file, line: lineOf(content, ctx.index),
        method: String(m[ctx.pattern.methodGroup] || 'GET').toUpperCase(),
        // per-route prefix = nearest preceding @Controller/.Group (handles multiple per file)
        route,
        handler: '',
      };
    }).filter(Boolean));

    surfaces.push(...runPatterns(content, file, patternSet.surfacePatterns, (m, ctx) => ({
      file, line: lineOf(content, ctx.index),
      kind: String(m[ctx.pattern.kindGroup] || 'unknown').toLowerCase(),
      label: '', handler: '',
    })));
  }

  return { feCalls, routes, surfaces };
}

// Test files define fixture routes/calls, not production surface — a Go handler_test.go that wires
// r.POST("/admin/items/:id/adjust") into a test router showed up as 6 "orphan routes" during field
// testing. Skip them wholesale (routes AND fe-calls).
const TEST_FILE_RE = /(_test\.go$|\.(test|spec)\.[cm]?[tj]sx?$|(^|\/)__(tests|mocks)__\/)/;

// FS wrapper: walk a root using the PatternSet's fileGlobs (extension suffix match for v1).
function executeOnRepo(patternSet, root) {
  const exts = [
    ...(patternSet.fileGlobs.frontend || []),
    ...(patternSet.fileGlobs.backend || []),
  ].map((g) => g.replace(/^\*\*\//, '').replace(/^\*/, '')); // '**/*.jsx' -> '.jsx'
  const files = walk(root, { include: exts })
    .map((abs) => path.relative(root, abs).replace(/\\/g, '/'))
    .filter((rel) => !TEST_FILE_RE.test(rel))
    .map((rel) => ({ path: rel, content: fs.readFileSync(path.join(root, rel), 'utf8') }));
  const map = executePatterns(patternSet, files);
  map.routes.push(...fileRoutesFromRepo(patternSet, root));
  return map;
}

module.exports = {
  executePatterns,
  executeOnRepo,
  lineOf,
  composePath,
  firstPrefix,
  prefixAt,
  deriveFileRoute,
  fileRoutesFromRepo,
};
