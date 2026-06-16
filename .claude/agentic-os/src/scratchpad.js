'use strict';
// Session scratchpad / working memory. A place for the agent to write notes OUTSIDE the context
// window — task plan, decisions, dead-ends, "what I've already confirmed" — so it survives
// compaction and isn't re-derived (Anthropic's "structured note-taking / agentic memory"). Distinct
// from the persistent cross-session learnings ledger: this is WITHIN-session working memory, cleared
// per task. Append-only JSONL + a render. Zero deps.
const fs = require('node:fs');
const path = require('node:path');

const FILE = (root) => path.join(root, '.ecosystem', '.scratchpad.jsonl');
const KINDS = ['plan', 'decision', 'deadend', 'confirmed', 'todo', 'note'];

function note(root, { kind, text, ts } = {}) {
  const k = KINDS.includes(kind) ? kind : 'note';
  const body = String(text || '').trim(); if (!body) return null;
  const rec = { ts: ts || '', kind: k, text: body };
  const f = FILE(root); fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.appendFileSync(f, JSON.stringify(rec) + '\n');
  return rec;
}

function recall(root, { kind } = {}) {
  let recs = [];
  try { recs = fs.readFileSync(FILE(root), 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); } catch {}
  return kind ? recs.filter((r) => r.kind === kind) : recs;
}

// Render current working memory for re-injection (e.g. after compaction).
function render(root) {
  const recs = recall(root);
  if (!recs.length) return '';
  const lines = ['## Session working memory (scratchpad)'];
  for (const k of KINDS) {
    const g = recs.filter((r) => r.kind === k); if (!g.length) continue;
    lines.push(`**${k}:**`, ...g.map((r) => `- ${r.text}`));
  }
  return lines.join('\n');
}

// Clear the scratchpad (new task).
function clear(root) { try { fs.unlinkSync(FILE(root)); } catch {} }

module.exports = { note, recall, render, clear, KINDS };
