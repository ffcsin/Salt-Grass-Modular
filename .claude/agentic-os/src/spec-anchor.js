'use strict';
// Spec-anchor: traceable spec + drift. Freezes requirements as ground truth and maps req-ID → task →
// file, then flags when shipped code drifts from the frozen spec (the #1 SDD efficiency multiplier).
// A spec markdown uses `R1:`, `R2:` ... requirement ids; tasks reference them; the edit ledger is
// diffed against the traceability map. Pure parse + set logic, zero deps.
const fs = require('node:fs');
const path = require('node:path');

// Parse a spec markdown into requirements. Lines like "- R1: the system must ..." or "### R2 ...".
function parseSpec(md) {
  const reqs = {};
  const re = /(?:^|\n)\s*(?:[-*]\s*|#+\s*)?(R\d+)[:.)\s]\s*(.+)/g;
  let m;
  while ((m = re.exec(String(md || ''))) !== null) reqs[m[1]] = { id: m[1], text: m[2].trim(), tasks: [], files: [] };
  return reqs;
}

// A traceability doc: { R1: { text, files: ['src/a.ts'], tasks: ['build X'] } }
function loadTraceability(root) {
  try { return JSON.parse(fs.readFileSync(path.join(root, '.ecosystem', 'spec', 'traceability.json'), 'utf8')); } catch { return {}; }
}
function saveTraceability(root, trace) {
  const f = path.join(root, '.ecosystem', 'spec', 'traceability.json');
  fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(trace, null, 2) + '\n'); return f;
}

// Drift: requirements with NO touched file (unimplemented) + touched files claimed by NO requirement (unplanned).
function driftCheck(trace, editedFiles) {
  const edited = new Set((editedFiles || []).map((f) => f.replace(/\\/g, '/')));
  const claimed = new Set();
  const unimplemented = [];
  for (const [id, r] of Object.entries(trace || {})) {
    const files = (r.files || []).map((f) => f.replace(/\\/g, '/'));
    files.forEach((f) => claimed.add(f));
    if (files.length && !files.some((f) => edited.has(f))) unimplemented.push({ id, text: r.text });
  }
  const unplanned = [...edited].filter((f) => claimed.size && !claimed.has(f) && /\.(ts|tsx|js|jsx)$/.test(f));
  return { unimplemented, unplanned, reqCount: Object.keys(trace || {}).length };
}

module.exports = { parseSpec, loadTraceability, saveTraceability, driftCheck };
