#!/usr/bin/env node
'use strict';
// Run the effective gate pack over a repo, TWO-TIER: BLOCK gates fail the run (exit 1 → the pre-push hook
// / preflight gates on it); ADVISORY gates are reported but never fail it. Uses the AI-designed
// .ecosystem/gates.config.json when present, else the deterministic split. Usage: node bin/run-gates.js <target>
const { execSync } = require('node:child_process');
const path = require('node:path');
const { resolveGates, stepCmd } = require('../src/gate-config');

const root = path.resolve(process.argv[2] || '.');
const resolved = resolveGates(root);

function runStep(s) {
  try { execSync(stepCmd(s), { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', timeout: 10 * 60 * 1000 }); return { ok: true }; }
  catch (e) { return { ok: false, out: String((e.stdout || '') + (e.stderr || e.message || '')).split('\n').slice(-15).join('\n') }; }
}

console.log(`gate source: ${resolved.source}\n`);
const failed = [];
console.log('BLOCK tier:');
for (const s of resolved.block) {
  const r = runStep(s);
  console.log(`  ${r.ok ? '✅' : '❌'} ${s.name}`);
  if (!r.ok) { failed.push(s.name); console.log((r.out || '').split('\n').map((l) => '     ' + l).join('\n')); }
}
if (resolved.advisory.length) {
  console.log('\nADVISORY tier (does not block):');
  for (const s of resolved.advisory) { const r = runStep(s); console.log(`  ${r.ok ? '✅' : '⚠️ '} ${s.name}${r.ok ? '' : ' (advisory failure)'}`); }
}
console.log(failed.length ? `\n❌ BLOCK gates failed: ${failed.join(', ')}` : '\n✅ all BLOCK gates passed');
process.exit(failed.length ? 1 : 0);
