#!/usr/bin/env node
// Install the managed git pre-push hook (sets core.hooksPath -> .ecosystem/git-hooks). Non-destructive
// to .git/hooks. Idempotent.  Usage: node bin/install-git-hooks.js <target>
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { prePushScript, commitMsgScript, hooksReadme } = require('../src/git-hooks');

const root = path.resolve(process.argv[2] || '.');
// Default ADVISORY (a repo can't be assumed to pass its own gates on day one); --enforce to block.
const advisory = !process.argv.includes('--enforce');
// must be a git repo
try { execSync('git rev-parse --is-inside-work-tree', { cwd: root, stdio: 'ignore' }); }
catch { console.error('not a git repo — skipping hook install'); process.exit(0); }

const dir = path.join(root, '.ecosystem', 'git-hooks');
fs.mkdirSync(dir, { recursive: true });
const prePush = path.join(dir, 'pre-push');
fs.writeFileSync(prePush, prePushScript({ advisory }));
try { fs.chmodSync(prePush, 0o755); } catch {}
const commitMsg = path.join(dir, 'commit-msg');
fs.writeFileSync(commitMsg, commitMsgScript());
try { fs.chmodSync(commitMsg, 0o755); } catch {}
fs.writeFileSync(path.join(dir, 'README.md'), hooksReadme());

let prev = null;
try { prev = execSync('git config --get core.hooksPath', { cwd: root, encoding: 'utf8' }).trim(); } catch {}

// DON'T HIJACK an existing hook manager. If the repo runs lefthook/husky/pre-commit (or already
// points core.hooksPath somewhere else), setting ours would silently displace their hooks — the
// exact "don't downgrade anything" failure field testing guarded against. Generate the hook FILES
// (inert until wired) and tell the owner how to opt in; --force overrides.
const force = process.argv.includes('--force');
const managerConfigs = ['lefthook.yml', 'lefthook.yaml', '.lefthook.yml', '.lefthook.yaml', '.pre-commit-config.yaml'];
const existingManager = managerConfigs.find((f) => fs.existsSync(path.join(root, f)))
  || (fs.existsSync(path.join(root, '.husky')) ? '.husky/' : null)
  || (prev && prev !== '.ecosystem/git-hooks' ? `core.hooksPath=${prev}` : null);

if (existingManager && !force) {
  console.log(JSON.stringify({
    installed: false, generated: '.ecosystem/git-hooks/', mode: advisory ? 'advisory' : 'enforcing',
    skippedBecause: `existing hook manager: ${existingManager}`,
    optIn: 'add `bash .ecosystem/ci-check.sh` to your hook manager, or re-run with --force to switch core.hooksPath',
  }));
  process.exit(0);
}

execSync('git config core.hooksPath .ecosystem/git-hooks', { cwd: root });
console.log(JSON.stringify({ installed: '.ecosystem/git-hooks/pre-push', mode: advisory ? 'advisory' : 'enforcing', hooksPath: '.ecosystem/git-hooks', previousHooksPath: prev || null }));
