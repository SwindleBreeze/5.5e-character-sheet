// Golden checks for the 2024 Dungeon Master's Guide magic items I to Q (plan §10.3, step 7.12)
// on real data: a level 5 character with the item in use (equipped and attuned) reads the
// numbers the item's text gives. Opt-in:
//   FIVETOOLS_DATA=./5etools-src-2.36.1 npx vitest run --config vitest.smoke.config.ts tests/smoke/itemsItoQ.test.ts
// Checks numbers only; it never prints or stores content.

import { beforeAll, describe, expect, it } from 'vitest';
import { importFivetools } from '../../src/adapters/fivetools/index.ts';
import { createCatalog, type Catalog } from '../../src/engine/build/catalog.ts';
import { quickBuild } from '../../src/engine/build/quickBuild.ts';
import { createContentIndex, type ContentIndex } from '../../src/engine/content/contentIndex.ts';
import { derive } from '../../src/engine/derive/derive.ts';
import type { DerivedSheet } from '../../src/engine/derive/types.ts';
import { featureEffects } from '../../src/engine/featureEffects/index.ts';
import type { Character, ContentEntity, EquipSlot } from '../../src/schema/index.ts';
import { nodeFileSource } from './nodeFileSource.ts';

const root = process.env.FIVETOOLS_DATA;

