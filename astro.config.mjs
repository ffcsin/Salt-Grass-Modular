import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://saltgrass-modular.vercel.app',
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
