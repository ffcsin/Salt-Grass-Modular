import type { APIRoute } from 'astro';

// On-demand: proxies the LPAI tracking script at request time.
export const prerender = false;

const BACKEND = import.meta.env.PUBLIC_API_URL || 'https://lpai-monorepo-production.up.railway.app';

export const GET: APIRoute = async () => {
  try {
    const res = await fetch(`${BACKEND}/api/website-clients/tracking-script`);
    let script = await res.text();
    // Rewrite tracking URL to use same-origin path to bypass ad blockers
    script = script.replace(/var u="[^"]+"/, 'var u="/api/t"');
    return new Response(script, {
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    // Silent fail — return empty script on backend error
    return new Response('', {
      status: 204,
      headers: { 'Content-Type': 'application/javascript' },
    });
  }
};