describe.skipIf(!root)('magic items I to Q golden checks (local data)', () => {
  let index: ContentIndex;
  let catalog: Catalog;

  beforeAll(async () => {
    const result = await importFivetools(nodeFileSource(root!), { now: 1 });
    const all = Object.values(result.entities).flat() as ContentEntity[];
    index = createContentIndex(all);
    catalog = createCatalog(all, new Set(['XPHB', 'XDMG']));
  });

  interface Use {
    /** The item, or the base item when `variant` is given. */
    id: string;
    variant?: string;
    slot: EquipSlot;
  }

  /** A level 5 human sage of this class with the item in use (nothing else held or worn). */
  function build(use: Use | undefined, classId = 'wizard|xphb'): DerivedSheet {
    const registry = featureEffects();
    const c: Character = quickBuild(
      {
        name: 'Golden',
        speciesId: 'human|xphb',
        backgroundId: 'sage|xphb',
        classes: [{ classId, levels: 5 }],
      },
      { index, catalog, registry, now: 1 },
    );
    if (use) {
      for (const row of c.inventory) delete row.equipped;
      c.inventory.push({
        uid: 'golden-item',
        itemRef: { kind: 'item', id: use.id },
        ...(use.variant ? { variantRef: { kind: 'item' as const, id: use.variant } } : {}),
        name: use.variant ?? use.id,
        quantity: 1,
        attuned: true,
        equipped: use.slot,
      });
    }
    return derive(c, index, { registry });
  }
  const worn = (id: string) => build({ id: `${id}|xdmg`, slot: 'worn' });
  const held = (id: string, classId?: string) =>
    build({ id: `${id}|xdmg`, slot: 'mainHand' }, classId);
  const resource = (s: DerivedSheet, name: string) => s.resources.find((r) => r.name === name);
  const act = (s: DerivedSheet, name: string) => s.actions.find((a) => a.name === name);
  const attack = (s: DerivedSheet, uid = 'golden-item') =>
    s.attacks.find((a) => a.rowUid === uid && a.use.kind === 'attackAction');

  it('Ioun Stones: a score up by 2, Advantage on Initiative and Perception, absorption', () => {
    const base = build(undefined);
    const agility = worn('ioun stone, agility');
    expect(agility.abilities.dex.score.value).toBe(
      Math.min(20, base.abilities.dex.score.value + 2),
    );
    const awareness = worn('ioun stone, awareness');
    expect(awareness.initiative.mode).toBe('advantage');
    expect(awareness.skills.perception.mode).toBe('advantage');
    expect(base.initiative.mode).toBe('normal');
    const absorption = worn('ioun stone, absorption');
    expect(resource(absorption, 'Ioun Stone of Absorption (spell levels left)')?.max.value).toBe(
      20,
    );
    expect(act(absorption, 'Ioun Stone of Absorption')?.actionType).toBe('reaction');
  });

  it('weapons: riders on the item’s own attacks, Lightning Bolt, Sing and Swing', () => {
    const javelin = held('javelin of lightning');
    expect(resource(javelin, 'Lightning Bolt')).toMatchObject({ recharge: 'dawn' });
    expect(act(javelin, 'Lightning Bolt')).toMatchObject({ roll: '4d6' });

    const disruption = attack(held('mace of disruption'));
    expect(disruption?.riders).toContainEqual(
      expect.objectContaining({ dice: '2d6', damageType: 'radiant', optIn: true }),
    );

    const lute = attack(held('lute of thunderous thumping'));
    expect(lute?.riders).toContainEqual(
      expect.objectContaining({ dice: '2d8', damageType: 'thunder', optIn: false }),
    );
    // A Bard may swing it with Charisma; a Wizard uses Strength.
    expect(lute?.ability).toBe('str');
    const bard = build({ id: 'lute of thunderous thumping|xdmg', slot: 'mainHand' }, 'bard|xphb');
    expect(bard.abilities.cha.score.value).toBeGreaterThan(bard.abilities.str.score.value);
    expect(attack(bard)?.ability).toBe('cha');

    const smiting = attack(held('mace of smiting'));
    expect(smiting?.riders.map((r) => r.dice).sort()).toEqual(['2', '7']);
  });

  it('Oathbow on a Longbow: the sworn enemy rider on the bow', () => {
    const s = build(
      { id: 'longbow|xphb', variant: 'oathbow|xdmg', slot: 'bothHands' },
      'fighter|xphb',
    );
    expect(attack(s)?.riders).toContainEqual(
      expect.objectContaining({ dice: '3d6', damageType: 'piercing', optIn: true }),
    );
  });

  it('Quarterstaff of the Acrobat and Luck Blade: Advantage, a reaction, daily luck', () => {
    const staff = held('quarterstaff of the acrobat');
    expect(staff.skills.acrobatics.mode).toBe('advantage');
    expect(resource(staff, 'Attack Deflection')).toMatchObject({ recharge: 'short' });
    expect(act(staff, 'Attack Deflection')?.actionType).toBe('reaction');

    const luck = build({ id: 'longsword|xphb', variant: 'luck blade|xdmg', slot: 'mainHand' });
    expect(resource(luck, 'Luck Blade: Luck')).toMatchObject({ recharge: 'dawn' });
  });

  it("Mariner's Armor: a Swim Speed equal to Speed", () => {
    const s = build({
      id: 'chain mail|xphb',
      variant: "mariner's armor|xdmg",
      slot: 'armor',
    });
    expect(s.speed.swim?.value).toBe(s.speed.walk?.value);
    expect(build(undefined).speed.swim).toBeUndefined();
  });

  it('periapts and the Pearl of Power', () => {
    const proof = worn('periapt of proof against poison');
    expect(proof.defenses.conditionImmunities.map((v) => v.value)).toContain('poisoned');
    expect(proof.defenses.immunities.map((v) => v.value)).toContain('poison');

    expect(worn('periapt of wound closure').deathSave.floor).toBe(10);

    const health = worn('periapt of health');
    expect(act(health, 'Periapt of Health')).toMatchObject({ roll: '2d4 + 2' });
    expect(resource(health, 'Periapt of Health')).toMatchObject({ recharge: 'dawn' });

    const pearl = worn('pearl of power');
    expect(resource(pearl, 'Pearl of Power')?.max.value).toBe(1);
    expect(act(pearl, 'Pearl of Power')?.outcomes).toEqual([{ regainSlot: { maxLevel: 3 } }]);
  });

  it('charged items: actions that spend a charge', () => {
    for (const [id, name] of [
      ['mace of terror', 'Wave of Terror'],
      ['pipes of haunting', 'Pipes of Haunting'],
      ['instrument of scribing', 'Scribe Message'],
    ] as const) {
      const s = id === 'mace of terror' ? held(id) : worn(id);
      expect(act(s, name)?.costs.map((c) => c.label)).toEqual(['1 charge']);
    }
  });
});
