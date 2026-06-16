# perf findings (5)

- [high] apps/saltgrass-modular/src/pages/api/s.ts:13 — Script is cached 1 hour (max-age=3600). If the backend tracking script is updated, cached clients will not pick it up for up to an hour.
- [high] apps/saltgrass-modular/src/pages/blog/[slug].astro:23 — On each page build, 5 separate API calls are made (posts list, post by slug, related posts, CTAs, chrome settings). Promise.all parallelizes 3 of them but the initial getBlogPosts() in getStaticPaths runs sequentially be
- [high] apps/saltgrass-modular/src/pages/blog/index.astro:124 — Client-side category and search filtering operates on data-attributes injected at build time (data-cat, data-title, data-excerpt). All filtering is zero-latency JS with no network round-trips — good pattern.
- [med] apps/saltgrass-modular/src/pages/blog/rss.xml.ts:37 — No caching headers are set on the Response. Every RSS reader poll triggers a fresh fetch to the Railway backend. Consider adding Cache-Control: max-age=3600 or similar to reduce upstream load.
- [high] apps/saltgrass-modular/src/pages/saltgrass-101/[slug].astro:130 — The hero image path `/img/saltgrass-101-hero.jpg` is shared across all 8 guide slugs with no per-guide hero image — all guide detail pages render identical hero imagery regardless of content.
