'use strict';
// Stale-context detection. Tracks a content hash of every file the agent READS this session; on a
// later turn, if a read file changed on disk (the agent's own edit or an external process), flag it
// as stale so the agent re-reads before reasoning on an outdated snapshot — a documented top failure
// mode ("context rot / drift"). Pairs with the existing read tracker + edit hooks. Zero deps.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const STORE = (root) => path.join(root, '.ecosystem', '.read-hashes.json');

function hashFile(abs) { try { return crypto.createHash('sha1').update(fs.readFileSync(abs)).digest('hex').slice(0, 16); } catch { return null; } }

function load(root) { try { return JSON.parse(fs.readFileSync(STORE(root), 'utf8')); } catch { return {}; } }
function save(root, data) { try { fs.mkdirSync(path.dirname(STORE(root)), { recursive: true }); fs.writeFileSync(STORE(root), JSON.stringify(data)); } catch {} }

// Record that a file was read this turn (store its current hash + turn marker).
function recordRead(root, filePath, turn) {
  if (!filePath) return;
  const abs = path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
  const h = hashFile(abs); if (!h) return;
  const data = load(root);
  const rel = path.relative(root, abs).replace(/\\/g, '/');
  data[rel] = { hash: h, turn: turn || 0 };
  save(root, data);
}

// Which previously-read files have since changed on disk? Returns [{file, readTurn}].
function detectStale(root) {
  const data = load(root);
  const stale = [];
  for (const [rel, rec] of Object.entries(data)) {
    const abs = path.join(root, rel);
    const now = hashFile(abs);
    if (now && now !== rec.hash) stale.push({ file: rel, readTurn: rec.turn });
  }
  return stale;
}

// Build a one-line nudge (or null). Optionally refresh the stored hash so it fires once per change.
function staleNudge(root, { refresh = true } = {}) {
  const stale = detectStale(root);
  if (!stale.length) return null;
  if (refresh) { const data = load(root); for (const s of stale) { const h = hashFile(path.join(root, s.file)); if (h) data[s.file].hash = h; } save(root, data); }
  const list = stale.slice(0, 8).map((s) => s.file).join(', ');
  return `[agentic-os] Stale context: ${stale.length} file(s) you read earlier have since changed (${list}). Re-read before reasoning about them — your in-context copy is outdated.`;
}

module.exports = { recordRead, detectStale, staleNudge, hashFile, load };
