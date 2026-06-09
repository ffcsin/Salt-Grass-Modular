# Salt Grass Modular

Custom modular construction company website. Built with Astro 5, Tailwind CSS, and LPAI CRM integration.

**Live Site:** https://saltgrassmodular.com  
**Staging:** https://saltgrass-modular.vercel.app

## Quick Start

```bash
npm install
npm run dev     # Local dev server on http://localhost:3000
npm run build   # Production build
npm run preview # Preview production build locally
```

## Features

- **25 Static Pages** — Homepage, services, audience landing pages, blog, guides
- **Blog System** — 3 seed articles with RSS feed, categories, related posts
- **LPAI Integration** — Calendar system, forms, analytics tracking
- **Performance Optimized** — Lighthouse targets: Perf≥90, SEO≥90, A11y≥95, BP≥90, LCP<2.5s
- **SEO Ready** — JSON-LD schemas, OG tags, canonical URLs, robots.txt, llms.txt
- **Mobile First** — Responsive design, tested at 375w/768w/1440w
- **Monitoring** — Health checks, analytics beacon, QR redirects

## Project Structure

```
src/
├── components/      # Reusable Astro components
│   ├── layout/      # BaseLayout, Header, Footer
│   ├── sections/    # Hero, CTA, Cards, etc
│   └── forms/       # Contact, Quote, Consultation forms
├── pages/           # Static pages + dynamic routes
│   ├── api/         # API endpoints (/api/s, /api/t, /api/health, /qr/[code])
│   ├── blog/        # Blog listing, detail, RSS
│   └── services/    # Service pages
├── lib/             # Utilities (blog.ts with API client)
└── styles/          # Global CSS + Tailwind config
public/
├── img/             # Images (hero, OG cards)
├── fonts/           # Self-hosted Inter Variable
├── robots.txt       # SEO robots file
├── llms.txt         # LLM-friendly business info
└── favicon.svg      # Brand icon
```

## Environment Variables

```
PUBLIC_API_URL=https://lpai-monorepo-production.up.railway.app
PUBLIC_LOCATION_ID=plan_chNIQv7tfy09Ew_h1liV
PUBLIC_SENTRY_DSN=  # Optional: error tracking
```

## Build & Deploy

**Vercel Deployment:**
1. Create new Vercel project
2. Link this repository
3. Framework: Astro
4. Build command: `npm run build`
5. Deploy!

**Custom Domain:**
- Point DNS CNAME to Vercel
- Update `site` in `astro.config.mjs`

## Pre-Launch Checklist

See [`PRE_LAUNCH_CHECKLIST.md`](./PRE_LAUNCH_CHECKLIST.md) for:
- Performance audit steps
- Domain configuration
- QA testing procedures
- Go-live checklist

## Contact

**Dylan Walker** (Owner)  
📞 (405) 659-1949  
📧 Dylan.Walker@saltgrassmodular.com

## License

Proprietary — Saltgrass Modular, 2026
