// Golden checks for the 2024 Dungeon Master's Guide magic items R to Z (plan §10.3, step 7.12)
// on real data: a level 5 human fighter with the item equipped (and attuned), its numbers read
// the way the item's text gives them. Opt-in:
//   FIVETOOLS_DATA=./5etools-src-2.36.1 npx vitest run --config vitest.smoke.config.ts tests/smoke/itemsRtoZ.test.ts
// Checks numbers only; it never prints or stores content.

import { beforeAll, describe, expect, it } from 'vitest';
import { importFivetools } from '../../src/adapters/fivetools/index.ts';
import { createCatalog, type Catalog } from '../../src/engine/build/catalog.ts';
import { quickBuild } from '../../src/engine/build/quickBuild.ts';
import { createContentIndex, type ContentIndex } from '../../src/engine/content/contentIndex.ts';
import { derive } from '../../src/engine/derive/derive.ts';
import type { DerivedSheet } from '../../src/engine/derive/types.ts';
import { featureEffects } from '../../src/engine/featureEffects/index.ts';
import { equipSlots } from '../../src/engine/items/items.ts';
import { setPick } from '../../src/engine/play/features.ts';
import { toggle } from '../../src/engine/play/reducers.ts';
import type { Character, ContentEntity } from '../../src/schema/index.ts';
import { nodeFileSource } from './nodeFileSource.ts';

const root = process.env.FIVETOOLS_DATA;

