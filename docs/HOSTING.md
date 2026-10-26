# Hosting the app on your own domain

The app is a static site: `npm run build` writes it to `dist/`, and any static host can serve
it. It uses hash routes (`/#/c/…`), so the host needs no rewrite rules.

## 1. Settings

Set these in the build environment (or a `.env` file, never committed); `.env.example` lists them.

| Variable              | Example               | What it does                                                                 |
| --------------------- | --------------------- | ---------------------------------------------------------------------------- |
| `VITE_APP_NAME`       | `Hero Ledger`         | The app's name: title, home screen, About. No "D&D" or "Dungeons & Dragons". |
| `VITE_APP_SHORT_NAME` | `Ledger`              | The name under the home screen icon.                                         |
| `VITE_BASE`           | `/`                   | The path the site lives at: `/` at a domain's root, `/sheet/` under a path.  |
| `VITE_CONTACT`        | `sheet@example.com`   | Shown in About for questions and takedown requests.                          |
| `VITE_DONATE_URL`     | `https://ko-fi.com/…` | Optional "support the project" link in About.                                |

## 2. Build and check

```sh
npm ci
npm run content-guard
npm test
npm run build
npm run content-guard:dist   # nothing but the app (and the SRD pack) in dist/
```

## 3. Upload

Upload the contents of `dist/` to the host. The service worker caches the app for offline use and
offers updates when a new build is uploaded (the user taps "Update").

- **Cache headers.** Serve `index.html`, `sw.js` and `manifest.webmanifest` with `Cache-Control:
no-cache`, so updates are seen. Files under `assets/` have hashed names and can be cached for a
  year.
- **HTTPS is required** for the service worker and for installing the app.
- **Any static host works:** Cloudflare Pages, Netlify, GitHub Pages, or a plain web server.

## 4. From the dev repo to the release repo

Copy the working tree into the new repository without the old history (for example
`git archive HEAD | tar -x -C ../release`), then make a first commit there. History that never
leaves cannot carry content. Run `npm run content-guard` in the new repo before the first push.
