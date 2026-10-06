# 5.5e Character Sheet

An offline-first character builder and sheet for D&D 2024 rules, built as a PWA for a private group.

**This repository contains no game content.** Content is imported on each device from data you
provide, and is stored only in that browser. Never commit data folders, `*.pack.json` files or
archives; `npm run content-guard` (also run in CI) enforces this.

## Development

Requires Node 24.

```sh
npm install
npm run dev          # http://localhost:5173/5.5e-character-sheet/
npm test             # unit and component tests
npm run typecheck
npm run lint
npm run build        # production build with service worker, output in dist/
```

Optional checks against a local 5etools data folder (never committed):

```sh
FIVETOOLS_DATA=./5etools-src-2.36.1/5etools-src-2.36.1/data npm run test:smoke
```

Test fixtures under `tests/fixtures/` must be small, hand-written, invented examples, and every
JSON fixture must include `"_fixture": true`.

## Deployment

Pushes to `main` run CI and deploy `dist/` to GitHub Pages (`/5.5e-character-sheet/`). In the
repository settings, set **Pages → Source** to **GitHub Actions**.
