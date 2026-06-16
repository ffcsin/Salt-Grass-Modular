#!/usr/bin/env node
'use strict';
// Diff-aware mutation sentinel (orchestrator). For each CHANGED source file, generate severity-tiered
// mutants, apply one at a time, run the repo's test command, and report any mutant the suite did NOT
// kill — i.e. behavior the tests don't actually constrain. Restores the file after each mutant.
//   node bin/mutation-sentinel.js <target> [--ref HEAD] [--max 12] [--test "npm test"]
const fs = require('node:fs'); const path = require('node:path');
const { execSync } = require('node:child_process');
const { generateMutants, summarize } = require('../src/verify/mutate');
const { changedFiles } = require('../lib/git');

const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '.');
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const ref = flag('--ref', 'HEAD');
const maxPerFile = parseInt(flag('--max', '10'), 10);
function detectTestCmd() {
  if (flag('--test')) return flag('--test');
  try { const pj = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')); if (pj.scripts && pj.scripts.test) return 'npm test'; } catch {}
  return 'node --test';
}
const testCmd = detectTestCmd();

function runTests() {
  try { execSync(testCmd, { cwd: root, stdio: 'ignore', timeout: 120000 }); return true; } catch { return false; }
}

function main() {
  const files = (changedFiles(root, ref).length ? changedFiles(root, ref) : changedFiles(root))
    .filter((f) => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f) && !/\.(test|spec)\.|\.d\.ts$/.test(f) && fs.existsSync(path.join(root, f)));
  if (!files.length) { console.log(JSON.stringify({ files: 0, note: 'no changed source files' })); return; }
  // Baseline must be green, else mutation results are meaningless.
  if (!runTests()) { console.log(JSON.stringify({ error: 'baseline tests fail — fix before mutation testing' })); process.exit(1); }

  const report = [];
  for (const rel of files) {
    const abs = path.join(root, rel);
    const original = fs.readFileSync(abs, 'utf8');
    const mutants = generateMutants(original, { max: maxPerFile });
    const results = [];
    for (const mut of mutants) {
      fs.writeFileSync(abs, mut.source);
      const killed = !runTests(); // tests fail on the mutant = killed (good)
      results.push({ id: mut.id, killed, desc: mut.desc, line: mut.line, before: mut.before, after: mut.after });
    }
    fs.writeFileSync(abs, original); // restore
    report.push({ file: rel, ...summarize(results) });
  }

  const dir = path.join(root, '.ecosystem', 'reports'); fs.mkdirSync(dir, { recursive: true });
  const lines = ['# Mutation sentinel (diff-scoped)', '', `_Test command: \`${testCmd}\`. A SURVIVING mutant = the tests didn't catch that behavior change → add/strengthen a test._`, ''];
  for (const r of report) {
    lines.push(`## ${r.file} — killed ${r.killed}/${r.total} (score ${(r.score * 100).toFixed(0)}%)`);
    if (r.survivors.length) for (const s of r.survivors) lines.push(`- ⚠ SURVIVED \`${s.before}\`→\`${s.after}\` at line ${s.line} (${s.desc}) — tests pass with this break`);
    else lines.push('- ✅ all mutants killed');
    lines.push('');
  }
  fs.writeFileSync(path.join(dir, 'mutation-sentinel.md'), lines.join('\n') + '\n');
  const totalSurv = report.reduce((s, r) => s + r.survived, 0);
  console.log(JSON.stringify({ files: report.length, survivors: totalSurv }));
}
main();
