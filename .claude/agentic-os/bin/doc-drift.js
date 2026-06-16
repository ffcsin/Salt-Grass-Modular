#!/usr/bin/env node
// Check the deep-map's file:line citations against current code; log drift to DOC_DRIFT_LOG.md.
// Advisory (exit 0) unless drift exceeds --fail-over <pct> (then exit 1 — the map needs a refresh).
// Usage: node bin/doc-drift.js <target> [--sample N] [--fail-over PCT]
const fs = require('node:fs');
const path = require('node:path');
const { collectCitations, checkCitations, sample, driftLogMarkdown } = require('../src/diagnostics/doc-drift');

const args = process.argv.slice(2);
const root = path.resolve(args.find((a) => !a.startsWith('--')) || '.');
const sampleN = Number((args[args.indexOf('--sample') + 1]) || 3000);
const failOver = args.includes('--fail-over') ? Number(args[args.indexOf('--fail-over') + 1]) : null;
const eco = path.join(root, '.ecosystem');
const dm = JSON.parse(fs.readFileSync(path.join(eco, 'deep-map.json'), 'utf8'));

const cites = collectCitations(dm);
const result = checkCitations(root, sample(cites, sampleN));
let existing = '';
try { existing = fs.readFileSync(path.join(eco, 'DOC_DRIFT_LOG.md'), 'utf8'); } catch {}
fs.writeFileSync(path.join(eco, 'DOC_DRIFT_LOG.md'), driftLogMarkdown(result, existing));

const pct = (result.driftRate * 100).toFixed(1);
console.log(JSON.stringify({ citations: cites.length, checked: result.checked, drifted: result.drifted.length, driftRatePct: Number(pct) }));
if (failOver != null && result.driftRate * 100 > failOver) { console.error(`drift ${pct}% > ${failOver}% — refresh the map`); process.exit(1); }
