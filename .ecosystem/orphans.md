# Orphans — triage queue

> Nothing here is auto-deleted. Verify before acting.

## Routes with no FE caller (33)

| Method | Route | Handler | Source |
| --- | --- | --- | --- |
| ANY | `/about.astro` | `` | src/pages/about.astro:1 |
| ANY | `/api/s` | `` | src/pages/api/s.ts:1 |
| ANY | `/api/t` | `` | src/pages/api/t.ts:1 |
| ANY | `/blog/:slug.astro` | `` | src/pages/blog/[slug].astro:1 |
| ANY | `/blog/index.astro` | `` | src/pages/blog/index.astro:1 |
| ANY | `/blog/rss.xml` | `` | src/pages/blog/rss.xml.ts:1 |
| ANY | `/compare/:slug.astro` | `` | src/pages/compare/[slug].astro:1 |
| ANY | `/compare/index.astro` | `` | src/pages/compare/index.astro:1 |
| ANY | `/contact.astro` | `` | src/pages/contact.astro:1 |
| ANY | `/cost/:slug.astro` | `` | src/pages/cost/[slug].astro:1 |
| ANY | `/developers.astro` | `` | src/pages/developers.astro:1 |
| ANY | `/financing.astro` | `` | src/pages/financing.astro:1 |
| ANY | `/glossary.astro` | `` | src/pages/glossary.astro:1 |
| ANY | `/homeowners.astro` | `` | src/pages/homeowners.astro:1 |
| ANY | `/index.astro` | `` | src/pages/index.astro:1 |
| ANY | `/locations/:slug.astro` | `` | src/pages/locations/[slug].astro:1 |
| ANY | `/locations/index.astro` | `` | src/pages/locations/index.astro:1 |
| ANY | `/military.astro` | `` | src/pages/military.astro:1 |
| ANY | `/models/container-homes.astro` | `` | src/pages/models/container-homes.astro:1 |
| ANY | `/models/pools.astro` | `` | src/pages/models/pools.astro:1 |
| ANY | `/privacy.astro` | `` | src/pages/privacy.astro:1 |
| ANY | `/process.astro` | `` | src/pages/process.astro:1 |
| ANY | `/projects.astro` | `` | src/pages/projects.astro:1 |
| ANY | `/qr/:code.astro` | `` | src/pages/qr/[code].astro:1 |
| ANY | `/saltgrass-101/:slug.astro` | `` | src/pages/saltgrass-101/[slug].astro:1 |
| ANY | `/saltgrass-101.astro` | `` | src/pages/saltgrass-101.astro:1 |
| ANY | `/services/container-homes.astro` | `` | src/pages/services/container-homes.astro:1 |
| ANY | `/services/developers.astro` | `` | src/pages/services/developers.astro:1 |
| ANY | `/services/disaster-relief.astro` | `` | src/pages/services/disaster-relief.astro:1 |
| ANY | `/services/index.astro` | `` | src/pages/services/index.astro:1 |
| ANY | `/services/pools.astro` | `` | src/pages/services/pools.astro:1 |
| ANY | `/services/traditional-builds.astro` | `` | src/pages/services/traditional-builds.astro:1 |
| ANY | `/terms.astro` | `` | src/pages/terms.astro:1 |

## FE calls matching no route (8)

| FE call | Method | URL |
| --- | --- | --- |
| src/lib/blog.ts:60 | GET | `/api/blog/posts?locationId=${LOCATION_ID}&status=published&limit=100` |
| src/lib/blog.ts:72 | GET | `/api/blog/posts/${encodeURIComponent(slug)}?locationId=${LOCATION_ID}` |
| src/lib/blog.ts:84 | GET | `/api/blog/categories?locationId=${LOCATION_ID}` |
| src/lib/blog.ts:104 | GET | `/api/blog/posts?${params}` |
| src/lib/blog.ts:118 | GET | `/api/blog/ctas?locationId=${LOCATION_ID}` |
| src/lib/blog.ts:148 | GET | `/api/blog/settings/${LOCATION_ID}` |
| src/pages/api/s.ts:10 | GET | `/api/website-clients/tracking-script` |
| src/pages/api/t.ts:11 | POST | `/api/website-clients/track` |
