// hooks/lib/profile.js
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function profilePath() {
  return process.env.AGENTIC_OS_PROFILE_PATH || path.join(os.homedir(), '.agentic-os', 'profile.json');
}
const DEFAULTS = { name: 'unknown', role: 'default', skillLevel: 'unknown', email: '', attribution: 'co-authored', identities: [], preferences: { verbosity: 'normal' } };
// enforcementMode (ask|block|warn) may be set on a profile to pin the owner's gate strictness; it is NOT a secret.
const SECRET_KEYS = /token|secret|key|password|credential/i;
// For free-text learning BODIES, the bare-substring SECRET_KEYS over-blocks ("keyword", "monkey" via
// "key"). Use a word-boundaried, secret-SHAPED pattern instead (review LOW finding).
const SECRET_TEXT = /\b(api[_-]?key|secret|token|password|passwd|credential|bearer|private[_-]?key)\b/i;
const normAttribution = (a) => (String(a || '').toLowerCase() === 'solo' ? 'solo' : 'co-authored');

function loadProfile() {
  try {
    const p = JSON.parse(fs.readFileSync(profilePath(), 'utf8'));
    return { ...DEFAULTS, ...p, preferences: { ...DEFAULTS.preferences, ...(p.preferences || {}) } };
  } catch { return { ...DEFAULTS, _missing: true }; }
}
function profileExists() { try { return fs.existsSync(profilePath()); } catch { return false; } }
// CONFIGURED = the user actually answered (real name/role) or explicitly declined. A bootstrap-scaffolded
// placeholder ({role:'default', note:'edit me…'}) is NOT configured — so the onboarding prompt still
// fires for a fresh user even though phase-18 created a stub file (else the auto-prompt never shows).
function profileConfigured(p) {
  p = p || loadProfile();
  if (p._missing) return false;
  if (p.declined === true) return true;
  return (p.name && p.name !== 'unknown') || (p.role && p.role !== 'default');
}
function saveProfile(updates) {
  const cur = loadProfile();
  const clean = {};
  for (const [k, v] of Object.entries(updates || {})) { if (!SECRET_KEYS.test(k)) clean[k] = v; }
  const now = new Date().toISOString();
  const merged = { ...cur, ...clean, preferences: { ...cur.preferences, ...(clean.preferences || {}) }, updatedAt: now };
  if (!merged.createdAt) merged.createdAt = now;
  delete merged._missing;
  const p = profilePath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(merged, null, 2) + '\n');
  return merged;
}
// Cross-repo user learning. Durable facts ABOUT the collaborator (preferences, corrections, working
// style) live on the GLOBAL profile, so a correction made in ANY repo is known in EVERY repo with this
// system. Capped + deduped (newest kept); secret-named text is dropped. Returns the record or null.
const USER_LEARN_CAP = 40;
function recordUserLearning(text, { type } = {}) {
  const body = String(text || '').trim();
  if (!body || SECRET_TEXT.test(body)) return null;
  const cur = loadProfile();
  const list = Array.isArray(cur.learnings) ? cur.learnings.slice() : [];
  const norm = (s) => s.trim().replace(/\s+/g, ' ').toLowerCase();
  if (list.some((l) => norm(l.text) === norm(body))) return null; // dupe
  const rec = { type: type || 'preference', text: body, ts: new Date().toISOString() };
  list.push(rec);
  while (list.length > USER_LEARN_CAP) list.shift(); // keep the most recent
  const merged = { ...cur, learnings: list, updatedAt: new Date().toISOString() };
  if (!merged.createdAt) merged.createdAt = merged.updatedAt;
  delete merged._missing;
  const p = profilePath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(merged, null, 2) + '\n');
  return rec;
}

// Turn the profile into a one-line guidance string injected at SessionStart so Claude adapts HOW it
// talks to THIS dev (the Grok vision: comm-style jargon/simple/both, vibe, strengths, weak spots) —
// distinct from the role-driven hook STRICTNESS. Empty if no profile yet.
function profileGuidance(p) {
  p = p || loadProfile();
  if (p._missing) return '';
  const parts = [];
  const cs = (p.preferences && p.preferences.communicationStyle) || p.communicationStyle;
  if (cs === 'both') parts.push('explain BOTH ways — the technical version first, then a plain "like you are seven" version');
  else if (cs === 'simple') parts.push('keep explanations simple/dumbed-down, minimal jargon');
  else if (cs === 'technical') parts.push('full technical depth, jargon is fine');
  const vibe = (p.preferences && p.preferences.vibe) || p.vibe;
  if (vibe === 'casual-funny') parts.push('casual + a bit funny is welcome');
  else if (vibe === 'professional') parts.push('keep the tone professional');
  if (p.strengths) parts.push(`strong in ${p.strengths}`);
  if (p.needsHelpWith) parts.push(`extra care around ${p.needsHelpWith}`);
  const who = p.name && p.name !== 'unknown' ? `${p.name}${p.role && p.role !== 'default' ? ` (${p.role})` : ''}` : 'this developer';
  // Cross-repo learned facts about the user (most recent few) — known in every repo with this system.
  const learned = Array.isArray(p.learnings) ? p.learnings.slice(-6).map((l) => l.text) : [];
  if (!parts.length && !learned.length) return '';
  let out = `[agentic-os profile] You are working with ${who}.`;
  if (parts.length) out += ` Adapt: ${parts.join(' · ')}.`;
  if (learned.length) out += ` Known preferences (learned across repos): ${learned.join('; ')}.`;
  return out;
}

