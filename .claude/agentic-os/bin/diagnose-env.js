#!/usr/bin/env node
// Env var audit: read-but-never-set (prod risk) + set-but-never-read (dead config) -> reports/env-audit.md
// Usage: node bin/diagnose-env.js <target>
const fs = require('node:fs');
const path = require('node:path');
const { auditEnv } = require('../src/diagnostics/env-audit');

const root = path.resolve(process.argv[2] || '.');
const a = auditEnv(root);
const eco = path.join(root, '.ecosystem', 'reports');
fs.mkdirSync(eco, { recursive: true });
const md = [
  '# Env var audit', '',
  `_${a.readCount} read in code · ${a.setCount} set in .env/compose. Note: vars set only in a CI/platform dashboard show as "read-not-set" — confirm those are provisioned there._`, '',
  `## Read but never set (${a.readNotSet.length}) — provision in prod or they are undefined`, '',
  ...a.readNotSet.map((n) => `- \`${n}\``), '',
  `## Set but never read (${a.setNotRead.length}) — dead config`, '',
  ...a.setNotRead.map((n) => `- \`${n}\``),
].join('\n') + '\n';
fs.writeFileSync(path.join(eco, 'env-audit.md'), md);
console.log(JSON.stringify({ read: a.readCount, set: a.setCount, readNotSet: a.readNotSet.length, setNotRead: a.setNotRead.length }));
