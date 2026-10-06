// Golden derived sheets (plan §9.2, step 3.12): four fixture characters built by the
// quick-builder, derived, and written out as text with every value's parts. A change to the
// engine that moves a number shows up here as a readable diff; review it, then update with
// `npx vitest run -u src/engine/__tests__/golden`.
//
// Also a performance guard: deriving a level 20 character must stay well inside a phone's
// frame budget.

import { beforeAll, describe, expect, it } from 'vitest';
import type { Character, ContentEntity } from '../../../schema/index.ts';
import { FIXTURE_FEATURE_EFFECTS } from '../../../test/fixtureFeatureEffects.ts';
import { fixtureContent } from '../../../test/fixtureIndex.ts';
import { createCatalog, type Catalog } from '../../build/catalog.ts';
import { quickBuild, type QuickBuildSpec } from '../../build/quickBuild.ts';
import type { ContentIndex } from '../../content/contentIndex.ts';
import { derive } from '../../derive/derive.ts';
import { formatSheet } from './formatSheet.ts';

let index: ContentIndex;
let catalog: Catalog;

beforeAll(async () => {
  const content = await fixtureContent();
  index = content.index;
  catalog = createCatalog(
    Object.values(content.entities).flat() as ContentEntity[],
    new Set(['TST']),
  );
});

const origin = { speciesId: 'mossling|tst', backgroundId: 'arena hand|tst' };

function build(spec: Omit<QuickBuildSpec, 'speciesId' | 'backgroundId'>): Character {
  return quickBuild(
    { ...origin, ...spec },
    { index, catalog, registry: FIXTURE_FEATURE_EFFECTS, now: 0 },
  );
}

const sheetOf = (c: Character) => derive(c, index, { registry: FIXTURE_FEATURE_EFFECTS });

describe('golden derived sheets', () => {
  it('Brute 5 (martial), raging', async () => {
    const c = build({ name: 'Brute', classes: [{ classId: 'brute|tst', levels: 5 }] });
    c.state.activeToggles.fury = {};
    await expect(formatSheet(sheetOf(c))).toMatchFileSnapshot('./brute-5.txt');
  });

  it('Gladiator 6 with a subclass (half caster)', async () => {
    const c = build({
      name: 'Gladiator',
      classes: [{ classId: 'gladiator|tst', levels: 6, subclassId: 'net|gladiator|tst|tst' }],
    });
    await expect(formatSheet(sheetOf(c))).toMatchFileSnapshot('./gladiator-6.txt');
  });

  it('Lorekeeper 5 / Pactbinder 2 (full caster and pact magic)', async () => {
    const c = build({
      name: 'Duo',
      classes: [
        { classId: 'lorekeeper|tst', levels: 5 },
        { classId: 'pactbinder|tst', levels: 2 },
      ],
    });
    await expect(formatSheet(sheetOf(c))).toMatchFileSnapshot('./lorekeeper-5-pactbinder-2.txt');
  });

  it('Wanderer 7 (unarmored)', async () => {
    const c = build({ name: 'Wanderer', classes: [{ classId: 'wanderer|tst', levels: 7 }] });
    // Unarmored: whatever armor the starting equipment put on comes off.
    c.inventory = c.inventory.map(({ equipped, ...row }) =>
      equipped === 'armor' || equipped === 'shield' ? row : { ...row, equipped },
    );
    await expect(formatSheet(sheetOf(c))).toMatchFileSnapshot('./wanderer-7.txt');
  });
});

describe('performance', () => {
  it('derives a level 20 character in under 5 ms', () => {
    const characters = [
      build({ name: 'Brute', classes: [{ classId: 'brute|tst', levels: 20 }] }),
      build({
        name: 'Multi',
        classes: [
          { classId: 'lorekeeper|tst', levels: 10 },
          { classId: 'pactbinder|tst', levels: 5 },
          { classId: 'wanderer|tst', levels: 5 },
        ],
      }),
    ];
    for (const c of characters) {
      for (let i = 0; i < 20; i++) sheetOf(c); // warm up the JIT and formula cache
      const times: number[] = [];
      for (let i = 0; i < 50; i++) {
        const start = performance.now();
        sheetOf(c);
        times.push(performance.now() - start);
      }
      times.sort((a, b) => a - b);
      const median = times[Math.floor(times.length / 2)]!;
      expect(median, c.name).toBeLessThan(5);
    }
  });
});
