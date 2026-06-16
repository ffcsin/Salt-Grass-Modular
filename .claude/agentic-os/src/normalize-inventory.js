// src/normalize-inventory.js
const ALIASES = { url: 'target', location: 'line', notes: 'detail' };
// Spine-item aliases: INSIDE a connection/endpoint the LLM often reuses `kind` (the file-level
// field name) to mean the spine `type`. Aliasing `kind`->`type` is scoped to spine items ONLY —
// at the inventory top level AND inside findings, `kind` keeps its own meaning (file kind / finding kind).
const SPINE_ALIASES = { ...ALIASES, kind: 'type' };
function applyAliases(item, aliases = ALIASES) {
  const o = {};
  for (const [k, v] of Object.entries(item || {})) o[aliases[k] || k] = v;
  return o;
}
function normParams(p) { p = p || {}; return { query: p.query || [], body: p.body || [], path: p.path || [] }; }

// Canonicalize a connection type. The LLM may write the HTTP verb INTO the type (e.g. 'http-get',
// 'http_post', 'fetch', 'rest-call') instead of using type 'http-call' + a separate method.
// Map any http-ish type to the canonical 'http-call' (so merge-deep's wireup picks it up) and
// recover the method from the embedded verb. Non-http types (queue/db/import/service-call/...) pass through.
function canonConnType(type, method) {
  const t = String(type || '').toLowerCase().trim();
  const verb = t.match(/\b(get|post|put|delete|patch)\b/);
  const httpish = /^(http|fetch|axios|xhr|rest|api[-_ ]?call|request)/.test(t) || (!!verb && /http|call|request|fetch/.test(t));
  if (httpish) return { type: 'http-call', method: method != null ? method : (verb ? verb[1].toUpperCase() : null) };
  return { type: type || '', method: method != null ? method : null };
}
// Endpoint type: route synonyms -> 'route' (so wireup treats them as routes); other kinds
// (export/handler/event-listener) pass through.
function canonExpType(type) {
  const t = String(type || '').toLowerCase().trim();
  if (!t) return 'route';
  if (/^(route|endpoint|http|rest)/.test(t)) return 'route';
  return type;
}
// Fold descriptive non-spine fields (label, auth) into detail so no info is dropped when the
// LLM emits them outside the spine.
function foldDetail(o) {
  return [o.label, o.detail, o.auth ? `auth: ${o.auth}` : '']
    .map((s) => (s == null ? '' : String(s).trim())).filter(Boolean).join(' — ');
}
function normConn(item) {
  const o = applyAliases(item, SPINE_ALIASES);
  const { type, method } = canonConnType(o.type, o.method);
  return { type, target: o.target || o.id || '', method,
    params: normParams(o.params), detail: foldDetail(o), line: o.line || 0, confidence: o.confidence || 'med' };
}
function normExp(item) {
  const o = applyAliases(item, SPINE_ALIASES);
  return { type: canonExpType(o.type), id: o.id || o.target || '', method: o.method != null ? o.method : null,
    params: normParams(o.params), guards: Array.isArray(o.guards) ? o.guards : [], detail: foldDetail(o),
    line: o.line || 0, confidence: o.confidence || 'med' };
}
function normalizeInventory(inv) {
  inv = inv || {};
  return {
    file: inv.file || '', kind: inv.kind || 'other', purpose: inv.purpose || '',
    connectionsOut: (inv.connectionsOut || []).map(normConn),
    exposesEndpoints: (inv.exposesEndpoints || []).map(normExp),
    findings: (inv.findings || []).map((f) => {
      const o = applyAliases(f);
      return { kind: o.kind || 'note', note: o.note || o.detail || '', line: o.line || 0, confidence: o.confidence || 'med' };
    }),
    discoveredConventions: inv.discoveredConventions || [],
    selfCheck: inv.selfCheck || {},
  };
}
module.exports = { normalizeInventory };
