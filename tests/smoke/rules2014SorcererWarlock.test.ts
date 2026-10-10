// Golden checks for the 2014 Sorcerer and Warlock on 2014 rules (plan step 8.6) on real data: each
// one quick-built at a few levels, with every book switched on and the 2014 originals preferred.
// Opt-in:
//   FIVETOOLS_DATA=./5etools-src npx vitest run --config vitest.smoke.config.ts tests/smoke/rules2014SorcererWarlock.test.ts
// Checks numbers and names only; it never prints or stores content.

import { beforeAll, describe, expect, it } from 'vitest';
import { importFivetools } from '../../src/adapters/fivetools/index.ts';
import { createCatalog, type Catalog } from '../../src/engine/build/catalog.ts';
import { quickBuild } from '../../src/engine/build/quickBuild.ts';
import { createContentIndex, type ContentIndex } from '../../src/engine/content/contentIndex.ts';
import { derive } from '../../src/engine/derive/derive.ts';
import type { DerivedSheet } from '../../src/engine/derive/types.ts';
import { featureEffects } from '../../src/engine/featureEffects/index.ts';
import { toggle } from '../../src/engine/play/reducers.ts';
import type { ContentEntity } from '../../src/schema/index.ts';
import { PREFER_2014, SHOW_2014 } from '../../src/sources/sourceFilter.ts';
import { nodeFileSource } from './nodeFileSource.ts';

const root = process.env.FIVETOOLS_DATA;

