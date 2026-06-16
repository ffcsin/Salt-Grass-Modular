function checkBash(cmd) {
  if (!cmd) return null;
  if (/git\s+push\b[^\n]*\s(-f\b|--force\b)(?!-with-lease)/.test(cmd)) return { block: true, reason: 'Refusing `git push --force` (use --force-with-lease, or set AGENTIC_OS_OVERRIDE).' };
  if (/git\s+reset\s+--hard\b/.test(cmd)) return { block: true, reason: '`git reset --hard` discards work — set AGENTIC_OS_OVERRIDE to proceed.' };
  if (/\brm\s+-[a-z]*r[a-z]*f|\brm\s+-[a-z]*f[a-z]*r/.test(cmd)) return { block: true, reason: '`rm -rf` blocked — set AGENTIC_OS_OVERRIDE to proceed.' };
  if (/--no-verify\b|--no-gpg-sign\b/.test(cmd)) return { block: true, reason: 'Skipping hooks/signing blocked — set AGENTIC_OS_OVERRIDE to proceed.' };
  return null;
}
module.exports = { checkBash };
