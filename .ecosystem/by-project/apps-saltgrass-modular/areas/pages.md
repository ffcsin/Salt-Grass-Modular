# apps/saltgrass-modular / pages

_24 files · 17 routes · 11 calls · 62 findings_

## Endpoints (route · guards · params)

- `GET /about` 🔓 — guards: [none]  `apps/saltgrass-modular/src/pages/about.astro:1`
- `GET /blog/[slug]` 🔓 — guards: [none] — :slug  `apps/saltgrass-modular/src/pages/blog/[slug].astro:14`
- `GET /blog` 🔓 — guards: [none]  `apps/saltgrass-modular/src/pages/blog/index.astro:1`
- `GET /blog/rss.xml` 🔓 — guards: [none]  `apps/saltgrass-modular/src/pages/blog/rss.xml.ts:6`
- `GET /contact` 🔓 — guards: [none]  `apps/saltgrass-modular/src/pages/contact.astro:8`
- `GET /developers` 🔓 — guards: [none]  `apps/saltgrass-modular/src/pages/developers.astro:7`
- `GET /financing` 🔓 — guards: [none]  `apps/saltgrass-modular/src/pages/financing.astro:1`
- `GET /homeowners` 🔓 — guards: [none]  `apps/saltgrass-modular/src/pages/homeowners.astro:1`
- `GET /` 🔓 — guards: [none]  `apps/saltgrass-modular/src/pages/index.astro:1`
- `GET /qr/[code]` 🔓 — guards: [none] — :code  `apps/saltgrass-modular/src/pages/qr/[code].astro:1`
- `GET /saltgrass-101/[slug]` 🔓 — guards: [none] — :slug  `apps/saltgrass-modular/src/pages/saltgrass-101/[slug].astro:6`
- `GET /saltgrass-101` 🔓 — guards: [none]  `apps/saltgrass-modular/src/pages/saltgrass-101.astro:1`
- `GET /services/container-homes` 🔓 — guards: [none]  `apps/saltgrass-modular/src/pages/services/container-homes.astro:1`
- `GET /services/developers` 🔓 — guards: [none]  `apps/saltgrass-modular/src/pages/services/developers.astro:1`
- `GET /services/disaster-relief` 🔓 — guards: [none]  `apps/saltgrass-modular/src/pages/services/disaster-relief.astro:1`
- `GET /services/pools` 🔓 — guards: [none]  `apps/saltgrass-modular/src/pages/services/pools.astro:1`
- `GET /services/traditional-builds` 🔓 — guards: [none]  `apps/saltgrass-modular/src/pages/services/traditional-builds.astro:1`

## Outbound API calls (method · target · params)

- `GET ${PUBLIC_API_URL}/api/blog/posts?locationId=${LOCATION_ID}&status=published&limit=100` — ?locationId ?status ?limit  `apps/saltgrass-modular/src/pages/blog/[slug].astro:15`
- `GET ${PUBLIC_API_URL}/api/blog/posts/${slug}?locationId=${LOCATION_ID}` — ?locationId  `apps/saltgrass-modular/src/pages/blog/[slug].astro:20`
- `GET ${PUBLIC_API_URL}/api/blog/posts?locationId=${LOCATION_ID}&category=X&status=published&limit=4` — ?locationId ?category ?status ?limit  `apps/saltgrass-modular/src/pages/blog/[slug].astro:23`
- `GET ${PUBLIC_API_URL}/api/blog/ctas?locationId=${LOCATION_ID}` — ?locationId  `apps/saltgrass-modular/src/pages/blog/[slug].astro:23`
- `GET ${PUBLIC_API_URL}/api/blog/settings/${LOCATION_ID}`  `apps/saltgrass-modular/src/pages/blog/[slug].astro:23`
- `GET ${PUBLIC_API_URL}/api/blog/posts?locationId=${LOCATION_ID}&status=published&limit=100` — ?locationId ?status ?limit  `apps/saltgrass-modular/src/pages/blog/index.astro:5`
- `GET ${PUBLIC_API_URL}/api/blog/categories?locationId=${LOCATION_ID}` — ?locationId  `apps/saltgrass-modular/src/pages/blog/index.astro:5`
- `GET https://lpai-monorepo-production.up.railway.app/api/blog/posts?locationId=${LOCATION_ID}&status=published&limit=100` — ?locationId ?status ?limit  `apps/saltgrass-modular/src/pages/blog/rss.xml.ts:7`
- `POST https://lpai-monorepo-production.up.railway.app/api/portal/forms/quote-request/submit` — body.locationId body.data.firstName body.data.lastName body.data.email body.data.phone body.data.projectType body.data.location body.data.budgetRange body.data.timeline body.data.message body.meta.referrer  `apps/saltgrass-modular/src/pages/contact.astro:79`
- `POST https://lpai-monorepo-production.up.railway.app/api/portal/forms/consultation/submit` — body.locationId body.data.firstName body.data.lastName body.data.email body.data.phone body.data.serviceInterest body.data.currentSituation body.data.preferredContact body.meta.referrer  `apps/saltgrass-modular/src/pages/contact.astro:85`
- `GET ${API_BASE}/api/qr/${code}?locationId=${LOCATION_ID}` — ?locationId  `apps/saltgrass-modular/src/pages/qr/[code].astro:9`

