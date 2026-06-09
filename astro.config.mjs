import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

export default defineConfig({
  // NOTE: hyphenated host — the live Vercel project is salt-grass-modular
  // (with hyphens). At domain cutover this becomes https://saltgrassmodular.com.
  site: 'https://salt-grass-modular.vercel.app',
  // Static-first: content pages prerender to the edge (fast, cached).
  // The Vercel adapter enables on-demand serverless rendering ONLY for routes
  // that opt out via `export const prerender = false` — i.e. the /api/* proxy
  // routes and /qr/[code] redirect, which must run at request time.
  output: 'static',
  adapter: vercel(),
  integrations: [
    tailwind(),
    sitemap({
      filter: (page) => !page.includes('/admin') && !page.includes('/account') && !page.includes('/api'),
    }),
  ],
  compressHTML: true,
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
  build: { inlineStylesheets: 'auto' },
});
