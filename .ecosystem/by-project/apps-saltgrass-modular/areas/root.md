# apps/saltgrass-modular / root

_3 files · 3 routes · 3 calls · 10 findings_

## Endpoints (route · guards · params)

- `GET /api/health` 🔓 — guards: [none]  `apps/saltgrass-modular/src/pages/api/health.ts:18`
- `GET /api/s` 🔓 — guards: [none]  `apps/saltgrass-modular/src/pages/api/s.ts:5`
- `POST /api/t` 🔓 — guards: [none] — body.(passthrough — shape determined by tracking script)  `apps/saltgrass-modular/src/pages/api/t.ts:5`

## Outbound API calls (method · target · params)

- `GET ${PUBLIC_API_URL}/api/health?locationId=${PUBLIC_LOCATION_ID}` — ?locationId  `apps/saltgrass-modular/src/pages/api/health.ts:28`
- `GET ${PUBLIC_API_URL}/api/website-clients/tracking-script`  `apps/saltgrass-modular/src/pages/api/s.ts:7`
- `POST ${PUBLIC_API_URL}/api/website-clients/track` — body.(raw passthrough — opaque to this layer)  `apps/saltgrass-modular/src/pages/api/t.ts:8`

## Findings

- [gotcha/high] uptime field is set to startTime (Date.now() at request start) rather than process uptime or a stable timestamp — this will always reflect request-start epoch ms, not actual service uptime. `apps/saltgrass-modular/src/pages/api/health.ts:51`
- [gotcha/high] statusCode logic sets 503 for both 'timeout' and 'error' states — the comment and overallStatus distinguish them but HTTP callers only see 503, losing the timeout signal. `apps/saltgrass-modular/src/pages/api/health.ts:44`
- [tenancy/high] PUBLIC_LOCATION_ID is forwarded to the backend health check to scope the DB probe — correct multi-tenant pattern for a single-location client site. `apps/saltgrass-modular/src/pages/api/health.ts:28`
- [security/low] No auth on this endpoint — intentional for uptime probing, but the response includes database status which could inform an attacker whether the DB is reachable. Low practical risk but worth noting. `apps/saltgrass-modular/src/pages/api/health.ts:18`
- [gotcha/high] Regex rewrite `var u="[^"]+"` assumes the backend tracking script uses a specific variable name/format. If the backend script changes that variable name, the rewrite silently fails and the beacon URL  `apps/saltgrass-modular/src/pages/api/s.ts:10`
- [gotcha/high] On backend error, returns HTTP 204 with empty body and Content-Type: application/javascript. Browsers will execute the empty response silently — no JS error but tracking is fully dead. Silent failure  `apps/saltgrass-modular/src/pages/api/s.ts:18`
- [perf/high] Script is cached 1 hour (max-age=3600). If the backend tracking script is updated, cached clients will not pick it up for up to an hour. `apps/saltgrass-modular/src/pages/api/s.ts:13`
- [security/med] No validation or rate-limiting on the proxy — any client can POST arbitrary payloads to the backend tracking endpoint via this relay. The backend must enforce its own validation and rate limits. `apps/saltgrass-modular/src/pages/api/t.ts:5`
- [gotcha/med] Content-Type is hardcoded as 'application/json' when forwarding to backend, but request.text() reads the raw body regardless of incoming Content-Type. If the tracking script sends non-JSON, the backen `apps/saltgrass-modular/src/pages/api/t.ts:10`
- [gotcha/low] res.body is streamed directly as the response. If the backend returns a streaming or chunked response, edge-runtime stream piping behavior in Astro SSR may vary. `apps/saltgrass-modular/src/pages/api/t.ts:13`

## Files

- `apps/saltgrass-modular/src/pages/api/health.ts` — Astro API route that acts as a health-check aggregator for the Saltgrass Modular client site. Probes the LPAI NestJS bac
- `apps/saltgrass-modular/src/pages/api/s.ts` — Astro API route that proxies and rewrites the LPAI analytics tracking script. Fetches the JS bundle from the backend, re
- `apps/saltgrass-modular/src/pages/api/t.ts` — Astro API route that proxies analytics tracking beacon POSTs to the LPAI backend. Receives a raw body from the client-si
