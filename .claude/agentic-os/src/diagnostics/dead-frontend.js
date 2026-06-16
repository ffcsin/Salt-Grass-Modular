// src/diagnostics/dead-frontend.js
// Abandoned frontend detection (Grok: "log abandoned frontend"). Finds component/module files that
// are defined but never imported anywhere — dead FE code the agent left behind. Framework entry
// points (page/layout/route/_app/index/middleware) are NOT dead (the framework loads them by path).
// Heuristic (import-graph by file basename) — advisory.
const fs = require('node:fs');
const path = require('node:path');
const { walk } = require('../../lib/walk');

const ENTRY = /(^|\/)(page|layout|route|template|loading|error|not-found|default|_app|_document|middleware|index|main)\.[tj]sx?$/i;
const isFe = (f) => /\.(tsx|jsx)$/.test(f) || /(^|\/)(components?|hooks|contexts|pages|app|features|widgets)\//i.test(f.replace(/\\/g, '/'));

// module specifiers imported in a file: import ... from 'X'  /  require('X')  /  dynamic import('X')
function importsIn(content) {
  const specs = new Set();
  const c = String(content || '');
  for (const re of [/import\s+[^'"`]*from\s*['"]([^'"]+)['"]/g, /import\s*\(\s*['"]([^'"]+)['"]/g, /require\(\s*['"]([^'"]+)['"]/g, /import\s*['"]([^'"]+)['"]/g]) {
    let m; while ((m = re.exec(c)) !== null) specs.add(m[1]);
  }
  return specs;
}
const baseName = (f) => f.replace(/\\/g, '/').split('/').pop().replace(/\.[tj]sx?$/, '');

// Exported component/function names in a file (PascalCase + the file basename if default-exported).
function exportedNames(content, file) {
  const names = new Set();
  const c = String(content || '');
  for (const re of [/export\s+(?:default\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)/g, /export\s+(?:const|let|var|class)\s+([A-Za-z0-9_]+)/g, /export\s*\{\s*([^}]+)\}/g]) {
    let m; while ((m = re.exec(c)) !== null) m[1].split(',').forEach((n) => { const x = n.trim().split(/\s+as\s+/)[0].trim(); if (x) names.add(x); });
  }
  if (/export\s+default/.test(c)) names.add(baseName(file)); // default export ~ the file name
  return names;
}

function auditDeadFrontend(root, opts = {}) {
  const exts = opts.exts || ['.tsx', '.jsx', '.ts'];
  let files = [];
  try { files = walk(root, { include: exts }); } catch {}
  files = files.filter((f) => !/node_modules|\.(test|spec)\.|\.d\.ts/.test(f));

  // global reference sets: imported file basenames + folder names + JSX tags used
  const importedBase = new Set();
  const jsxTags = new Set();
  const cache = {};
  for (const abs of files) {
    let c = ''; try { c = cache[abs] = fs.readFileSync(abs, 'utf8'); } catch { continue; }
    for (const spec of importsIn(c)) {
      if (!/^[./~@]/.test(spec)) continue; // only local imports
      importedBase.add(baseName(spec));                 // .../Card  or  folder (barrel)
      const segs = spec.replace(/\\/g, '/').split('/'); importedBase.add(segs[segs.length - 1]); // last seg (folder for barrels)
    }
    let m; const re = /<([A-Z][A-Za-z0-9_]*)/g; while ((m = re.exec(c)) !== null) jsxTags.add(m[1]); // <Component used
  }

  const dead = [];
  for (const abs of files) {
    const rel = path.relative(root, abs).replace(/\\/g, '/');
    if (ENTRY.test(rel) || !isFe(rel)) continue;
    const bn = baseName(rel);
    if (importedBase.has(bn)) continue;                 // file imported (directly or via barrel folder)
    const names = exportedNames(cache[abs] || '', rel);
    if ([...names].some((n) => jsxTags.has(n) || importedBase.has(n))) continue; // its export is used somewhere
    dead.push(rel);
  }
  return { scanned: files.length, dead };
}

module.exports = { importsIn, baseName, exportedNames, auditDeadFrontend };
