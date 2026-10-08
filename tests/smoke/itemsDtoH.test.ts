// Golden checks for the 2024 Dungeon Master's Guide magic items D to H (plan §10.3, step 7.12)
// on real data: a level 5 human sage, fighter or wizard, with the item in use (equipped or worn,
// and attuned), its numbers read the way the item's text gives them. Opt-in:
//   FIVETOOLS_DATA=./5etools-src-2.36.1 npx vitest run --config vitest.smoke.config.ts tests/smoke/itemsDtoH.test.ts
// Checks numbers only; it never prints or stores content.

import { beforeAll, describe, expect, it } from 'vitest';
import { importFivetools } from '../../src/adapters/fivetools/index.ts';
import { createCatalog, type Catalog } from '../../src/engine/build/catalog.ts';
import { quickBuild } from '../../src/engine/build/quickBuild.ts';
import { createContentIndex, type ContentIndex } from '../../src/engine/content/contentIndex.ts';
import { derive } from '../../src/engine/derive/derive.ts';
import type { DerivedSheet } from '../../src/engine/derive/types.ts';
import { featureEffects } from '../../src/engine/featureEffects/index.ts';
import { toggle } from '../../src/engine/play/reducers.ts';
import type { Character, ContentEntity, InventoryItem } from '../../src/schema/index.ts';
import { nodeFileSource } from './nodeFileSource.ts';

const root = process.env.FIVETOOLS_DATA;

