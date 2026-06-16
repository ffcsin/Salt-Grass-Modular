// src/deep-merge.js
// Merge one or more deep-extract inventory sources into a single deep-map, then compute the two
// deterministic gates: COVERAGE (every expected file extracted) and COMPLETENESS (every real
// network call emitted). Sources may be workflow task-output files ({result:{inventories,...}})
// or raw {inventories, glossary} files — both are accepted.
const fs = require('node:fs');
const path = require('node:path');
const { buildDeepMap, toRepoRelative } = require('../bin/deep-map');
const { completenessDrift } = require('./deep-verify');

function readSource(srcPath) {
  const j = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
  const r = (j && j.result) ? j.result : j;
  return { inventories: (r && r.inventories) || [], glossary: (r && r.glossary) || [] };
}

// Pure merge: given the root, raw inventory arrays, and the expected file set, build the deep-map
// and the two gate reports. dedupe (richest-on-http per file) happens inside buildDeepMap->mergeDeep.
function mergeInventories(root, inventories, expectedFiles = [], extraGlossary = []) {
  const deepMap = buildDeepMap(root, inventories);

  // COVERAGE
  const extracted = new Set(deepMap.files.map((f) => f.file));
  const expected = new Set(expectedFiles.map((f) => toRepoRelative(root, f)));
  const missing = [...expected].filter((f) => !extracted.has(f));

  // COMPLETENESS (emitted http-calls vs real network calls in source)
  const undercounts = [];
  for (const f of deepMap.files) {
    let content = '';
    try { content = fs.readFileSync(path.join(root, f.file), 'utf8'); } catch {}
    if (!content) continue;
    const d = completenessDrift(f, content);
    if (!d.ok) undercounts.push({ f: f.file, emitted: d.emitted, network: d.network });
  }
  undercounts.sort((a, b) => (b.network - b.emitted) - (a.network - a.emitted));

  // union glossary: from inventories (already in deepMap.glossary) + any source-level glossary
  const gloss = [...deepMap.glossary];
  const names = new Set(gloss.map((g) => g.name));
  for (const g of extraGlossary) if (g && g.name && !names.has(g.name)) { names.add(g.name); gloss.push(g); }
  deepMap.glossary = gloss;

  return { deepMap, missing, undercounts };
}

// FS entry: read sources + the committed expected set (.ecosystem/.deep/select.json), merge, and
// write deep-map.json + glossary.json + missing-files.json + undercount-files.json.
function mergeFromSources(root, sourcePaths) {
  const inventories = [];
  const extraGlossary = [];
  for (const p of sourcePaths) {
    const { inventories: inv, glossary } = readSource(p);
    inventories.push(...inv);
    extraGlossary.push(...glossary);
  }
  let expectedFiles = [];
  const selPath = path.join(root, '.ecosystem', '.deep', 'select.json');
  try { expectedFiles = JSON.parse(fs.readFileSync(selPath, 'utf8')).files || []; } catch {}

  const { deepMap, missing, undercounts } = mergeInventories(root, inventories, expectedFiles, extraGlossary);

  const eco = path.join(root, '.ecosystem');
  fs.mkdirSync(path.join(eco, '.deep'), { recursive: true });
  fs.writeFileSync(path.join(eco, 'deep-map.json'), JSON.stringify(deepMap, null, 2) + '\n');
  fs.writeFileSync(path.join(eco, 'glossary.json'), JSON.stringify(deepMap.glossary, null, 2) + '\n');
  fs.writeFileSync(path.join(eco, '.deep', 'missing-files.json'), JSON.stringify(missing, null, 2) + '\n');
  fs.writeFileSync(path.join(eco, '.deep', 'undercount-files.json'), JSON.stringify(undercounts.map((u) => u.f), null, 2) + '\n');

  return { deepMap, missing, undercounts, expectedCount: expectedFiles.length };
}

module.exports = { readSource, mergeInventories, mergeFromSources };
