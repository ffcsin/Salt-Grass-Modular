# src / root

_4 files · 3 routes · 0 calls · 10 findings_

## Endpoints (route · guards · params)

- `GET /military` 🔓 — guards: [none]  `src/pages/military.astro:9`
- `GET /process` 🔓 — guards: [none]  `src/pages/process.astro:102`
- `GET /projects` 🔓 — guards: [none]  `src/pages/projects.astro:6`

## Outbound API calls (method · target · params)


## Findings

- [gotcha/high] Contact CTAs bypass the /contact form entirely — phone and email links are hardcoded to Dylan Walker's personal contact info. If the contact owner changes, this page requires a manual code edit. No LP `src/pages/military.astro:272`
- [gotcha/high] Keywords prop is passed to BaseLayout (line 10) but container-homes.astro and pools.astro do not pass keywords — inconsistency across sibling pages in whether the keywords SEO prop is used. `src/pages/military.astro:10`
- [dead-code/med] The hero image references /img/military-hero.jpg (line 17) — this is a static asset path; if the file does not exist in public/img/ it will be a 404 at runtime. Same pattern exists on process.astro an `src/pages/military.astro:17`
- [dead-code/high] privacy.astro does not exist in the saltgrass-modular app. If a /privacy route is expected (e.g. linked from footer or required by Stripe/LPAI compliance), it is missing entirely. `src/pages/privacy.astro:0`
- [inconsistency/high] The page title says '8-Stage Process' (line 102) and the Hero headline repeats 'Our 8-Stage Process' (line 106), but the stages array contains exactly 7 entries (Discovery through Handoff, lines 8-97) `src/pages/process.astro:102`
- [gotcha/med] The FAQ mentions 'See our Financing page' (line 228) without a hyperlink — the text assumes a /financing route exists (which it does in this app) but the cross-link is plain text, reducing discoverabi `src/pages/process.astro:228`
- [dead-code/high] 'See Details' buttons (line 204) use btn-secondary with no href or onclick — clicking does nothing. No project detail pages exist to route to. `src/pages/projects.astro:204`
- [security/high] filterProjects() (line 303) references the implicit global `event` object rather than receiving it as a parameter. This is a browser-specific implicit global that is deprecated and not available in al `src/pages/projects.astro:303`
- [gotcha/med] Category filter onclick (line 163) uses template literal string `filterProjects('${cat.id}')` but the handler references implicit `event.target` (line 303) — if the click registers on a child element  `src/pages/projects.astro:163`
- [gotcha/high] All 6 project entries use placeholder CSS gradient colors for images (e.g. 'gradient-to-br from-blue-400 to-blue-600') instead of real photos (line 19). The image field is consumed as a Tailwind class `src/pages/projects.astro:19`

## Files

- `src/pages/military.astro` — Static marketing page targeting military and government buyers, showcasing FEMA/GSA certifications, government use-case 
- `src/pages/privacy.astro` — FILE NOT FOUND. privacy.astro does not exist in apps/saltgrass-modular/src/pages/ or any subdirectory. The file was list
- `src/pages/process.astro` — Static informational page describing Saltgrass Modular's 7-stage build process (Discovery through Handoff) with timeline
- `src/pages/projects.astro` — Static portfolio/case-study page displaying 6 completed projects (3 residential homes, 2 pools, 1 commercial development
