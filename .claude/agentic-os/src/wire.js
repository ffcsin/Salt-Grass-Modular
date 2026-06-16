// src/wire.js
const { normalizeUrl, normalizeRoute } = require('../lib/url-normalize');

// tRPC procedure ids (`trpc:ns.proc`) are ALREADY canonical match keys — normalizeRoute would read
// `:ns` as a path param and collapse every namespace into `/trpc:param.*`. Keep them verbatim;
// REST paths still get param-normalized.
const pkOf = (route) => (String(route).startsWith('trpc:') ? String(route) : normalizeRoute(String(route)));

// The key a route is "called" under: ANY-method (file-based) routes serve every verb,
// so they're keyed by path alone; verb-specific routes keep METHOD+path.
function calledKeyForRoute(r) {
  return r.method === 'ANY' ? `ANY ${pkOf(r.route)}` : `${r.method} ${pkOf(r.route)}`;
}

function wire(rawMap) {
  const epIndex = new Map(); // "METHOD paramKey" -> [route...]
  const anyIndex = new Map(); // "paramKey" -> [route...] for method 'ANY' (file-based routes)
  const wildcards = []; // mount-style routes (/api/auth/** → prefix /auth/) matched by path prefix
  for (const r of rawMap.routes) {
    const pk = pkOf(r.route);
    const key = `${r.method} ${pk}`;
    if (!epIndex.has(key)) epIndex.set(key, []);
    epIndex.get(key).push(r);
    if (r.method === 'ANY') {
      if (!anyIndex.has(pk)) anyIndex.set(pk, []);
      anyIndex.get(pk).push(r);
    }
    // Mount prefix ONLY when the star sits on a path BOUNDARY: '/auth/**' | '/auth/*' → prefix
    // '/auth/'. The trailing slash is required so '/v1*' does NOT become prefix '/v1' and over-match
    // '/v1users' (review fix; was `^(\/.*?)\*+$` which captured to the first star). A mid-path single
    // star isn't a mount and is ignored.
    const wc = pk.match(/^(\/.*\/)\*+$/);
    if (wc) wildcards.push({ method: r.method, prefix: wc[1], route: r, calledKey: key });
  }
  wildcards.sort((a, b) => b.prefix.length - a.prefix.length); // longest prefix wins

  const wireup = [];
  const calledKeys = new Set();

  for (const f of rawMap.feCalls) {
    // tRPC targets exact-match a procedure route — never URL-normalized (no path semantics).
    const isTrpc = String(f.url).startsWith('trpc:');
    const norm = isTrpc ? { external: false, matchKey: f.url, paramKey: f.url } : normalizeUrl(f.url);
    if (norm.external) {
      wireup.push({ from: { file: f.file, line: f.line }, method: f.method, url: f.url, match: 'external', externalHost: norm.externalHost });
      continue;
    }
    const key = `${f.method} ${norm.paramKey}`;
    let hit = epIndex.get(key);
    let calledKey = key;
    let via;
    if (!hit) {
      // Fall back to a file-based (ANY-method) route on the same path, regardless of verb.
      const any = anyIndex.get(norm.paramKey);
      if (any) { hit = any; calledKey = `ANY ${norm.paramKey}`; }
    }
    if (!hit && !isTrpc) {
      // Tier 2 — UNIQUE-SUFFIX match. Nested router groups lose their parent prefix under regex
      // extraction (gin: api.Group("/accounts") in main.go, accounts.Group("/me") in account.go → the
      // route extracts as /me/x while the FE calls /accounts/me/x — field testing). Try progressively
      // shorter SEGMENT-BOUNDARY suffixes of the call path, longest first; accept only when exactly
      // ONE route bears that paramKey (ambiguity stays unmatched — never guess between handlers).
      const segs = norm.paramKey.split('/').filter(Boolean);
      for (let i = 1; i < segs.length && !hit; i++) {
        const sufKey = `${f.method} /${segs.slice(i).join('/')}`;
        const cand = epIndex.get(sufKey);
        if (cand) {
          if (cand.length === 1) { hit = cand; calledKey = sufKey; via = 'suffix'; }
          break; // longest matching suffix decides — shorter ones would only be less specific
        }
      }
    }
    if (!hit && !isTrpc) {
      // Tier 3 — WILDCARD MOUNT match. Sub-app mounts register as `/api/auth/**` (Hono app.on /
      // express .use-style): any call whose path falls under the prefix belongs to that mount
      // (e.g. /auth/get-session → /auth/**). Method must agree (or the mount is ANY).
      for (const w of wildcards) {
        if ((w.method === f.method || w.method === 'ANY' || w.method === 'ALL') && norm.paramKey.startsWith(w.prefix)) {
          hit = [w.route]; calledKey = w.calledKey; via = 'wildcard';
          break; // wildcards are longest-prefix-first
        }
      }
    }
    if (hit) {
      calledKeys.add(calledKey);
      wireup.push({ from: { file: f.file, line: f.line }, method: f.method, url: f.url, match: 'matched', route: hit[0].route, handler: hit[0].handler, ambiguous: hit.length > 1, ...(via ? { via } : {}) });
    } else {
      wireup.push({ from: { file: f.file, line: f.line }, method: f.method, url: f.url, match: 'unmatched' });
    }
  }

  const routesNoCaller = rawMap.routes.filter((r) => !calledKeys.has(calledKeyForRoute(r)));
  const feCallsUnmatched = wireup.filter((w) => w.match === 'unmatched');

  return { ...rawMap, wireup, orphans: { routesNoCaller, feCallsUnmatched } };
}

module.exports = { wire };
