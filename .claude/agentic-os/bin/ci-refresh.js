#!/usr/bin/env node
'use strict';
// ci-refresh — the self-maintenance entry point. Regenerates GitHub+GitLab CI, re-imports/critiques any
// existing CI, TESTS the gates (static probe by default; --run executes them), and clears the CI-dirty
// marker. Called automatically by the `preflight` skill when .ecosystem/.ci-dirty is non-empty, so the
// CI layer stays in sync with the repo's tooling without manual gen-ci/ci-sync runs.
// Usage: node bin/ci-refresh.js <target> [--run]
const path = require('node:path');
const { refreshCI, verifyGates, readCiDirty } = require('../src/ci-maintain');

const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '.');
const run = process.argv.includes('--run');

const dirtyBefore = readCiDirty(root);
const r = refreshCI(root, { both: true });
const gates = verifyGates(root, { run });
const broken = gates.filter((g) => g.status === 'fail' || g.status === 'no-script' || g.status === 'tool-missing');

console.log(JSON.stringify({
  refreshedBecause: dirtyBefore.length ? dirtyBefore : 'manual',
  generated: r.gen && r.gen.written,
  ciSync: r.sync && { hasExistingCI: r.sync.hasExistingCI, mirrored: r.sync.mirrored, missing: r.sync.missing },
  gatesTested: run ? 'executed' : 'probed',
  gates,
  broken: broken.map((b) => ({ gate: b.gate, status: b.status })),
}, null, 2));
process.exit(broken.some((b) => b.status === 'fail') ? 1 : 0); // a FAILING gate (real run) is non-zero; probe issues are advisory
