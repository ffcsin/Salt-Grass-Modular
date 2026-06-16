'use strict';
// Human-readable view of the edit log (.ecosystem/audit-log.jsonl) that the PostToolUse hook
// appends to. The JSONL is the machine trail; this renders .ecosystem/edit-ledger.md grouped
// by day → area, so a human (or future Claude) can read "what changed, by whom, where" at a glance.
const fs = require('node:fs');
const path = require('node:path');

function loadEdits(root) {
  try {
    return fs.readFileSync(path.join(root, '.ecosystem', 'audit-log.jsonl'), 'utf8')
      .split('\n').filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

function renderLedger(root) {
  const edits = loadEdits(root);
  const byDay = {};
  for (const e of edits) {
    const day = (e.ts || '').slice(0, 10) || 'undated';
    (byDay[day] = byDay[day] || []).push(e);
  }
  const lines = ['# Edit Ledger', '', `_${edits.length} tracked edit(s). Auto-appended by the PostToolUse hook; rendered on demand._`, ''];
  for (const day of Object.keys(byDay).sort().reverse()) {
    lines.push(`## ${day}`, '');
    const byArea = {};
    for (const e of byDay[day]) (byArea[e.area || 'ungrouped'] = byArea[e.area || 'ungrouped'] || []).push(e);
    for (const area of Object.keys(byArea).sort()) {
      lines.push(`### ${area}`);
      for (const e of byArea[area]) {
        const f = (e.file || '').replace(/\\/g, '/').split('/').slice(-2).join('/');
        const why = e.why ? ` — ${e.why}` : '';
        lines.push(`- \`${e.action || 'edit'}\` ${f} · ${e.who || 'unknown'} · ${(e.ts || '').slice(11, 19)}${why}`);
      }
      lines.push('');
    }
  }
  const out = path.join(root, '.ecosystem', 'edit-ledger.md');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, lines.join('\n'));
  return out;
}

module.exports = { loadEdits, renderLedger };
