// lib/walk.js
const fs = require('node:fs');
const path = require('node:path');

// '.claude' is tooling (hooks/bumpers + the vendored agentic-os runtime copy), never app surface —
// scanning it made the runtime's OWN extractor source show up as FE calls (its docstrings contain
// `trpc:ns.proc`, which matches the trpc call regex).
const DEFAULT_SKIP = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage', '.ecosystem', '.claude',
  '.vercel', '.turbo', '.astro', '.output', 'out', '.cache', '.svelte-kit', '.parcel-cache', 'vendor', '__pycache__']);

function walk(dir, { include = [], skip = DEFAULT_SKIP, _out = [] } = {}) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return _out;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (skip.has(entry.name)) continue;
      walk(path.join(dir, entry.name), { include, skip, _out });
    } else if (entry.isFile()) {
      if (include.length === 0 || include.some((ext) => entry.name.endsWith(ext))) {
        _out.push(path.join(dir, entry.name));
      }
    }
  }
  return _out;
}

module.exports = { walk, DEFAULT_SKIP };
