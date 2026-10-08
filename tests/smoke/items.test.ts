// The 2024 Dungeon Master's Guide magic items on real data (plan §10.3, step 7.12): every one has
// a mapping (text for consumables and what is decided at the table), the mappings are valid,
// and none of them needs a primitive the engine lacks without saying so. Opt-in:
//   FIVETOOLS_DATA=./5etools-src-2.36.1 npm run test:smoke
// Checks counts and invariants only; it never prints or stores content.

import { beforeAll, describe, expect, it } from 'vitest';
import { importFivetools } from '../../src/adapters/fivetools/index.ts';
import { featureEffects } from '../../src/engine/featureEffects/index.ts';
import { refKey, type ContentEntity, type Item } from '../../src/schema/index.ts';
import { nodeFileSource } from './nodeFileSource.ts';

const root = process.env.FIVETOOLS_DATA;

describe.skipIf(!root)('magic items (local data)', () => {
  let items: Item[];

  beforeAll(async () => {
    const result = await importFivetools(nodeFileSource(root!), { now: 1 });
    items = (Object.values(result.entities).flat() as ContentEntity[]).filter(
      (e): e is Item => e.kind === 'item' && e.source === 'XDMG' && !!e.rarity,
    );
  });

  it('every 2024 DMG magic item has a mapping', () => {
    const registry = featureEffects();
    expect(items.length).toBeGreaterThan(500);
    const unmapped = items
      .filter((i) => !registry[refKey({ kind: 'item', id: i.id })])
      .map((i) => i.id);
    expect(unmapped).toEqual([]);
  });

  it('item spells come with how they are paid for', () => {
    const wand = items.find((i) => i.id === 'wand of fireballs|xdmg')!;
    expect(wand.effects).toContainEqual({
      type: 'grantSpells',
      spells: [{ mode: 'innate', spell: { id: 'fireball|xphb' }, uses: { charges: 1 } }],
    });
  });
});
