import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://okurinochizu.jp',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  server: { port: 4321 },
  devToolbar: { enabled: false },
  vite: { build: { sourcemap: false } },
});
