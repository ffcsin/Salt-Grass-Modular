#!/usr/bin/env node
// Deterministic pipeline for Deep-Extraction Mode. The agentic fan-out (Workflow) produces raw
// per-file inventories; this CLI normalizes + line-corrects + selfCheck-verifies + merges them into
// .ecosystem/deep-map.json. Run with no inventories file = selection mode (prints API-bearing batches).
const fs = require('node:fs');
const path = require('node:path');
const { selectFromRepo } = require('../src/select-files');
const { normalizeInventory } = require('../src/normalize-inventory');
const { lineCorrectInventory } = require('../src/line-correct');
const { mergeDeep } = require('../src/merge-deep');
const { selfCheckDrift } = require('../src/deep-verify');

// Coerce an inventory file path to repo-relative + forward slashes. Agents sometimes emit an
// ABSOLUTE path (e.g. 'c:/Projects/app/services/x.ts') instead of the relative one they were given;
// left alone that breaks line-correction (path.join(root, abs) is wrong) and splits the file's
// identity in the merge. Normalize so every file keys consistently.
function toRepoRelative(root, f) {
  let p = String(f || '').replace(/\\/g, '/');
  const r = path.resolve(root).replace(/\\/g, '/').replace(/\/+$/, '');
  if (p.toLowerCase().startsWith(r.toLowerCase() + '/')) return p.slice(r.length + 1);
  if (path.isAbsolute(p)) {
    const rel = path.relative(root, p).replace(/\\/g, '/');
    if (rel && !rel.startsWith('..')) return rel;
  }
  return p.replace(/^\/+/, '');
}

function buildDeepMap(root, rawInventories) {
  const out = [];
  let mismatches = 0;
  for (const raw of rawInventories) {
    let inv = normalizeInventory(raw);
    inv.file = toRepoRelative(root, inv.file);
    let content = '';
    try { content = fs.readFileSync(path.join(root, inv.file), 'utf8'); } catch {}
    if (content) inv = lineCorrectInventory(inv, content);
    if (content) { const d = selfCheckDrift(inv.selfCheck, content); if (!d.ok) mismatches++; }
    out.push(inv);
  }
  const dm = mergeDeep(out);
  dm.accuracy = { mismatches, precision: null, trusted: false };
  return dm;
}

function write(root, dm) {
  const eco = path.join(root, '.ecosystem');
  fs.mkdirSync(eco, { recursive: true });
  fs.writeFileSync(path.join(eco, 'deep-map.json'), JSON.stringify(dm, null, 2) + '\n');
  return path.join(eco, 'deep-map.json');
}

if (require.main === module) {
  const root = path.resolve(process.argv[2] || '.');
  const invFile = process.argv[3];
  if (!invFile) { console.log(JSON.stringify(selectFromRepo(root), null, 2)); process.exit(0); }
  const raw = JSON.parse(fs.readFileSync(invFile, 'utf8'));
  const dm = buildDeepMap(root, raw);
  const p = write(root, dm);
  console.log(`deep-map: ${dm.files.length} files, ${dm.wireup.length} wireup, ${dm.findings.length} findings, ${dm.accuracy.mismatches} selfCheck mismatch(es) -> ${p}`);
}

module.exports = { buildDeepMap, write, toRepoRelative };
