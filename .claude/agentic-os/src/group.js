// src/group.js
const { normalizeRoute } = require('../lib/url-normalize');

function areaOf(route) {
  // tRPC procedure ids: `trpc:ns.proc` → the namespace IS the feature area (employees, hires,
  // marketing…). Without this, normalizeRoute mangles the id (`:ns` → :param), the slug test
  // fails, and every procedure lands in 'root' — the per-feature areas/audits never form.
  const t = String(route).match(/^trpc:([A-Za-z0-9_-]+)\./);
  if (t) return t[1];
  const seg = normalizeRoute(route).split('/').filter(Boolean)[0];
  if (!seg || seg === ':param') return 'root';
  // An area name becomes a FILENAME (.ecosystem/areas/<area>.md). Anything that isn't a clean slug
  // (junk extraction, params-with-spaces, Windows-invalid chars like ':') groups under root instead
  // of crashing the doc writer. (field testing: an area literally named ':param :param' → ENOENT.)
  if (!/^[a-zA-Z0-9._-]+$/.test(seg)) return 'root';
  return seg;
}

function group(map) {
  const areas = {};
  const ensure = (a) => (areas[a] || (areas[a] = {
    area: a, routes: [], feCalls: [], surfaces: [],
    orphans: { routesNoCaller: [], feCallsUnmatched: [] },
  }));

  for (const r of map.routes || []) ensure(areaOf(r.route)).routes.push(r);

  for (const w of map.wireup || []) {
    if (w.match === 'matched') ensure(areaOf(w.route)).feCalls.push(w);
    else ensure('ungrouped').feCalls.push(w);
  }

  for (const s of map.surfaces || []) ensure('ungrouped').surfaces.push(s);

  const orph = map.orphans || {};
  for (const r of orph.routesNoCaller || []) ensure(areaOf(r.route)).orphans.routesNoCaller.push(r);
  for (const w of orph.feCallsUnmatched || []) ensure('ungrouped').orphans.feCallsUnmatched.push(w);

  return { areas, order: Object.keys(areas).sort() };
}

module.exports = { group, areaOf };
