'use strict';
// Gate config — the bridge between the AI gate-DESIGN pass and every gate consumer (local pre-push,
// GitHub, GitLab). The `design-gates` skill writes .ecosystem/gates.config.json: a TWO-TIER, repo-tailored
// gate set (BLOCK = fast/green/deploy-relevant → fail the build; ADVISORY = slow/debt-prone → report only),
// designed by agents that actually ran the suites. If that file is absent, we fall back to the DETERMINISTIC
// planner (planGates) split into a sensible two-tier — so a repo always has working gates, and the AI design
// only makes them smarter. This mirrors the map's deterministic-baseline + agentic-enrichment split.
const fs = require('node:fs');
const path = require('node:path');
const { planGates } = require('./gates');

// Resolve the effective two-tier gates for a repo. Returns { block:[step], advisory:[step], source }.
// step = { name, command } | { name, builtin:true } (the builtin secret-scan).
function resolveGates(root) {
  // 1) AI-designed / hand-authored config wins.
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(root, '.ecosystem', 'gates.config.json'), 'utf8'));
    if (cfg && (Array.isArray(cfg.block) || Array.isArray(cfg.advisory))) {
      const norm = (arr) => (arr || []).filter((s) => s && s.name && (s.command || s.builtin)).map((s) => ({ name: s.name, command: s.command, builtin: !!s.builtin, cwd: s.cwd }));
      return { block: norm(cfg.block), advisory: norm(cfg.advisory), source: cfg.designedBy === 'agent' ? 'agent-designed' : 'config' };
    }
  } catch {}
  // 2) Deterministic fallback — STACK-AWARE via the gate playbook (docs/gates research). The archetype
  //    decides whether the production BUILD is block (deploy-critical for libraries/Next/Go/Rust) vs
  //    advisory; the cross-cutting rule (unanimous in the research) tiers the rest: secret-scan + tests +
  //    format = block (deterministic, deploy-relevant); lint + typecheck = advisory (debt-prone on real
  //    repos); dep-audit + sast = advisory (flaky/slow). An AI `design-gates` pass refines this further.
  const detect = require('./detect').detect(root);
  let scripts = {}; try { scripts = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts || {}; } catch {}
  const pm = (detect.tooling || {}).packageManager || 'npm';
  let archetype = null, blockCats = null;
  try { const gp = require('./gate-playbook'); archetype = gp.archetypeFor(detect); blockCats = archetype ? gp.blockCategoriesFor(archetype) : null; } catch {}
  const tierOf = (gate) => {
    if (gate === 'secret-scan') return 'block';
    if (gate === 'dep-audit' || gate === 'sast') return 'advisory';
    if (gate === 'lint' || gate === 'typecheck') return 'advisory'; // debt-prone — never block on inherited errors
    return 'block'; // test
  };
  // 2-pre) SPLIT-STACK repos: when the toolchains live in component dirs (backend/go.mod +
  // frontend/package.json) and the root has no scripts of its own, root-level planning produces junk
  // (`npm biome check .` at a root with no package.json — field testing). Plan per-component instead:
  // explicit cwd, the component's own package manager, its own scripts. Single-root repos skip this
  // branch (planComponentGates → null) — zero behavior change for them.
  const rootHasScripts = !!(scripts.lint || scripts.test || scripts.build || scripts.typecheck);
  if (!rootHasScripts) {
    try {
      const compSteps = require('./component-gates').planComponentGates(root, pm);
      if (compSteps && compSteps.length) {
        const block = [], advisory = [];
        const buildTier = blockCats && blockCats.has('build') ? 'block' : 'advisory';
        for (const st of compSteps) {
          const tier = st.gate === 'build' ? buildTier : tierOf(st.gate);
          (tier === 'block' ? block : advisory).push({ name: st.name, command: st.command, cwd: st.cwd, lang: st.lang, install: st.install });
        }
        block.unshift({ name: 'secret-scan', builtin: true });
        return { block, advisory, source: archetype ? `deterministic-components:${archetype}` : 'deterministic-components' };
      }
    } catch { /* fall through to root planning */ }
  }
  const block = [], advisory = [];
  for (const g of planGates(detect, scripts)) {
    if (g.skip) continue;
    const step = g.builtin ? { name: g.gate, builtin: true } : { name: g.gate, command: g.command };
    (tierOf(g.gate) === 'block' ? block : advisory).push(step);
  }
  // The production build is the highest-value gate for deploy archetypes — add it (block) when the repo
  // has a build script and the archetype treats build as deploy-relevant; else advisory.
  if (scripts.build) {
    const buildStep = { name: 'build', command: `${pm} run build` };
    (blockCats && blockCats.has('build') ? block : advisory).unshift(buildStep);
  }
  return { block, advisory, source: archetype ? `deterministic:${archetype}` : 'deterministic' };
}

// One shell line per step (builtin secret-scan → portable grep over the diff).
function stepCmd(step) {
  if (step.builtin && step.name === 'secret-scan') return `git diff --no-color | grep -nE 'sk-ant-[a-zA-Z0-9-]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|postgres(ql)?://[^[:space:]:@]+:[^[:space:]:@]+@' && { echo 'secret detected'; exit 1; } || echo 'no secrets'`;
  const c = step.cwd ? `cd ${JSON.stringify(step.cwd)} && ${step.command}` : step.command;
  return c;
}

// The portable runner the pre-push hook + any CI calls: BLOCK fails the run; ADVISORY runs but never fails it.
function renderCheckSh(resolved) {
  const blockBody = resolved.block.map((s) => `run_block "${s.name}" ${JSON.stringify(stepCmd(s))}`).join('\n');
  const advBody = resolved.advisory.map((s) => `run_adv "${s.name}" ${JSON.stringify(stepCmd(s))}`).join('\n');
  return `#!/usr/bin/env bash
# agentic-os checks (${resolved.source}). BLOCK tier fails the run; ADVISORY tier is reported only.
set -uo pipefail
FAILED=();
run_block() { echo "── [block] $1"; bash -c "$2"; if [ $? -ne 0 ]; then FAILED+=("$1"); fi; }
run_adv()   { echo "── [advisory] $1"; bash -c "$2" || echo "  ⚠ advisory '$1' failed (not blocking)"; }
${blockBody || '# (no block gates)'}
${advBody || '# (no advisory gates)'}
if [ \${#FAILED[@]} -ne 0 ]; then echo "❌ BLOCK gates failed: \${FAILED[*]}"; exit 1; fi
echo "✅ all BLOCK gates passed"
`;
}

// The mature GitHub/GitLab renderers live in ci-render.js (stages, cache, services, deploy scaffold).
// gate-config owns the gate RESOLUTION + the portable local runner; ci-render owns platform CI rendering.
const { renderGithub, renderGitlab } = require('./ci-render');

module.exports = { resolveGates, renderCheckSh, renderGithub, renderGitlab, stepCmd };
