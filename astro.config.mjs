// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  site: 'https://news.n0ai.cloud',
  output: 'static',
  adapter: cloudflare({
    imageService: 'compile',
    platformProxy: { enabled: true }
  }),
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [
    // sitemap disabled temp - will use manual /sitemap.xml
  ],
  image: {
    domains: ['images.unsplash.com', 'cdn.n0ai.cloud'],
    service: { entrypoint: 'astro/assets/services/sharp' }
  },
  prefetch: { prefetchAll: true, defaultStrategy: 'viewport' },
  experimental: { clientPrerender: true },
});
