'use strict';
// Session report — the "what changed & why" artifact. Extends the edit ledger into a single
// reviewable per-session report: files changed (+ area), the run trace (tool timeline), and budget
// spend. The 2026 audit standard moved from "show logs" to "reproduce + name every input + one
// reviewable artifact." Zero deps — composes edit-ledger + trace + budget.
const fs = require('node:fs');
const path = require('node:path');

function renderSessionReport(root, { transcriptPath } = {}) {
  const lines = ['# Session report', ''];
  // edits
  try {
    const { loadEdits } = require('./edit-ledger');
    const edits = loadEdits(root);
    lines.push(`## Files changed (${edits.length})`, '');
    const byArea = {};
    for (const e of edits) (byArea[e.area || 'ungrouped'] = byArea[e.area || 'ungrouped'] || []).push(e);
    for (const [area, es] of Object.entries(byArea)) { lines.push(`**${area}**`); for (const e of es) lines.push(`- \`${e.action}\` ${(e.file || '').split(/[\\/]/).pop()} — ${e.who} @ ${(e.ts || '').slice(0, 19)}`); }
    lines.push('');
  } catch {}
  // trace + budget
  if (transcriptPath) {
    try {
      const { readTranscript, sumUsage } = require('./budget');
      const { transcriptToSpans } = require('./trace');
      const entries = readTranscript(transcriptPath);
      const spans = transcriptToSpans(entries);
      const usage = sumUsage(entries);
      const tools = spans.filter((s) => s.kind === 'tool');
      lines.push('## Run summary', '', `- Tool calls: ${tools.length}`, `- Tokens: ${usage.total.toLocaleString()} (in ${usage.input.toLocaleString()} / out ${usage.output.toLocaleString()})`, '');
    } catch {}
  }
  return lines.join('\n');
}

function writeSessionReport(root, opts) {
  const md = renderSessionReport(root, opts);
  const f = path.join(root, '.ecosystem', 'SESSION_REPORT.md');
  fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, md + '\n');
  return f;
}

module.exports = { renderSessionReport, writeSessionReport };
