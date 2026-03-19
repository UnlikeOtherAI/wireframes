import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://wireframes.dev',
  integrations: [sitemap()],
  build: {
    format: 'file',
  },
});
