#!/usr/bin/env node
'use strict';
// Single systematic entry point — run the WHOLE deterministic engine on a target repo in one command.
// Read-only (never executes the target's code); writes every artifact under <target>/.ecosystem/.
// Each step is timed + error-isolated, so one failure can't abort the run (and surfaces as a bug).
//   node bin/run-all.js <target> [--ref HEAD]
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(process.argv[2] || '.');
const args = process.argv.slice(2);
const ref = (() => { const i = args.indexOf('--ref'); return i >= 0 ? args[i + 1] : 'HEAD'; })();
const eco = path.join(root, '.ecosystem');
const reports = path.join(eco, 'reports');
fs.mkdirSync(reports, { recursive: true });

const results = [];
function step(name, fn) {
  const t0 = process.hrtime.bigint();
  try {
    const summary = fn() || {};
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    results.push({ name, ok: true, ms, summary });
    console.log(`✓ ${name}  (${ms.toFixed(0)}ms)  ${JSON.stringify(summary)}`);
  } catch (e) {
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    results.push({ name, ok: false, ms, error: e.message });
    console.log(`✗ ${name}  (${ms.toFixed(0)}ms)  ERROR: ${e.message}`);
  }
}
const write = (rel, content) => { const f = path.join(eco, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content); };

console.log(`\n=== agentic-os engine run on ${root} ===\n`);

let symbolIndex = null;
step('symbol-index', () => { const { buildSymbolIndex } = require('../src/symbols'); symbolIndex = buildSymbolIndex(root); return { defs: symbolIndex.defs.size, files: symbolIndex.files.length }; });

step('repo-map', () => { const { renderRepoMap } = require('../src/repomap'); const r = renderRepoMap(root, { budgetTokens: 2000 }); write('repo-map.md', r.markdown + '\n'); return { files: r.files, tokens: r.tokensUsed }; });

step('agents-md', () => { let stack = null; try { stack = require('../src/detect').detect(root); } catch {} const { writeAgentsMd } = require('../src/agents-md'); writeAgentsMd(root, { stack }); return { wrote: 'AGENTS.md' }; });

step('bm25-index', () => { const { buildIndex } = require('../src/retrieval/bm25'); const idx = buildIndex(root); return { docs: idx.N, terms: idx.df.size }; });

step('dead-frontend', () => { const { auditDeadFrontend } = require('../src/diagnostics/dead-frontend'); const a = auditDeadFrontend(root); write('reports/dead-frontend.md', `# Abandoned frontend (${a.dead.length}/${a.scanned})\n\n${a.dead.slice(0, 500).map((d) => `- \`${d}\``).join('\n')}\n`); return { scanned: a.scanned, dead: a.dead.length }; });

step('phantom-api', () => { const { auditPhantoms } = require('../src/diagnostics/phantom-api'); const r = auditPhantoms(root, { ref, symbolIndex }); write('reports/phantom-api.md', `# Phantom-API scan (vs ${r.ref})\n\n## Internal phantoms (${r.internalPhantoms.length})\n${r.internalPhantoms.map((n) => `- \`${n}(...)\``).join('\n')}\n\n## Unverified deps (${r.depPhantoms.length})\n${r.depPhantoms.map((p) => `- \`${p}\``).join('\n')}\n`); return { internal: r.internalPhantoms.length, deps: r.depPhantoms.length }; });

step('secret-scan', () => { const { scanSecrets, loadBaseline } = require('../src/diagnostics/secret-scan'); const { addedLines } = require('../lib/git'); const hits = scanSecrets(addedLines(root, ref).join('\n'), { baseline: loadBaseline(root) }); write('reports/secrets.md', `# Secret scan of diff (${hits.length})\n\n${hits.map((h) => `- ${h.desc} line ${h.line} \`${h.match}\``).join('\n')}\n`); return { findings: hits.length }; });

step('behavioral-diff', () => { const { classifyDiff } = require('../src/verify/behavioral-diff'); const { diffText } = require('../lib/git'); const r = classifyDiff(diffText(root, ref)); const beh = r.filter((x) => x.kind === 'behavioral').length; write('reports/behavioral-diff.md', `# Behavioral diff (${beh}/${r.length} behavioral)\n\n${r.map((x) => `- ${x.kind} \`${x.file}\``).join('\n')}\n`); return { files: r.length, behavioral: beh }; });

step('effectiveness', () => { const { execSync } = require('node:child_process'); const E = require('../src/effectiveness'); let log = ''; try { log = execSync('git log --since="30 days ago" --format=%H^|%an^|%at --numstat', { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).replace(/\^\|/g, '|'); } catch {} const m = E.churnMetrics(E.parseNumstat(log)); write('reports/effectiveness.md', E.render(m) + '\n'); return { commits: m.commits, churn: m.churnRatio }; });

// Summary
const totalMs = results.reduce((s, r) => s + r.ms, 0);
const failed = results.filter((r) => !r.ok);
const md = ['# Engine run', '', `_${results.length} steps, ${(totalMs / 1000).toFixed(1)}s total, ${failed.length} failed._`, '',
  '| step | status | ms | summary |', '|---|---|---|---|',
  ...results.map((r) => `| ${r.name} | ${r.ok ? '✅' : '❌ ' + r.error} | ${r.ms.toFixed(0)} | ${r.ok ? JSON.stringify(r.summary) : ''} |`)].join('\n');
write('ENGINE_RUN.md', md + '\n');
console.log(`\n=== done: ${results.length - failed.length}/${results.length} ok, ${(totalMs / 1000).toFixed(1)}s -> ${path.join(eco, 'ENGINE_RUN.md')} ===`);
process.exit(failed.length ? 1 : 0);
