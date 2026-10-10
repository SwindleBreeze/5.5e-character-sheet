// Tool picks on real data: a pick of musical instruments lists the instruments, not the
// "Musical Instrument" groups (2024 and Faerûn), and marks the ones the character already has
// from elsewhere (a Bard who is also an Entertainer with Musician). Opt-in:
//   FIVETOOLS_DATA=./5etools-src-2.36.1 npm run test:smoke
// Checks names and keys only; it never prints or stores content.

import { beforeAll, describe, expect, it } from 'vitest';
import { importFivetools } from '../../src/adapters/fivetools/index.ts';
import { createCatalog, type Catalog } from '../../src/engine/build/catalog.ts';
import { quickBuild } from '../../src/engine/build/quickBuild.ts';
import { offerOptions } from '../../src/engine/choices/options.ts';
import { createContentIndex, type ContentIndex } from '../../src/engine/content/contentIndex.ts';
import { derive } from '../../src/engine/derive/derive.ts';
import { featureEffects } from '../../src/engine/featureEffects/index.ts';
import type { ContentEntity } from '../../src/schema/index.ts';
import { nodeFileSource } from './nodeFileSource.ts';

const root = process.env.FIVETOOLS_DATA;

describe.skipIf(!root)('tool picks (local data)', () => {
  let index: ContentIndex;
  let catalog: Catalog;
  const registry = featureEffects();

  beforeAll(async () => {
    const result = await importFivetools(nodeFileSource(root!), { now: 1 });
    const all = Object.values(result.entities).flat() as ContentEntity[];
    index = createContentIndex(all);
    const books = result.sources.filter((s) => s.origin !== 'homebrew').map((s) => s.code);
    catalog = createCatalog(all, new Set(books));
  });

  it('an instrument pick lists instruments, and marks the ones already known', () => {
    const c = quickBuild(
      {
        name: 'P',
        classes: [{ classId: 'bard|xphb', levels: 1 }],
        backgroundId: 'entertainer|xphb',
        speciesId: 'human|xphb',
      },
      { index, catalog, registry, now: 1 },
    );
    const sheet = derive(c, index, { registry });
    const picks = sheet.features
      .flatMap((f) => f.choices)
      .filter(
        (x) =>
          x.offer.effect?.type === 'proficiencyChoice' && x.offer.effect.filter === 'instrument',
      );
    // The Bard's three, the Entertainer's one and Musician's three.
    expect(picks.length).toBe(3);
    for (const pick of picks) {
      const { options } = offerOptions(pick.offer, { character: c, sheet, catalog, index });
      const names = options.map((o) => o.label);
      expect(names).not.toContain('Musical Instrument');
      expect(names).toContain('Lute');
      // What the other picks chose is marked as already known.
      const others = picks.filter((p) => p !== pick).flatMap((p) => p.values);
      for (const o of options.filter((x) => others.includes(x.value)))
        expect(o.taken, o.value).toBe(true);
    }
  });
});
