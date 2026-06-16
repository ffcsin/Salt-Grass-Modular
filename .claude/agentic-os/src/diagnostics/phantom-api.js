'use strict';
// Phantom-API / hallucinated-dependency guard. Two classes of agent hallucination, caught at the
// diff before they land:
//   (1) INTERNAL phantom calls — a bare function call `foo(...)` to a name defined NOWHERE in the
//       repo, not a JS global, not imported in that file. The agent invented an API.
//   (2) DEPENDENCY phantoms (slopsquat surface) — an import of a bare package not in package.json
//       and not a Node builtin. May not exist / may be a typosquat of a real one.
// Pure regex + the symbol index + package.json. Zero deps, zero network in the core (registry check
// is an optional separate step). Heuristic + advisory — report, don't hard-block by default.
const fs = require('node:fs');
const path = require('node:path');
const { buildSymbolIndex, GLOBALS } = require('../symbols');
const { addedLines } = require('../../lib/git');

const NODE_BUILTINS = new Set(['fs', 'path', 'os', 'http', 'https', 'crypto', 'util', 'events', 'stream', 'url',
  'querystring', 'child_process', 'cluster', 'net', 'tls', 'dns', 'zlib', 'readline', 'assert', 'buffer', 'timers',
  'string_decoder', 'perf_hooks', 'worker_threads', 'async_hooks', 'v8', 'vm', 'module', 'process', 'console', 'fs/promises']);

// JS keywords that are followed by `(` but are NOT calls.
const KEYWORD_CALLS = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'await', 'typeof',
  'do', 'else', 'super', 'with', 'yield', 'void', 'delete', 'in', 'of', 'new', 'throw', 'case', 'async']);

const levenshtein = (a, b) => {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
};

// Top npm names worth typosquat-warning against (small static list — extend as desired).
const POPULAR = ['react', 'react-dom', 'lodash', 'express', 'axios', 'next', 'typescript', 'eslint', 'jest', 'vitest',
  'zod', 'chalk', 'commander', 'dotenv', 'prisma', 'mongoose', 'webpack', 'vite', 'tailwindcss', 'prettier', 'uuid'];

// Core: scan a block of ADDED text given a name-existence predicate + known deps.
function scanForPhantoms({ added, hasSymbol, importedNames, deps }) {
  const text = String(added || '');
  const known = (name) => hasSymbol(name) || GLOBALS.has(name) || (importedNames && importedNames.has(name));
  const internal = new Set(), depPhantoms = [], typos = [];

  // (1) bare calls: `name(` directly (NO space — `mile (cost)` in prose is not a call), not preceded
  // by `.`, not a keyword, and not on a comment line (kills the dominant false-positive class).
  const callRe = /(^|[^.\w$])([a-z_$][\w$]*)\(/g; // camel/snake start → looks like a function, not a Type/Component
  let m;
  for (const line of text.split('\n')) {
    if (/^\s*(\/\/|\*|\/\*|#|>|-|\||\d+\.)/.test(line)) continue; // comment / markdown / list line
    callRe.lastIndex = 0;
    while ((m = callRe.exec(line)) !== null) {
      const name = m[2];
      if (KEYWORD_CALLS.has(name) || known(name)) continue;
      internal.add(name);
    }
  }

  // (2) imports of bare packages.
  const impRe = /(?:import\s+[^'"`;]*from\s*|import\s*|require\(\s*|import\(\s*)['"]([^'"]+)['"]/g;
  while ((m = impRe.exec(text)) !== null) {
    let spec = m[1];
    if (spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('node:') || spec.startsWith('@/') || spec.startsWith('~')) continue;
    const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
    if (NODE_BUILTINS.has(pkg) || (deps && deps.has(pkg))) continue;
    depPhantoms.push(pkg);
    const near = POPULAR.find((p) => p !== pkg && levenshtein(p, pkg) > 0 && levenshtein(p, pkg) <= 2);
    if (near) typos.push({ pkg, near });
  }
  return { internalPhantoms: [...internal], depPhantoms: [...new Set(depPhantoms)], typos };
}

function loadDeps(root) {
  const deps = new Set();
  try {
    const pj = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    for (const k of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) Object.keys(pj[k] || {}).forEach((d) => deps.add(d));
  } catch {}
  return deps;
}

// Repo audit: scan everything ADDED vs a git ref against the repo symbol index.
function auditPhantoms(root, opts = {}) {
  const ref = opts.ref || 'HEAD';
  const idx = opts.symbolIndex || buildSymbolIndex(root);
  const deps = loadDeps(root);
  const added = (opts.added != null) ? opts.added : addedLines(root, ref).join('\n');
  // Build a global importedNames set so a call imported in ANY changed file isn't flagged (coarse but low-FP).
  const allImported = new Set();
  for (const f of idx.files) for (const n of f.importedNames) allImported.add(n);
  const r = scanForPhantoms({ added, hasSymbol: idx.has, importedNames: allImported, deps });
  return { ...r, ref, scannedChars: added.length };
}

module.exports = { scanForPhantoms, auditPhantoms, loadDeps, levenshtein, NODE_BUILTINS };
