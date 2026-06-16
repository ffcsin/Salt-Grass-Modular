'use strict';
// Lightweight symbol index — the substrate for phantom-API detection, dependency-aware context
// packing, and PageRank repo-maps. Walks source files and extracts: per-file DEFINED symbols
// (functions/classes/consts/methods/exports), IMPORT specifiers, and identifier REFERENCES. Pure
// regex (JS/TS-first; degrades gracefully on other langs). NOT a full parser — the AST extractor
// owns route-level precision; this is the cheap, broad name-level index for relevance + existence.
const fs = require('node:fs');
const path = require('node:path');
const { walk } = require('../lib/walk');

const SRC = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
// JS globals/builtins + very common host names we should NEVER flag as undefined.
const GLOBALS = new Set(['console', 'require', 'module', 'exports', 'process', 'Buffer', '__dirname', '__filename',
  'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Promise', 'Array', 'Object', 'String', 'Number',
  'Boolean', 'Math', 'JSON', 'Date', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Symbol', 'RegExp', 'Error', 'parseInt',
  'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent', 'fetch', 'window', 'document',
  'globalThis', 'Reflect', 'Proxy', 'BigInt', 'structuredClone', 'queueMicrotask', 'URL', 'URLSearchParams',
  'TextEncoder', 'TextDecoder', 'Intl', 'Function', 'await', 'async', 'return', 'typeof', 'new', 'super', 'this',
  'if', 'for', 'while', 'switch', 'catch', 'throw', 'yield', 'void', 'delete', 'in', 'of', 'do', 'else']);

function defsIn(content) {
  const names = new Map(); // name -> first line
  const lines = String(content || '').split('\n');
  const add = (name, i) => { if (name && !names.has(name)) names.set(name, i + 1); };
  const decl = [
    /(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/,
    /(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/,
    /(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/,
    /(?:export\s+)?(?:type|interface|enum)\s+([A-Za-z_$][\w$]*)/,
  ];
  for (let i = 0; i < lines.length; i++) {
    for (const re of decl) { const m = lines[i].match(re); if (m) add(m[1], i); }
    // class-method shorthand: `  methodName(args) {`  (skip control keywords)
    const mm = lines[i].match(/^\s{2,}(?:public\s+|private\s+|protected\s+|static\s+|async\s+|get\s+|set\s+)*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*[:{]/);
    if (mm && !GLOBALS.has(mm[1])) add(mm[1], i);
    // export { a, b as c }
    const ex = lines[i].match(/export\s*\{\s*([^}]+)\}/);
    if (ex) ex[1].split(',').forEach((n) => add(n.trim().split(/\s+as\s+/).pop().trim(), i));
  }
  return names;
}

function importSpecsIn(content) {
  const specs = new Set();
  const c = String(content || '');
  for (const re of [/import\s+[^'"`;]*from\s*['"]([^'"]+)['"]/g, /import\s*\(\s*['"]([^'"]+)['"]/g, /require\(\s*['"]([^'"]+)['"]/g, /import\s*['"]([^'"]+)['"]/g]) {
    let m; while ((m = re.exec(c)) !== null) specs.add(m[1]);
  }
  return specs;
}

// Imported local identifiers (so we know which names a file legitimately uses from elsewhere).
function importedNamesIn(content) {
  const names = new Set();
  const c = String(content || '');
  let m;
  const re = /import\s+([^'"`;]+?)\s+from\s*['"][^'"]+['"]/g;
  while ((m = re.exec(c)) !== null) {
    const clause = m[1];
    const def = clause.match(/^\s*([A-Za-z_$][\w$]*)/); if (def && !/[{*]/.test(clause[0])) names.add(def[1]);
    const named = clause.match(/\{([^}]*)\}/); if (named) named[1].split(',').forEach((n) => { const x = n.trim().split(/\s+as\s+/).pop().trim(); if (x) names.add(x); });
    const ns = clause.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/); if (ns) names.add(ns[1]);
  }
  // const x = require('...')
  const rq = /(?:const|let|var)\s+(?:\{([^}]*)\}|([A-Za-z_$][\w$]*))\s*=\s*require\(/g;
  while ((m = rq.exec(c)) !== null) {
    if (m[2]) names.add(m[2]);
    if (m[1]) m[1].split(',').forEach((n) => { const x = n.trim().split(':').pop().trim(); if (x) names.add(x); });
  }
  return names;
}

function buildSymbolIndex(root, opts = {}) {
  const exts = opts.exts || SRC;
  let files = [];
  try { files = walk(root, { include: exts }); } catch {}
  files = files.filter((f) => !/\.(test|spec)\.[tj]sx?$|\.d\.ts$/.test(f));
  const defs = new Map();   // name -> [{file,line}]
  const fileRecs = [];
  for (const abs of files) {
    let content = ''; try { content = fs.readFileSync(abs, 'utf8'); } catch { continue; }
    const rel = path.relative(root, abs).replace(/\\/g, '/');
    const d = defsIn(content);
    for (const [name, line] of d) { (defs.get(name) || defs.set(name, []).get(name)).push({ file: rel, line }); }
    fileRecs.push({ file: rel, defines: new Set(d.keys()), imports: importSpecsIn(content), importedNames: importedNamesIn(content) });
  }
  return { defs, files: fileRecs, has: (name) => defs.has(name) };
}

module.exports = { buildSymbolIndex, defsIn, importSpecsIn, importedNamesIn, GLOBALS, SRC };
