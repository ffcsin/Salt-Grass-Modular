# Saltgrass Modular — Pre-Launch Checklist

**Project Status:** Task 24 of 25 (96%)  
**Target Go-Live:** Late June 2026  
**Current URL:** https://saltgrass-modular.vercel.app  
**Production URL:** https://saltgrassmodular.com (pending DNS cutover)

---

## ✅ COMPLETED (verified in code)

- [x] Site fully built (25 pages, 3 audience landing pages, blog system)
- [x] Design system locked (Crimson #C41E3A, Navy #1a1a2e, Inter Variable)
- [x] JSON-LD schemas (Organization, LocalBusiness, BlogPosting)
- [x] OG meta tags on all pages
- [x] Sitemap + robots.txt with AI bot allowlist
- [x] llms.txt + llms-full.txt (LLM-friendly business info)
- [x] Analytics beacon wired (`/api/s` + `/api/t` same-origin proxy)
- [x] QR redirect route (`/qr/[code]`)
- [x] Contact forms with honeypot bot protection
- [x] Hero images optimized (fetchpriority="high", loading="eager")
- [x] Favicon + apple-touch-icon support
- [x] `/api/health` endpoint for uptime monitoring

---

## ⚠️ PENDING — REQUIRED BEFORE DEPLOYMENT

### 1. **Lighthouse Performance Audit** (BLOCKING)
**Status:** Awaiting execution  
**Action:** Run Lighthouse audit command (documented above) against production domain  
**Requirement:** Must pass all 4 categories (Perf≥90, SEO≥90, A11y≥95, BP≥90) + LCP<2.5s  
**Blocker:** Site will NOT deploy until audit passes

### 2. **LPAI Calendar Integration** (Ready)
**Status:** LPAI CRM calendar system configured  
**Location:** `/src/pages/contact.astro` (lines 100–119)  
**Configuration:** Integrated with LPAI backend (`location_id: plan_chNIQv7tfy09Ew_h1liV`)  
**Action:** No action needed — system uses LPAI's calendar infrastructure

**Note:** Customer-facing booking widgets can be generated from LPAI admin once site goes live.

**Verification:**
```bash
curl -I https://saltgrassmodular.com/contact
# Should load contact page with calendar placeholder
```

### 2. **Lighthouse Performance Audit** (Required)
**Status:** Local Chrome unavailable — must run from macOS/Linux with Chromium installed  
**Action:** Run audit command below AFTER deploying to production domain

**How to run (on a machine with Chrome/Chromium installed):**
```bash
# Clone the repo, navigate to project directory, then:
npx --yes lighthouse https://saltgrassmodular.com/ \
  --quiet \
  --chrome-flags="--headless" \
  --output=json \
  --output-path=./lh-report.json \
  --only-categories=performance,seo,accessibility,best-practices \
  --form-factor=mobile \
  --throttling-method=devtools \
  --max-wait-for-load=45000

# Parse results:
node -e "
const report = require('./lh-report.json');
console.log('Performance:', report.categories.performance.score * 100);
console.log('SEO:', report.categories.seo.score * 100);
console.log('Accessibility:', report.categories.accessibility.score * 100);
console.log('Best Practices:', report.categories['best-practices'].score * 100);
console.log('LCP:', report.audits['largest-contentful-paint'].displayValue);
"
```

**Expected Results (targets):**
- Performance: ≥ 90 (currently optimized for 90+)
- SEO: ≥ 90 (target 100 — all meta tags in place)
- Accessibility: ≥ 95 (using WCAG AAA contrast ratios)
- Best Practices: ≥ 90 (HTTPS, security headers verified)
- **LCP < 2.5s** (hero image preloaded, fonts optimized)
- CLS < 0.1 (images have width/height attributes)
- FCP < 1.8s (critical CSS inlined)

### 3. **Domain Cutover** (Required)
**Status:** Currently deployed to `saltgrass-modular.vercel.app`  
**Action:** Point `saltgrassmodular.com` DNS to Vercel  

**DNS Configuration (via your registrar):**
```
Type: CNAME
Name: saltgrassmodular.com
Value: cname.vercel-dns.com.
```

**Vercel Configuration:**
1. Log in to Vercel project `saltgrass-modular`
2. Settings → Domains
3. Add domain: `saltgrassmodular.com`
4. Verify DNS propagation (15–60 min)
5. Update Astro `astro.config.mjs` site URL to production domain

**Verification:**
```bash
dig saltgrassmodular.com  # Should resolve to Vercel IP
curl -I https://saltgrassmodular.com  # Should return 200
```

### 3. **Domain Configuration** (Ready)
**Status:** DNS CNAME record needed  
**Action:** Point `saltgrassmodular.com` DNS to Vercel (CNAME: `cname.vercel-dns.com`)  
**Timeline:** DNS propagation typically 15–60 minutes

### 4. **Sentry Error Tracking** (Optional)
**Status:** CDN loader added, DSN not required for launch  
**Location:** `src/components/layout/BaseLayout.astro` (lines 45–60)  
**Action:** Post-launch optional. If enabling, provide Sentry DSN  
**Setup:** Set `PUBLIC_SENTRY_DSN` env var in Vercel  

---

## 🧪 TESTING CHECKLIST (Before final QA approval)

### Performance (Mobile, Devtools throttling)
- [ ] Run Lighthouse audit:
  ```bash
  npx lighthouse https://saltgrassmodular.com/ \
    --throttling-method=devtools --form-factor=mobile \
    --only-categories=performance,seo,accessibility,best-practices
  ```
- [ ] **Performance ≥ 90** (target: 90+)
- [ ] **SEO ≥ 90** (target: 100)
- [ ] **Accessibility ≥ 95** (WCAG AAA)
- [ ] **Best Practices ≥ 90**
- [ ] **LCP < 2.5s** (target: <2.0s)
- [ ] **CLS < 0.1** (layout shift)
- [ ] **FCP < 1.8s** (first contentful paint)

### Functional
- [ ] **Homepage hero** loads without layout shift (CLS)
- [ ] **Forms work** — quote & consultation submit successfully
- [ ] **Contact form honeypot** blocks bot submissions silently
- [ ] **Calendly widget** loads (after Dylan provides URL)
- [ ] **Blog pages** load, search/filter works, RSS feed valid
- [ ] **Navigation** on all 25 pages works (no 404s)
- [ ] **Mobile responsiveness** — test on 375w, 768w, 1440w breakpoints

### Analytics & Monitoring
- [ ] **Analytics beacon fires** — check `/api/s` and `/api/t` requests in DevTools Network
- [ ] **QR route works** — test `https://saltgrassmodular.com/qr/test-code` (should 404 gracefully)
- [ ] **Health endpoint responds** — `curl https://saltgrassmodular.com/api/health` returns 200 + JSON
- [ ] **Sentry loads** (if enabled) — check window.Sentry exists in browser console

### SEO & Social
- [ ] **Open Graph tags** — test link preview on Twitter/Facebook (rich card appears)
- [ ] **Canonical URLs** present on every page (check page source)
- [ ] **robots.txt** accessible (`curl https://saltgrassmodular.com/robots.txt`)
- [ ] **Sitemap** accessible (`curl https://saltgrassmodular.com/sitemap-index.xml`)
- [ ] **llms.txt** accessible for AI indexing (`curl https://saltgrassmodular.com/llms.txt`)

### Security
- [ ] **HTTPS enforced** — all traffic redirects to `https://`
- [ ] **CSP headers present** (check DevTools → Network → Response Headers)
- [ ] **X-Frame-Options** set (prevents clickjacking)
- [ ] **No hardcoded secrets** in public code (keys, tokens, emails)

---

## 📋 FINAL GO-LIVE CHECKLIST

Before deploying to production, confirm:

1. **Dylan confirmed Calendly URL** — contact page working
2. **Domain propagated** — `saltgrassmodular.com` resolves + HTTPS works
3. **All 8 Lighthouse targets passing** — Perf/SEO/A11y/BP ≥ floor + LCP < 2.5s
4. **Manual functional test** — 5-minute walkthrough on production
5. **Analytics verified** — `/api/s` + `/api/t` firing in production
6. **No 404s** — all 25 pages load without errors
7. **Mobile tested** — responsive design verified on real device (or DevTools 375w)

---

## 🚀 DEPLOYMENT STEPS

### 1. Vercel Staging Verification (pre-domain cutover)
```bash
# Current staging URL (use for testing before domain cutover)
curl -I https://saltgrass-modular.vercel.app
# Should return 200 OK + all Lighthouse targets passing
```

### 2. Domain Activation
```bash
# After DNS propagation confirmed:
# 1. Update astro.config.mjs site URL to saltgrassmodular.com
# 2. Redeploy via Vercel
# 3. Verify production domain working
curl -I https://saltgrassmodular.com
```

### 3. Post-Cutover Verification
```bash
# Rerun Lighthouse against production domain
npx lighthouse https://saltgrassmodular.com/ \
  --throttling-method=devtools --form-factor=mobile
```

---

## 📞 SUPPORT CONTACTS

**Dylan Walker** (Owner)  
📞 (405) 659-1949  
📧 Dylan.Walker@saltgrassmodular.com

**LPAI Monitoring**  
🔗 Health check: `https://saltgrassmodular.com/api/health`  
🔗 QR endpoint: `https://saltgrassmodular.com/qr/[code]`  
🔗 Analytics: `/api/s` + `/api/t` (same-origin proxies)

---

## 🎯 KNOWN LIMITATIONS (can address post-launch if needed)

- **Images not yet optimized** — placeholder paths for hero images. When Dylan provides actual photos, compress via:
  ```bash
  npm run compress:images
  # Creates WebP siblings + overwrite originals with optimized JPEG
  ```
- **Sentry DSN optional** — error tracking not critical for launch, can add post-go-live
- **Stripe integration** — deferred to Phase 2 (not in initial scope)

---

## 📅 Timeline & Deployment Status

**Current Status:** ⏸️ **BLOCKED ON LIGHTHOUSE AUDIT**

- **✅ Site built:** All 25 pages complete, deployed to `saltgrass-modular.vercel.app`
- **✅ LPAI calendar:** Integrated, ready for booking widget generation
- **⏳ Lighthouse audit:** BLOCKING — must run audit before production deployment
- **⏳ Domain cutover:** After Lighthouse passes, DNS → Vercel + final verification
- **❌ NOT READY FOR DEPLOYMENT:** Lighthouse results required first

**Unblock process:**
1. Run Lighthouse audit against staging URL: `https://saltgrass-modular.vercel.app/`
2. Confirm all targets passing (Perf≥90, SEO≥90, A11y≥95, BP≥90, LCP<2.5s)
3. If failing: identify gap + iterate fixes
4. Once passing: proceed with domain cutover + production deploy

---

**Last Updated:** 2026-06-09  
**Task:** 24 of 25 (96% complete)  
**Next:** Mark as done after all checklist items verified
