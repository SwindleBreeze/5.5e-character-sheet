# Contributing

## The one rule: no game content in the repo

The repo holds code only. Content is imported on each device and stored in that browser. Never
commit data folders, `*.pack.json` files or archives. `npm run content-guard` (also run in CI)
enforces this, and `npm run content-guard:dist` checks the built site the same way.

Test fixtures under `tests/fixtures/` must be small, hand-written, invented examples, and every
JSON fixture must include `"_fixture": true`.

## Build and test

Requires Node 24.

```sh
npm install
npm run dev          # http://localhost:5173/
npm test             # unit and component tests
npm run typecheck
npm run lint
npm run format:check
npm run build        # production build with service worker, in dist/
```

Release settings (name, base path, contact, donation link) are build-time variables: see
`.env.example`. The developer screens (`/dev/build`, `/dev/coverage`, `/dev/design`) are in
development builds only, or with `VITE_DEV_TOOLS=1`.

## Checks against real data

The rules engine is checked against a local data folder in the 5etools JSON format, kept outside
the repo and never committed:

```sh
FIVETOOLS_DATA=/path/to/data-folder npm run test:smoke
```

These tests read names, keys and numbers only; they never print or store content.

## Packs

A pack is everything imported on one device, exported from Library → Import → Export pack and
imported on another. Packs work across app versions: the app imports the kinds of content it
knows and skips the rest. If content was imported by an older version, the app says what
importing again would add.
