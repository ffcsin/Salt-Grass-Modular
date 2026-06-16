#!/usr/bin/env node
// Derive repo invariants from the deep-map and emit: executable .ecosystem/checks/<id>.cjs
// (run by preflight/CI, no external tool), .ecosystem/semgrep/<id>.yml, and .ecosystem/invariants.md.
// Usage: node bin/derive-invariants.js <target>
const fs = require('node:fs');
const path = require('node:path');
const { deriveInvariants, checkScript, semgrepRule, invariantsDoc } = require('../src/diagnostics/derive-invariants');

const root = path.resolve(process.argv[2] || '.');
const eco = path.join(root, '.ecosystem');
const dm = JSON.parse(fs.readFileSync(path.join(eco, 'deep-map.json'), 'utf8'));
const invariants = deriveInvariants(dm);

fs.mkdirSync(path.join(eco, 'checks'), { recursive: true });
fs.mkdirSync(path.join(eco, 'semgrep'), { recursive: true });
const written = [];
for (const inv of invariants) {
  const cjs = path.join(eco, 'checks', `${inv.id}.cjs`);
  fs.writeFileSync(cjs, checkScript(inv)); try { fs.chmodSync(cjs, 0o755); } catch {}
  fs.writeFileSync(path.join(eco, 'semgrep', `${inv.id}.yml`), semgrepRule(inv));
  written.push(inv.id);
}
fs.writeFileSync(path.join(eco, 'invariants.md'), invariantsDoc(invariants));
console.log(JSON.stringify({ invariants: invariants.map((i) => `${i.id}:${i.field}`), written }));
