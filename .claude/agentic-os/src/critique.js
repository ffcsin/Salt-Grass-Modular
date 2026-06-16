// src/critique.js
const fs = require('node:fs');
const path = require('node:path');
const { loadConfig } = require('./compile');
const { executeOnRepo } = require('./execute');
const { wire } = require('./wire');

const routeKey = (r) => `${r.method} ${r.route}`;
function calledRoutes(map) {
  const s = new Set();
  for (const w of map.wireup || []) if (w.match === 'matched') s.add(`${w.method} ${w.route}`);
  return s;
}
function orphanKeys(map) {
  return new Set((map.orphans && map.orphans.routesNoCaller || []).map(routeKey));
}
// Keyed on file|method|url (NOT line — lines shift with unrelated edits; method INCLUDED so a known
// GET-unmatched that becomes a POST-unmatched — a real method-change regression — is not suppressed
// as "known", review fix) so a long-known unmatched call is never re-reported every run.
const unmatchedKey = (w) => `${w.from ? w.from.file : '?'}|${w.method || 'GET'}|${w.url}`;
function unmatchedKeys(map) {
  return new Set((map.orphans && map.orphans.feCallsUnmatched || []).map(unmatchedKey));
}

function diffMaps(oldMap, newMap, bar = 0.10) {
  const oldCalled = calledRoutes(oldMap);
  const oldOrphans = orphanKeys(oldMap);
  const newOrphans = newMap.orphans && newMap.orphans.routesNoCaller || [];

  // routes that are orphan NOW but were CALLED before = true regressions
  const newOrphanRoutes = newOrphans.filter((r) => oldCalled.has(routeKey(r)));

  // calls unmatched NOW that were NOT unmatched before (newly-introduced phantom or a route that
  // vanished). Previously-known unmatched calls are baseline, not regressions.
  const oldUnmatched = unmatchedKeys(oldMap);
  const newUnmatchedCalls = (newMap.orphans && newMap.orphans.feCallsUnmatched || [])
    .filter((w) => !oldUnmatched.has(unmatchedKey(w)));

  // resolved: was orphan, now not present in new orphans
  const newOrphanSet = orphanKeys(newMap);
  const resolvedOrphans = [...oldOrphans].filter((k) => !newOrphanSet.has(k)).map((k) => {
    const [method, ...rest] = k.split(' '); return { method, route: rest.join(' ') };
  });

  const oldDrift = (oldMap.accuracy && oldMap.accuracy.maxDrift) || 0;
  const newDrift = (newMap.accuracy && newMap.accuracy.maxDrift) || 0;
  const driftDelta = newDrift - oldDrift;

  const regressions = [];
  for (const r of newOrphanRoutes) regressions.push(`${r.method} ${r.route} lost its FE caller`);
  for (const w of newUnmatchedCalls) regressions.push(`FE call ${w.from ? w.from.file + ':' + w.from.line : '?'} → ${w.url} is now unmatched`);
  if (driftDelta > 0 && newDrift >= bar) regressions.push(`accuracy drift increased to ${(newDrift * 100).toFixed(1)}% (bar ${bar * 100}%)`);

  return { newOrphanRoutes, newUnmatchedCalls, resolvedOrphans, driftDelta, regressions };
}

// Re-derive a map the SAME way runPipeline builds the committed one: patterns + the deterministic
// deep-map union (AST/Hono/tRPC). Deriving without the union made every union-only match (trpc
// procedures, wildcard mounts) read as a false regression against the committed map.
function deriveMap(root, cfg) {
  const raw = executeOnRepo(cfg, root);
  try {
    const { buildDeterministicDeepMap, unionIntoRawMap } = require('./deterministic-deep-map');
    unionIntoRawMap(raw, buildDeterministicDeepMap(root, {}));
  } catch {}
  return wire(raw);
}

function freshMap(root) {
  const cfg = loadConfig(root);
  if (!cfg) throw new Error('no .ecosystem/extractor.config.json — bootstrap first');
  const m = deriveMap(root, cfg);
  m.accuracy = { maxDrift: (JSON.parse(fs.readFileSync(path.join(root, '.ecosystem', 'map.json'), 'utf8')).accuracy || {}).maxDrift || 0 };
  return m;
}
function runCritique(root) {
  const oldMap = JSON.parse(fs.readFileSync(path.join(root, '.ecosystem', 'map.json'), 'utf8'));
  const newMap = deriveMap(root, loadConfig(root));
  newMap.accuracy = oldMap.accuracy || { maxDrift: 0 }; // drift recomputation is the mapper's job; critique focuses on structural regressions
  return diffMaps(oldMap, newMap);
}

module.exports = { diffMaps, freshMap, runCritique };
