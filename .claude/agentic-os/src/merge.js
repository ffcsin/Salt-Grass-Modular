// src/merge.js
const fs = require('node:fs');
const path = require('node:path');

// Machine-owned files are regenerated freely. Anything else under .ecosystem/
// (notably the human dirs below) is never touched by the engine.
const MACHINE_FILES = new Set([
  'map.json', 'extractor.config.json', 'inventory.md', 'wireup.md', 'orphans.md', 'accuracy-report.md',
  'ECOSYSTEM.md', 'path-to-area.json',
]);
const HUMAN_DIRS = ['intent', 'decisions'];

function writeEcosystem(root, machineOutputs) {
  const eco = path.join(root, '.ecosystem');
  fs.mkdirSync(eco, { recursive: true });
  for (const dir of HUMAN_DIRS) fs.mkdirSync(path.join(eco, dir), { recursive: true }); // create-if-missing only

  for (const [name, content] of Object.entries(machineOutputs)) {
    if (!MACHINE_FILES.has(name)) throw new Error(`refusing to write non-machine file: ${name}`);
    fs.writeFileSync(path.join(eco, name), content);
  }
  return eco;
}

const MACHINE_DIRS = ['areas']; // machine-owned subdirs (regenerated)

function isMachinePath(rel) {
  const norm = rel.replace(/\\/g, '/');
  if (MACHINE_FILES.has(norm)) return true;
  return MACHINE_DIRS.some((d) => norm.startsWith(d + '/') && (norm.endsWith('.md') || norm.endsWith('.json')));
}

function writeMachine(root, rel, content) {
  if (!isMachinePath(rel)) throw new Error(`not a machine path: ${rel}`);
  const full = path.join(root, '.ecosystem', rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  return full;
}

function writeHumanIfMissing(root, rel, content) {
  const full = path.join(root, '.ecosystem', rel);
  if (fs.existsSync(full)) return false;
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  return true;
}

module.exports = { writeEcosystem, MACHINE_FILES, HUMAN_DIRS, MACHINE_DIRS, isMachinePath, writeMachine, writeHumanIfMissing };
