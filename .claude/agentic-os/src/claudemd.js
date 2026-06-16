// src/claudemd.js
const BEGIN = '<!-- agentic-os:begin (generated — do not edit inside this block) -->';
const END = '<!-- agentic-os:end -->';

function mergeClaudeMd(existing, block) {
  const managed = `${BEGIN}\n${block}\n${END}`;
  if (existing == null || !String(existing).trim()) {
    return `${managed}\n\n## Project notes\n\n_Your repo-specific notes go here (never touched by agentic-os)._\n`;
  }
  const b = existing.indexOf(BEGIN);
  const e = existing.indexOf(END);
  if (b !== -1 && e !== -1 && e > b) {
    // Our block already present → replace ONLY our block, in place. Everything else untouched.
    return existing.slice(0, b) + managed + existing.slice(e + END.length);
  }
  // Existing CLAUDE.md with no managed block → APPEND at the end (never prepend — the repo's own
  // rules stay on top). For a RICH existing file, prefer the `sync-claude-md` skill (agent merge).
  return existing.replace(/\s*$/, '') + `\n\n${managed}\n`;
}

module.exports = { mergeClaudeMd, BEGIN, END };
