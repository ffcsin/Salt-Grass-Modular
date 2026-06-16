# tenancy findings (4)

- [high] apps/saltgrass-modular/src/pages/api/health.ts:28 — PUBLIC_LOCATION_ID is forwarded to the backend health check to scope the DB probe — correct multi-tenant pattern for a single-location client site.
- [high] apps/saltgrass-modular/src/pages/blog/[slug].astro:20 — All API calls correctly scope to PUBLIC_LOCATION_ID — correct single-tenant isolation for this client site.
- [high] apps/saltgrass-modular/src/pages/blog/index.astro:5 — Both API calls correctly scope to PUBLIC_LOCATION_ID — correct single-tenant isolation for this client site.
- [high] apps/saltgrass-modular/src/pages/qr/[code].astro:5 — Location scoping is handled by passing PUBLIC_LOCATION_ID as a query param — this means all QR codes on this site are resolved against a single tenant; cross-tenant QR resolution is not supported by this page.
