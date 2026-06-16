#!/usr/bin/env node
// Scan the repo for async correctness bugs (await-in-non-async, then-without-catch) -> reports.
// Usage: node bin/diagnose-async.js <target>
const fs = require('node:fs');
const path = require('node:path');
const { walk } = require('../lib/walk');
const { scanAsyncBugs } = require('../src/diagnostics/async-bugs');

const root = path.resolve(process.argv[2] || '.');
let files = [];
try { files = walk(root, { include: ['.ts', '.tsx', '.js', '.jsx', '.mjs'] }); } catch {}
const rows = [];
for (const abs of files) {
  if (/node_modules|\.(test|spec)\./.test(abs)) continue;
  let c = ''; try { c = fs.readFileSync(abs, 'utf8'); } catch { continue; }
  for (const b of scanAsyncBugs(c, abs)) rows.push({ file: path.relative(root, abs).replace(/\\/g, '/'), ...b });
}
const eco = path.join(root, '.ecosystem', 'reports');
fs.mkdirSync(eco, { recursive: true });
fs.writeFileSync(path.join(eco, 'async-bugs.md'),
  [`# Async correctness candidates (${rows.length})`, '', '_await-in-non-async (AST, high-confidence) + then-without-catch (heuristic). Verify each._', '',
    ...rows.map((r) => `- [${r.kind}] \`${r.file}:${r.line}\``)].join('\n') + '\n');
console.log(JSON.stringify({ candidates: rows.length, byKind: rows.reduce((a, r) => ((a[r.kind] = (a[r.kind] || 0) + 1), a), {}) }));
