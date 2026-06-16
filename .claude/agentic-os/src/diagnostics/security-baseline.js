// src/diagnostics/security-baseline.js
// RBAC/tenancy regression gate. Snapshots the deep-map's security posture (which endpoints are
// public/guarded + tenancy-risk findings) into a committed baseline; on later runs, diffs the
// current map vs the baseline and flags REGRESSIONS: a newly public/no-auth endpoint, an endpoint
// that lost a guard, or a new tenancy-risk finding. This catches the #1 bug class (auth/tenant
// leaks introduced by a change) BEFORE it ships — the gate the industry has no canonical tool for.
const { normalizeRoute } = require('../../lib/url-normalize');
const { isPublic, guardSet } = require('./rbac');

const pathOf = (id) => String(id || '').replace(/^\s*(GET|POST|PUT|DELETE|PATCH|ANY|SUB)\s+/i, '');
// tRPC procedure ids (`trpc:ns.proc`) are ALREADY canonical — running them through normalizeRoute turns
// the namespace into a path param (`trpc:auth.x` → `/trpc:param.x`), collapsing every namespace together.
// REST paths still get param-normalized so `/users/1` and `/users/2` share a baseline key.
const routeKey = (p) => (p.startsWith('trpc:') ? p : normalizeRoute(p));

// Comparable security snapshot of a deep-map.
function snapshot(deepMap) {
  const endpoints = {};
  const tenancy = [];
  for (const f of deepMap.files || []) {
    for (const e of f.exposesEndpoints || []) {
      if (e.type !== 'route') continue;
      const method = String(e.method || 'ANY').toUpperCase();
      const key = `${method} ${routeKey(pathOf(e.id))}`;
      // if the same key appears twice, keep the MORE-guarded one (conservative baseline)
      const cand = { public: isPublic(e.guards), guards: guardSet(e.guards), file: f.file, line: e.line, id: `${method} ${pathOf(e.id)}` };
      const cur = endpoints[key];
      if (!cur || (cur.public && !cand.public) || cand.guards.length > cur.guards.length) endpoints[key] = cand;
    }
    for (const x of f.findings || []) {
      if (x.kind === 'tenancy' || (x.kind === 'security' && /tenant|locationId|cross-tenant|isolation/i.test(x.note || ''))) {
        tenancy.push({ key: `${f.file}:${x.line}`, note: String(x.note || '').slice(0, 160), confidence: x.confidence });
      }
    }
  }
  return { endpoints, tenancy };
}

// Diff current vs baseline → regressions.
function diffSecurity(base, cur) {
  const newPublic = [], removedGuards = [], newTenancy = [];
  for (const [key, c] of Object.entries(cur.endpoints)) {
    const b = base.endpoints[key];
    if (c.public && (!b || !b.public)) { newPublic.push({ endpoint: c.id || key, file: c.file, line: c.line, wasGuarded: !!(b && b.guards.length) }); continue; }
    // Flag when ANY baseline guard token is DROPPED — not just when the count shrinks. A same-
    // cardinality SWAP is a real regression (e.g. role:hr → role:marketing on a PII procedure keeps
    // length 1 but re-scopes who can reach it). Matters now that guardOfProcedure emits fine-grained
    // role:<kind> tokens (review fix; was: `c.guards.length < b.guards.length`).
    if (b && b.guards.length) {
      const dropped = b.guards.filter((g) => !c.guards.includes(g));
      if (dropped.length) removedGuards.push({ endpoint: c.id || key, was: b.guards, now: c.guards, dropped, file: c.file, line: c.line });
    }
  }
  const baseT = new Set((base.tenancy || []).map((t) => t.key));
  for (const t of cur.tenancy || []) if (!baseT.has(t.key)) newTenancy.push(t);
  return { newPublic, removedGuards, newTenancy };
}

// Gate verdict: hard regressions (newPublic / removedGuards) fail; new tenancy findings warn.
function gateVerdict(diff) {
  const hard = diff.newPublic.length + diff.removedGuards.length;
  return { ok: hard === 0, hardRegressions: hard, warnings: diff.newTenancy.length };
}

module.exports = { snapshot, diffSecurity, gateVerdict };
