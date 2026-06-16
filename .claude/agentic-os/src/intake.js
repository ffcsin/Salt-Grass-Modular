'use strict';
// Issue/PR → task intake. Parses a GitHub issue/PR body into a task scaffold (title, acceptance
// criteria, mentioned files/areas) so "assign an issue" becomes a scoped, traceable task. The gh-CLI
// fetch + PR-open flow lives in the intake skill; this is the pure parse. Zero deps.

// Extract acceptance criteria from checklists / "acceptance"/"AC" sections.
function extractCriteria(body) {
  const out = [];
  const lines = String(body || '').split('\n');
  let inAC = false;
  for (const line of lines) {
    if (/^#{1,6}\s*(acceptance|ac|done when|requirements?)\b/i.test(line)) { inAC = true; continue; }
    if (/^#{1,6}\s/.test(line)) inAC = false;
    const cb = line.match(/^\s*[-*]\s*\[[ xX]\]\s*(.+)/);
    if (cb) { out.push(cb[1].trim()); continue; }
    if (inAC) { const b = line.match(/^\s*[-*]\s*(.+)/); if (b) out.push(b[1].trim()); }
  }
  return [...new Set(out)];
}

// Mentioned file paths and `code` identifiers.
function extractMentions(text) {
  const files = new Set(), idents = new Set();
  const t = String(text || '');
  for (const m of t.match(/`([^`]+)`/g) || []) { const v = m.slice(1, -1); if (/[./]/.test(v) && /\.[a-z]{1,4}$/i.test(v)) files.add(v); else if (/^[A-Za-z_$][\w$]*$/.test(v)) idents.add(v); }
  for (const m of t.match(/\b[\w./-]+\.(ts|tsx|js|jsx|py|go|rs|java|md)\b/g) || []) files.add(m);
  return { files: [...files], idents: [...idents] };
}

function parseIssue({ number, title, body } = {}) {
  const criteria = extractCriteria(body);
  const mentions = extractMentions((title || '') + '\n' + (body || ''));
  return {
    number: number || null,
    title: (title || '').trim(),
    criteria,
    mentionedFiles: mentions.files,
    mentionedIdents: mentions.idents,
    taskScaffold: {
      goal: (title || '').trim(),
      requirements: criteria.map((c, i) => ({ id: `R${i + 1}`, text: c })),
      suspectFiles: mentions.files,
    },
  };
}

module.exports = { extractCriteria, extractMentions, parseIssue };
