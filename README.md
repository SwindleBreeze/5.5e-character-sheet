# 5.5e Character Sheet

An offline-first character builder and sheet for D&D 2024 rules, built as a PWA for a private group.

**This repository contains no game content.** Content is imported on each device from data you
provide, and is stored only in that browser. Never commit data folders, `*.pack.json` files or
archives; `npm run content-guard` (also run in CI) enforces this.

## Development

Requires Node 24. The project plan, with phase status and design decisions, is in
[docs/PLAN.md](docs/PLAN.md).

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
FIVETOOLS_DATA=./5etools-src-2.36.1 npm run test:smoke
```

## Content

Content is imported in the app under Library → Import:

- **Content pack** (`*.pack.json.gz`): the main way to get content onto phones. Make one on a
  desktop with Library → Import → Export pack after importing 5etools data, then share the file
  with your group. Packs hold game content: keep them private and out of the repo.
- **5etools data**: pick the 5etools folder, its `data` folder, or the release zip. Every source is
  imported; Settings → Sources chooses which ones the app offers (2014 sources stay locked until
  a later phase). Besides rules content, this includes deities, supernatural gifts (charms,
  blessings, boons), Bastion facilities and character creation options.

Packs work across app versions: the app imports the kinds of content it knows and skips the
rest. If the app on a phone is older than the pack, it says so (or, for versions before the
player extras, shows the new library tabs as empty); update the app and import the pack again.

Test fixtures under `tests/fixtures/` must be small, hand-written, invented examples, and every
JSON fixture must include `"_fixture": true`.

## Deployment

Pushes to `main` run CI and deploy `dist/` to GitHub Pages (`/5.5e-character-sheet/`). In the
repository settings, set **Pages → Source** to **GitHub Actions**.