// MULTI-ORG IDENTITY. A dev who works for several companies needs a different commit email per repo.
// The profile holds a DEFAULT identity (name/email/attribution) + an `identities[]` list, each matched
// against a `signal` (the repo's git remote URL, else its path). The first matching identity wins;
// its email/name/attribution override the default. So LPAI repos commit under the LPAI email, Tradeify
// repos under the Tradeify email — automatically, no per-repo fiddling.
//   identities: [{ match: 'dronequote|leadprospecting', email: 'me@leadprospecting.ai' },
//                { match: 'tradeify', email: 'me@tradeify.com', attribution: 'co-authored' }]
// Normalize a remote URL (or path) to its OWNER/REPO part — strip scheme, host, .git. CRITICAL: matching
// against the RAW url let a 2-char match like "co"/"io" hit "github.com" and stamp the wrong company's
// email on commits (review HIGH). Matching the owner/repo segment removes the host noise.
//   git@github.com:secops-tdfy/agentic-os.git → secops-tdfy/agentic-os
//   https://github.com/secops-tdfy/agentic-os → secops-tdfy/agentic-os
//   a filesystem path → its last two segments
function ownerRepoSignal(signal) {
  let s = String(signal || '').trim().toLowerCase().replace(/\.git$/, '');
  if (/^[a-z][a-z0-9+.-]*:\/\//.test(s)) s = s.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+\//, ''); // scheme://host/
  else if (/^[^@\s]+@[^:\s]+:/.test(s)) s = s.replace(/^[^@\s]+@[^:\s]+:/, '');                // git@host:
  else s = s.replace(/\\/g, '/').split('/').filter(Boolean).slice(-2).join('/');               // a path
  return s;
}
// Resolve the identity for a repo. Matches each identity's `match` regex against the OWNER/REPO signal,
// and picks the MOST-SPECIFIC (longest matched span) — not first-wins — so a broad entry can't shadow a
// precise one (review HIGH). Falls back to the profile default with matched:null.
function resolveIdentity(p, signal) {
  p = p || loadProfile();
  const base = { name: p.name, email: p.email || '', attribution: normAttribution(p.attribution), matched: null };
  const s = ownerRepoSignal(signal);
  if (!s || !Array.isArray(p.identities)) return base;
  let best = null, bestLen = -1;
  for (const id of p.identities) {
    if (!id || !id.match) continue;
    let m; try { m = new RegExp(id.match, 'i').exec(s); } catch { const i = s.indexOf(String(id.match).toLowerCase()); m = i >= 0 ? [String(id.match)] : null; }
    if (m && m[0] && m[0].length > bestLen) { best = id; bestLen = m[0].length; }
  }
  if (!best) return base;
  return { name: best.name || p.name, email: best.email || p.email || '', attribution: normAttribution(best.attribution || p.attribution), matched: best.match };
}
// Append/update a per-org identity (dedup by `match`). Returns the saved profile, or { error } on bad input.
function addIdentity({ match, email, name, attribution } = {}) {
  if (!match || String(match).length < 3) return { error: 'match must be at least 3 chars (a 2-char match hits github.com and mis-attributes commits)' };
  if (attribution && !['solo', 'co-authored'].includes(String(attribution).toLowerCase())) return { error: "attribution must be 'solo' or 'co-authored'" };
  const warn = /github|gitlab|\.com|\bgit\b/i.test(match) ? `warning: "${match}" may also match the host in remote URLs — prefer the org/repo slug` : null;
  const cur = loadProfile();
  const ids = Array.isArray(cur.identities) ? cur.identities.slice() : [];
  const rec = { match, ...(email ? { email } : {}), ...(name ? { name } : {}), ...(attribution ? { attribution: normAttribution(attribution) } : {}) };
  const i = ids.findIndex((x) => x && x.match === match);
  if (i >= 0) ids[i] = { ...ids[i], ...rec }; else ids.push(rec);
  const saved = saveProfile({ identities: ids });
  return warn ? { ...saved, warning: warn } : saved;
}

// The repo's identity signal: its git remote URL (best for org matching), else the repo path.
function repoSignal(projectDir) {
  try { const r = require('node:child_process').execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: projectDir || '.', encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); if (r) return r; } catch {}
  return String(projectDir || '');
}

// Identity guidance injected at SessionStart — makes the PROFILE the identity source for the work, so
// commits are authored as the user (not the agent), with the RIGHT per-org email + the user's
// attribution choice. GitHub ops already run under the user's own `gh`/token; this covers git
// authorship + the commit-message trailer policy (the only place "Claude" otherwise appears).
function identityNote(projectDir) {
  const p = loadProfile();
  if (p._missing || !p.name || p.name === 'unknown') return ''; // only for a configured profile
  const id = resolveIdentity(p, repoSignal(projectDir));
  const parts = [`author commits as "${id.name}"${id.email ? ` <${id.email}>` : ''}${id.matched ? ` (org-matched: ${id.matched})` : ''}`];
  if (id.attribution === 'solo') parts.push('attribute to the user ONLY — do NOT add an AI/Claude `Co-Authored-By` trailer');
  else parts.push('the user includes the AI co-author trailer (transparency) — keep adding it');
  return `[agentic-os identity] This repo's work is the user's: ${parts.join('; ')}. (GitHub/git run under the user's own account.) Align git config: \`node <plugin>/bin/git-identity.js .\``;
}

module.exports = { loadProfile, saveProfile, recordUserLearning, profileExists, profileConfigured, profilePath, profileGuidance, identityNote, resolveIdentity, addIdentity, repoSignal, DEFAULTS };