describe.skipIf(!root)('magic items D to H golden checks (local data)', () => {
  let index: ContentIndex;
  let catalog: Catalog;

  beforeAll(async () => {
    const result = await importFivetools(nodeFileSource(root!), { now: 1 });
    const all = Object.values(result.entities).flat() as ContentEntity[];
    index = createContentIndex(all);
    catalog = createCatalog(all, new Set(['XPHB', 'XDMG']));
  });

  interface Spec {
    /** The magic item, or a magic variant on `base`. */
    item: string;
    base?: string;
    slot: NonNullable<InventoryItem['equipped']>;
    cls?: 'fighter' | 'wizard';
    toggles?: [string, string?][];
  }

  /** A level 5 human sage with the item in use; whatever it replaces is unequipped. */
  function build({ item, base, slot, cls = 'fighter', toggles = [] }: Spec): DerivedSheet {
    const registry = featureEffects();
    let c: Character = quickBuild(
      {
        name: 'Golden',
        speciesId: 'human|xphb',
        backgroundId: 'sage|xphb',
        classes: [{ classId: `${cls}|xphb`, levels: 5 }],
      },
      { index, catalog, registry, now: 1 },
    );
    const hands = slot === 'mainHand' || slot === 'offHand' || slot === 'bothHands';
    for (const r of c.inventory) {
      if (r.equipped === slot || (hands && r.equipped && r.equipped !== 'worn')) delete r.equipped;
    }
    const id = `${item}|xdmg`;
    c.inventory.push({
      uid: 'golden',
      itemRef: { kind: 'item', id: base ?? id },
      ...(base ? { variantRef: { kind: 'item' as const, id } } : {}),
      name: item,
      quantity: 1,
      attuned: true,
      equipped: slot,
    });
    let s = derive(c, index, { registry });
    for (const [t, option] of toggles) {
      c = toggle(c, s, t, true, { free: true, ...(option ? { option } : {}) });
      s = derive(c, index, { registry });
    }
    return s;
  }
  const resource = (s: DerivedSheet, name: string) => s.resources.find((r) => r.name === name);
  const act = (s: DerivedSheet, name: string) => s.actions.find((a) => a.name === name);
  const sense = (s: DerivedSheet, name: string) =>
    s.senses.find((x) => x.value.sense === name)?.value.range;
  const attack = (s: DerivedSheet, name: string) => s.attacks.find((a) => a.name === name)!;
  const values = (list: { value: string }[]) => list.map((v) => v.value);

  it('Dagger of Venom: a daily poison coat, a bonus action with its own save DC', () => {
    const s = build({ item: 'dagger of venom', slot: 'mainHand' });
    expect(resource(s, 'Dagger of Venom')).toMatchObject({ recharge: 'dawn' });
    expect(resource(s, 'Dagger of Venom')?.max.value).toBe(1);
    expect(act(s, 'Dagger of Venom')).toMatchObject({
      actionType: 'bonus',
      roll: '2d10',
      saveDc: 15,
    });
  });

  it('Demon Armor: Abyssal, and clawed Unarmed Strikes with +1', () => {
    const plain = build({ item: 'dagger of venom', slot: 'offHand' });
    const s = build({ item: 'demon armor', base: 'plate armor|xphb', slot: 'armor' });
    expect(values(s.proficiencies.languages)).toContain('abyssal');
    const unarmed = attack(s, 'Unarmed Strike');
    expect(unarmed.damageDice).toBe('1d8');
    expect(unarmed.toHit?.bonus.value).toBe(attack(plain, 'Unarmed Strike').toHit!.bonus.value + 1);
  });

  it('Dwarven Thrower: the Force rider on its own attack only', () => {
    const s = build({ item: 'dwarven thrower', slot: 'mainHand' });
    expect(attack(s, 'dwarven thrower').riders.map((r) => r.dice)).toEqual(['1d8']);
    expect(attack(s, 'Unarmed Strike').riders).toEqual([]);
  });

  it('Efreeti Chain and Elven Chain: languages and armor training', () => {
    const efreeti = build({ item: 'efreeti chain', base: 'chain mail|xphb', slot: 'armor' });
    expect(values(efreeti.defenses.immunities)).toContain('fire');
    expect(values(efreeti.proficiencies.languages)).toContain('primordial');
    // A wizard has no armor training, but wears Elven Chain without penalty.
    const elven = build({
      item: 'elven chain',
      base: 'chain mail|xphb',
      slot: 'armor',
      cls: 'wizard',
    });
    expect(elven.issues.map((i) => i.code)).not.toContain('armorUntrained');
    expect(elven.saves.dex.mode).toBe('normal');
  });

  it('Eye and Hand of Vecna: Truesight, Initiative, poison, the cold rider', () => {
    const s = build({ item: 'eye and hand of vecna', slot: 'worn' });
    expect(sense(s, 'truesight')).toBe(240);
    expect(s.initiative.mode).toBe('advantage');
    expect(values(s.defenses.immunities)).toContain('poison');
    expect(values(s.defenses.conditionImmunities)).toContain('poisoned');
    expect(act(s, 'Necrotic Reduction')).toMatchObject({ roll: '7d6', saveDc: 18 });
    const hand = build({ item: 'hand of vecna', slot: 'worn' });
    expect(attack(hand, 'Greatsword').riders.map((r) => `${r.name} ${r.dice}`)).toEqual([
      'Hand of Vecna 2d8',
    ]);
    expect(sense(build({ item: 'eye of vecna', slot: 'worn' }), 'truesight')).toBe(240);
  });

  it('Gem of Brightness and Gem of Seeing: actions paid in charges', () => {
    const gem = build({ item: 'gem of brightness', slot: 'offHand' });
    expect(act(gem, 'Gem of Brightness (flare)')?.costs.map((c) => c.label)).toEqual(['5 charges']);
    expect(act(gem, 'Gem of Brightness (beam)')?.saveDc).toBe(15);
    const seeing = build({
      item: 'gem of seeing',
      slot: 'offHand',
      toggles: [['gem-of-seeing']],
    });
    expect(sense(seeing, 'truesight')).toBe(120);
    expect(sense(build({ item: 'gem of seeing', slot: 'offHand' }), 'truesight')).toBeUndefined();
  });

  it('gloves: climbing and swimming speeds, Sleight of Hand, missile snaring', () => {
    const climb = build({ item: 'gloves of swimming and climbing', slot: 'worn' });
    expect(climb.speed.climb?.value).toBe(30);
    expect(climb.speed.swim?.value).toBe(30);
    const plain = build({ item: 'goggles of night', slot: 'worn' });
    const thief = build({ item: 'gloves of thievery', slot: 'worn' });
    expect(thief.skills['sleight of hand'].bonus.value).toBe(
      plain.skills['sleight of hand'].bonus.value + 5,
    );
    // A free hand is needed: the wizard has one, the fighter's greatsword takes both.
    const wizard = build({ item: 'gloves of missile snaring', slot: 'worn', cls: 'wizard' });
    expect(act(wizard, 'Gloves of Missile Snaring')).toMatchObject({ actionType: 'reaction' });
    const fighter = build({ item: 'gloves of missile snaring', slot: 'worn' });
    expect(act(fighter, 'Gloves of Missile Snaring')).toBeUndefined();
  });

  it('Goggles of Night and Helm of Telepathy: senses', () => {
    expect(sense(build({ item: 'goggles of night', slot: 'worn' }), 'darkvision')).toBe(60);
    expect(sense(build({ item: 'helm of telepathy', slot: 'worn' }), 'telepathy')).toBe(30);
  });

  it('Gold Dragon Scale Mail: resistance and its daily sense', () => {
    const s = build({ item: 'gold dragon scale mail', slot: 'armor' });
    expect(values(s.defenses.resistances)).toContain('fire');
    expect(resource(s, 'Gold Dragon Scale Mail')).toMatchObject({ recharge: 'dawn' });
  });

  it('hats: Unknown Spell once per rest', () => {
    const wizardry = build({ item: 'hat of wizardry', slot: 'worn', cls: 'wizard' });
    expect(resource(wizardry, 'Hat of Wizardry')).toMatchObject({ recharge: 'long' });
    const many = build({ item: 'hat of many spells', slot: 'offHand', cls: 'wizard' });
    expect(resource(many, 'Hat of Many Spells')).toMatchObject({ recharge: 'short' });
  });

  it('Helm of Brilliance: the fire opal rider while the flames are lit', () => {
    const lit = build({
      item: 'helm of brilliance',
      slot: 'worn',
      toggles: [['helm-of-brilliance']],
    });
    expect(values(lit.defenses.resistances)).toContain('fire');
    expect(attack(lit, 'Greatsword').riders.map((r) => r.dice)).toEqual(['1d6']);
    const unlit = build({ item: 'helm of brilliance', slot: 'worn' });
    expect(attack(unlit, 'Greatsword').riders).toEqual([]);
  });

  it('Defender and Frost Brand: AC moved from the sword, fire resistance', () => {
    const plain = build({ item: 'defender', base: 'longsword|xphb', slot: 'mainHand' });
    const shifted = build({
      item: 'defender',
      base: 'longsword|xphb',
      slot: 'mainHand',
      toggles: [['defender', 'ac-2']],
    });
    expect(shifted.ac.value).toBe(plain.ac.value + 2);
    const frost = build({ item: 'frost brand', base: 'longsword|xphb', slot: 'mainHand' });
    expect(values(frost.defenses.resistances)).toContain('fire');
  });

  it('Horn of Blasting: its blast', () => {
    const s = build({ item: 'horn of blasting', slot: 'offHand' });
    expect(act(s, 'Horn of Blasting')).toMatchObject({ roll: '5d8', saveDc: 15 });
  });
});
