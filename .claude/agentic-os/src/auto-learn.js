'use strict';
// Automatic learning capture — closes the write side of the learning loop (the read side, learningsFor,
// already injects repo learnings at edit time). Runs at Stop, deterministic, zero-LLM-in-hook. Two sources:
//
//   1) MARKER SCRAPE — the agent persists a durable discovery by writing, anywhere in its turn:
//        LEARNING(gotcha): cron tz is UTC not local — off-by-7h bug lived here
//        LEARNING(user): this dev wants direct pushes to main, no feature branches
//      `user`-typed markers (and the USER-LEARNING: form) go to the GLOBAL profile (cross-repo);
//      all others go to this repo's .ecosystem/learnings.jsonl.
//   2) GIT COMMITS — new fix()/feat() conventional-commit subjects since the last capture become repo
//      learnings (type fix/pattern, area = commit scope). High-signal, zero agent effort. A head marker
//      (.ecosystem/.learn-head) bounds it; first run seeds the marker and backfills nothing.
//
// "Automatic" honestly: the hook can't read minds, so deliberate discoveries use the one-token marker;
// shipped fixes are captured for free from git. No fake "it captures everything".
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const L = require('./learnings');

const REPO_TYPES = new Set(['convention', 'gotcha', 'fix', 'pattern', 'decision', 'intent']);
// LEARNING(type): text   |   USER-LEARNING: text   |   LEARN: text (→ gotcha)
const MARKER_RE = /(?:^|\n)\s*(?:LEARNING\((convention|gotcha|fix|pattern|decision|intent|user)\)|USER-?LEARNING|LEARN)\s*:\s*(.+)/gi;

function parseMarkers(text) {
  const out = [];
  const s = String(text || '');
  for (const m of s.matchAll(MARKER_RE)) {
    const raw = (m[0] || '');
    const isUser = /user/i.test(raw.slice(0, raw.indexOf(':')));
    const type = m[1] && m[1].toLowerCase();
    out.push({ scope: isUser ? 'user' : 'repo', type: type && type !== 'user' ? type : 'gotcha', text: m[2].trim() });
  }
  return out;
}

// New fix()/feat() subjects since the head marker → [{type, area, text}].
function commitLearnings(root) {
  const marker = path.join(root, '.ecosystem', '.learn-head');
  let last = null; try { last = fs.readFileSync(marker, 'utf8').trim(); } catch {}
  let head = null; try { head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {}
  if (!head) return [];
  if (!last) { try { fs.writeFileSync(marker, head); } catch {} return []; } // first run: seed, don't backfill
  if (last === head) return [];
  let log = '';
  try { log = execFileSync('git', ['log', `${last}..HEAD`, '--no-merges', '--format=%s'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return []; }
  const out = [];
  for (const subj of log.split('\n').map((l) => l.trim()).filter(Boolean)) {
    const m = subj.match(/^(fix|feat)\(([a-z0-9_.\/-]+)\)!?:\s*(.+)/i);
    if (!m) continue;
    if (/\[skip ci\]|chore\(ecosystem\)/i.test(subj)) continue;
    out.push({ type: m[1].toLowerCase() === 'fix' ? 'fix' : 'pattern', area: m[2], text: `${m[1]}: ${m[3]}` });
  }
  try { fs.writeFileSync(marker, head); } catch {}
  return out;
}

// Capture a finished session. assistantText = all of this turn's agent text; profileApi = the profile
// lib (injected so the hook's lib copy is used). Returns { repo, user } counts.
function captureSession(root, assistantText, profileApi) {
  let repo = 0, user = 0;
  for (const mk of parseMarkers(assistantText)) {
    if (mk.scope === 'user') {
      try { if (profileApi && profileApi.recordUserLearning && profileApi.recordUserLearning(mk.text, { type: 'preference' })) user++; } catch {}
    } else if (REPO_TYPES.has(mk.type)) {
      if (L.recordLearning(root, { type: mk.type, text: mk.text, source: 'auto:marker', ts: new Date().toISOString() })) repo++;
    }
  }
  for (const c of commitLearnings(root)) {
    if (L.recordLearning(root, { type: c.type, text: c.text, area: c.area, source: 'auto:commit', ts: new Date().toISOString() })) repo++;
  }
  if (repo) { try { L.renderLearnings(root); } catch {} }
  return { repo, user };
}

module.exports = { parseMarkers, commitLearnings, captureSession, MARKER_RE };
