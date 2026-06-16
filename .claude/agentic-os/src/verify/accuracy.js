// src/verify/accuracy.js
// The accuracy core: measure a set of agent-found facts against a DETERMINISTIC reference set
// (recall/precision/F1 + the actual missing/extra lists). Per the research: completeness is only
// provable relative to a reference a parser produces — so we measure the deep-map's routes/calls
// against what a deterministic extractor enumerates. Missing = omissions (the dangerous class);
// extra = dynamic routes the regex couldn't see OR hallucinations (investigate each).
const { normalizeRoute, normalizeUrl } = require('../../lib/url-normalize');

const pathOf = (id) => String(id || '').replace(/^\s*(GET|POST|PUT|DELETE|PATCH|ANY)\s+/i, '');

// Pure set comparison.
function measureRecall(found, reference) {
  const ref = new Set(reference);
  const f = new Set(found);
  const intersect = [...ref].filter((x) => f.has(x));
  const missing = [...ref].filter((x) => !f.has(x));
  const extra = [...f].filter((x) => !ref.has(x));
  const recall = ref.size ? intersect.length / ref.size : 1;
  const precision = f.size ? intersect.length / f.size : 1;
  const f1 = (recall + precision) ? (2 * recall * precision) / (recall + precision) : 0;
  return { recall, precision, f1, refCount: ref.size, foundCount: f.size, hit: intersect.length, missing, extra };
}

// Route signatures from a deep-map (agent-found) — "METHOD normalizedPath", deduped.
function deepRouteSigs(deepMap) {
  const s = new Set();
  for (const file of deepMap.files || []) for (const e of file.exposesEndpoints || []) {
    if (e.type !== 'route') continue;
    s.add(`${String(e.method || 'ANY').toUpperCase()} ${normalizeRoute(pathOf(e.id))}`);
  }
  return [...s];
}
// Route signatures from a deterministic raw map (executeOnRepo result).
function refRouteSigs(rawMap) {
  const s = new Set();
  for (const r of rawMap.routes || []) s.add(`${String(r.method || 'ANY').toUpperCase()} ${normalizeRoute(r.route)}`);
  return [...s];
}
// Outbound-call signatures (host or normalized internal path) from a deep-map.
function deepCallSigs(deepMap) {
  const s = new Set();
  for (const file of deepMap.files || []) for (const c of file.connectionsOut || []) {
    if (c.type !== 'http-call') continue;
    const n = normalizeUrl(c.target || '');
    s.add(n.external ? `ext:${n.externalHost}` : `int:${n.paramKey}`);
  }
  return [...s];
}

module.exports = { measureRecall, deepRouteSigs, refRouteSigs, deepCallSigs, pathOf };