describe.skipIf(!root)('magic items R to Z golden checks (local data)', () => {
  let index: ContentIndex;
  let catalog: Catalog;

  beforeAll(async () => {
    const result = await importFivetools(nodeFileSource(root!), { now: 1 });
    const all = Object.values(result.entities).flat() as ContentEntity[];
    index = createContentIndex(all);
    catalog = createCatalog(all, new Set(['XPHB', 'XDMG']));
  });

  interface Spec {
    /** The item's name; the id is `<name>|xdmg`. */
    item: string;
    toggles?: string[];
    /** A damage type picked for the item's resistance choice. */
    resistance?: string;
    /** Take off the fighter's body armor. */
    unarmored?: boolean;
  }

  /** A level 5 human sage fighter with the item in use. */
  function build({ item: name, toggles = [], resistance, unarmored }: Spec): DerivedSheet {
    const registry = featureEffects();
    const id = `${name}|xdmg`;
    const item = index.get({ kind: 'item', id });
    if (!item) throw new Error(`no item ${id}`);
    let c: Character = quickBuild(
      {
        name: 'Golden',
        speciesId: 'human|xphb',
        backgroundId: 'sage|xphb',
        classes: [{ classId: 'fighter|xphb', levels: 5 }],
      },
      { index, catalog, registry, now: 1 },
    );
    const slot =
      equipSlots(item).includes('worn') && !item.weapon ? 'worn' : (equipSlots(item)[0] ?? 'worn');
    // Free the hands (or body) the item needs.
    if (slot !== 'worn')
      for (const r of c.inventory) if (r.equipped && r.equipped !== 'worn') delete r.equipped;
    if (unarmored) for (const r of c.inventory) if (r.equipped === 'armor') delete r.equipped;
    c.inventory.push({
      uid: 'golden-item',
      itemRef: { kind: 'item', id },
      name: item.name,
      quantity: 1,
      attuned: true,
      equipped: slot,
    });
    if (resistance) {
      c = setPick(
        c,
        { owner: { kind: 'item', id }, slot: 'damage-type' },
        { values: [resistance], labels: [], entryIndex: 0 },
      );
    }
    let s = derive(c, index, { registry });
    for (const t of toggles) {
      c = toggle(c, s, t, true, { free: true });
      s = derive(c, index, { registry });
    }
    return s;
  }

  const act = (s: DerivedSheet, name: string) => s.actions.find((a) => a.name === name);
  const resource = (s: DerivedSheet, name: string) => s.resources.find((r) => r.name === name);
  const attack = (s: DerivedSheet, name: string) => s.attacks.find((a) => a.name === name);
  const resists = (s: DerivedSheet) => s.defenses.resistances.map((r) => r.value);
  const senses = (s: DerivedSheet) => s.senses.map((x) => `${x.value.sense} ${x.value.range}`);

  it('speeds: swimming, climbing, the air and water rings, and flight that switches on', () => {
    expect(build({ item: 'ring of swimming' }).speed.swim?.value).toBe(40);
    expect(build({ item: 'slippers of spider climbing' }).speed.climb?.value).toBe(30);
    const air = build({ item: 'ring of elemental command (air)' });
    expect(air.speed.fly?.value).toBe(30);
    expect(resists(air)).toContain('lightning');
    expect(build({ item: 'ring of elemental command (water)' }).speed.swim?.value).toBe(60);

    expect(build({ item: 'winged boots' }).speed.fly).toBeUndefined();
    expect(build({ item: 'winged boots', toggles: ['winged-boots'] }).speed.fly?.value).toBe(30);
    expect(build({ item: 'wings of flying', toggles: ['wings-of-flying'] }).speed.fly?.value).toBe(
      60,
    );
  });

  it('senses, advantage and Armor Class', () => {
    const eyes = build({ item: 'robe of eyes' });
    expect(senses(eyes)).toEqual(expect.arrayContaining(['darkvision 120', 'truesight 120']));
    expect(eyes.skills.perception.mode).toBe('advantage');

    const sentinel = build({ item: 'sentinel shield' });
    expect(sentinel.initiative.mode).toBe('advantage');
    expect(sentinel.skills.perception.mode).toBe('advantage');
    expect(build({ item: 'weapon of warning' }).initiative.mode).toBe('advantage');

    // The robe's base AC without armor: 15 + Dex, shield allowed.
    const archmagi = build({ item: 'robe of the archmagi', unarmored: true });
    expect(archmagi.ac.value).toBe(15 + archmagi.abilities.dex.mod);
  });

  it('a damage type picked for the Ring of Resistance', () => {
    expect(resists(build({ item: 'ring of resistance', resistance: 'fire' }))).toContain('fire');
  });

  it('riders on the item’s own attacks, paid in charges or daily uses', () => {
    const striking = build({ item: 'staff of striking' });
    const staff = attack(striking, 'Staff of Striking')!;
    expect(staff.riders.map((r) => r.dice)).toEqual(['1d6', '2d6', '3d6']);
    expect(staff.riders.every((r) => r.optIn && r.damageType === 'force')).toBe(true);
    // Only the staff's attacks carry them.
    expect(attack(striking, 'Unarmed Strike')!.riders).toEqual([]);

    const orcus = attack(build({ item: 'wand of orcus' }), 'Wand of Orcus')!;
    expect(orcus.riders).toMatchObject([{ dice: '2d12', damageType: 'necrotic', optIn: false }]);

    const thunder = build({ item: 'staff of thunder and lightning' });
    expect(attack(thunder, 'Staff of Thunder and Lightning')!.riders).toMatchObject([
      { dice: '2d6', damageType: 'lightning', optIn: true },
    ]);
    expect(resource(thunder, 'Lightning Strike')).toMatchObject({ recharge: 'dawn' });
    expect(act(thunder, 'Lightning Strike')?.roll).toBe('9d6');
  });

  it('Sword of Kas: critical range, Battle Hunger and Necrotic resistance', () => {
    const kas = build({ item: 'sword of kas' });
    const sword = attack(kas, 'Sword of Kas')!;
    expect(sword.critRange).toBe(19);
    expect(sword.riders.map((r) => r.dice)).toEqual(['2d10']);
    expect(kas.initiative.dice.map((d) => d.dice)).toEqual(['1d10']);
    expect(resists(kas)).toContain('necrotic');
  });

  it('Thunderous Greatclub: Strength 20 and its thunder', () => {
    const club = build({ item: 'thunderous greatclub' });
    expect(club.abilities.str.score.value).toBe(20);
    expect(attack(club, 'Thunderous Greatclub')!.riders).toMatchObject([
      { dice: '1d8', damageType: 'thunder' },
    ]);
    expect(resource(club, 'Earthquake')?.max.value).toBe(1);
  });

  it('actions paid in charges', () => {
    const evasion = build({ item: 'ring of evasion' });
    expect(act(evasion, 'Ring of Evasion')).toMatchObject({ actionType: 'reaction' });
    expect(act(evasion, 'Ring of Evasion')!.costs.map((c) => c.label)).toEqual(['1 charge']);
    const stars = build({ item: 'ring of shooting stars' });
    expect(act(stars, 'Lightning Spheres')!.costs.map((c) => c.label)).toEqual(['2 charges']);
    expect(act(build({ item: 'scimitar of speed' }), 'Scimitar of Speed')?.actionType).toBe(
      'bonus',
    );
  });

  it('Wave: Advantage on Initiative and its daily Globe of Invulnerability', () => {
    const wave = build({ item: 'wave' });
    expect(wave.initiative.mode).toBe('advantage');
    const globe = wave.spellcasting.granted.find(
      (g) => g.spellId === 'globe of invulnerability|xphb',
    );
    expect(globe?.usesMax).toBe(1);
  });
});
