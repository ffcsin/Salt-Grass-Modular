'use strict';
// Tiny zero-dep git helpers (shared by guards/diagnostics). All fail-soft: return empty on any error
// so a non-git repo or missing git never crashes a hook.
const { execSync } = require('node:child_process');

function git(root, args) {
  try { return execSync(`git ${args}`, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch { return ''; }
}

// Files changed vs a ref (default: working tree + staged vs HEAD). Repo-relative, forward slashes.
function changedFiles(root, ref) {
  const out = git(root, ref ? `diff --name-only ${ref}` : 'status --porcelain');
  if (ref) return out.split('\n').map((l) => l.trim()).filter(Boolean).map((f) => f.replace(/\\/g, '/'));
  return out.split('\n').map((l) => l.slice(3).trim()).filter(Boolean).map((f) => f.replace(/\\/g, '/'));
}

// Unified diff text (added/removed lines) vs a ref.
function diffText(root, ref) { return git(root, `diff ${ref || 'HEAD'}`); }

// Just the ADDED lines (without the leading +) from a diff — what the agent is introducing.
function addedLines(root, ref) {
  return diffText(root, ref).split('\n')
    .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
    .map((l) => l.slice(1));
}

function gitLog(root, args) { return git(root, `log ${args}`); }

module.exports = { git, changedFiles, diffText, addedLines, gitLog };
