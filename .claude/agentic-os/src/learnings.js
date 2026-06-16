'use strict';
// Per-repo learning ledger — the repo accumulates knowledge over its life.
// NOT cross-project (each repo owns its own .ecosystem/learnings.jsonl). Seeded by the
// glossary at bootstrap; GROWS as skills/agents discover conventions, gotchas, fixes, and
// intent. Surfaced back into pre-edit context so the repo teaches the next edit.
const fs = require('node:fs');
const path = require('node:path');

const TYPES = ['convention', 'gotcha', 'fix', 'pattern', 'decision', 'intent'];
const file = (root) => path.join(root, '.ecosystem', 'learnings.jsonl');

function normText(s) { return String(s || '').trim().replace(/\s+/g, ' ').toLowerCase(); }

function loadLearnings(root) {
  try {
    return fs.readFileSync(file(root), 'utf8').split('\n').filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

// Append a learning. Dedupes on (type + normalized text). Returns the record or null if dupe/invalid.
function recordLearning(root, { type, text, area, file: srcFile, source, ts } = {}) {
  const t = TYPES.includes(type) ? type : 'gotcha';
  const body = String(text || '').trim();
  if (!body) return null;
  const existing = loadLearnings(root);
  const key = t + '|' + normText(body);
  if (existing.some((e) => e.type + '|' + normText(e.text) === key)) return null;
  const rec = { ts: ts || '', type: t, text: body, area: area || '', file: srcFile || '', source: source || 'manual' };
  const f = file(root);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.appendFileSync(f, JSON.stringify(rec) + '\n');
  return rec;
}

// Learnings relevant to a file/area — what the repo has learned that bears on this edit.
function learningsFor(root, { area, file: srcFile } = {}) {
  const a = area || '', sf = (srcFile || '').replace(/\\/g, '/');
  return loadLearnings(root).filter((l) =>
    (a && l.area === a) || (sf && l.file && sf.endsWith(l.file.replace(/\\/g, '/'))) || (!l.area && !l.file));
}

// Human-readable rollup grouped by type → .ecosystem/learnings.md
function renderLearnings(root) {
  const all = loadLearnings(root);
  const lines = ['# Repo Learnings', '', `_${all.length} learning(s) accumulated for this repo. Grows as agentic-os works the codebase._`, ''];
  for (const t of TYPES) {
    const group = all.filter((l) => l.type === t);
    if (!group.length) continue;
    lines.push(`## ${t[0].toUpperCase() + t.slice(1)} (${group.length})`, '');
    for (const l of group) {
      const tag = [l.area && `area: ${l.area}`, l.file && l.file, l.source && `via ${l.source}`].filter(Boolean).join(' · ');
      lines.push(`- ${l.text}${tag ? `  \n  _${tag}_` : ''}`);
    }
    lines.push('');
  }
  const out = path.join(root, '.ecosystem', 'learnings.md');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, lines.join('\n'));
  return out;
}

module.exports = { TYPES, loadLearnings, recordLearning, learningsFor, renderLearnings };
