#!/usr/bin/env node
'use strict';
// Align a repo's git author identity with the agentic-os user PROFILE, so commits are authored AS the
// user (their name/email) rather than whatever the repo's git config happens to be. The profile is the
// identity source. GitHub operations already run under the user's own `gh`/token — this covers the git
// author + committer. Idempotent; only writes when the profile has a real name/email.
//   node bin/git-identity.js <repo>            # align if unset OR mismatched
//   node bin/git-identity.js <repo> --check    # report only, never write
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '.');
const checkOnly = process.argv.includes('--check');

function git(args, allowFail) {
  try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch (e) { if (allowFail) return ''; throw e; }
}

try { git(['rev-parse', '--is-inside-work-tree']); } catch { console.log(JSON.stringify({ aligned: false, reason: 'not a git repo' })); process.exit(0); }

let lib, profile;
try { lib = require('../hooks/lib/profile'); profile = lib.loadProfile(); } catch { profile = { _missing: true }; }
// Resolve the RIGHT identity for THIS repo: a per-org override matched on the remote URL, else default.
const resolved = lib ? lib.resolveIdentity(profile, lib.repoSignal(root)) : { name: null, email: null };
const name = resolved.name && resolved.name !== 'unknown' ? resolved.name : null;
const email = resolved.email || null;

if (!name && !email) {
  console.log(JSON.stringify({ aligned: false, reason: 'profile has no name/email — run /agentic-os:profile-interview' }));
  process.exit(0);
}

// Read the repo-LOCAL config (NOT the effective value, which includes the user's global identity) — the
// "deliberate per-repo identity" we must not clobber is a LOCAL value; a global default doesn't count.
const curName = git(['config', '--local', 'user.name'], true);
const curEmail = git(['config', '--local', 'user.email'], true);
// NEVER clobber a deliberately-set local identity with the DEFAULT (unmatched) one — that silently
// stamps the personal/global email onto a repo where the user hand-set a client email (review HIGH).
// Apply when an org actually matched; for the default, only FILL when the LOCAL value is unset.
const allowOverwrite = !!resolved.matched;
const apply = (cur, val) => val && cur !== val && (allowOverwrite || !cur);
const changes = [];
if (apply(curName, name)) changes.push(['user.name', curName || '(unset)', name]);
if (apply(curEmail, email)) changes.push(['user.email', curEmail || '(unset)', email]);

if (!changes.length) { console.log(JSON.stringify({ aligned: true, name: curName, email: curEmail, changed: [] })); process.exit(0); }
if (checkOnly) { console.log(JSON.stringify({ aligned: false, wouldChange: changes.map(([k, from, to]) => ({ key: k, from, to })) })); process.exit(0); }

for (const [k, , to] of changes) git(['config', k, to]);
console.log(JSON.stringify({ aligned: true, changed: changes.map(([k, from, to]) => ({ key: k, from, to })), attribution: resolved.attribution, matchedOrg: resolved.matched || null }));
