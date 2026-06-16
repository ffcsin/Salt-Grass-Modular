#!/usr/bin/env node
'use strict';
// Behavioral-diff review of the current diff -> highlights only behavior-changing hunks.
// Usage: node bin/behavioral-diff.js <target> [gitRef]
const fs = require('node:fs'); const path = require('node:path');
const { classifyDiff } = require('../src/verify/behavioral-diff');
const { diffText } = require('../lib/git');
const root = path.resolve(process.argv[2] || '.');
const res = classifyDiff(diffText(root, process.argv[3] || 'HEAD'));
const behavioral = res.filter((r) => r.kind === 'behavioral');
const dir = path.join(root, '.ecosystem', 'reports'); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'behavioral-diff.md'),
  ['# Behavioral diff', '', `_${behavioral.length} of ${res.length} changed files have BEHAVIORAL changes; the rest are neutral (whitespace/comment/rename). Review the behavioral ones first._`, '',
   ...res.map((r) => `- ${r.kind === 'behavioral' ? '⚠ BEHAVIORAL' : (r.kind === 'rename' ? '· rename' : '· neutral')} \`${r.file}\` — ${r.detail}`)].join('\n') + '\n');
console.log(JSON.stringify({ files: res.length, behavioral: behavioral.length }));
