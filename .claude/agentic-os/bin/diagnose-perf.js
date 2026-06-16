#!/usr/bin/env node
// Performance anti-pattern scan -> reports/perf-audit.md. Usage: node bin/diagnose-perf.js <target>
const fs = require('node:fs'); const path = require('node:path');
const { auditPerf } = require('../src/diagnostics/perf-audit');
const root = path.resolve(process.argv[2] || '.');
const a = auditPerf(root);
const eco = path.join(root, '.ecosystem', 'reports'); fs.mkdirSync(eco, { recursive: true });
fs.writeFileSync(path.join(eco, 'perf-audit.md'),
  [`# Performance & scalability candidates (${a.total})`, '', `_${JSON.stringify(a.byKind)}. Heuristic — verify each._`, '',
   ...a.hits.slice(0,800).map((h)=>`- [${h.kind}] \`${h.file}:${h.line}\` — ${h.note}`)].join('\n')+'\n');
console.log(JSON.stringify({ total: a.total, byKind: a.byKind }));
