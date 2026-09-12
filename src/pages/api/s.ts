import type { APIRoute } from 'astro';

/**
 * On-demand: proxies the LPAI tracking script at request time, rewriting its
 * POST target to the same-origin /api/t so ad blockers cannot distinguish it
 * from ordinary site JavaScript.
 *
 * Hardened 2026-09-11 (contrarian review): only a tracker we can vouch for is
 * ever edge-cached. Previously any non-2xx upstream — a 429, or a 502 during a
 * Railway redeploy — was served as 200 JavaScript with max-age=3600, so one bad
 * second poisoned analytics for an hour across a whole region, silently.
 */
export const prerender = false;

const BACKEND = import.meta.env.PUBLIC_API_URL || 'https://lpai-monorepo-production.up.railway.app';

/** Fail fast rather than hold the page's load event open on a hung backend. */
const UPSTREAM_TIMEOUT_MS = 5000;

/** Tolerant of var/let/const and either quote style — a no-op replace would
 *  silently ship a tracker posting straight at the backend, where blockers eat it. */
const POST_TARGET = /\b(?:var|let|const)\s+u\s*=\s*(["'])(?:(?!\1).)*\1/;

/** A tracker we could not vouch for. Never cached, so the next request retries. */
const nothing = () =>
  new Response(null, {
    // Body MUST be null: a 204 with any body (even '') throws in Node.
    status: 204,
    headers: { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' },
  });

export const GET: APIRoute = async () => {
  try {
    const res = await fetch(`${BACKEND}/api/website-clients/tracking-script`, {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!res.ok) return nothing();

    const upstream = await res.text();
    const script = upstream.replace(POST_TARGET, 'var u="/api/t"');

    return new Response(script, {
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': script !== upstream ? 'public, max-age=3600' : 'no-store',
      },
    });
  } catch {
    // Silent fail — a missing tracker must never break the page.
    return nothing();
  }
};
