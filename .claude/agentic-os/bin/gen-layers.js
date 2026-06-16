#!/usr/bin/env node
// Emit the doc layers from the deep-map: warnings/orphans + warnings/parked (sign-off ledger) +
// the ADR scaffold. Contributors have their own bin.  Usage: node bin/gen-layers.js <target>
const fs = require('node:fs');
const path = require('node:path');
const { buildWarnings, orphansMarkdown, parkedScaffold } = require('../src/warnings');
const { adrTemplate, adrReadme } = require('../src/adr');

const root = path.resolve(process.argv[2] || '.');
const eco = path.join(root, '.ecosystem');
const dm = JSON.parse(fs.readFileSync(path.join(eco, 'deep-map.json'), 'utf8'));

// warnings
const w = buildWarnings(dm);
fs.mkdirSync(path.join(eco, 'warnings'), { recursive: true });
fs.writeFileSync(path.join(eco, 'warnings', 'orphans.md'), orphansMarkdown(w));
const parkedPath = path.join(eco, 'warnings', 'parked.md');
let existingParked = '';
try { existingParked = fs.readFileSync(parkedPath, 'utf8'); } catch {}
fs.writeFileSync(parkedPath, parkedScaffold(existingParked));

// ADR scaffold (create-only — never clobber existing ADRs)
const adrDir = path.join(eco, 'adr');
fs.mkdirSync(adrDir, { recursive: true });
if (!fs.existsSync(path.join(adrDir, '0000-template.md'))) fs.writeFileSync(path.join(adrDir, '0000-template.md'), adrTemplate());
if (!fs.existsSync(path.join(adrDir, 'README.md'))) fs.writeFileSync(path.join(adrDir, 'README.md'), adrReadme());

console.log(JSON.stringify({ orphanRoutes: w.orphanRoutes.length, unmatchedCalls: w.unmatchedCalls.length, deadCode: w.deadCode.length, adrScaffolded: true }));
