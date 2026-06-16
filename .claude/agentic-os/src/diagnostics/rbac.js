// src/diagnostics/rbac.js
// Shared RBAC helpers. isPublic must be TOKEN-based, not prose-based: a guard entry like
// "@Public() — bypasses JwtAuthGuard" or "@Public() — no JWT required" is PUBLIC (the @Public()
// decorator wins), even though the prose mentions JWT. The earlier substring check mis-read that
// prose and under-counted no-auth endpoints.
function isPublic(guards) {
  const arr = (guards || []).map((g) => String(g));
  if (arr.length === 0) return true;                              // no guard at all => public
  if (arr.some((g) => /@?public\s*\(\s*\)/i.test(g) || /^@?public$/i.test(g.trim()))) return true; // explicit @Public()
  // otherwise public only if NO real auth-guard token appears anywhere. 'protected' covers the
  // tRPC-derived `auth:protected` and a guard literally named protected. NOTE: a bare `session`
  // token is deliberately NOT here — non-auth middleware like sessionLogger/sessionCookie/
  // touchSession would mis-read as guarded (the dangerous false-NEGATIVE: a real public endpoint
  // that merely sets a session cookie shows as authed and never gets flagged no-auth). The genuine
  // auth case `requireSession` is already caught by `requires` (review fix).
  return !arr.some((g) => /(jwt|auth|role|featuregate|requires|useguards|guard\b|protected)/i.test(g));
}
// The "head" of a guard string (before prose), for comparing guard SETS without prose noise.
const guardHead = (g) => String(g).split(/—|--| - |\s\(/)[0].trim();
const guardSet = (g) => [...new Set((g || []).map(guardHead).filter(Boolean))].sort();

module.exports = { isPublic, guardSet, guardHead };
