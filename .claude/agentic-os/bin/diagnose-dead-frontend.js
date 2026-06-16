#!/usr/bin/env node
// Abandoned frontend (dead components never imported/used) -> reports/dead-frontend.md
// Usage: node bin/diagnose-dead-frontend.js <target>
const fs = require('node:fs'); const path = require('node:path');
const { auditDeadFrontend } = require('../src/diagnostics/dead-frontend');
const root = path.resolve(process.argv[2] || '.');
const a = auditDeadFrontend(root);
const eco = path.join(root, '.ecosystem', 'reports'); fs.mkdirSync(eco, { recursive: true });
fs.writeFileSync(path.join(eco, 'dead-frontend.md'),
  [`# Abandoned frontend (${a.dead.length} of ${a.scanned} scanned)`, '', `_Component/module files never imported and whose export is never used as a JSX tag. Entry points (page/layout/route) excluded. Heuristic — verify before deleting (dynamic imports/lazy loading can hide a use)._`, '',
   ...a.dead.slice(0,600).map((d)=>`- \`${d}\``)].join('\n')+'\n');
console.log(JSON.stringify({ scanned: a.scanned, dead: a.dead.length }));
