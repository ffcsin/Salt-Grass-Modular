#!/usr/bin/env node
// RBAC/tenancy regression gate. First run establishes .ecosystem/security-baseline.json. Later runs
// diff the current deep-map vs the baseline and FAIL on a new no-auth endpoint or a removed guard.
// Flags: --update (accept current posture as the new baseline).
// Usage: node bin/security-gate.js <target> [--update]
const fs = require('node:fs');
const path = require('node:path');
const { snapshot, diffSecurity, gateVerdict } = require('../src/diagnostics/security-baseline');

const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '.');
const update = process.argv.includes('--update');
const eco = path.join(root, '.ecosystem');
const dm = JSON.parse(fs.readFileSync(path.join(eco, 'deep-map.json'), 'utf8'));
const cur = snapshot(dm);
const baselinePath = path.join(eco, 'security-baseline.json');

// Auto-heal a STALE-EMPTY baseline: if a prior run snapshotted 0 endpoints (e.g. bootstrapped before the
// repo's stack was extractable) but the current map now has routes, the empty baseline is meaningless —
// refresh it instead of diffing against nothing (which would let every real endpoint slip in unguarded).
let baselineEmpty = false;
if (fs.existsSync(baselinePath)) {
  try { baselineEmpty = Object.keys(JSON.parse(fs.readFileSync(baselinePath, 'utf8')).endpoints || {}).length === 0; } catch { baselineEmpty = true; }
}
if (update || !fs.existsSync(baselinePath) || (baselineEmpty && Object.keys(cur.endpoints).length > 0)) {
  fs.writeFileSync(baselinePath, JSON.stringify(cur, null, 2) + '\n');
  const action = update ? 'baseline-updated' : (baselineEmpty ? 'baseline-refreshed (was empty)' : 'baseline-established');
  console.log(JSON.stringify({ action, endpoints: Object.keys(cur.endpoints).length, public: Object.values(cur.endpoints).filter((e) => e.public).length }));
  process.exit(0);
}

const base = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const diff = diffSecurity(base, cur);
const verdict = gateVerdict(diff);
for (const p of diff.newPublic) console.log(`🚨 NEW NO-AUTH: ${p.endpoint} ${p.wasGuarded ? '(guard REMOVED)' : '(new public endpoint)'} — ${p.file}:${p.line}`);
for (const g of diff.removedGuards) console.log(`🚨 GUARD REMOVED: ${g.endpoint} [${g.was.join(', ')}] -> [${g.now.join(', ')}] — ${g.file}:${g.line}`);
for (const t of diff.newTenancy.slice(0, 20)) console.log(`⚠️  new tenancy finding: ${t.note} — ${t.key}`);
console.log(verdict.ok ? `\n✅ no security regressions (${verdict.warnings} tenancy warning(s))` : `\n🚨 ${verdict.hardRegressions} security regression(s) — fix, or accept with --update`);
process.exit(verdict.ok ? 0 : 1);
