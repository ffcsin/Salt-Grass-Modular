'use strict';
// Natural-language framing for the ASK popup. Turns a raw guarded operation into a plain-English
// "Bumper Bypass Request: <what you're about to do>" sentence, so the permission prompt reads like a
// human request ("Force-delete branch X — removes it even if unmerged") instead of a bare command.
// Covers every guarded op the hooks can ASK about (git destructive ops, rm -rf, secret/scope/read gates).

// Describe a Bash command in human terms (what it WILL do + the risk).
function describeBash(cmd) {
  const c = String(cmd || '').trim();
  let m;
  if ((m = c.match(/\brm\s+(?:-\S*[rf]\S*\s+)+(?:--\s+)?(['"]?)([^\s'";|&]+)\1/))) {
    return { what: `permanently delete \`${m[2]}\` and everything inside it`, risk: 'This cannot be undone.' };
  }
  if (/\brm\s+-\S*[rf]/.test(c)) return { what: 'recursively delete files', risk: 'This cannot be undone.' };
  if (/git\s+push\b[^\n]*(--force\b|--force-with-lease|\s-f\b|-\w*f\w*\b)/.test(c)) {
    // branch = last non-flag token after `push` (handles `push --force origin main`, `push -f main`).
    const toks = c.replace(/^.*\bpush\s+/, '').split(/[\s;|&]+/).filter((t) => t && !t.startsWith('-'));
    const b = (toks.length >= 2 ? toks[1] : toks[0]) || 'the remote branch';
    return { what: `force-push to \`${b.replace(/[:^~].*$/, '')}\``, risk: 'Overwrites remote history — teammates can lose commits.' };
  }
  if (/git\s+reset\s+--hard/.test(c)) {
    const r = (c.match(/reset\s+--hard\s+(\S+)/) || [])[1];
    return { what: `hard-reset the current branch${r ? ` to \`${r}\`` : ''}`, risk: 'Discards local commits and uncommitted changes.' };
  }
  if (/git\s+branch\s+-D\b/.test(c)) {
    const n = (c.match(/branch\s+-D\s+(.+?)(?:\s*(?:;|&&|\||$))/) || [])[1] || 'the branch';
    return { what: `force-delete ${n.trim().split(/\s+/).length > 1 ? 'branches' : 'branch'} \`${n.trim()}\``, risk: 'Removes them even if not merged.' };
  }
  if (/git\s+clean\s+-\S*[fd]/.test(c)) return { what: 'delete all untracked files/dirs (git clean)', risk: 'Untracked work is lost.' };
  if (/--no-verify|--no-gpg-sign|-c\s+commit\.gpgsign=false/.test(c)) return { what: 'run a git command that BYPASSES your hooks/signing', risk: 'Skips the safety checks those hooks enforce.' };
  if (/\bgit\s+checkout\s+--\s/.test(c) || /git\s+restore\b/.test(c)) return { what: 'discard local changes to file(s)', risk: 'Uncommitted edits are lost.' };
  return { what: `run \`${c.length > 120 ? c.slice(0, 117) + '…' : c}\``, risk: '' };
}

// Describe an Edit/Write gate in human terms.
function describeEdit(kind, file) {
  const f = file ? `\`${String(file).replace(/\\/g, '/').split('/').slice(-2).join('/')}\`` : 'a file';
  if (kind === 'secret') return { what: `write what looks like a credential into ${f}`, risk: 'Secrets should live in env/secret stores, not the repo.' };
  if (kind === 'read-before-edit') return { what: `edit ${f} before reading its area audit`, risk: 'You may be missing the routes/guards/gotchas of this area.' };
  if (kind === 'scope') return { what: `edit ${f}, which isn't in your declared task scope`, risk: 'Possible scope creep — confirm this is intended.' };
  if (kind === 'tdd') return { what: `create new code in ${f} with no test`, risk: 'The mandated workflow is test-first — write the failing test before the implementation.' };
  return { what: `edit ${f}`, risk: '' };
}

// Build the popup body from a description. The header reads like a human request.
function askBody({ what, risk }, { command, reason } = {}) {
  const lines = [`🛡️ Bumper Bypass Request — about to ${what}.`];
  if (risk) lines.push(`⚠ ${risk}`);
  if (command) lines.push('', `Command: \`${command}\``);
  if (reason) lines.push('', `Gated because: ${reason}`);
  lines.push('', 'Allow this once? (Deny to keep it blocked.)');
  return lines.join('\n');
}

module.exports = { describeBash, describeEdit, askBody };
