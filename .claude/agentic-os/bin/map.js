// bin/map.js
const fs = require('node:fs');
const path = require('node:path');
const { detect } = require('../src/detect');
const { loadConfig } = require('../src/compile');
const { executeOnRepo } = require('../src/execute');
const { wire } = require('../src/wire');
const { computeDrift } = require('../src/verify');
const { render } = require('../src/render');
const { writeEcosystem } = require('../src/merge');
const { walk } = require('../lib/walk');

// Independent count for drift: coarse raw regex, SCOPED BY FILE CATEGORY so frontend
// calls (e.g. axios.get) are never miscounted as backend routes. Routes are counted only
// in backend files; FE calls + surfaces only in frontend files.
function independentCounts(root, patternSet) {
  const toExt = (g) => g.replace(/^\*\*\//, '').replace(/^\*/, '');
  const exts = [...(patternSet.fileGlobs.frontend || []), ...(patternSet.fileGlobs.backend || [])].map(toExt);
  // Count across ALL source files (matching the executor's scope, which runs every pattern on every
  // file) — but, like the executor, SKIP test files: a handler_test.go that wires fixture routes is
  // not production surface, and counting it here while the extractor excludes it reads as drift.
  // Independent copy of the executor's test-file rule (the gauge must not share its code path).
  const TEST_FILE_RE = /(_test\.go$|\.(test|spec)\.[cm]?[tj]sx?$|(^|\/)__(tests|mocks)__\/)/;
  // Match on the repo-RELATIVE path, like the executor: an ANCESTOR dir named __mocks__/__tests__
  // (outside the repo) must not exclude every file and read as 100% drift on a correct map.
  const files = exts.length === 0 ? [] : walk(root, { include: exts })
    .filter((p) => !TEST_FILE_RE.test(path.relative(root, p).replace(/\\/g, '/')))
    .map((p) => ({ ext: path.extname(p), content: fs.readFileSync(p, 'utf8') }));
  // Per-shape extension scoping mirrors the extractors' ext fields: client.GET('/x') in .ts is an FE
  // call while r.GET("/x") in .go is a route — same regex shape, opposite meaning (see default-patternset).
  const JS_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
  const GO_EXTS = ['.go'];
  const PY_EXTS = ['.py'];
  const count = (re, only) => files.reduce((n, f) => (only && !only.includes(f.ext)) ? n : n + (f.content.match(re) || []).length, 0);
  // File-based routes: 1 route per route file. Recount the dirs independently (do NOT reuse
  // fileRoutesFromRepo — the drift gauge must be an independent check, not the same code path).
  let fileRouteCount = 0;
  for (const fr of patternSet.fileRoutes || []) {
    const frExts = fr.exts || ['.ts', '.js'];
    let frFiles = [];
    try { frFiles = walk(path.join(root, fr.baseDir), { include: frExts }); } catch { continue; }
    for (const abs of frFiles) {
      const rel = path.relative(path.join(root, fr.baseDir), abs).replace(/\\/g, '/');
      if (/(^|\/)(_|\.)/.test(rel)) continue;
      if (/\.(test|spec|d)\.[tj]sx?$/.test(rel)) continue;
      // filePattern (app-router: only route.* files are endpoints — page/layout are UI). The executor
      // enforces this; without it here the gauge counted every page.tsx under app/ as a "route"
      // (290 phantom routes on the MLM trial repo → 24.6% drift on a correct map).
      if (fr.filePattern && rel.replace(/\.(t|j)sx?$/, '').split('/').pop() !== fr.filePattern) continue;
      fileRouteCount++;
    }
  }
  // routes: ROUTE-DEFINING only — NestJS @Get decorators OR router/app/fastify.<method>(. NOT bare
  // `.get(` (which matches thousands of array/map/service method calls and wrecks the gauge at scale).
  // tRPC procedures (`name: xxxProcedure.`) + Hono multi-method mounts (`.on([...], "/path"`) are
  // route-definers too — the deep-map union extracts them, so the gauge must count them or the
  // drift math reads the RICHER map as drifted. Gauge regexes measure the same universe the
  // extractors target: LITERAL-url fetch/axios (a variable-arg fetch(url) is unmappable by any
  // deterministic extractor), `.on(` only with a `/`-leading path arg (else socket/emitter `.on(`
  // event listeners count as routes), and the full surface kind set (Click|Submit|Change).
  // The tRPC gauges must mirror the EXTRACTORS' shapes or the union reads as drift on the modern
  // stack (review fix): FE calls use a chain of ANY depth (`trpc.brief.departments.update.useX` —
  // ≥2 segments before the hook, matching trpcFeCallsIn), and the route gauge requires a builder
  // CALL after the procedure (`proc.input(`/`.query(`) so a type annotation `x: ProtectedProcedure
  // .Context` or a `._def` property read is NOT miscounted as a route.
  // Same rule for the typed-client + Go shapes (MLM field test: extractor found 1013 feCalls /
  // 881 routes, gauge counted 17 / 442 → 98.3% "drift" on a correct map): the gauge must count the
  // hey-api object-form `.get({url:'/x'})` (optional generics + one nested key level before url:),
  // openapi-fetch `.GET('/x')` (JS-scoped), axios object-form, useSWR/useQuery literal URLs, and
  // the Go gin/echo/chi/mux route verbs (.go-scoped) — exactly the universes default-patternset targets.
  return {
    feCalls: count(/\b\w*[Ff]etch\s*\(\s*[`'"]|axios\.\w+\s*\(\s*[`'"]/g)
      + count(/\btrpc(?:\.\w+){2,}\.(?:useQuery|useMutation|useSuspenseQuery|useInfiniteQuery|useSuspenseInfiniteQuery|query|mutate|fetch)\b/g)
      + count(/\baxios\s*\(\s*\{[^}]*url:\s*[`'"]/g)
      // NB: trpc.x.y.useQuery('lit') matches BOTH this branch and the tRPC chain branch — accepted:
      // the extractor side also counts it twice (useQuery pattern + the deep-map union's tRPC call,
      // whose url differs so the union dedup keeps both). Parity holds on the realistic path.
      + count(/\b(?:useSWR|useQuery)\(\s*[`'"]/g)
      + count(/\.(?:get|post|put|patch|delete)\s*(?:<[^(){};]*>)?\s*\(\s*\{(?:[^{}]|\{[^{}]*\})*?url:\s*[`'"]/g, JS_EXTS)
      + count(/\.(?:GET|POST|PUT|PATCH|DELETE)\(\s*[`'"]\//g, JS_EXTS),
    routes: count(/@(get|post|put|delete|patch|all)\b|\b(?:router|app|fastify|route)\.(get|post|put|delete|patch|all)\s*\(/gi, JS_EXTS) + fileRouteCount
      + count(/@(?:app|router)\.(?:get|post|put|delete|patch)\(\s*[`'"]/g, PY_EXTS)
      + count(/@(?:app|bp)\.route\(\s*[`'"]/g, PY_EXTS)
      + count(/\b\w+\s*:\s*\w*[Pp]rocedure[\w$]*\s*\.\s*\w+\s*\(/g)
      + count(/\.on\(\s*(?:\[[^\]]*\]|[`'"][A-Za-z]+[`'"])\s*,\s*[`'"]\//g)
      + count(/\.(?:GET|POST|PUT|PATCH|DELETE)\(\s*"(?:\/[^"]*)?"/g, GO_EXTS)
      + count(/\.(?:Get|Post|Put|Patch|Delete)\(\s*"(?:\/[^"]*)?"/g, GO_EXTS)
      + count(/\.HandleFunc\(\s*"\//g, GO_EXTS),
    surfaces: count(/on(Click|Submit|Change)=/g),
  };
}

function runPipeline(root) {
  const stack = detect(root);
  const patternSet = loadConfig(root);
  if (!patternSet) {
    throw new Error('no extractor config found at .ecosystem/extractor.config.json — run the discover phase first');
  }

  const rawMap = executeOnRepo(patternSet, root);
  // Union the deterministic deep-map (AST + modern-TS extractors) into the structural rawMap: NestJS
  // decorators, tRPC cross-file namespaces, and Hono app.on mounts are invisible to per-file regex
  // patterns, so without this the wireup/orphans/drift under-report on those stacks. Fail-soft: the
  // pattern-extracted map stands alone if the deep extraction throws.
  try {
    const { buildDeterministicDeepMap, unionIntoRawMap } = require('../src/deterministic-deep-map');
    unionIntoRawMap(rawMap, buildDeterministicDeepMap(root, {}));
  } catch {}
  const wired = wire(rawMap);
  const report = computeDrift(rawMap, independentCounts(root, patternSet));

  const map = {
    version: 1,
    generatedAt: new Date().toISOString(),
    stack,
    ...wired,
    accuracy: { maxDrift: report.maxDrift, precision: report.precision, trusted: report.trusted },
  };

  const md = render(wired);
  const reportMd = [
    '# Accuracy Report', '',
    `- Max drift: ${(report.maxDrift * 100).toFixed(1)}% (bar < ${report.bars.drift * 100}%)`,
    `- Precision: ${report.precision == null ? 'not yet sampled (run verify-map skill)' : (report.precision * 100).toFixed(1) + '%'}`,
    `- Trusted: ${report.trusted ? 'YES' : 'NO'}`, '',
    '## Per-category drift', '',
    ...Object.entries(report.drift).map(([k, v]) => `- ${k}: ${(v * 100).toFixed(1)}%`),
  ].join('\n') + '\n';

  writeEcosystem(root, {
    'map.json': JSON.stringify(map, null, 2) + '\n',
    'inventory.md': md['inventory.md'],
    'wireup.md': md['wireup.md'],
    'orphans.md': md['orphans.md'],
    'accuracy-report.md': reportMd,
  });

  return { map, report };
}

if (require.main === module) {
  const root = path.resolve(process.argv[2] || '.');
  try {
    const { report } = runPipeline(root);
    console.log(`Map written to ${path.join(root, '.ecosystem')} — maxDrift ${(report.maxDrift * 100).toFixed(1)}%`);
  } catch (e) {
    console.error('map failed:', e.message);
    process.exit(1);
  }
}

module.exports = { runPipeline, independentCounts };
