# apps/web-marketing / pages

_1 files · 1 routes · 0 calls · 5 findings_

## Endpoints (route · guards · params)

- `GET /terms` 🔓 — guards: [none]  `apps/web-marketing/src/pages/terms.astro:1`

## Outbound API calls (method · target · params)


## Findings

- [gotcha/med] Section 9 (Third-Party Integrations, lines 163-189) contains external links to Google, Meta, LinkedIn, and Microsoft developer terms pages as target='_blank' rel='noopener noreferrer'. These links are `apps/web-marketing/src/pages/terms.astro:167`
- [gotcha/med] The /privacy link (line 85) and /pricing link (line 102) are relative hrefs — they depend on those routes existing in the same app. If the privacy or pricing pages are missing or at different paths, t `apps/web-marketing/src/pages/terms.astro:85`
- [inconsistency/high] Section 8 explicitly states 'LPAI does not use Your Data... to train generalized AI/ML models' (line 158) and Section 5 states 'The Lead Finder does not use data obtained through Google, Meta, LinkedI `apps/web-marketing/src/pages/terms.astro:137`
- [gotcha/low] IntersectionObserver active-TOC logic (lines 322-341) casts HTMLElement as HTMLAnchorElement inline — TypeScript 'as' cast without null guard on getAttribute. Low risk at runtime (elements are always  `apps/web-marketing/src/pages/terms.astro:319`
- [gotcha/high] The 'Last updated: May 4, 2026' date (line 35) is hardcoded. If the terms content is edited without updating this date, it becomes a misleading legal timestamp. `apps/web-marketing/src/pages/terms.astro:35`

## Files

- `apps/web-marketing/src/pages/terms.astro` — Terms of Service legal page for the LeadProspecting AI marketing site (apps/web-marketing). Renders 18 numbered ToS sect
