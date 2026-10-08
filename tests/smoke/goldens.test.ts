// Golden checks for every subclass (plan §10.2, step 6.17) on real data: the 2024 Player's
// Handbook's 48 and the 2024 supplements' 28, Artificer included, each built at levels 1, 3, 5,
// 11 and 20. A build has no pick left and no rules issue, and its fingerprint (AC, hit points,
// attacks, save DC, saves, slots, counters, resistances, switches) matches the reviewed one.
// Opt-in:
//   FIVETOOLS_DATA=./5etools-src-2.36.1 npm run test:smoke
// Checks numbers only; it never prints or stores content.

import { beforeAll, describe, expect, it } from 'vitest';
import { importFivetools } from '../../src/adapters/fivetools/index.ts';
import { createCatalog } from '../../src/engine/build/catalog.ts';
import { quickBuild } from '../../src/engine/build/quickBuild.ts';
import { createContentIndex, type ContentIndex } from '../../src/engine/content/contentIndex.ts';
import { derive } from '../../src/engine/derive/derive.ts';
import { featureEffects } from '../../src/engine/featureEffects/index.ts';
import type { ContentEntity, Subclass } from '../../src/schema/index.ts';
import { fingerprint, goldenSources } from './fingerprint.ts';
import { GOLDENS } from './goldens.ts';
import { nodeFileSource } from './nodeFileSource.ts';

const root = process.env.FIVETOOLS_DATA;
const LEVELS = [1, 3, 5, 11, 20];

describe.skipIf(!root)('golden checks: every subclass at levels 1, 3, 5, 11 and 20', () => {
  let index: ContentIndex;
  let all: ContentEntity[];

  beforeAll(async () => {
    const result = await importFivetools(nodeFileSource(root!), { now: 1 });
    all = Object.values(result.entities).flat() as ContentEntity[];
    index = createContentIndex(all);
  });

  it('covers every 2024 subclass of the mapped books', () => {
    const books = new Set(['XPHB', 'EFA', 'FRHoF', 'RHW', 'AU']);
    const subclasses = all
      .filter((e): e is Subclass => e.kind === 'subclass' && books.has(e.source))
      .map((s) => s.id)
      .sort();
    expect(subclasses).toEqual(Object.keys(GOLDENS).sort());
    expect(subclasses).toHaveLength(76);
  });

  it.each(Object.keys(GOLDENS))('%s', (id) => {
    const sub = index.get({ kind: 'subclass', id }) as Subclass;
    const catalog = createCatalog(all, new Set(goldenSources(sub, index)));
    const registry = featureEffects();
    for (const levels of LEVELS) {
      const c = quickBuild(
        {
          name: 'Golden',
          speciesId: 'human|xphb',
          backgroundId: 'soldier|xphb',
          classes: [{ classId: sub.classId, levels, subclassId: id }],
        },
        { index, catalog, registry, now: 1 },
      );
      const s = derive(c, index, { registry });
      expect(s.choices.pending, `level ${levels}`).toEqual([]);
      expect(s.issues, `level ${levels}`).toEqual([]);
      expect(fingerprint(s), `level ${levels}`).toBe(GOLDENS[id]![levels]);
    }
  });
});
