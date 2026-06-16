#!/usr/bin/env node
'use strict';
// Token budget. set: write a ceiling. check: compare a transcript's spend to it.
//   node bin/budget.js <target> set --limit 500000
//   node bin/budget.js <target> check --transcript <path>
const fs = require('node:fs'); const path = require('node:path');
const B = require('../src/budget');
const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '.');
const cmd = process.argv[3] || 'check';
const args = process.argv.slice(3);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
if (cmd === 'set') {
  const f = path.join(root, '.ecosystem', 'budget.json'); fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ tokenLimit: parseInt(flag('--limit'), 10) || 0, warnAt: parseFloat(flag('--warn')) || 0.8 }, null, 2) + '\n');
  console.log('budget set');
} else { console.log(B.budgetNudge(root, flag('--transcript')) || 'within budget (or no budget/transcript set)'); }
