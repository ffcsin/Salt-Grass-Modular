# Area: ungrouped

> Machine-generated from `map.json`. Do not edit — it is regenerated each run.
> Intent / why / gotchas (human-owned): [`../intent/ungrouped.md`](../intent/ungrouped.md)

## Routes (0)

| Method | Route | Handler | Source |
| --- | --- | --- | --- |

## Frontend calls (8)

| Caller | Method | URL | Route |
| --- | --- | --- | --- |
| src/lib/blog.ts:60 | GET | `/api/blog/posts?locationId=${LOCATION_ID}&status=published&limit=100` | `` |
| src/lib/blog.ts:72 | GET | `/api/blog/posts/${encodeURIComponent(slug)}?locationId=${LOCATION_ID}` | `` |
| src/lib/blog.ts:84 | GET | `/api/blog/categories?locationId=${LOCATION_ID}` | `` |
| src/lib/blog.ts:104 | GET | `/api/blog/posts?${params}` | `` |
| src/lib/blog.ts:118 | GET | `/api/blog/ctas?locationId=${LOCATION_ID}` | `` |
| src/lib/blog.ts:148 | GET | `/api/blog/settings/${LOCATION_ID}` | `` |
| src/pages/api/s.ts:10 | GET | `/api/website-clients/tracking-script` | `` |
| src/pages/api/t.ts:11 | POST | `/api/website-clients/track` | `` |

## Orphan routes — no caller (0)

| Method | Route | Source |
| --- | --- | --- |
