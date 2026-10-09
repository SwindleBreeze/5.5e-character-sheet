// Golden checks for the Artificer (EFA) class features on real data (plan §10.2, step 6.16):
// quick builds at a few levels, their counters, actions and spell slots read the way the 2024
// rules give them. Opt-in:
//   FIVETOOLS_DATA=./5etools-src npx vitest run --config vitest.smoke.config.ts tests/smoke/supArtificer.test.ts
// Checks numbers only; it never prints or stores content.

import { beforeAll, describe, expect, it } from 'vitest';
import { importFivetools } from '../../src/adapters/fivetools/index.ts';
import { createCatalog, type Catalog } from '../../src/engine/build/catalog.ts';
import { quickBuild } from '../../src/engine/build/quickBuild.ts';
import { createContentIndex, type ContentIndex } from '../../src/engine/content/contentIndex.ts';
import { derive } from '../../src/engine/derive/derive.ts';
import type { DerivedSheet } from '../../src/engine/derive/types.ts';
import { featureEffects } from '../../src/engine/featureEffects/index.ts';
import type { Character, ContentEntity } from '../../src/schema/index.ts';
import { nodeFileSource } from './nodeFileSource.ts';

const root = process.env.FIVETOOLS_DATA;

describe.skipIf(!root)('Artificer class features (local data)', () => {
  let index: ContentIndex;
  let catalog: Catalog;

  beforeAll(async () => {
    const result = await importFivetools(nodeFileSource(root!), { now: 1 });
    const all = Object.values(result.entities).flat() as ContentEntity[];
    index = createContentIndex(all);
    catalog = createCatalog(all, new Set(['XPHB', 'EFA', 'FRHoF', 'RHW', 'AU', 'ABH', 'LFL']));
  });

  /** A human soldier Artificer, quick-built. */
  function build(levels: number, change?: (c: Character) => void): DerivedSheet {
    const registry = featureEffects();
    const c = quickBuild(
      {
        name: 'Golden',
        speciesId: 'human|xphb',
        backgroundId: 'soldier|xphb',
        classes: [{ classId: 'artificer|efa', levels }],
      },
      { index, catalog, registry, now: 1 },
    );
    change?.(c);
    const s = derive(c, index, { registry });
    expect(s.choices.pending).toEqual([]);
    return s;
  }
  const resource = (s: DerivedSheet, name: string) => s.resources.find((r) => r.name === name);
  const actionOf = (s: DerivedSheet, name: string) => s.actions.find((a) => a.name === name);
  const slots = (s: DerivedSheet) => s.spellcasting.slots.map((x) => x.max);
  const intMod = (s: DerivedSheet) => s.abilities.int.mod;

  it("level 1: Tinker's Magic, Mending, spell slots", () => {
    const one = build(1);
    expect(resource(one, "Tinker's Magic")).toMatchObject({ recharge: 'long' });
    expect(resource(one, "Tinker's Magic")?.max.value).toBe(Math.max(1, intMod(one)));
    expect(actionOf(one, "Tinker's Magic")?.actionType).toBe('action');
    const caster = one.spellcasting.casters.find((c) => c.key === 'artificer|efa')!;
    expect(caster.ability).toBe('int');
    // Mending comes on top of the two cantrips the class picks.
    expect(caster.cantrips).toContain('mending|xphb');
    expect(caster.cantripsMax).toBe(3);
    expect(caster.cantrips).toHaveLength(3);
    expect(slots(one)).toEqual([2]);
    expect(resource(one, 'Flash of Genius')).toBeUndefined();
  });

  it('level 5 and 7: slots, Magic Item Tinker, Flash of Genius', () => {
    const five = build(5);
    expect(slots(five)).toEqual([4, 2]);
    expect(resource(five, 'Drain Magic Item')).toBeUndefined();

    const seven = build(7);
    expect(resource(seven, 'Drain Magic Item')).toMatchObject({ recharge: 'long' });
    expect(resource(seven, 'Drain Magic Item')?.max.value).toBe(1);
    expect(resource(seven, 'Transmute Magic Item')?.max.value).toBe(1);
    expect(actionOf(seven, 'Charge Magic Item')?.actionType).toBe('bonus');
    expect(resource(seven, 'Flash of Genius')).toMatchObject({ recharge: 'long' });
    expect(resource(seven, 'Flash of Genius')?.max.value).toBe(Math.max(1, intMod(seven)));
    expect(actionOf(seven, 'Flash of Genius')?.actionType).toBe('reaction');
  });

  it('level 11: Spell-Storing Item', () => {
    const eleven = build(11);
    expect(slots(eleven)).toEqual([4, 3, 3]);
    expect(resource(eleven, 'Spell-Storing Item')).toMatchObject({ recharge: 'long' });
    expect(resource(eleven, 'Spell-Storing Item')?.max.value).toBe(Math.max(2, 2 * intMod(eleven)));
  });

  it('levels 14 and 20: Flash of Genius comes back on a Short Rest', () => {
    const fourteen = build(14);
    expect(resource(fourteen, 'Flash of Genius')).toMatchObject({ recharge: 'shortOne' });

    // At 20, all of them, but only while attuned to a magic item.
    const twenty = build(20);
    expect(resource(twenty, 'Flash of Genius')).toMatchObject({ recharge: 'shortOne' });
    const attuned = build(20, (c) => {
      c.inventory.push({
        uid: 'ring',
        itemRef: { kind: 'item', id: 'ring of protection|xdmg' },
        name: 'Ring of Protection',
        quantity: 1,
        equipped: 'worn',
        attuned: true,
      });
    });
    expect(resource(attuned, 'Flash of Genius')).toMatchObject({ recharge: 'short' });
    expect(slots(twenty)).toEqual([4, 3, 3, 3, 2]);
    const caster = twenty.spellcasting.casters.find((c) => c.key === 'artificer|efa')!;
    expect(caster.preparedMax).toBe(15);
    // Four from the table, and Mending.
    expect(caster.cantripsMax).toBe(5);
  });
});
