#!/usr/bin/env node
// Test-to-endpoint coverage map -> reports/test-coverage.md. Usage: node bin/diagnose-coverage.js <target>
const fs = require('node:fs'); const path = require('node:path');
const { buildCoverage } = require('../src/diagnostics/test-coverage');
const root = path.resolve(process.argv[2] || '.');
const dm = JSON.parse(fs.readFileSync(path.join(root, '.ecosystem', 'deep-map.json'), 'utf8'));
const c = buildCoverage(root, dm);
const eco = path.join(root, '.ecosystem', 'reports'); fs.mkdirSync(eco, { recursive: true });
fs.writeFileSync(path.join(eco, 'test-coverage.md'),
  [`# Endpoint test coverage`, '', `_${c.testFiles} test files · ${c.endpoints} endpoints · ${(c.coverageRate*100).toFixed(0)}% referenced in tests · ${c.untested.length} untested. Heuristic (path/needle appears in a test) — advisory._`, '',
   '## Untested endpoints', '', ...c.untested.slice(0,600).map((e)=>`- \`${e.id}\` — ${e.file}:${e.line}`)].join('\n')+'\n');
console.log(JSON.stringify({ testFiles: c.testFiles, endpoints: c.endpoints, coverageRatePct: Math.round(c.coverageRate*100), untested: c.untested.length }));
