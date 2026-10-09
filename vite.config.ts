/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the app from /<repo-name>/.
const BASE = '/5.5e-character-sheet/';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig({
  base: BASE,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      pwaAssets: { disabled: false, config: true, injectThemeColor: false },
      manifest: {
        name: '5.5e Character Sheet',
        short_name: 'Char Sheet',
        description: 'Offline character builder and sheet for D&D 2024 rules.',
        // The dark palette's background (tokens.css): the splash screen and the bar until the
        // page sets its own.
        theme_color: '#16120e',
        background_color: '#16120e',
        display: 'standalone',
        orientation: 'any',
        start_url: BASE,
        scope: BASE,
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: `${BASE}index.html`,
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
    // The theme tokens are read as text by the contrast test; other CSS stays empty in tests.
    css: { include: [/theme\/tokens\.css/], modules: { classNameStrategy: 'non-scoped' } },
    restoreMocks: true,
    // UI tests that import content take a few seconds, and up to ~15 s on a loaded machine when
    // every file runs in parallel (plan 7.9 looks at making them faster).
    testTimeout: 30_000,
  },
});
