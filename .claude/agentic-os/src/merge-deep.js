// src/merge-deep.js
const { wire } = require('./wire');

// A file may be extracted more than once (initial sweep + an incremental/targeted re-extract).
// Keep the RICHEST inventory per file, ranking HTTP-CALL count first (that is what a re-extract
// fixes), then total connections, then endpoints — so a re-extract rich in http-calls is never
// outranked by an earlier version that happened to log more db/import connections.
function dedupeByFile(inventories) {
  const httpCount = (i) => (i.connectionsOut || []).filter((c) => String(c.type || '').toLowerCase().includes('http')).length;
  const richness = (i) => httpCount(i) * 1e6 + (i.connectionsOut || []).length * 1e3 + (i.exposesEndpoints || []).length;
  const best = new Map();
  for (const inv of inventories) {
    const key = inv.file || '';
    const cur = best.get(key);
    if (!cur || richness(inv) > richness(cur)) best.set(key, inv);
  }
  return [...best.values()];
}

function mergeDeep(rawInventories) {
  const inventories = dedupeByFile(rawInventories);
  const feCalls = [], routes = [], findings = [], glossaryMap = new Map();
  for (const inv of inventories) {
    for (const c of inv.connectionsOut || []) {
      if (c.type === 'http-call') feCalls.push({ file: inv.file, line: c.line, method: (c.method || 'GET'), url: c.target, urlKind: 'literal' });
    }
    for (const e of inv.exposesEndpoints || []) {
      if (e.type === 'route') routes.push({ file: inv.file, line: e.line, method: (e.method || 'GET'), route: e.id, handler: '', guards: e.guards || [] });
    }
    for (const f of inv.findings || []) findings.push({ ...f, file: inv.file });
    for (const g of inv.discoveredConventions || []) if (!glossaryMap.has(g.name)) glossaryMap.set(g.name, g);
  }
  const wired = wire({ feCalls, routes, surfaces: [] });
  return {
    version: 1, generatedAt: 'X',
    files: inventories,
    wireup: wired.wireup, orphans: wired.orphans,
    findings, glossary: [...glossaryMap.values()],
  };
}
module.exports = { mergeDeep, dedupeByFile };
