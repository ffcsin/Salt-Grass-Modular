#!/usr/bin/env node
// Generate the exact Grok-spec ecosystem folder taxonomy (routes/ auth/ security/ warnings/ orphans/
// decisions/ intentions/) with per-folder 5-section index.md, from the deep-map + dead-frontend.
// Usage: node bin/gen-grok-layout.js <target>
const fs = require('node:fs'); const path = require('node:path');
const { renderLayout } = require('../src/ecosystem-layout');
const { auditDeadFrontend } = require('../src/diagnostics/dead-frontend');
const root = path.resolve(process.argv[2] || '.');
const eco = path.join(root, '.ecosystem');
const dm = JSON.parse(fs.readFileSync(path.join(eco, 'deep-map.json'), 'utf8'));
const dead = auditDeadFrontend(root).dead;
const date = new Date().toISOString().slice(0, 10);
const files = renderLayout(dm, { date, deadFrontend: dead });
let n = 0;
for (const [rel, content] of Object.entries(files)) {
  const full = path.join(eco, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content); n++;
}
console.log(JSON.stringify({ written: n, folders: ['routes', 'auth', 'security', 'warnings', 'orphans', 'decisions', 'intentions'], deadFrontend: dead.length }));
