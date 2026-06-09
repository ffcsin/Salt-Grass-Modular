import type { APIRoute } from 'astro';

// On-demand: live health probe — must reflect real-time backend state.
export const prerender = false;

const BACKEND = import.meta.env.PUBLIC_API_URL || 'https://lpai-monorepo-production.up.railway.app';
const LOCATION_ID = import.meta.env.PUBLIC_LOCATION_ID;

type CheckState = 'ok' | 'error' | 'timeout' | 'unknown';

interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  checks: {
    frontend: CheckState;
    backend: CheckState;
    // 'unknown' = the backend health response did not expose a database
    // sub-check; we don't claim it's broken when we simply can't see it.
    database: CheckState;
  };
  version: string;
  responseTimeMs: number;
}

export const GET: APIRoute = async () => {
  const startTime = Date.now();
  const checks: HealthStatus['checks'] = {
    frontend: 'ok',
    backend: 'error',
    database: 'unknown',
  };

  // Check backend health
  try {
    const res = await fetch(`${BACKEND}/api/health?locationId=${LOCATION_ID}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      checks.backend = 'ok';
      const backendHealth = await res.json().catch(() => ({}));
      // Only report a database state if the backend actually surfaced one.
      const dbState = backendHealth?.checks?.database;
      if (typeof dbState === 'string') {
        checks.database = dbState === 'ok' ? 'ok' : 'error';
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      checks.backend = 'timeout';
    }
  }

  // Overall status is driven by backend reachability — a missing/unknown
  // database sub-check must NOT degrade an otherwise-healthy response.
  const overallStatus =
    checks.backend === 'ok' ? 'ok' : checks.backend === 'timeout' ? 'degraded' : 'error';
  const statusCode = overallStatus === 'ok' ? 200 : 503;

  const response: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
    version: '1.0',
    responseTimeMs: Date.now() - startTime,
  };

  return new Response(JSON.stringify(response), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
};
