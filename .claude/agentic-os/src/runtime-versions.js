'use strict';
// Runtime-version detection — read the versions the repo ACTUALLY pins so generated CI uses the
// dev-env truth instead of a hardcoded image tag. (field testing: the repo pins go 1.25.4 + node 24 via
// mise.toml, but the generated backstop said `golang:1.23` and setup-node 22.) Priority: mise.toml
// (the dev-env manager — what the team really runs) > language-native pins (.nvmrc, go.mod directive,
// engines.node, .python-version). Line-based parsing, zero deps, never executes anything.
const fs = require('node:fs');
const path = require('node:path');

const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } };
const majorMinor = (v) => { const m = String(v || '').match(/(\d+)(?:\.(\d+))?/); return m ? (m[2] !== undefined ? `${m[1]}.${m[2]}` : m[1]) : null; };
const major = (v) => { const m = String(v || '').match(/\d+/); return m ? m[0] : null; };

// Parse the [tools] table of mise.toml / .mise.toml → { go: '1.25.4', node: '24', ... }.
function miseTools(root) {
  const out = {};
  const text = read(path.join(root, 'mise.toml')) || read(path.join(root, '.mise.toml'));
  let inTools = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*\[tools\]/.test(line)) { inTools = true; continue; }
    if (/^\s*\[/.test(line)) { inTools = false; continue; }
    if (!inTools) continue;
    const m = line.match(/^\s*"?([a-zA-Z0-9_:@/.-]+)"?\s*=\s*"([^"]+)"/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

// componentDirs: extra dirs to probe for go.mod / package.json engines (backend/, frontend/, …).
function runtimeVersions(root, componentDirs = ['backend', 'frontend', 'server', 'client', 'web', 'api']) {
  const mise = miseTools(root);
  const dirs = ['.', ...componentDirs];

  let go = mise.go ? majorMinor(mise.go) : null;
  if (!go) for (const d of dirs) { const m = read(path.join(root, d, 'go.mod')).match(/^go\s+(\d+\.\d+)/m); if (m) { go = m[1]; break; } }

  let node = mise.node ? major(mise.node) : null;
  if (!node) { const nvm = read(path.join(root, '.nvmrc')).trim(); if (nvm) node = major(nvm); }
  if (!node) for (const d of dirs) {
    try { const eng = JSON.parse(read(path.join(root, d, 'package.json')) || '{}').engines; if (eng && eng.node) { node = major(eng.node); break; } } catch { /* malformed pkg */ }
  }

  let python = mise.python ? majorMinor(mise.python) : null;
  if (!python) { const pv = read(path.join(root, '.python-version')).trim(); if (pv) python = majorMinor(pv); }

  return { go, node, python };
}

module.exports = { runtimeVersions, miseTools };
