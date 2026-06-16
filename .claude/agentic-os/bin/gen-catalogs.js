#!/usr/bin/env node
'use strict';
// Generate the reference catalogs (crons / webhooks / collections / env-vars / tier-gates / FE
// surfaces) under <target>/.ecosystem/reference/ — the reference-parity reference layer.
//   node bin/gen-catalogs.js <target>
const fs = require('node:fs'); const path = require('node:path');
const C = require('../src/catalogs');
const root = path.resolve(process.argv[2] || '.');
const dir = path.join(root, '.ecosystem', 'reference'); fs.mkdirSync(dir, { recursive: true });
const cat = C.buildCatalogs(root);
const w = (name, md) => fs.writeFileSync(path.join(dir, name), md + '\n');
const cite = (x) => `\`${x.file}:${x.line}\``;

w('crons.md', [`# Crons (${cat.crons.length})`, '', '| schedule | method | source |', '|---|---|---|',
  ...cat.crons.map((c) => `| \`${c.schedule}\` | ${c.method || '?'} | ${cite(c)} |`)].join('\n'));
w('webhooks.md', [`# Webhooks (${cat.webhooks.length})`, '', '| method | route | sig-verified | source |', '|---|---|---|---|',
  ...cat.webhooks.map((h) => `| ${h.method} | \`${h.route}\` | ${h.signatureVerified ? '✅' : '⚠️ none found'} | ${cite(h)} |`)].join('\n'));
w('collections.md', [`# Collections (${cat.collections.length})`, '', '| collection | reads | writes | files |', '|---|---|---|---|',
  ...cat.collections.map((c) => `| \`${c.name}\` | ${c.reads} | ${c.writes} | ${c.files.length} |`)].join('\n'));
w('env-vars.md', [`# Env vars (${cat.envVars.length})`, '', '| var | reads | first file |', '|---|---|---|',
  ...cat.envVars.map((e) => `| \`${e.name}\` | ${e.reads} | \`${e.files[0] || ''}\` |`)].join('\n'));
// tier-gates index by tier + feature
const byTier = {}, byFeature = {};
for (const g of cat.gates) { const b = g.grp === 'tier' ? byTier : byFeature; (b[g.value] = b[g.value] || []).push({ file: g.file, line: g.line, kind: g.kind }); }
fs.writeFileSync(path.join(dir, 'tier-gates.json'), JSON.stringify({ totalGates: cat.gates.length, byTier, byFeature }, null, 2) + '\n');
fs.writeFileSync(path.join(dir, 'fe-surfaces.json'), JSON.stringify({ surfaces: cat.feSurfaces.length, totalButtons: cat.feSurfaces.reduce((s, x) => s + x.buttons.length, 0), data: cat.feSurfaces }, null, 2) + '\n');

console.log(JSON.stringify({ crons: cat.crons.length, webhooks: cat.webhooks.length, collections: cat.collections.length, envVars: cat.envVars.length, gates: cat.gates.length, feSurfaces: cat.feSurfaces.length }));
