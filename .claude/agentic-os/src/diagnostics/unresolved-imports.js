'use strict';
// Hallucinated-import detector — the #1 documented AI-coding failure mode of 2026: the agent writes
// `import { foo } from './bar'` (or `require('../baz')`) referencing a LOCAL module it invented, which
// type-checking-off + lint-light repos miss until runtime. This resolves every RELATIVE import in a
// just-edited JS/TS file against the filesystem (trying the usual extensions + /index) and flags the
// ones that point at nothing. Relative-only on purpose: package imports need the module graph (npm/go
// mod) which the phantom-dep guard already covers; relative imports are deterministically checkable.
// Go: same idea for local-package imports under the module root is harder (needs go.mod path), so v1
// is JS/TS where the bulk of hallucinated-module bugs live.
const fs = require('node:fs');
const path = require('node:path');

const EXTS = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.node'];
// import ... from '…' | require('…') | dynamic import('…') | export ... from '…'
const IMPORT_RE = /(?:import\b[^'"]*?from\s*|export\b[^'"]*?from\s*|require\s*\(\s*|import\s*\(\s*)["'](\.[^"']+)["']/g;

function resolves(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const e of EXTS) { try { if (fs.statSync(base + e).isFile()) return true; } catch {} }
  // directory import → index.*
  for (const e of EXTS.filter(Boolean)) { try { if (fs.statSync(path.join(base, 'index' + e)).isFile()) return true; } catch {} }
  try { if (fs.statSync(base).isDirectory()) { // a dir with a package.json main, or any index handled above
    const pj = path.join(base, 'package.json'); if (fs.existsSync(pj)) return true; } } catch {}
  return false;
}

// content optional — if absent, read from disk. absFile = absolute path of the edited file.
function scanUnresolvedImports(absFile, content) {
  const f = String(absFile || '');
  if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f)) return [];
  let src = content;
  if (src == null) { try { src = fs.readFileSync(f, 'utf8'); } catch { return []; } }
  const bad = [];
  const seen = new Set();
  for (const m of String(src).matchAll(IMPORT_RE)) {
    const spec = m[1];
    if (seen.has(spec)) continue; seen.add(spec);
    if (!resolves(f, spec)) bad.push(spec);
  }
  return bad;
}

module.exports = { scanUnresolvedImports, resolves };
