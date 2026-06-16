#!/usr/bin/env node
// Cross-store write-consistency scan — find functions that write 2+ datastores with no shared
// atomicity (the "N DBs holding overlapping data, they drift" problem). Writes
// .ecosystem/reports/store-consistency.md. Usage: node bin/diagnose-store-consistency.js <target>
const fs = require('node:fs');
const path = require('node:path');
const { walk } = require('../lib/walk');
const { scanStoreConsistency, STORES } = require('../src/diagnostics/store-consistency');

const root = path.resolve(process.argv[2] || '.');
let files = [];
try { files = walk(root, { include: ['.go', '.ts', '.tsx', '.js', '.jsx', '.mjs'] }); } catch {}

const rows = [];
for (const abs of files) {
  const rel = path.relative(root, abs).replace(/\\/g, '/');
  if (/node_modules|\/vendor\/|_test\.go$|\.(test|spec)\.|\/generated\//.test(rel)) continue;
  let c = ''; try { c = fs.readFileSync(abs, 'utf8'); } catch { continue; }
  if (!/INSERT|UPDATE|DELETE|ExecuteWrite|CreateTransfers|CreateAccounts|MERGE|InsertOne|PutItem/.test(c)) continue; // cheap prefilter
  for (const r of scanStoreConsistency(c, rel)) rows.push(r);
}

const sev = { High: 0, Medium: 1, Low: 2 };
rows.sort((a, b) => sev[a.severity] - sev[b.severity] || b.stores.length - a.stores.length);
const counts = rows.reduce((a, r) => ((a[r.severity] = (a[r.severity] || 0) + 1), a), {});

const eco = path.join(root, '.ecosystem', 'reports');
fs.mkdirSync(eco, { recursive: true });
const lbl = (id) => (STORES.find((s) => s.id === id) || { label: id }).label;
const md = [
  `# Cross-store write consistency (${rows.length} multi-store write paths)`,
  '',
  '_Functions that WRITE 2+ datastores. A write path with no outbox and no compensation is a drift hazard:',
  'a partial failure leaves the stores inconsistent. **Hypotheses — verify each against the real call frame**',
  '(a guard may live one level up). A PG transaction does NOT make non-SQL stores atomic._',
  '',
  `**High ${counts.High || 0} · Medium ${counts.Medium || 0} · Low ${counts.Low || 0}**`,
  '',
  '| Sev | Stores | Guard | Function | Location |',
  '|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.severity} | ${r.stores.map(lbl).join(' + ')} | ${r.pattern} | \`${r.fn}\` | \`${r.file}:${r.line}\` |`),
  '',
  '## Notes',
  ...rows.filter((r) => r.note).map((r) => `- \`${r.fn}\` (${r.file}:${r.line}) — ${r.note}`),
].join('\n');
fs.writeFileSync(path.join(eco, 'store-consistency.md'), md + '\n');

console.log(JSON.stringify({ multiStorePaths: rows.length, ...counts, report: '.ecosystem/reports/store-consistency.md' }));
