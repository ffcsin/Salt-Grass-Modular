import type { APIRoute } from 'astro';

const BACKEND = import.meta.env.PUBLIC_API_URL || 'https://lpai-monorepo-production.up.railway.app';
const LOCATION_ID = import.meta.env.PUBLIC_LOCATION_ID;

interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  checks: {
    frontend: 'ok' | 'error';
    backend: 'ok' | 'error' | 'timeout';
    database?: 'ok' | 'error' | 'timeout';
  };
  version: string;
  uptime: number;
}

export const GET: APIRoute = async () => {
  const startTime = Date.now();
  const checks = {
    frontend: 'ok' as const,
    backend: 'error' as const,
    database: 'error' as const,
  };

  // Check backend health
  try {
    const res = await fetch(`${BACKEND}/api/health?locationId=${LOCATION_ID}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      checks.backend = 'ok';
      const backendHealth = await res.json();
      if (backendHealth.checks?.database) {
        checks.database = backendHealth.checks.database === 'ok' ? 'ok' : 'error';
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      checks.backend = 'timeout';
    }
  }

  const statusCode = checks.backend === 'ok' ? 200 : checks.backend === 'timeout' ? 503 : 503;
  const overallStatus = checks.backend === 'ok' ? 'ok' : checks.backend === 'timeout' ? 'degraded' : 'error';

  const response: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
    version: '1.0',
    uptime: startTime,
  };

  return new Response(JSON.stringify(response), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
};
