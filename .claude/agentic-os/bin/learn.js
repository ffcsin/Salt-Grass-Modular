#!/usr/bin/env node
'use strict';
// CLI for the per-repo learning ledger. Skills/agents and humans append what the repo teaches them;
// it surfaces back into pre-edit context (relevant learnings for the area being edited).
//   learn add --type gotcha --text "..." [--area X] [--file path] [--source skill:diagnose-bug]
//   learn list [--type gotcha]
//   learn render            # writes .ecosystem/learnings.md
const path = require('node:path');
const L = require('../src/learnings');

function parseFlags(argv) {
  const o = {}; for (let i = 0; i < argv.length; i++) { if (argv[i].startsWith('--')) { o[argv[i].slice(2)] = argv[i + 1]; i++; } } return o;
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const root = path.resolve(process.env.AGENTIC_OS_TARGET || '.');
  const f = parseFlags(rest);
  if (cmd === 'add') {
    const rec = L.recordLearning(root, { type: f.type, text: f.text, area: f.area, file: f.file, source: f.source || 'cli', ts: new Date().toISOString() });
    L.renderLearnings(root);
    console.log(rec ? `learned (${rec.type}): ${rec.text}` : 'skipped (duplicate or empty)');
  } else if (cmd === 'list') {
    const all = L.loadLearnings(root).filter((l) => !f.type || l.type === f.type);
    if (!all.length) { console.log('no learnings yet'); return; }
    for (const l of all) console.log(`- (${l.type})${l.area ? ` [${l.area}]` : ''} ${l.text}`);
  } else if (cmd === 'render') {
    console.log('wrote ' + L.renderLearnings(root));
  } else {
    console.log('usage: learn add|list|render  (set AGENTIC_OS_TARGET or run from repo root)');
    process.exit(cmd ? 1 : 0);
  }
}
main();
