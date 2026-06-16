#!/usr/bin/env node
// Merge inventory sources (workflow task-outputs or raw inventory JSONs) into the deep-map, compute
// the coverage + completeness gates, and prepare the NEXT workflow script if a gate fails.
// Prints a JSON signal: GAPFILL_NEEDED | REEXTRACT_NEEDED | CONVERGED.
// Usage: node bin/deep-merge.js <target> <source.json> [<source2.json> ...]
const fs = require('node:fs');
const path = require('node:path');
const { mergeFromSources } = require('../src/deep-merge');
const { batchFiles } = require('../src/deep-select');
const { genSweepScript, genReextractScript } = require('../src/deep-scripts');

const root = path.resolve(process.argv[2] || '.');
const sources = process.argv.slice(3);
if (!sources.length) { console.error('usage: deep-merge.js <target> <source.json>...'); process.exit(2); }

const lineCount = (f) => { try { return fs.readFileSync(path.join(root, f), 'utf8').split('\n').length; } catch { return 0; } };
const { deepMap, missing, undercounts, expectedCount } = mergeFromSources(root, sources);
const deep = path.join(root, '.ecosystem', '.deep');

let gapfillScript = null, reextractScript = null;
if (missing.length) {
  gapfillScript = genSweepScript(batchFiles(missing.map((f) => ({ f, n: lineCount(f) }))), path.join(deep, 'gapfill.js'));
} else if (undercounts.length) {
  reextractScript = genReextractScript(undercounts.map((u) => ({ f: u.f || u, n: lineCount(u.f || u) })), path.join(deep, 'reextract.js'));
}
const signal = missing.length ? 'GAPFILL_NEEDED' : (undercounts.length ? 'REEXTRACT_NEEDED' : 'CONVERGED');
console.log(JSON.stringify({ signal, files: deepMap.files.length, expected: expectedCount, missing: missing.length, undercounts: undercounts.length, gapfillScript, reextractScript }));
