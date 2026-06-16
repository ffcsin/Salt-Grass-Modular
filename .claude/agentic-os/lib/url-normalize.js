// lib/url-normalize.js
// Generic, stack-agnostic URL normalization. No app-specific base URLs (unlike an earlier
// prototype that hardcoded its own hosts). External = any absolute http(s) URL.

function normalizeUrl(rawUrl) {
  let u = String(rawUrl).trim();

  // Strip a leading ${...} base-url prefix (treat as local base). Broad on purpose: covers
  // ${API_BASE_URL}, ${getApiBaseUrl()}, ${Config.API_BASE_URL}, ${this.AI_BASE_URL}, etc.
  // A FE url that starts with an interpolation is virtually always "<base>/path".
  u = u.replace(/^\$\{[^}]+\}/, '');

  // Absolute URL -> external.
  const ext = u.match(/^https?:\/\/([^/]+)/);
  if (ext) return { url: u, external: true, externalHost: ext[1] };

  let matchKey = u.split('?')[0].split('#')[0];
  if (matchKey.startsWith('/api/')) matchKey = matchKey.slice(4); // '/api/x' -> '/x'
  if (!matchKey.startsWith('/')) matchKey = '/' + matchKey;

  const paramKey = matchKey
    .replace(/\$\{[^}]+\}/g, ':param')      // template literals: ${id}
    .replace(/\[\.\.\.[^\]]+\]/g, ':param') // Next.js catch-all: [...slug]
    .replace(/\[[^\]]+\]/g, ':param')       // Next.js dynamic segment: [id] / [contactId]
    .replace(/\{[^}]+\}/g, ':param')        // curly params: {item_id} (FastAPI/Flask/Spring/.NET)
    .replace(/:[a-zA-Z][\w]*/g, ':param')   // colon params: :userId (Express/Rails)
    .replace(/\/\d+(?=\/|$)/g, '/:param');  // literal numeric id segments e.g. /users/123

  return { url: u, external: false, matchKey, paramKey };
}

function normalizeRoute(routePath) {
  let r = routePath.split('?')[0];
  if (r.startsWith('/api/')) r = r.slice(4);
  if (!r.startsWith('/')) r = '/' + r;
  return r
    .replace(/\$\{[^}]+\}/g, ':param')
    .replace(/\[\.\.\.[^\]]+\]/g, ':param') // Next.js catch-all: [...slug]
    .replace(/\[[^\]]+\]/g, ':param')       // Next.js dynamic segment: [id]
    .replace(/\{[^}]+\}/g, ':param')        // curly params: {item_id} (FastAPI/Flask/Spring/.NET)
    .replace(/:[a-zA-Z][\w]*/g, ':param');
}

module.exports = { normalizeUrl, normalizeRoute };
