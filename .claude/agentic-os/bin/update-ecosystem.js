#!/usr/bin/env node
'use strict';
// Incremental ecosystem refresh — keep the map current as the repo changes. ZERO agents = free,
// so it's safe to run on a hook (Stop) or by hand after a batch of edits. It refreshes everything
// DETERMINISTIC: the structural map (routes/guards/params/orphans/mismatches via AST), the human
// views (learnings.md, edit-ledger.md), and clears the dirty set's deterministic debt.
//
// What it does NOT do: the agentic deep re-extract (semantic API-call/intent enrichment) — that
// costs tokens and stays at `preflight`. So: edits → this keeps structure live for free → preflight
// tops up the semantic layer before a push. `.dirty.json` is the handoff between the two.
const fs = require('node:fs');
const path = require('node:path');

function main(root, opts = {}) {
  const eco = path.join(root, '.ecosystem');
  if (!fs.existsSync(path.join(eco, 'extractor.config.json'))) {
    console.error('no .ecosystem/extractor.config.json — run bootstrap first'); process.exit(1);
  }
  let dirty = [];
  try { dirty = JSON.parse(fs.readFileSync(path.join(eco, '.dirty.json'), 'utf8')); } catch {}

  // 1. Structural map (deterministic) — refreshes routes/guards/params/orphans/mismatches/accuracy.
  const { runPipeline } = require('./map.js');
  const { report } = runPipeline(root);

  // 2. Re-render human views (free).
  let rendered = [];
  try { rendered.push(path.basename(require('../src/learnings').renderLearnings(root))); } catch {}
  try { rendered.push(path.basename(require('../src/edit-ledger').renderLedger(root))); } catch {}

  // 3. Re-render the categorized folder layout if a deep map exists (still deterministic).
  let layout = 0;
  try {
    const dmPath = path.join(eco, 'deep-map.json');
    if (fs.existsSync(dmPath)) {
      const deepMap = JSON.parse(fs.readFileSync(dmPath, 'utf8'));
      const { renderLayout } = require('../src/ecosystem-layout');
      let deadFrontend = null;
      try { deadFrontend = require('../src/diagnostics/dead-frontend').auditDeadFrontend(root); } catch {}
      const files = renderLayout(deepMap, { deadFrontend });
      for (const [rel, content] of Object.entries(files)) {
        const out = path.join(eco, rel);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, content);
        layout++;
      }
    }
  } catch {}

  // 4. Refresh reference catalogs + tool-audit docs (deterministic). gen-audits PRESERVES any
  //    agent-enriched prose (additive — never clobbers the depth), so this is safe to run on refresh.
  let catalogs = false, audits = false;
  if (opts.full !== false) {
    try { require('node:child_process').execFileSync('node', [path.join(__dirname, 'gen-catalogs.js'), root], { stdio: 'ignore' }); catalogs = true; } catch {}
    try { if (fs.existsSync(path.join(eco, 'deep-map.json'))) { require('node:child_process').execFileSync('node', [path.join(__dirname, 'gen-audits.js'), root], { stdio: 'ignore' }); audits = true; } } catch {}
  }

  // 5. The deterministic debt of the dirty set is now paid. Keep the list as a SEMANTIC todo for
  //    preflight's deep re-extract (don't clear it — preflight owns that), but stamp the refresh.
  fs.writeFileSync(path.join(eco, '.last-refresh.json'), JSON.stringify({ ts: new Date().toISOString(), dirtyAtRefresh: dirty.length }) + '\n');

  console.log(`ecosystem refreshed — structural map (drift ${(report.maxDrift * 100).toFixed(1)}%), ${rendered.length} view(s), ${layout} layout file(s)${catalogs ? ', catalogs' : ''}${audits ? ', audits (enrichment preserved)' : ''}.` +
    (dirty.length ? ` ${dirty.length} file(s) still queued for deep re-extract at preflight.` : ''));
}

if (require.main === module) {
  try { main(path.resolve(process.argv[2] || '.')); }
  catch (e) { console.error('update-ecosystem failed:', e.message); process.exit(1); }
}
module.exports = { main };
