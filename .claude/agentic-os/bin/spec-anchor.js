#!/usr/bin/env node
'use strict';
// Spec-anchor: parse a spec into traceability, or check drift vs the edit ledger.
//   node bin/spec-anchor.js <target> init <spec.md>
//   node bin/spec-anchor.js <target> drift
const fs = require('node:fs'); const path = require('node:path');
const S = require('../src/spec-anchor');
const { loadEdits } = require('../src/edit-ledger');
const root = path.resolve(process.argv[2] || '.');
const cmd = process.argv[3] || 'drift';
if (cmd === 'init') {
  let md = ''; try { md = fs.readFileSync(process.argv[4], 'utf8'); } catch {}
  const reqs = S.parseSpec(md);
  S.saveTraceability(root, reqs);
  console.log(`parsed ${Object.keys(reqs).length} requirement(s) -> .ecosystem/spec/traceability.json (add files[] per req)`);
} else {
  const d = S.driftCheck(S.loadTraceability(root), loadEdits(root).map((e) => (e.file || '').replace(root.replace(/\/g,'/') + '/', '')));
  console.log(JSON.stringify(d, null, 2));
}
