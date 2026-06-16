// src/diagnostics/param-mismatch.js
// FE↔BE parameter mismatch detector (Grok's "missing variables / mismatched API calls"). Joins each
// FE http-call's params with the matched BE route's declared params (by normalized method+path) and
// flags fields the call sends that the route doesn't declare (extra) and fields the route declares
// that the call omits (missing). Confidence is inherently advisory — deep-map params aren't a
// guaranteed-complete contract — so these are REVIEW signals, not hard failures.
const { normalizeUrl, normalizeRoute } = require('../../lib/url-normalize');

// Clean a params channel into comparable identifier names: strip a trailing '?' (optional),
// and DROP descriptive/non-identifier noise the agents sometimes emit ("...payload", "a|b", "x (y)").
function cleanNames(v) {
  const raw = Array.isArray(v) ? v.map((x) => typeof x === 'string' ? x : (x && x.name) || '')
    : (v && typeof v === 'object' ? Object.keys(v) : []);
  return [...new Set(raw
    .map((s) => String(s).trim().replace(/\?$/, ''))
    .filter((s) => s && /^[A-Za-z_$][\w.$]*$/.test(s)))]; // plain identifiers only
}
const plist = cleanNames;

// Route ids often carry the method ("POST /api/users"); strip it so the PATH matches the FE target.
function pathOf(id) {
  return String(id || '').replace(/^\s*(GET|POST|PUT|DELETE|PATCH|ANY)\s+/i, '');
}

function indexRoutes(deepMap) {
  const exact = new Map(); // "METHOD pk" -> route info
  const anyByPath = new Map(); // pk -> route info (method ANY)
  for (const f of deepMap.files) {
    for (const e of f.exposesEndpoints || []) {
      if (e.type !== 'route') continue;
      const pk = normalizeRoute(pathOf(e.id));
      const info = { file: f.file, line: e.line, id: e.id, method: e.method, params: e.params || {} };
      const m = String(e.method || '').toUpperCase();
      if (m === 'ANY' || !m) { if (!anyByPath.has(pk)) anyByPath.set(pk, info); }
      else { const k = `${m} ${pk}`; if (!exact.has(k)) exact.set(k, info); }
    }
  }
  return { exact, anyByPath };
}

function findParamMismatches(deepMap) {
  const { exact, anyByPath } = indexRoutes(deepMap);
  const mismatches = [];
  for (const f of deepMap.files) {
    for (const c of f.connectionsOut || []) {
      if (c.type !== 'http-call') continue;
      const norm = normalizeUrl(c.target || '');
      if (norm.external) continue; // can't validate an external API's contract
      const m = String(c.method || 'GET').toUpperCase();
      const route = exact.get(`${m} ${norm.paramKey}`) || anyByPath.get(norm.paramKey);
      if (!route) continue; // unmatched calls are an orphan concern, not a param concern

      const callBody = plist(c.params && c.params.body);
      const callQuery = plist(c.params && c.params.query);
      const beBody = plist(route.params && route.params.body);
      const beQuery = plist(route.params && route.params.query);

      // A channel is only comparable as FIELDS when it looks like a field list (entries start
      // lowercase). A single PascalCase entry is a DTO/type name (`@Body() dto: RefreshTokenDto`),
      // not a field set — skip it to avoid false "missing TypeName" positives.
      const isFieldList = (names) => names.length > 0 && names.every((n) => /^[a-z_$]/.test(n));
      const bodyComparable = isFieldList(beBody);
      const queryComparable = isFieldList(beQuery);

      const extraBody = bodyComparable ? callBody.filter((x) => !beBody.includes(x)) : [];
      const missingBody = (bodyComparable && isFieldList(callBody)) ? beBody.filter((x) => !callBody.includes(x)) : [];
      const extraQuery = queryComparable ? callQuery.filter((x) => !beQuery.includes(x)) : [];

      if (extraBody.length || missingBody.length || extraQuery.length) {
        mismatches.push({
          route: route.id, method: m,
          call: { file: f.file, line: c.line, target: c.target },
          endpoint: { file: route.file, line: route.line },
          extraInCall: [...extraBody.map((x) => `body.${x}`), ...extraQuery.map((x) => `query.${x}`)],
          missingInCall: missingBody.map((x) => `body.${x}`),
          confidence: 'low',
        });
      }
    }
  }
  return mismatches;
}

module.exports = { findParamMismatches, indexRoutes };