## Findings

- [gotcha/high] All stats (3+ years, 50+ projects, 99% satisfaction) are hardcoded copy. If this data changes, it requires a code edit rather than a CMS update — drift risk over time. `apps/saltgrass-modular/src/pages/about.astro:36`
- [gotcha/high] Team section uses placeholder gradient divs instead of actual photos for Engineering Team and Installation Specialists — placeholder state shipped to production. `apps/saltgrass-modular/src/pages/about.astro:171`
- [gotcha/med] Images (/img/about-hero.jpg, /img/dylan-portrait.jpg, /img/facility-tour.jpg) are referenced but their existence in /public is not verifiable from this file alone — broken image risk if assets are not `apps/saltgrass-modular/src/pages/about.astro:16`
- [security/med] chrome.headerHtml, chrome.footerHtml, and post.content are all rendered with set:html (raw HTML injection). If the backend returns malicious HTML (e.g. from a compromised CMS record), it executes in t `apps/saltgrass-modular/src/pages/blog/[slug].astro:68`
- [gotcha/med] CTA gradient detection: `ctaIsTailwindGradient` checks if gradient starts with 'from-' to distinguish Tailwind class from inline CSS. If a Tailwind gradient class doesn't start with 'from-' (e.g. 'bg- `apps/saltgrass-modular/src/pages/blog/[slug].astro:52`
- [gotcha/high] getStaticPaths calls getBlogPosts() which uses limit=100. Sites with >100 posts will silently drop slugs from the pre-rendered set — those posts will 404 at runtime. `apps/saltgrass-modular/src/pages/blog/[slug].astro:15`
- [tenancy/high] All API calls correctly scope to PUBLIC_LOCATION_ID — correct single-tenant isolation for this client site. `apps/saltgrass-modular/src/pages/blog/[slug].astro:20`
- [perf/high] On each page build, 5 separate API calls are made (posts list, post by slug, related posts, CTAs, chrome settings). Promise.all parallelizes 3 of them but the initial getBlogPosts() in getStaticPaths  `apps/saltgrass-modular/src/pages/blog/[slug].astro:23`
- [gotcha/high] getBlogPosts() uses limit=100. If the location has >100 posts, the listing silently truncates — no pagination UI is rendered. The filter/search only operates on the pre-fetched 100-post window. `apps/saltgrass-modular/src/pages/blog/index.astro:5`
- [gotcha/med] Featured post selection: `posts.find(p => p.heroStyle === 'featured') || posts[0]`. If no post has heroStyle='featured', the newest post (posts[0]) is featured by API return order — this is implicit a `apps/saltgrass-modular/src/pages/blog/index.astro:10`
- [perf/high] Client-side category and search filtering operates on data-attributes injected at build time (data-cat, data-title, data-excerpt). All filtering is zero-latency JS with no network round-trips — good p `apps/saltgrass-modular/src/pages/blog/index.astro:124`
- [gotcha/med] Category fallback logic derives categories from post data if API returns empty array. The fallback uses post.category values directly as both slug and name, so category slugs will not be URL-safe if p `apps/saltgrass-modular/src/pages/blog/index.astro:13`
- [tenancy/high] Both API calls correctly scope to PUBLIC_LOCATION_ID — correct single-tenant isolation for this client site. `apps/saltgrass-modular/src/pages/blog/index.astro:5`
- [gotcha/high] getBlogPosts() fetches up to 100 posts from the backend (limit=100) but rss.xml.ts only renders the first 30 (.slice(0, 30)). If there are more than 100 posts, newer posts beyond the 100-limit will ne `apps/saltgrass-modular/src/pages/blog/rss.xml.ts:9`
- [gotcha/high] The SITE_URL is hardcoded to 'https://www.saltgrassmodular.com' (line 4), not pulled from an env var. If the site is ever redeployed under a different domain or staging URL, all RSS item links and the `apps/saltgrass-modular/src/pages/blog/rss.xml.ts:4`
- [perf/med] No caching headers are set on the Response. Every RSS reader poll triggers a fresh fetch to the Railway backend. Consider adding Cache-Control: max-age=3600 or similar to reduce upstream load. `apps/saltgrass-modular/src/pages/blog/rss.xml.ts:37`
- [dead-code/high] File does not exist. The compare/ directory is absent entirely from apps/saltgrass-modular/src/pages/. This may be a planned but unbuilt comparison-page feature. `apps/saltgrass-modular/src/pages/compare/[slug].astro:0`
- [dead-code/high] File does not exist. The compare/ directory is absent entirely from apps/saltgrass-modular/src/pages/. `apps/saltgrass-modular/src/pages/compare/index.astro:0`
- [gotcha/high] The LPAI calendar widget at line 100-113 is a placeholder stub — it renders a text message stating the calendar will be configured during account setup. No actual embed or iframe exists. Visitors who  `apps/saltgrass-modular/src/pages/contact.astro:101`
- [security/med] The LPAI location ID 'plan_chNIQv7tfy09Ew_h1liV' is hardcoded as a fallback default inside both QuoteRequestForm.astro (line 3) and ConsultationForm.astro (line 3) and also visible in the HTML source  `apps/saltgrass-modular/src/pages/contact.astro:110`
- [gotcha/high] Both form submit handlers (QuoteRequestForm + ConsultationForm) perform the honeypot check then silently show the success state without actually submitting — a bot that fills the honeypot gets a false `apps/saltgrass-modular/src/pages/contact.astro:182`
- [inconsistency/med] The tab switcher JavaScript at line 148 uses onclick= inline handlers (switchTab('quote')) which are declared as a plain function in a script block. In strict Astro environments with Content Security  `apps/saltgrass-modular/src/pages/contact.astro:148`
- [dead-code/high] File does not exist. The cost/ directory is absent entirely from apps/saltgrass-modular/src/pages/. This may be a planned but unbuilt cost-guide programmatic SEO feature. `apps/saltgrass-modular/src/pages/cost/[slug].astro:0`
- [gotcha/med] The page claims '50+ completed projects' and '99% client satisfaction' (lines 72-78) as hard-coded marketing copy. These figures are not sourced from a CMS or backend and will silently become stale as `apps/saltgrass-modular/src/pages/developers.astro:72`
- [gotcha/high] The case study at lines 270-302 is a generic placeholder ('12-Unit Multi-Family Development, Oklahoma') with no real client name, photos, or links. The testimonial is attributed only to '— Residential `apps/saltgrass-modular/src/pages/developers.astro:270`
- [inconsistency/med] The page is titled 'For Developers & Government' and the hero targets developers broadly, but the URL is /developers (not /developers-government or /enterprise). The /services/developers.astro page al `apps/saltgrass-modular/src/pages/developers.astro:9`
- [dead-code/med] There is a /services/developers.astro file at apps/saltgrass-modular/src/pages/services/developers.astro serving a similar audience. Having two developer-targeted pages (/developers and /services/deve `apps/saltgrass-modular/src/pages/developers.astro:0`
- [gotcha/high] The 'Schedule Call' CTA on line 299-303 uses an inline onclick targeting 'consultation-modal' which is only rendered in index.astro. If a user navigates directly to /financing the modal DOM element wi `apps/saltgrass-modular/src/pages/financing.astro:299`
- [gotcha/med] The Hearth link opens externally with no tracking/UTM parameters, so conversions from this page cannot be attributed in analytics. `apps/saltgrass-modular/src/pages/financing.astro:138`
- [dead-code/high] File does not exist at the specified path. The task listed it but the filesystem confirms it is absent. `apps/saltgrass-modular/src/pages/glossary.astro:0`
- [dead-code/high] ServicesGrid is imported (line 4) but never rendered in the template body. Dead import. `apps/saltgrass-modular/src/pages/homeowners.astro:4`
- [inconsistency/med] Hearth description on this page says 'funds in 24 hours / pre-qualify in 2 min' (lines 176-178) while financing.astro says 'pre-qualify in minutes / approval 2-4 weeks'. Minor copy inconsistency acros `apps/saltgrass-modular/src/pages/homeowners.astro:176`
- [gotcha/low] Native HTML <details>/<summary> accordion pattern used for FAQ (lines 257-315). This is a different UI pattern from the rest of the site which uses custom JS components — no visual consistency enforce `apps/saltgrass-modular/src/pages/homeowners.astro:257`
- [gotcha/high] Modals (quote-modal, consultation-modal) are only rendered in index.astro DOM. Other pages (financing.astro, and possibly others) trigger these modals via inline onclick or data-action, but those moda `apps/saltgrass-modular/src/pages/index.astro:45`
- [gotcha/med] The data-action='quote-modal' dispatch pattern in the client <script> (lines 82-101) uses document.getElementById which returns null if the element is missing — fails silently. No fallback to a full / `apps/saltgrass-modular/src/pages/index.astro:87`
- [dead-code/high] File does not exist at the specified path. The task listed it but the filesystem confirms it is absent. `apps/saltgrass-modular/src/pages/locations/[slug].astro:0`
- [dead-code/high] File does not exist at the specified path. The task listed it but the filesystem confirms it is absent. `apps/saltgrass-modular/src/pages/locations/index.astro:0`
- [security/med] The `code` param is passed through encodeURIComponent before being interpolated into the fetch URL, which is correct. However, no length or character-set validation is applied before the fetch — an ar `apps/saltgrass-modular/src/pages/qr/[code].astro:9`
- [gotcha/high] The catch block is a bare no-op; any network error (Railway down, DNS failure) silently returns 404 to the user with no logging, making it impossible to distinguish a bad QR code from an infrastructur `apps/saltgrass-modular/src/pages/qr/[code].astro:16`
- [tenancy/high] Location scoping is handled by passing PUBLIC_LOCATION_ID as a query param — this means all QR codes on this site are resolved against a single tenant; cross-tenant QR resolution is not supported by t `apps/saltgrass-modular/src/pages/qr/[code].astro:5`
- [dead-code/high] The fallback `if (!guide) return Astro.redirect('/saltgrass-101')` on line 113 can never be reached in SSG mode because getStaticPaths() only registers the 8 known slugs — Astro will 404 any unknown s `apps/saltgrass-modular/src/pages/saltgrass-101/[slug].astro:113`
- [gotcha/high] All guide content (titles, descriptions, section text, pricing figures) is hardcoded in the JS object on lines 21-110. Any content update requires a code change and redeploy rather than a CMS update — `apps/saltgrass-modular/src/pages/saltgrass-101/[slug].astro:21`
- [perf/high] The hero image path `/img/saltgrass-101-hero.jpg` is shared across all 8 guide slugs with no per-guide hero image — all guide detail pages render identical hero imagery regardless of content. `apps/saltgrass-modular/src/pages/saltgrass-101/[slug].astro:130`
- [inconsistency/high] The guides array on lines 6-55 is a separate definition from the `guides` Record in saltgrass-101/[slug].astro. Both must be manually kept in sync — a slug added to one but not the other will produce  `apps/saltgrass-modular/src/pages/saltgrass-101.astro:6`
- [gotcha/med] The hero image `/img/saltgrass-101-hero.jpg` is referenced here and identically in the detail page. If the asset is missing at build time, both index and all 8 detail pages will render broken images s `apps/saltgrass-modular/src/pages/saltgrass-101.astro:67`
- [gotcha/high] The three 'Request Quote' buttons (lines 123, 138, 152) are plain `<button>` elements with no form, href, JS handler, or event listener attached. Clicking them does nothing. This is a dead CTA. `apps/saltgrass-modular/src/pages/services/container-homes.astro:123`
- [gotcha/high] The 'Recent Projects' gallery section (lines 164-196) uses CSS gradient placeholders (`bg-gradient-to-br from-blue-400 to-blue-600 h-64`) instead of real project photos — these are unfilled placeholde `apps/saltgrass-modular/src/pages/services/container-homes.astro:164`
- [gotcha/high] The 'Popular Models' gallery (lines 111-159) also uses gradient color blocks (`bg-gradient-to-br`) instead of real product images — same placeholder-shipping risk. `apps/saltgrass-modular/src/pages/services/container-homes.astro:111`
- [inconsistency/med] FAQ answer for cost quotes '640 SF one-bedroom ranges from $90K-$120K' (line 33) while the model card on line 137 shows 'Starting at $105K'. The range in the FAQ implies a floor below $105K but the ca `apps/saltgrass-modular/src/pages/services/container-homes.astro:33`
- [gotcha/high] The CtaBanner at line 269 prompts developers to 'Submit your RFQ or schedule a developer call' but this page contains no form, no RFQ submission mechanism, no mailto link, and no href to an RFQ form — `apps/saltgrass-modular/src/pages/services/developers.astro:269`
- [gotcha/med] The hero image `/img/developers-hero.jpg` is referenced but not verified to exist in the public assets — same silent-broken-image risk as other service pages. `apps/saltgrass-modular/src/pages/services/developers.astro:14`
- [gotcha/med] The developer-facing copy references `/financing` and implies government/GSA schedule availability, but no links to those pages appear in the body — a developer landing here has no in-page navigation  `apps/saltgrass-modular/src/pages/services/developers.astro:150`
- [inconsistency/high] CtaBanner is imported on line 4 but never rendered in the template — unlike every other service page which ends with a <CtaBanner> component. The page ends with a bespoke inline CTA section (lines 195 `apps/saltgrass-modular/src/pages/services/disaster-relief.astro:4`
- [security/med] Dylan's direct phone number (405-659-1949) and email address (Dylan.Walker@saltgrassmodular.com) are hardcoded in the template markup (lines 203-207). These are publicly visible in source and at risk  `apps/saltgrass-modular/src/pages/services/disaster-relief.astro:203`
- [gotcha/med] The hero image `/img/disaster-relief-hero.jpg` is referenced but existence of the asset is unverified — same silent-broken-image risk as other pages using placeholder or missing images. `apps/saltgrass-modular/src/pages/services/disaster-relief.astro:15`
- [dead-code/high] src/pages/services/index.astro does not exist. There is no umbrella services listing page under the /services route for saltgrass-modular. The site homepage (src/pages/index.astro) links to /services  `apps/saltgrass-modular/src/pages/services/index.astro:0`
- [gotcha/high] 'Request Quote' buttons (lines 58, 96) are plain <button> elements with no href, form binding, or onclick handler — clicking them does nothing at runtime. No modal wiring, no form submission, no navig `apps/saltgrass-modular/src/pages/services/pools.astro:58`
- [gotcha/med] Hero image references /img/pools-hero.jpg (line 16) — this is a static asset path that must exist in the public/ directory at build time. No fallback or error handling if missing. `apps/saltgrass-modular/src/pages/services/pools.astro:16`
- [inconsistency/med] The comparison table lists tube steel + fiberglass durability as '8–12 years' (line 123) but the FAQ directly below says '8–12 years with proper maintenance' (line 209) — consistent internally, but a  `apps/saltgrass-modular/src/pages/services/pools.astro:123`
- [gotcha/med] Hero image references /img/traditional-builds-hero.jpg (line 16) and inline <img> references /img/traditional-home-exterior.jpg (line 52) — both must exist as static assets in public/. No fallback or  `apps/saltgrass-modular/src/pages/services/traditional-builds.astro:16`
- [gotcha/high] CTA banner (line 195-198) says 'Schedule a consultation' but no link or modal trigger is present in this file. The consultation flow is not wired here — user has no navigation target from this CTA. `apps/saltgrass-modular/src/pages/services/traditional-builds.astro:195`
- [inconsistency/high] The 'Financing page' is referenced as a link destination in two FAQ answers (lines 181, 187) but the anchor is plain text, not an actual <a href> — these are dead references that don't navigate anywhe `apps/saltgrass-modular/src/pages/services/traditional-builds.astro:179`

## Files

- `apps/saltgrass-modular/src/pages/about.astro` — Static About page for the Saltgrass Modular client site. Renders founder story, differentiators, fabrication facility in
- `apps/saltgrass-modular/src/pages/blog/[slug].astro` — Dynamic Astro blog post detail page for Saltgrass Modular. Uses SSG (getStaticPaths) to pre-render all published posts. 
- `apps/saltgrass-modular/src/pages/blog/index.astro` — Blog listing index page for Saltgrass Modular. Fetches all published posts and category list at build time, renders a fe
- `apps/saltgrass-modular/src/pages/blog/rss.xml.ts` — Astro API route that generates a standard RSS 2.0 XML feed for the Saltgrass Modular blog, fetching the 30 most recent p
- `apps/saltgrass-modular/src/pages/compare/[slug].astro` — FILE DOES NOT EXIST in this repository. The path apps/saltgrass-modular/src/pages/compare/[slug].astro was listed for ex
- `apps/saltgrass-modular/src/pages/compare/index.astro` — FILE DOES NOT EXIST in this repository. The path apps/saltgrass-modular/src/pages/compare/index.astro was listed for ext
- `apps/saltgrass-modular/src/pages/contact.astro` — Contact page for Saltgrass Modular that presents phone/email/address contact options and hosts a tabbed interface with t
- `apps/saltgrass-modular/src/pages/cost/[slug].astro` — FILE DOES NOT EXIST in this repository. The path apps/saltgrass-modular/src/pages/cost/[slug].astro was listed for extra
- `apps/saltgrass-modular/src/pages/developers.astro` — Static marketing page targeting real estate developers, government contractors, real estate investors, and educational i
- `apps/saltgrass-modular/src/pages/financing.astro` — Static Astro page for the Saltgrass Modular financing hub. Presents three financing options (construction loans via Hear
- `apps/saltgrass-modular/src/pages/glossary.astro` — FILE DOES NOT EXIST in the repository. No glossary.astro was found under apps/saltgrass-modular/src/pages/.
- `apps/saltgrass-modular/src/pages/homeowners.astro` — Static Astro page targeting residential homeowner buyers. Covers modular home value props, popular model showcases (with
- `apps/saltgrass-modular/src/pages/index.astro` — Home page / entry point of the Saltgrass Modular Astro site. Renders the Hero with dual CTAs, ServicesGrid, StatsStrip, 
- `apps/saltgrass-modular/src/pages/locations/[slug].astro` — FILE DOES NOT EXIST in the repository. No locations/ directory was found under apps/saltgrass-modular/src/pages/.
- `apps/saltgrass-modular/src/pages/locations/index.astro` — FILE DOES NOT EXIST in the repository. No locations/ directory was found under apps/saltgrass-modular/src/pages/.
- `apps/saltgrass-modular/src/pages/qr/[code].astro` — Dynamic QR-code redirect handler. At SSR request time it calls the LPAI backend to resolve a short code to a redirectUrl
- `apps/saltgrass-modular/src/pages/saltgrass-101/[slug].astro` — Static educational guide detail page for the Saltgrass 101 learning hub. Uses getStaticPaths() to pre-build 8 guide slug
- `apps/saltgrass-modular/src/pages/saltgrass-101.astro` — Saltgrass 101 learning hub index page. Renders a grid of 8 educational guide cards (each linking to /saltgrass-101/[slug
- `apps/saltgrass-modular/src/pages/services/container-homes.astro` — Static marketing service page for Saltgrass custom container homes. Renders hero, feature list, spec strip, model galler
- `apps/saltgrass-modular/src/pages/services/developers.astro` — Static B2B marketing page targeting developers, military, government agencies, and real estate investors. Covers market 
- `apps/saltgrass-modular/src/pages/services/disaster-relief.astro` — Static marketing page for Saltgrass disaster relief and rapid deployment services. Covers emergency housing types, why-m
- `apps/saltgrass-modular/src/pages/services/index.astro` — File does not exist in the repository. No services/index.astro is present under apps/saltgrass-modular/src/pages/service
- `apps/saltgrass-modular/src/pages/services/pools.astro` — Static Astro page rendering the Saltgrass Modular pools service detail. Presents two pool product lines (tube steel + fi
- `apps/saltgrass-modular/src/pages/services/traditional-builds.astro` — Static Astro page for the Saltgrass Modular 'Traditional Custom Builds' service. Presents architectural styles, construc
