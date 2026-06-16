# dead-code findings (15)

- [high] apps/saltgrass-modular/src/pages/compare/[slug].astro:0 — File does not exist. The compare/ directory is absent entirely from apps/saltgrass-modular/src/pages/. This may be a planned but unbuilt comparison-page feature.
- [high] apps/saltgrass-modular/src/pages/compare/index.astro:0 — File does not exist. The compare/ directory is absent entirely from apps/saltgrass-modular/src/pages/.
- [high] apps/saltgrass-modular/src/pages/cost/[slug].astro:0 — File does not exist. The cost/ directory is absent entirely from apps/saltgrass-modular/src/pages/. This may be a planned but unbuilt cost-guide programmatic SEO feature.
- [med] apps/saltgrass-modular/src/pages/developers.astro:0 — There is a /services/developers.astro file at apps/saltgrass-modular/src/pages/services/developers.astro serving a similar audience. Having two developer-targeted pages (/developers and /services/developers) without clea
- [high] apps/saltgrass-modular/src/pages/glossary.astro:0 — File does not exist at the specified path. The task listed it but the filesystem confirms it is absent.
- [high] apps/saltgrass-modular/src/pages/homeowners.astro:4 — ServicesGrid is imported (line 4) but never rendered in the template body. Dead import.
- [high] apps/saltgrass-modular/src/pages/locations/[slug].astro:0 — File does not exist at the specified path. The task listed it but the filesystem confirms it is absent.
- [high] apps/saltgrass-modular/src/pages/locations/index.astro:0 — File does not exist at the specified path. The task listed it but the filesystem confirms it is absent.
- [med] src/pages/military.astro:17 — The hero image references /img/military-hero.jpg (line 17) — this is a static asset path; if the file does not exist in public/img/ it will be a 404 at runtime. Same pattern exists on process.astro and projects.astro.
- [high] src/pages/models/container-homes.astro:157 — 'Request Quote' buttons (lines 157) use btn-primary class but have no onclick handler, href, or form trigger — clicking them does nothing. The quote CTA is dead UI.
- [high] src/pages/models/pools.astro:104 — 'Request Quote' buttons (lines 104, 163) use btn-primary class but have no onclick, href, or form action — same dead CTA pattern as container-homes.astro.
- [high] src/pages/privacy.astro:0 — privacy.astro does not exist in the saltgrass-modular app. If a /privacy route is expected (e.g. linked from footer or required by Stripe/LPAI compliance), it is missing entirely.
- [high] src/pages/projects.astro:204 — 'See Details' buttons (line 204) use btn-secondary with no href or onclick — clicking does nothing. No project detail pages exist to route to.
- [high] apps/saltgrass-modular/src/pages/saltgrass-101/[slug].astro:113 — The fallback `if (!guide) return Astro.redirect('/saltgrass-101')` on line 113 can never be reached in SSG mode because getStaticPaths() only registers the 8 known slugs — Astro will 404 any unknown slug before the front
- [high] apps/saltgrass-modular/src/pages/services/index.astro:0 — src/pages/services/index.astro does not exist. There is no umbrella services listing page under the /services route for saltgrass-modular. The site homepage (src/pages/index.astro) links to /services via a Hero CTA, whic
