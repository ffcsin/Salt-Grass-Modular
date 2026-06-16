// src/deep-select.js
// Workspace-aware, size-aware batching for the deep-extract sweep. Big files go solo (they need
// multi-page reads), medium in pairs, small grouped — and batches never mix workspaces, so the
// per-sweep glossary stays coherent. Pure functions + an FS entry; no agent logic here.
const fs = require('node:fs');
const path = require('node:path');
const { loadConfig } = require('./compile');
const { executeOnRepo } = require('./execute');
const { apiBearingFiles } = require('./select-files');

// The workspace/project a file belongs to (monorepo-aware). apps/x, services/x, packages/x → that
// pair; otherwise the top dir. Single-package repos collapse to one workspace ('.').
function workspaceOf(file) {
  const p = String(file).split('/');
  if (['apps', 'services', 'packages'].includes(p[0]) && p[1]) return `${p[0]}/${p[1]}`;
  return p.length > 1 ? p[0] : '.';
}

// Size-aware batching within one already-grouped list. big(>bigLines) solo, med(>medLines) pairs,
// rest in groups of `small`.
function sizeBatch(items, { bigLines = 2000, medLines = 800, small = 6 } = {}) {
  const big = items.filter((r) => r.n > bigLines);
  const med = items.filter((r) => r.n > medLines && r.n <= bigLines);
  const sm = items.filter((r) => r.n <= medLines);
  const out = [];
  for (const r of big) out.push([r.f]);
  for (let i = 0; i < med.length; i += 2) out.push(med.slice(i, i + 2).map((r) => r.f));
  for (let i = 0; i < sm.length; i += small) out.push(sm.slice(i, i + small).map((r) => r.f));
  return out;
}

// Build batches for a set of files (with line counts), grouped by workspace then size-batched.
function batchFiles(rows, opts) {
  const byWs = {};
  for (const r of rows) (byWs[workspaceOf(r.f)] = byWs[workspaceOf(r.f)] || []).push(r);
  const batches = [];
  for (const ws of Object.keys(byWs).sort()) batches.push(...sizeBatch(byWs[ws], opts));
  return batches;
}

// FS entry: read the committed extractor config, find API-bearing files, attach line counts,
// return { files, batches, byWorkspace }.
function selectDeep(root, opts = {}) {
  const cfg = loadConfig(root);
  if (!cfg) throw new Error('no extractor config — run discover/compile (bin/map.js) first');
  const raw = executeOnRepo(cfg, root);
  const files = apiBearingFiles(raw);
  const rows = files.map((f) => {
    let n = 0;
    try { n = fs.readFileSync(path.join(root, f), 'utf8').split('\n').length; } catch {}
    return { f, n };
  }).filter((r) => r.n > 0);
  const batches = batchFiles(rows, opts);
  const byWorkspace = {};
  for (const r of rows) byWorkspace[workspaceOf(r.f)] = (byWorkspace[workspaceOf(r.f)] || 0) + 1;
  return { files: rows.map((r) => r.f), batches, byWorkspace };
}

module.exports = { workspaceOf, sizeBatch, batchFiles, selectDeep };
