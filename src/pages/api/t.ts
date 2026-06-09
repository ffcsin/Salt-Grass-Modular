import type { APIRoute } from 'astro';

const BACKEND = import.meta.env.PUBLIC_API_URL || 'https://lpai-monorepo-production.up.railway.app';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.text();
    const res = await fetch(`${BACKEND}/api/website-clients/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    return new Response(res.body, { status: res.status });
  } catch {
    // Silent fail on error
    return new Response('', { status: 204 });
  }
};