describe.skipIf(!root)('2014 Sorcerer and Warlock on 2014 rules (local data)', () => {
  let index: ContentIndex;
  let catalog: Catalog;
  const registry = featureEffects();

  beforeAll(async () => {
    const result = await importFivetools(nodeFileSource(root!), { now: 1 });
    const all = Object.values(result.entities).flat() as ContentEntity[];
    index = createContentIndex(all);
    const books = result.sources.filter((s) => s.origin !== 'homebrew').map((s) => s.code);
    catalog = createCatalog(all, new Set([...books, SHOW_2014, PREFER_2014]));
  });

  /** A half-orc soldier of one 2014 class, quick-built, with these toggles (`id`) on. */
  function build(classId: string, levels: number, subclassId?: string, toggles: string[] = []) {
    let c = quickBuild(
      {
        name: 'Golden',
        speciesId: 'half-orc|phb',
        backgroundId: 'soldier|phb',
        classes: [{ classId, levels, ...(subclassId ? { subclassId } : {}) }],
        ruleset: '2014',
      },
      { index, catalog, registry, now: 1 },
    );
    let s = derive(c, index, { registry });
    for (const id of toggles) {
      c = toggle(c, s, id, true, { free: true });
      s = derive(c, index, { registry });
    }
    expect(s.issues.filter((i) => i.severity !== 'info')).toEqual([]);
    return s;
  }
  /** `sub` is `<name>|<source>`: `draconic|phb` is `draconic|sorcerer|phb|phb`. */
  const subId = (sub: string, cls: string) => sub.replace('|', `|${cls}|phb|`);
  const sorcerer = (levels: number, sub: string, toggles?: string[]) =>
    build('sorcerer|phb', levels, subId(sub, 'sorcerer'), toggles);
  const warlock = (levels: number, sub: string, toggles?: string[]) =>
    build('warlock|phb', levels, subId(sub, 'warlock'), toggles);
  const resource = (s: DerivedSheet, name: string) => s.resources.find((r) => r.name === name);
  const action = (s: DerivedSheet, name: string) => s.actions.find((a) => a.name === name);
  const values = (list: { value: string }[]) => list.map((v) => v.value).sort();
  const spellDc = (s: DerivedSheet) => s.spellcasting.casters[0]!.dc.value;
  const costOf = (s: DerivedSheet, name: string) => action(s, name)?.costs[0]?.amount;

  it('Sorcerer: Sorcery Points, Metamagic picks and Sorcerous Restoration', () => {
    expect(resource(sorcerer(1, 'wild|phb'), 'Sorcery Points')).toBeUndefined();
    expect(resource(sorcerer(2, 'wild|phb'), 'Sorcery Points')?.max.value).toBe(2);
    const twenty = sorcerer(20, 'wild|phb');
    expect(resource(twenty, 'Sorcery Points')?.max.value).toBe(20);
    expect(action(twenty, 'Sorcerous Restoration')?.outcomes).toHaveLength(1);
    // Metamagic: 2 at 3, +1 at 10 and 17 (the class data's picks).
    const metamagic = (s: DerivedSheet) =>
      s.features
        .flatMap((f) => f.choices)
        .filter((x) => x.offer.key.slot.startsWith('optfeat.metamagic'))
        .reduce((n, x) => n + x.count, 0);
    expect(metamagic(sorcerer(3, 'wild|phb'))).toBe(2);
    expect(metamagic(twenty)).toBe(4);
  });

  it('Sorcerer: Draconic Bloodline', () => {
    const SUB = 'draconic|phb';
    const one = sorcerer(1, SUB);
    const wild = sorcerer(1, 'wild|phb');
    expect(one.hp.max.value).toBe(wild.hp.max.value + 1);
    expect(one.ac.value).toBe(13 + one.abilities.dex.mod);
    expect(values(one.proficiencies.languages)).toContain('draconic');
    expect(sorcerer(6, SUB).hp.max.value).toBe(sorcerer(6, 'wild|phb').hp.max.value + 6);
    // The quick build picks the first ancestor (Black: acid).
    expect(values(sorcerer(6, SUB).defenses.resistances)).toEqual([]);
    expect(values(sorcerer(6, SUB, ['elemental-affinity']).defenses.resistances)).toEqual(['acid']);
    const wings = sorcerer(14, SUB, ['dragon-wings']);
    expect(wings.speed.fly?.value).toBe(wings.speed.walk?.value);
    const eighteen = sorcerer(18, SUB);
    expect(action(eighteen, 'Draconic Presence')?.saveDc).toBe(spellDc(eighteen));
    expect(costOf(eighteen, 'Draconic Presence')).toBe(5);
  });

  it('Sorcerer: Wild Magic', () => {
    const one = sorcerer(1, 'wild|phb');
    expect(resource(one, 'Tides of Chaos')?.recharge).toBe('long');
    const six = sorcerer(6, 'wild|phb');
    expect(costOf(six, 'Bend Luck')).toBe(2);
    expect(action(six, 'Bend Luck')?.roll).toBe('1d4');
  });

  it('Sorcerer: Shadow Magic', () => {
    const SUB = 'shadow|xge';
    const one = sorcerer(1, SUB);
    expect(one.senses.find((s) => s.value.sense === 'darkvision')?.value.range).toBe(120);
    expect(resource(one, 'Strength of the Grave')?.recharge).toBe('long');
    const three = sorcerer(3, SUB);
    const darkness = three.spellcasting.granted.find(
      (g) => g.spellId === 'darkness|phb' && g.mode === 'innate',
    );
    expect(darkness?.cost).toBe(2);
    expect(costOf(sorcerer(6, SUB), 'Hound of Ill Omen')).toBe(3);
    expect(action(sorcerer(14, SUB), 'Shadow Walk')?.actionType).toBe('bonus');
    expect(sorcerer(18, SUB, ['umbral-form']).defenses.resistances).toHaveLength(11);
  });

  it('Sorcerer: Aberrant Mind and Clockwork Soul', () => {
    const aberrant = sorcerer(6, 'aberrant mind|tce');
    expect(action(aberrant, 'Telepathic Speech')?.actionType).toBe('bonus');
    expect(values(aberrant.defenses.resistances)).toEqual(['psychic']);
    expect(resource(sorcerer(18, 'aberrant mind|tce'), 'Warping Implosion')?.max.value).toBe(1);
    const clockwork = sorcerer(1, 'clockwork soul|tce');
    expect(resource(clockwork, 'Restore Balance')?.max.value).toBe(
      Math.max(1, clockwork.abilities.cha.mod),
    );
    expect(resource(sorcerer(14, 'clockwork soul|tce'), 'Trance of Order')?.max.value).toBe(1);
  });

  it('Warlock: Eldritch Master', () => {
    const twenty = warlock(20, 'fiend|phb');
    expect(resource(twenty, 'Eldritch Master')?.recharge).toBe('long');
    expect(action(twenty, 'Eldritch Master')?.outcomes).toHaveLength(4);
    expect(twenty.spellcasting.pact).toMatchObject({ level: 5, max: 4 });
  });

  it('Warlock: The Archfey', () => {
    const one = warlock(1, 'archfey|phb');
    expect(resource(one, 'Fey Presence')?.recharge).toBe('short');
    expect(action(one, 'Fey Presence')?.saveDc).toBe(spellDc(one));
    expect(action(warlock(6, 'archfey|phb'), 'Misty Escape')?.actionType).toBe('reaction');
    const ten = warlock(10, 'archfey|phb');
    expect(values(ten.defenses.conditionImmunities)).toContain('charmed');
    expect(resource(ten, 'Beguiling Defenses')).toBeUndefined();
    expect(resource(warlock(14, 'archfey|phb'), 'Dark Delirium')?.recharge).toBe('short');
  });

  it('Warlock: The Fiend', () => {
    const one = warlock(1, 'fiend|phb');
    expect(action(one, "Dark One's Blessing")?.outcomes[0]).toEqual({
      tempHp: String(Math.max(1, one.abilities.cha.mod + 1)),
    });
    const six = warlock(6, 'fiend|phb');
    expect(resource(six, "Dark One's Own Luck")).toMatchObject({ recharge: 'short' });
    expect(resource(six, "Dark One's Own Luck")?.max.value).toBe(1);
    // The quick build picks the first damage type (acid).
    expect(values(warlock(10, 'fiend|phb').defenses.resistances)).toEqual(['acid']);
    const fourteen = warlock(14, 'fiend|phb');
    expect(action(fourteen, 'Hurl Through Hell')?.roll).toBe('10d10');
    expect(resource(fourteen, 'Hurl Through Hell')?.restoreWith).toEqual([]);
  });

  it('Warlock: The Great Old One and The Celestial', () => {
    expect(resource(warlock(6, 'great old one|phb'), 'Entropic Ward')?.recharge).toBe('short');
    expect(values(warlock(10, 'great old one|phb').defenses.resistances)).toEqual(['psychic']);
    const healing = resource(warlock(1, 'celestial|xge'), 'Healing Light');
    expect(healing).toMatchObject({ die: '1d6', pool: true });
    expect(healing?.max.value).toBe(2);
    expect(values(warlock(6, 'celestial|xge').defenses.resistances)).toEqual(['radiant']);
  });

  it('Warlock: The Undead', () => {
    const SUB = 'undead|vrgr';
    const one = warlock(1, SUB);
    expect(resource(one, 'Form of Dread')?.max.value).toBe(2);
    expect(values(warlock(1, SUB, ['form-of-dread']).defenses.conditionImmunities)).toEqual([
      'frightened',
    ]);
    const ten = warlock(10, SUB);
    expect(values(ten.defenses.resistances)).toEqual(['necrotic']);
    expect(action(ten, 'Necrotic Husk')?.roll).toBe('2d10 + 10');
    expect(values(warlock(10, SUB, ['form-of-dread']).defenses.immunities)).toEqual(['necrotic']);
    const spirit = warlock(14, SUB, ['spirit-projection']);
    expect(values(spirit.defenses.resistances)).toEqual(
      expect.arrayContaining(['bludgeoning', 'piercing', 'slashing']),
    );
  });
});
