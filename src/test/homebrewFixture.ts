// The hand-written homebrew files (tests/fixtures/fivetools/homebrew), as the importer reads
// them. Their `_copy`, subrace and class list point at the official fixture (TST).

import type { HomebrewFile } from '../adapters/fivetools/homebrew.ts';
import { importHomebrew } from '../adapters/fivetools/homebrew.ts';
import { repos } from '../db/repos.ts';
import { createContentIndex, type ContentIndex } from '../engine/content/contentIndex.ts';
import { refKey, type ContentEntity } from '../schema/index.ts';
import { fixtureContent } from './fixtureIndex.ts';

const files = import.meta.glob('../../tests/fixtures/fivetools/homebrew/*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** `hearth-guide.json` and `brute-paths.json`, or the ones named. */
export function homebrewFiles(...names: string[]): HomebrewFile[] {
  return Object.entries(files)
    .map(([path, text]) => ({ name: path.slice(path.lastIndexOf('/') + 1), text }))
    .filter((f) => !names.length || names.includes(f.name));
}

/** The files as `File`s, the way the import screen picks them. */
export function homebrewUploads(...names: string[]): File[] {
  return homebrewFiles(...names).map(
    (f) => new File([f.text], f.name, { type: 'application/json' }),
  );
}

/**
 * Import the homebrew into the app database on top of the official fixture (seed that first)
 * and switch its sources on with `enabled`.
 */
export async function seedHomebrew(enabled: string[]) {
  const { content, settings } = repos();
  const result = await importHomebrew(homebrewFiles(), {
    now: 2,
    lookup: (refs) => content.getMany(refs),
    existing: await content.listSources(),
  });
  await content.replaceSources(result.sources, result.entities);
  await settings.set('enabledSources', enabled);
  return result;
}

/** The official fixture and the homebrew on top of it, in one index (no database). */
export async function homebrewContent(): Promise<{ index: ContentIndex; all: ContentEntity[] }> {
  const { entities } = await fixtureContent();
  const official = Object.values(entities).flat() as ContentEntity[];
  const byKey = new Map(official.map((e) => [refKey({ kind: e.kind, id: e.id }), e]));
  const brew = await importHomebrew(homebrewFiles(), {
    now: 2,
    lookup: async (refs) =>
      new Map(
        refs.flatMap((r) => {
          const e = byKey.get(refKey(r));
          return e ? [[refKey(r), e] as const] : [];
        }),
      ),
    existing: [...new Set(official.map((e) => e.source))].map((code) => ({
      code,
      name: code,
      edition: 'unknown',
      counts: {},
      importedAt: 1,
      adapterVersion: 1,
      origin: '5etools',
    })),
  });
  const all = [...official, ...(Object.values(brew.entities).flat() as ContentEntity[])];
  return { index: createContentIndex(all), all };
}
