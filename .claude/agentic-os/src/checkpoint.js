'use strict';
// Checkpoint & resume ledger for long-horizon tasks. The existing rollback agent handles git UNDO;
// this is the fast-FORWARD: at each milestone snapshot {git ref, task progress, decisions, open
// todos} so a NEW session resumes a multi-step plan exactly where it stalled (agent success drops
// sharply after ~35 min — checkpoint/resume is the key reliability lever). Append-only JSONL, zero deps.
const fs = require('node:fs');
const path = require('node:path');

const FILE = (root) => path.join(root, '.ecosystem', 'task-state.jsonl');

function saveCheckpoint(root, { label, gitRef, done = [], remaining = [], decisions = [], notes = '', ts } = {}) {
  const rec = { ts: ts || '', label: label || 'checkpoint', gitRef: gitRef || '', done, remaining, decisions, notes };
  const f = FILE(root); fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.appendFileSync(f, JSON.stringify(rec) + '\n');
  return rec;
}

function loadCheckpoints(root) {
  try { return fs.readFileSync(FILE(root), 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); }
  catch { return []; }
}

function latest(root) { const all = loadCheckpoints(root); return all[all.length - 1] || null; }

// Render the latest checkpoint for re-priming a fresh session.
function renderResume(root) {
  const cp = latest(root);
  if (!cp) return '';
  const lines = [`## Resume: ${cp.label}`, cp.gitRef ? `_at git ${cp.gitRef}_` : ''];
  if (cp.done.length) lines.push('**Done:**', ...cp.done.map((d) => `- ✅ ${d}`));
  if (cp.remaining.length) lines.push('**Remaining:**', ...cp.remaining.map((d) => `- ⬜ ${d}`));
  if (cp.decisions.length) lines.push('**Decisions:**', ...cp.decisions.map((d) => `- ${d}`));
  if (cp.notes) lines.push('**Notes:** ' + cp.notes);
  return lines.filter(Boolean).join('\n');
}

module.exports = { saveCheckpoint, loadCheckpoints, latest, renderResume };
