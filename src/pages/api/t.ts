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
 * NOT pinning body.domain here yet: the pin only works if it matches this
 * tenant's stored website_clients.domain, and pinning an unverified value would
 * silently send every beacon nowhere. Verify the stored domain, then pin.
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
