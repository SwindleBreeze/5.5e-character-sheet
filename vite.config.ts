/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

// Release settings (plan 9.0), from the environment or a `.env` file; see `.env.example`.
// `VITE_BASE` is the path the site is served from: `/` on its own domain, `/<repo>/` on GitHub
// Pages. `VITE_APP_NAME` names the app in the title, the home screen and the About page.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const base = env.VITE_BASE || '/';
  const name = env.VITE_APP_NAME || '5.5e Character Sheet';
  const shortName = env.VITE_APP_SHORT_NAME || 'Char Sheet';
  return {
    base,
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __APP_NAME__: JSON.stringify(name),
    },
    plugins: [
      react(),
      {
        name: 'app-name',
        transformIndexHtml: (html: string) =>
          html.replaceAll('%APP_NAME%', name).replaceAll('%APP_SHORT_NAME%', shortName),
      },
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        pwaAssets: { disabled: false, config: true, injectThemeColor: false },
        manifest: {
          name,
          short_name: shortName,
          description: 'Offline character builder and sheet for the fifth edition rules (2024).',
          // The dark palette's background (tokens.css): the splash screen and the bar until the
          // page sets its own.
          theme_color: '#16120e',
          background_color: '#16120e',
          display: 'standalone',
          orientation: 'any',
          start_url: base,
          scope: base,
        },
        workbox: {
          // The free rules pack too, so they load and come back offline (plan 9.3).
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}', 'srd/*.pack.json.gz'],
          navigateFallback: `${base}index.html`,
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
  };
});
