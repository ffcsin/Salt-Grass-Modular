#!/usr/bin/env node
const path = require('node:path');
const { runCritique } = require('../src/critique');
const root = path.resolve(process.argv[2] || '.');
try {
  const c = runCritique(root);
  if (c.resolvedOrphans.length) console.log(`✓ ${c.resolvedOrphans.length} orphan(s) resolved`);
  if (c.regressions.length === 0) { console.log('✓ critique: no regressions'); process.exit(0); }
  console.error('✗ critique regressions:');
  for (const r of c.regressions) console.error('  - ' + r);
  process.exit(1);
} catch (e) { console.error('critique failed:', e.message); process.exit(2); }
