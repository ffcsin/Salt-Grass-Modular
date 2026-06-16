#!/usr/bin/env node
'use strict';
// Secret scan of the current diff -> reports/secrets.md (+ nonzero exit if live secrets found).
// Usage: node bin/diagnose-secrets.js <target> [gitRef]
const fs = require('node:fs'); const path = require('node:path');
const { scanSecrets, loadBaseline } = require('../src/diagnostics/secret-scan');
const { addedLines } = require('../lib/git');
const root = path.resolve(process.argv[2] || '.');
const added = addedLines(root, process.argv[3] || 'HEAD').join('\n');
const hits = scanSecrets(added, { baseline: loadBaseline(root) });
const dir = path.join(root, '.ecosystem', 'reports'); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'secrets.md'),
  [`# Secret scan (${hits.length} finding(s) in the diff)`, '', '_Add a fingerprint to `.ecosystem/secrets-baseline.json` to suppress a reviewed false positive._', '',
   ...hits.map((h) => `- **${h.desc}** (line ${h.line}) \`${h.match}\` — fp \`${h.fingerprint}\``)].join('\n') + '\n');
console.log(JSON.stringify({ findings: hits.length }));
process.exit(hits.length ? 2 : 0);
