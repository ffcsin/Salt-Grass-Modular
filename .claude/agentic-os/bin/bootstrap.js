#!/usr/bin/env node
'use strict';
// FULL bootstrap — the entire 18-phase agentic-os ecosystem on a repo in ONE command, deterministic
// (no agents needed for the structural/RBAC/param/tenant/graph/docs/governance layers). The agentic
// deep-extract (semantic prose enrichment) is the only thing layered ON TOP via the deep-map skill;
// everything else runs here, fast, every time, on any JS/TS repo (decent Python baseline too).
//   node bin/bootstrap.js <target> [--no-hooks] [--quiet]
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const PLUGIN = path.resolve(__dirname, '..');
const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '.');
const noHooks = process.argv.includes('--no-hooks');
const eco = path.join(root, '.ecosystem');
fs.mkdirSync(eco, { recursive: true });

const results = [];
function phase(name, fn) {
  const t0 = process.hrtime.bigint();
  try { const s = fn() || {}; const ms = Number(process.hrtime.bigint() - t0) / 1e6; results.push({ name, ok: true, ms, s }); console.log(`✓ ${name}  (${ms.toFixed(0)}ms)  ${JSON.stringify(s)}`); }
  catch (e) { const ms = Number(process.hrtime.bigint() - t0) / 1e6; results.push({ name, ok: false, ms, error: e.message }); console.log(`✗ ${name}  ERROR: ${e.message}`); }
}
function runBin(bin, args = []) { try { return execFileSync('node', [path.join(PLUGIN, 'bin', bin), root, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).trim(); } catch (e) { return (e.stdout || '') + (e.stderr ? ' ' + e.stderr : ''); } }

console.log(`\n=== agentic-os FULL bootstrap on ${root} ===\n`);

let stack = {};
phase('1 detect', () => { stack = require('../src/detect').detect(root); return { frameworks: stack.frameworks }; });

phase('2 patterns (deterministic)', () => { const { defaultPatternSet } = require('../src/default-patternset'); const { saveConfig } = require('../src/compile'); const ps = defaultPatternSet(stack); saveConfig(root, ps); return { routePatterns: ps.routePatterns.length }; });

phase('3 structural map', () => { const { runPipeline } = require('./map.js'); const { report } = runPipeline(root); return { drift: +(report.maxDrift * 100).toFixed(1) }; });

phase('4 deterministic deep-map (routes+guards+params+FE calls)', () => { const { writeDeterministicDeepMap } = require('../src/deterministic-deep-map'); return writeDeterministicDeepMap(root, { now: '' }); });

phase('5 RBAC/security baseline', () => runBin('security-gate.js') && { ran: true });
phase('6 param-mismatch', () => runBin('diagnose-params.js') && { ran: true });
phase('7 tenant-scope', () => runBin('diagnose-tenant.js') && { ran: true });
phase('8 env audit', () => runBin('diagnose-env.js') && { ran: true });
phase('9 async bugs', () => runBin('diagnose-async.js') && { ran: true });
phase('10 perf anti-patterns', () => runBin('diagnose-perf.js') && { ran: true });
phase('10b cross-store consistency', () => runBin('diagnose-store-consistency.js') && { ran: true });
phase('11 dead frontend', () => runBin('diagnose-dead-frontend.js') && { ran: true });
phase('11b test-coverage map', () => runBin('diagnose-coverage.js') && { ran: true });
phase('12 phantom-API + secrets', () => { runBin('diagnose-phantom.js'); runBin('diagnose-secrets.js'); return { ran: true }; });

phase('13 knowledge graph', () => runBin('build-graph.js') && { ran: true });
phase('14 docs + CLAUDE.md mandate', () => { require('../src/docgen').runDocgen ? require('../src/docgen').runDocgen(root) : runBin('../src/docgen.js'); return { ran: true }; });
phase('15 categorized layout', () => runBin('gen-grok-layout.js') && { ran: true });
phase('15b tool-audit-depth docs (9-section, deterministic + AGENT-NEEDED)', () => { const out = runBin('gen-audits.js'); try { return JSON.parse(out); } catch { return { ran: true }; } });
phase('16 repo-map + AGENTS.md + layers', () => { runBin('repo-map.js'); runBin('gen-agents-md.js'); runBin('gen-layers.js'); return { ran: true }; });
phase('16b reference catalogs (crons/webhooks/collections/env/gates/FE-surfaces)', () => { const out = runBin('gen-catalogs.js'); try { return JSON.parse(out); } catch { return { ran: true }; } });

phase('17 hooks-config + governance', () => {
  execFileSync('node', [path.join(PLUGIN, 'src', 'hooks-config.js'), root], { stdio: 'ignore' });
  if (!noHooks) {
    // Repo-local Claude Code hook enforcement — bakes the rules INTO the repo (.claude/settings.json
    // + .claude/agentic-os/ runtime), committed + working for anyone who clones, no plugin required.
    try { const { installRepoHooks } = require('../src/claude-settings'); installRepoHooks(PLUGIN, root); } catch (e) { console.log('  (repo-hook install skipped: ' + e.message + ')'); }
    // git hooks (local pre-push gate — DEFERS to an existing lefthook/husky/pre-commit manager) +
    // CI for the DETECTED platforms only (detect-ci + git remotes decide; --both forced a GitHub
    // config onto GitLab-only repos — field testing) + import/critique any existing CI.
    runBin('install-git-hooks.js'); runBin('gen-ci.js'); runBin('ci-sync.js');
  }
  // baseline MCP pins if any servers configured
  runBin('mcp-pin.js', ['pin']);
  return { hooks: !noHooks, repoLocal: !noHooks };
});

phase('18 user profile scaffold', () => { try { const { loadProfile, saveProfile } = require('../hooks/lib/profile'); const p = loadProfile(); if (p._missing) saveProfile({ role: 'default', note: 'edit me: run /agentic-os:profile-interview' }); return { profile: p._missing ? 'scaffolded' : 'exists' }; } catch (e) { return { profile: 'skipped: ' + e.message }; } });

// Final report
const totalMs = results.reduce((s, r) => s + r.ms, 0);
const failed = results.filter((r) => !r.ok);
const md = ['# agentic-os bootstrap', '', `_Full deterministic bootstrap of ${path.basename(root)} — ${results.length} phases, ${(totalMs / 1000).toFixed(1)}s, ${failed.length} failed._`, '',
  '> The agentic deep-extract (semantic prose/intent enrichment) is the optional heavy layer on top — run `/agentic-os:deep-map` when you want per-area descriptions. Everything structural (routes/guards/params/RBAC/tenant/graph/orphans/docs/governance) is in this run.', '',
  '| phase | status | ms |', '|---|---|---|',
  ...results.map((r) => `| ${r.name} | ${r.ok ? '✅ ' + JSON.stringify(r.s) : '❌ ' + r.error} | ${r.ms.toFixed(0)} |`)].join('\n');
fs.writeFileSync(path.join(eco, 'BOOTSTRAP.md'), md + '\n');
console.log(`\n=== bootstrap done: ${results.length - failed.length}/${results.length} phases, ${(totalMs / 1000).toFixed(1)}s -> ${path.join(eco, 'BOOTSTRAP.md')} ===`);
process.exit(failed.length ? 1 : 0);
