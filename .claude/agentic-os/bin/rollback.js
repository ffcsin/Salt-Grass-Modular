#!/usr/bin/env node
// Safe checkpoint/restore for agentic changes (the Rollback capability). Captures the working tree
// into a hidden ref WITHOUT touching it; restores files from a checkpoint into the working tree
// (never rewrites history, never force-resets). Pairs with the verify gates: checkpoint before a
// risky change, restore if it breaks.
//   node bin/rollback.js <target> checkpoint ["label"]
//   node bin/rollback.js <target> list
//   node bin/rollback.js <target> restore <ref>     (stashes current work first for safety)
const { execSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(process.argv[2] || '.');
const op = process.argv[3];
const git = (cmd) => execSync(`git ${cmd}`, { cwd: root, encoding: 'utf8' }).trim();
try { git('rev-parse --is-inside-work-tree'); } catch { console.error('not a git repo'); process.exit(2); }

if (op === 'checkpoint') {
  const label = (process.argv[4] || 'checkpoint').replace(/[^a-z0-9._-]/gi, '-');
  // snapshot the working tree (incl. staged) without modifying it; fall back to HEAD if clean
  let snap = '';
  try { snap = git('stash create'); } catch {}
  if (!snap) snap = git('rev-parse HEAD');
  const ref = `refs/agentic-os/cp/${label}-${git('rev-parse --short HEAD')}-${git('rev-list --count HEAD')}`;
  git(`update-ref ${ref} ${snap}`);
  console.log(JSON.stringify({ checkpoint: ref, snapshot: snap }));
} else if (op === 'list') {
  let refs = '';
  try { refs = git('for-each-ref --format=%(refname) --sort=-creatordate refs/agentic-os/cp'); } catch {}
  console.log(JSON.stringify({ checkpoints: refs ? refs.split('\n') : [] }));
} else if (op === 'restore') {
  const ref = process.argv[4];
  if (!ref) { console.error('restore needs a <ref> (see `list`)'); process.exit(2); }
  // safety: stash any current uncommitted work so restore is reversible
  let stashed = false;
  try { const s = git('stash create'); if (s) { git(`stash store -m "agentic-os pre-restore" ${s}`); stashed = true; } } catch {}
  git(`checkout ${ref} -- .`); // restore files from the checkpoint into the working tree
  console.log(JSON.stringify({ restored: ref, priorWorkStashed: stashed, note: stashed ? 'your prior changes are in `git stash list` (most recent)' : 'working tree was clean' }));
} else {
  console.error('ops: checkpoint | list | restore <ref>'); process.exit(2);
}
