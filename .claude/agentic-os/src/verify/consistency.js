// src/verify/consistency.js
// V4 — inter-run consistency. The deep-extract agent layer is non-deterministic; to trust it we run
// it N times on the SAME files and measure per-fact agreement. Per the research: a fact asserted in
// 100% of runs is stable/trusted; a fact with high error ℰ(x)=min(p,1−p) is a drift hotspot to
// quarantine. This is how you prove the random-omission rate is low + bounded.
const { normalizeRoute, normalizeUrl } = require('../../lib/url-normalize');

// Canonical fact keys for one run's inventories: routes + outbound http-call targets, file-scoped.
function factKeys(inventories) {
  const keys = new Set();
  for (const inv of inventories || []) {
    const file = inv.file || '';
    for (const e of inv.exposesEndpoints || []) {
      if (e.type !== 'route') continue;
      const path = String(e.id || '').replace(/^\s*(GET|POST|PUT|DELETE|PATCH|ANY)\s+/i, '');
      keys.add(`${file}|route|${normalizeRoute(path)}`);
    }
    for (const c of inv.connectionsOut || []) {
      if (c.type !== 'http-call') continue;
      const n = normalizeUrl(c.target || '');
      keys.add(`${file}|call|${n.external ? 'ext:' + n.externalHost : n.paramKey}`);
    }
  }
  return [...keys];
}

// runs = array of fact-key arrays (one per extraction run of the SAME files).
function measureConsistency(runs) {
  const n = runs.length;
  if (!n) return { runs: 0, totalFacts: 0, stable: 0, inconsistent: [], consistencyRate: 1 };
  const sets = runs.map((r) => new Set(r));
  const all = new Set(runs.flat());
  const facts = [...all].map((f) => {
    const present = sets.filter((s) => s.has(f)).length;
    const p = present / n;
    return { fact: f, present, p, stable: present === n, error: Math.min(p, 1 - p) };
  });
  const stable = facts.filter((x) => x.stable).length;
  const inconsistent = facts.filter((x) => !x.stable).sort((a, b) => b.error - a.error);
  return { runs: n, totalFacts: facts.length, stable, inconsistent, consistencyRate: facts.length ? stable / facts.length : 1 };
}

module.exports = { factKeys, measureConsistency };
