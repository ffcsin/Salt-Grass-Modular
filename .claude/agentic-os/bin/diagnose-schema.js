#!/usr/bin/env node
// Full schema fan-out: given a schema/model file, list its fields + every downstream usage.
// Usage: node bin/diagnose-schema.js <schema-file> [<target-root>]
const path = require('node:path');
const { analyzeSchemaFile } = require('../src/diagnostics/schema-fanout');

const file = process.argv[2];
if (!file) { console.error('usage: diagnose-schema.js <schema-file> [<root>]'); process.exit(2); }
const root = path.resolve(process.argv[3] || process.cwd());
const rel = path.isAbsolute(file) ? path.relative(root, file).replace(/\\/g, '/') : file;
const a = analyzeSchemaFile(root, rel);

console.log(`# Schema fan-out — ${rel}${a.isSchema ? '' : '  (does not look like a schema)'}`);
console.log(`${a.fields.length} fields\n`);
const rows = Object.entries(a.fanout).sort((x, y) => y[1].count - x[1].count);
for (const [field, info] of rows) {
  console.log(`- ${field}: ${info.count} file(s)${info.files.length ? ' — ' + info.files.slice(0, 8).join(', ') + (info.count > info.files.length ? ' …' : '') : ''}`);
}
