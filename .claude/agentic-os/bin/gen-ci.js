#!/usr/bin/env node
// Generate CI configs for the detected platform(s) + the portable ci-check.sh. Always writes the
// generic script (the pre-push hook + any CI can call it). Writes platform configs for whatever CI
// the repo uses (or GitHub if none detected, as a sensible default).
// Usage: node bin/gen-ci.js <target>
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { detect } = require('../src/detect');
const { resolveGates, renderCheckSh, renderGithub, renderGitlab } = require('../src/gate-config');

const root = path.resolve(process.argv[2] || '.');
const both = process.argv.includes('--both') || process.argv.includes('--all'); // force GitHub + GitLab
const d = detect(root);
d.root = root; // lets ci-render's installCmd consult the deploy configs (deploy-mirror install)
const pm = (d.tooling || {}).packageManager || 'npm';
// The effective two-tier gate set — AI-designed (.ecosystem/gates.config.json) if present, else the
// deterministic split. The SAME `resolved` renders the local runner + GH + GitLab → one source of truth.
const resolved = resolveGates(root);

// Infer platforms from git remotes too — a repo that PUSHES to both github.com and gitlab.com should get
// both configs, even if only one CI dir exists yet. (The user's "exist in gh AND gl" case.)
function remotePlatforms() {
  const out = new Set();
  try {
    const txt = execFileSync('git', ['remote', '-v'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    if (/github\.com/i.test(txt)) out.add('github');
    if (/gitlab\.[a-z.]+/i.test(txt)) out.add('gitlab');
  } catch {}
  return out;
}

const written = [];
const write = (rel, content, mode) => {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  if (mode) { try { fs.chmodSync(full, mode); } catch {} }
  written.push(rel);
};

// always: the portable runner (the single source of gate truth — pre-push hook + every CI calls it)
write('.ecosystem/ci-check.sh', renderCheckSh(resolved), 0o755);

// keep machine-local markers out of git (the committed .ecosystem holds the maps; these are per-checkout)
const ecoIgnore = path.join(root, '.ecosystem', '.gitignore');
if (!fs.existsSync(ecoIgnore)) write('.ecosystem/.gitignore', '.preflight-ok\n.dirty.json\n.read-hashes.json\n.session-edits.json\n.session-reads.json\n.self-critique-blocks.json\n');

// platform set = detected CI dirs ∪ git-remote hosts ∪ (--both ? all : ∅); default github if no signal.
const set = new Set([...(d.ci || []), ...remotePlatforms()]);
if (both) { set.add('github'); set.add('gitlab'); }
if (!set.size) set.add('github');
const platforms = [...set];

if (platforms.includes('github')) write('.github/workflows/agentic-os-checks.yml', renderGithub(resolved, d));
if (platforms.includes('gitlab')) write('.ecosystem/gitlab-ci.agentic-os.yml', renderGitlab(resolved, d)); // include into .gitlab-ci.yml

console.log(JSON.stringify({ platforms, both, gateSource: resolved.source, block: resolved.block.length, advisory: resolved.advisory.length, written }));
