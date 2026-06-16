// src/hooks-config.js
const fs = require('node:fs');
const path = require('node:path');
const { areaOf } = require('./group');

function generate(map, opts = {}) {
  const minRoutes = opts.minRoutes || 8;
  const byFile = {};
  for (const r of map.routes || []) {
    const f = (byFile[r.file] || (byFile[r.file] = { count: 0, areas: new Set() }));
    f.count++; f.areas.add(areaOf(r.route));
  }
  const highFanoutFiles = Object.entries(byFile)
    .filter(([, v]) => v.count >= minRoutes || v.areas.size >= 2)
    .map(([f]) => f.replace(/\\/g, '/'));
  return {
    version: 1, generatedAt: new Date().toISOString(),
    enable: { preEditContext: true, promptRouter: true, docsFirstReminder: true, postEditNudge: true, sessionSummary: true, mandateReminder: true, identityNote: true,
      safetyGuardrails: true, readTracker: true, blastRadius: true, newFileNudge: true, stopVerify: true, stopRemapNet: true, auditTrail: true,
      // autoRefresh: keep the structural map live automatically on Stop (free, no agents — re-maps
      // routes/guards/params/orphans when files changed). autoLearn: capture learnings automatically.
      deepDirty: true, autoRefresh: true, autoLearn: true, secretGuard: true, depGuard: true, staleContext: true, contextPack: true, untrustedGuard: true, budgetGuard: true, errorCheck: true,
      // profilePrompt: auto-onboard a new user via AskUserQuestion. tddGate: ask test-first on a new
      // source file with exports + no sibling test. importCheck: flag hallucinated (unresolved) imports
      // post-edit (the #1 2026 agent failure mode). planFirst: nudge a spec/brainstorm on new-feature files.
      profilePrompt: true, tddGate: true, importCheck: true, planFirst: true,
      // diagnosticScan: deterministic bug-finder over changed files at Stop (store-consistency / async /
      // hallucinated-import) — cheap, no LLM, advisory. Complements the headless autoReview gate.
      diagnosticScan: true },
    preEditCharCap: 4000, highFanoutFiles, role: 'default',
    enforcementMode: 'ask', // owner dial: ask (default) | block | warn. Flip to 'block' to hard-deny.
    enforceReadBeforeEdit: true, enforceVerifyBeforeDone: true,
    // Self-critique gate — BLOCKS completion until an independent review (reviewer sub-agent or review
    // skill) runs over a session that edited code + claimed done. The documented #1 leverage guardrail
    // ("writer ≠ grader"). Mandated by default; set false to drop to a soft nudge, or selfCritiqueEnforce:'warn'.
    enforceSelfCritique: true,
    // autoReview: when the self-critique gate fires, SPIN UP a headless reviewer agent (claude -p) over
    // the diff automatically — CLEAN satisfies the gate, issues block with the findings. Only runs on a
    // gate-fire (bounded) + when the `claude` CLI is available; else falls back to the directive block.
    // Has real $ cost per run (surfaced in output). reviewModel: override (e.g. a cheaper model);
    // omit to inherit. Kill switch: AGENTIC_OS_NO_AUTOREVIEW=1.
    autoReview: true, reviewModel: null, reviewDiffCapBytes: 200000, reviewTimeoutMs: 180000,
  };
}

function run(projectDir) {
  const map = JSON.parse(fs.readFileSync(path.join(projectDir, '.ecosystem', 'map.json'), 'utf8'));
  const cfg = generate(map);
  const out = path.join(projectDir, '.ecosystem', 'hooks-config.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(cfg, null, 2) + '\n');
  return cfg;
}

if (require.main === module) {
  const root = path.resolve(process.argv[2] || '.');
  try { const c = run(root); console.log('hooks-config: ' + c.highFanoutFiles.length + ' high-fan-out files'); }
  catch (e) { console.error('hooks-config failed:', e.message); process.exit(1); }
}
module.exports = { generate, run };
