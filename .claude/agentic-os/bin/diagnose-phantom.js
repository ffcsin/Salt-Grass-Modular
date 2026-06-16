#!/usr/bin/env node
'use strict';
// Phantom-API / hallucinated-dependency audit of the current diff -> reports/phantom-api.md
// Usage: node bin/diagnose-phantom.js <target> [gitRef]
const fs = require('node:fs'); const path = require('node:path');
const { auditPhantoms } = require('../src/diagnostics/phantom-api');
const root = path.resolve(process.argv[2] || '.');
const r = auditPhantoms(root, { ref: process.argv[3] || 'HEAD' });
const dir = path.join(root, '.ecosystem', 'reports'); fs.mkdirSync(dir, { recursive: true });
const lines = [`# Phantom-API / hallucinated-dependency scan (diff vs ${r.ref})`, '',
  '_Calls to names defined nowhere in the repo, and imports of packages not in package.json. Heuristic — a flag may be a method on an external object or a just-added local. Verify before trusting._', ''];
lines.push(`## Possibly-invented internal calls (${r.internalPhantoms.length})`, '', ...(r.internalPhantoms.length ? r.internalPhantoms.map((n) => `- \`${n}(...)\` — not defined in repo, not imported, not a JS global`) : ['_none_']), '');
lines.push(`## Unverified new dependencies (${r.depPhantoms.length})`, '', ...(r.depPhantoms.length ? r.depPhantoms.map((p) => `- \`${p}\` — not in package.json (verify it exists on the registry before installing)`) : ['_none_']), '');
if (r.typos.length) lines.push(`## ⚠ Possible typosquats (${r.typos.length})`, '', ...r.typos.map((t) => `- \`${t.pkg}\` is 1-2 chars from popular \`${t.near}\` — confirm you meant this`), '');
fs.writeFileSync(path.join(dir, 'phantom-api.md'), lines.join('\n') + '\n');
console.log(JSON.stringify({ internalPhantoms: r.internalPhantoms.length, depPhantoms: r.depPhantoms.length, typos: r.typos.length }));
