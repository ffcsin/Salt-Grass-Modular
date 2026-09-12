import type { APIRoute } from 'astro';

/**
 * On-demand: proxies tracking beacons (POST) to the LPAI backend, same-origin
 * so ad blockers do not strip them.
 *
 * Hardened 2026-09-11 (contrarian review):
 *   - forwards the visitor's x-forwarded-for + user-agent. Without them the
 *     backend sees every visitor as this Vercel function (UA "node"), so unique
 *     visitors collapse into one and "Ignore My IP" never matches. This site had
 *     been reporting collapsed visitor counts since launch.
 *   - fails fast instead of hanging on an unresponsive backend.
 *   - the 204 carries a null body; `new Response('', { status: 204 })` throws in
 *     Node, which turned this "fail quietly" branch into a 500.
 *
 * body.domain is deliberately NOT pinned, because pinning would not fix what is
 * wrong here. This site's analytics are BROKEN AT THE DATA LAYER (verified in
 * prod 2026-09-11, correcting an earlier cut of this comment that overstated it).
 *
 * The beacons DO arrive — 1,746 page_views rows under www.saltgrassmodular.com
 * and saltgrassmodular.com in the last 30 days. What fails is tenant
 * attribution. trackPageView resolves a tenant two ways, and both miss:
 *   1. website_clients.domain (exact or www-stripped) — this business has NO
 *      website_clients row at all, only `locations` entries
 *      (plan_chNIQv7tfy09Ew_h1liV, the id these forms post as, and
 *      ikZkjzhWC5oRJhldSLOQ).
 *   2. website_client_onboarding via healthConfig.websiteUrl / vercelConfig —
 *      the onboarding row exists but carries neither field.
 * So every view is stored with no locationId: the traffic is real, it is being
 * paid for, and the client's dashboard reads zero. The tenant is also invisible
 * to the nightly analytics-freshness check, which discovers clients from
 * website_clients rows carrying a domain — so nothing would ever have alerted.
 *
 * Fix in DATA, not here: give the onboarding row healthConfig.websiteUrl =
 * https://saltgrassmodular.com (the cheap fix, which is exactly how Zoomies
 * resolves), or create a proper website_clients row. Then pin the domain here.
 */
export const prerender = false;

const BACKEND = import.meta.env.PUBLIC_API_URL || 'https://lpai-monorepo-production.up.railway.app';

/** Fail fast rather than hold a beacon open against a hung backend. */
const UPSTREAM_TIMEOUT_MS = 5000;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.text();
    const visitorIp =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      '';
    const userAgent = request.headers.get('user-agent') || '';
    const res = await fetch(`${BACKEND}/api/website-clients/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(visitorIp ? { 'x-forwarded-for': visitorIp } : {}),
        ...(userAgent ? { 'user-agent': userAgent } : {}),
      },
      body,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    return new Response(res.body, { status: res.status });
  } catch {
    // Silent fail on error.
    return new Response(null, { status: 204 });
  }
};
