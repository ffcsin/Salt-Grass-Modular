#!/usr/bin/env node
'use strict';
// Golden-set regression gate. Cases live in .ecosystem/golden/cases.json:
//   [{ "name": "health", "cmd": "node bin/health.js", "expected": {...} }]
// Each case runs `cmd`, JSON-parses stdout, and diffs vs `expected`.
//   node bin/golden.js <target>            run + gate (exit 1 on regression)
//   node bin/golden.js <target> --record   capture current outputs as the new baseline
const fs = require('node:fs'); const path = require('node:path');
const { execSync } = require('node:child_process');
const { checkCase } = require('../src/verify/golden');
const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '.');
const record = process.argv.includes('--record');
const file = path.join(root, '.ecosystem', 'golden', 'cases.json');
let cases = []; try { cases = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { console.log('no .ecosystem/golden/cases.json — create one with [{name,cmd,expected}]'); process.exit(0); }

function runOne(c) { try { return JSON.parse(execSync(c.cmd, { cwd: root, encoding: 'utf8', timeout: 60000 })); } catch (e) { return { __error: String(e.message).slice(0, 200) }; } }

if (record) {
  for (const c of cases) c.expected = runOne(c);
  fs.writeFileSync(file, JSON.stringify(cases, null, 2) + '\n');
  console.log(`recorded ${cases.length} golden baseline(s)`); process.exit(0);
}
let failed = 0;
const lines = ['# Golden-set regression', ''];
for (const c of cases) {
  const actual = runOne(c);
  const r = checkCase(c, actual);
  lines.push(`- ${r.pass ? '✅' : '❌'} ${c.name}` + (r.pass ? '' : `\n` + r.diffs.slice(0, 8).map((d) => `    - \`${d.path}\`: expected ${JSON.stringify(d.expected)} got ${JSON.stringify(d.actual)}`).join('\n')));
  if (!r.pass) failed++;
}
const dir = path.join(root, '.ecosystem', 'reports'); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'golden.md'), lines.join('\n') + '\n');
console.log(JSON.stringify({ cases: cases.length, failed }));
process.exit(failed ? 1 : 0);
