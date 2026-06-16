#!/usr/bin/env node
// Emit the FE↔BE param-mismatch review list from the deep-map.
// Usage: node bin/diagnose-params.js <target>
const fs = require('node:fs');
const path = require('node:path');
const { findParamMismatches } = require('../src/diagnostics/param-mismatch');

const root = path.resolve(process.argv[2] || '.');
const eco = path.join(root, '.ecosystem');
const dm = JSON.parse(fs.readFileSync(path.join(eco, 'deep-map.json'), 'utf8'));
const m = findParamMismatches(dm);
const withMissing = m.filter((x) => x.missingInCall.length);

const lines = [
  '# FE↔BE parameter mismatches (advisory)', '',
  `_${m.length} potential mismatches (${withMissing.length} omit a declared field). Low-confidence review list — deep-map params are not a guaranteed-complete contract; verify against code._`, '',
  ...m.map((x) => `- \`${x.method} ${x.route.replace(/^(GET|POST|PUT|DELETE|PATCH|ANY) /, '')}\` — call \`${x.call.file}:${x.call.line}\` vs route \`${x.endpoint.file}:${x.endpoint.line}\`` +
    (x.missingInCall.length ? ` · MISSING ${x.missingInCall.join(', ')}` : '') +
    (x.extraInCall.length ? ` · EXTRA ${x.extraInCall.join(', ')}` : '')),
];
fs.mkdirSync(path.join(eco, 'reports'), { recursive: true });
fs.writeFileSync(path.join(eco, 'reports', 'param-mismatches.md'), lines.join('\n') + '\n');
console.log(JSON.stringify({ total: m.length, withMissing: withMissing.length }));
