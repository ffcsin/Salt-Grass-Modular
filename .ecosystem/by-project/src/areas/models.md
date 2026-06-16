# src / models

_2 files · 2 routes · 0 calls · 6 findings_

## Endpoints (route · guards · params)

- `GET /models/container-homes` 🔓 — guards: [none]  `src/pages/models/container-homes.astro:1`
- `GET /models/pools` 🔓 — guards: [none]  `src/pages/models/pools.astro:26`

## Outbound API calls (method · target · params)


## Findings

- [dead-code/high] 'Request Quote' buttons (lines 157) use btn-primary class but have no onclick handler, href, or form trigger — clicking them does nothing. The quote CTA is dead UI. `src/pages/models/container-homes.astro:157`
- [gotcha/high] All model pricing and specs are hardcoded in the Astro frontmatter array (lines 6-75). There is no CMS or API backing this data — any price or spec change requires a code deploy. `src/pages/models/container-homes.astro:6`
- [gotcha/med] Hero image references /img/models-hero.jpg (line 87) — static asset with no fallback; 404 if missing from public/img/. `src/pages/models/container-homes.astro:87`
- [dead-code/high] 'Request Quote' buttons (lines 104, 163) use btn-primary class but have no onclick, href, or form action — same dead CTA pattern as container-homes.astro. `src/pages/models/pools.astro:104`
- [gotcha/high] scrollToSection() is defined in a <script> block (line 284) and called via inline onclick attributes (lines 44, 49). This is a global function attached to window — works but could collide if other scr `src/pages/models/pools.astro:284`
- [gotcha/high] All pool model data (tubeSteelModels, weldedSteelModels arrays lines 6-16) is hardcoded — same no-CMS pattern as container-homes.astro. Price changes require code deploys. `src/pages/models/pools.astro:6`

## Files

- `src/pages/models/container-homes.astro` — Static product catalog page listing four container home models (320 SF studio, 640 SF 1-bed, 960 SF 2-bed, custom) with 
- `src/pages/models/pools.astro` — Static product catalog page for modular pool models, presenting two construction types (tube steel + fiberglass, welded 
