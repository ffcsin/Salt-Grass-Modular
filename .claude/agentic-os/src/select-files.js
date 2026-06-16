// src/select-files.js
const { loadConfig } = require('./compile');
const { executeOnRepo } = require('./execute');

function apiBearingFiles(rawMap) {
  const s = new Set();
  for (const r of rawMap.routes || []) s.add(r.file);
  for (const f of rawMap.feCalls || []) s.add(f.file);
  return [...s];
}
function batch(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}
// FS entry: skeleton on a repo -> batches of API-bearing files
function selectFromRepo(root, batchSize = 8) {
  const cfg = loadConfig(root);
  if (!cfg) throw new Error('no extractor config — run discover/compile first');
  const raw = executeOnRepo(cfg, root);
  return batch(apiBearingFiles(raw), batchSize);
}
module.exports = { apiBearingFiles, batch, selectFromRepo };
