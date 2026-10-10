// Golden checks for the 2014 Paladin and Ranger on 2014 rules (plan step 8.6): the classes' own
// features and their subclasses (Devotion, Ancients, Vengeance, Glory; Beast Master, Hunter,
// Gloom Stalker, Fey Wanderer), with every book switched on. Opt-in:
//   FIVETOOLS_DATA=./5etools-src npx vitest run --config vitest.smoke.config.ts <this file>
// Checks numbers and names only; it never prints or stores content.

import { beforeAll, describe, expect, it } from 'vitest';
import { importFivetools } from '../../src/adapters/fivetools/index.ts';
import { createCatalog, type Catalog } from '../../src/engine/build/catalog.ts';
import { fillPending, quickBuild } from '../../src/engine/build/quickBuild.ts';
import { createContentIndex, type ContentIndex } from '../../src/engine/content/contentIndex.ts';
import { derive } from '../../src/engine/derive/derive.ts';
import type { DerivedSheet } from '../../src/engine/derive/types.ts';
import { featureEffects } from '../../src/engine/featureEffects/index.ts';
import { setPick } from '../../src/engine/play/features.ts';
import { addItem, equipItem, newRow } from '../../src/engine/play/inventory.ts';
import { toggle } from '../../src/engine/play/reducers.ts';
import {
  decodeChoiceKey,
  type Character,
  type ContentEntity,
  type Item,
} from '../../src/schema/index.ts';
import { PREFER_2014, SHOW_2014 } from '../../src/sources/sourceFilter.ts';
import { nodeFileSource } from './nodeFileSource.ts';

const root = process.env.FIVETOOLS_DATA;

describe.skipIf(!root)('2014 rules: Paladin and Ranger', () => {
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

  const deps = () => ({ index, catalog, registry, now: 1 });
  const sheetOf = (c: Character) => derive(c, index, { registry });

  /** A half-orc soldier on 2014 rules with a Longsword in hand, and these toggles on. */
  function build(cls: string, levels: number, sub?: string, toggles: string[] = []) {
    let c = quickBuild(
      {
        name: 'Golden',
        speciesId: 'half-orc|phb',
        backgroundId: 'soldier|phb',
        classes: [{ classId: `${cls}|phb`, levels, ...(sub ? { subclassId: sub } : {}) }],
        ruleset: '2014',
      },
      deps(),
    );
    const sword = index.get({ kind: 'item', id: 'longsword|phb' }) as Item;
    c = addItem(c, newRow({ uid: 'sword', item: sword }));
    c = equipItem(c, 'sword', 'mainHand', index);
    let s = sheetOf(c);
    expect(s.choices.pending).toEqual([]);
    for (const t of toggles) {
      c = toggle(c, s, t, true, { free: true });
      s = sheetOf(c);
    }
    return { c, s };
  }

  /** The same ranger with every Tasha's optional feature picked over its original. */
  function tasha(levels: number) {
    const built = build('ranger', levels);
    let c = built.c;
    for (const pick of built.s.features.flatMap((f) => f.choices)) {
      if (decodeChoiceKey(pick.key).slot !== 'variant') continue;
      c = setPick(c, decodeChoiceKey(pick.key), {
        values: ['tce'],
        labels: [],
        entryIndex: pick.entryIndex,
      });
    }
    const filled = fillPending(c, deps());
    expect(filled.sheet.choices.pending).toEqual([]);
    return filled.sheet;
  }

  const resource = (s: DerivedSheet, name: string) => s.resources.find((r) => r.name === name);
  const act = (s: DerivedSheet, name: string) => s.actions.find((a) => a.name === name);
  const riders = (s: DerivedSheet) => s.attacks.flatMap((a) => a.riders);
  const rider = (s: DerivedSheet, id: string) => riders(s).find((r) => r.id === id);
  const picks = (s: DerivedSheet, slot: string) =>
    s.features.flatMap((f) => f.choices).filter((x) => decodeChoiceKey(x.key).slot === slot);
  const chaDc = (s: DerivedSheet) => 8 + s.abilities.cha.mod + s.pb.value;
  const granted = (s: DerivedSheet, id: string) =>
    s.spellcasting.granted.filter((g) => g.spellId === id);

  it('Paladin: class features', () => {
    const one = build('paladin', 1).s;
    expect(resource(one, 'Divine Sense')?.max.value).toBe(Math.max(0, 1 + one.abilities.cha.mod));
    expect(resource(one, 'Lay on Hands')?.max.value).toBe(5);
    expect(act(one, 'Lay on Hands')?.actionType).toBe('action');

    const two = build('paladin', 2).s;
    expect(rider(two, 'divine-smite-1')).toMatchObject({ dice: '2d8', damageType: 'radiant' });
    expect(rider(two, 'divine-smite-2')).toBeUndefined();

    const three = build('paladin', 3, 'devotion|paladin|phb|phb').s;
    expect(resource(three, 'Channel Divinity')).toMatchObject({ recharge: 'short' });
    expect(resource(three, 'Channel Divinity')?.max.value).toBe(1);
    expect(resource(three, 'Harness Divine Power')?.max.value).toBe(1);
    expect(three.defenses.conditionImmunities.map((v) => v.value)).toContain('disease');

    const six = build('paladin', 6).s;
    expect(six.attacksPerAction.value).toBe(2);
    expect(six.saves.wis.bonus.value - (build('paladin', 4).s.saves.wis.bonus.value - 0)).toBe(
      Math.max(1, six.abilities.cha.mod) + (six.pb.value - build('paladin', 4).s.pb.value),
    );

    const eleven = build('paladin', 11).s;
    expect(rider(eleven, 'improved-divine-smite')).toMatchObject({ dice: '1d8', optIn: false });
    expect(rider(eleven, 'divine-smite-3')?.dice).toBe('4d8');
    expect(rider(eleven, 'divine-smite-4')).toBeUndefined();
    expect(eleven.defenses.conditionImmunities.map((v) => v.value)).toContain('frightened');

    const twenty = build('paladin', 20).s;
    expect(rider(twenty, 'divine-smite-4')?.dice).toBe('5d8');
    expect(resource(twenty, 'Lay on Hands')?.max.value).toBe(100);
    expect(resource(twenty, 'Cleansing Touch')?.max.value).toBe(
      Math.max(1, twenty.abilities.cha.mod),
    );
    expect(resource(twenty, 'Harness Divine Power')?.max.value).toBe(3);
  });

  it('Paladin: Devotion and Ancients', () => {
    const dev3 = build('paladin', 3, 'devotion|paladin|phb|phb', ['sacred-weapon']).s;
    expect(act(dev3, 'Turn the Unholy')?.saveDc).toBe(chaDc(dev3));
    expect(resource(dev3, 'Channel Divinity')?.used).toBe(0);
    const dev20 = build('paladin', 20, 'devotion|paladin|phb|phb', ['holy-nimbus']).s;
    expect(dev20.defenses.conditionImmunities.map((v) => v.value)).toContain('charmed');
    expect(resource(dev20, 'Holy Nimbus')?.max.value).toBe(1);
    expect(dev20.saves.wis.situational?.some((x) => x.mode === 'advantage')).toBe(true);

    const anc3 = build('paladin', 3, 'ancients|paladin|phb|phb').s;
    expect(act(anc3, "Nature's Wrath")?.saveDc).toBe(chaDc(anc3));
    expect(act(anc3, 'Turn the Faithless')?.actionType).toBe('action');
    const anc20 = build('paladin', 20, 'ancients|paladin|phb|phb', ['elder-champion']).s;
    expect(resource(anc20, 'Undying Sentinel')?.max.value).toBe(1);
    expect(act(anc20, 'Elder Champion: Start of Turn')).toBeDefined();
  });

  it('Paladin: Vengeance and Glory', () => {
    const ven3 = build('paladin', 3, 'vengeance|paladin|phb|phb').s;
    expect(act(ven3, 'Abjure Enemy')?.saveDc).toBe(chaDc(ven3));
    expect(act(ven3, 'Vow of Enmity')?.actionType).toBe('bonus');
    const ven20 = build('paladin', 20, 'vengeance|paladin|phb|phb', ['avenging-angel']).s;
    expect(ven20.speed.fly?.value).toBe(60);
    expect(act(ven20, 'Soul of Vengeance')?.actionType).toBe('reaction');

    const glory3 = build('paladin', 3, 'glory|paladin|phb|tce').s;
    expect(act(glory3, 'Inspiring Smite')?.roll).toBe('2d8 + 3');
    expect(act(glory3, 'Inspiring Smite')?.actionType).toBe('bonus');
    const plain7 = build('paladin', 7, 'devotion|paladin|phb|phb').s;
    const glory7 = build('paladin', 7, 'glory|paladin|phb|tce').s;
    expect(glory7.speed.walk!.value).toBe(plain7.speed.walk!.value + 10);
    const glory20 = build('paladin', 20, 'glory|paladin|phb|tce').s;
    expect(resource(glory20, 'Glorious Defense')?.max.value).toBe(
      Math.max(1, glory20.abilities.cha.mod),
    );
    expect(resource(glory20, 'Living Legend')?.max.value).toBe(1);
  });

  it('Ranger: the Player’s Handbook features', () => {
    const one = build('ranger', 1).s;
    expect(picks(one, 'enemy')).toHaveLength(1);
    expect(picks(one, 'terrain')).toHaveLength(1);
    expect(one.skills.survival.situational?.[0]?.mode).toBe('advantage');
    expect(resource(one, 'Favored Foe')).toBeUndefined();

    const three = build('ranger', 3).s;
    expect(act(three, 'Primeval Awareness')?.actionType).toBe('action');
    expect(granted(three, 'speak with animals|phb')).toEqual([]);

    const ten = build('ranger', 10).s;
    expect(picks(ten, 'enemy')).toHaveLength(2);
    expect(picks(ten, 'terrain')).toHaveLength(3);
    expect(ten.attacksPerAction.value).toBe(2);
    expect(resource(ten, "Nature's Veil")).toBeUndefined();
    const hidden = build('ranger', 10, undefined, ['hide-in-plain-sight']).s;
    expect(hidden.skills.stealth.bonus.value).toBe(ten.skills.stealth.bonus.value + 10);

    const twenty = build('ranger', 20).s;
    expect(picks(twenty, 'enemy')).toHaveLength(3);
    expect(act(twenty, 'Vanish: Hide')?.actionType).toBe('bonus');
    expect(rider(twenty, 'foe-slayer')?.dice).toBe(String(twenty.abilities.wis.mod));
  });

  it('Ranger: the Tasha’s optional features', () => {
    const one = tasha(1);
    expect(picks(one, 'enemy')).toHaveLength(0);
    expect(picks(one, 'terrain')).toHaveLength(0);
    expect(resource(one, 'Favored Foe')?.max.value).toBe(2);
    expect(rider(one, 'favored-foe')?.dice).toBe('1d4');
    expect(picks(one, 'expertise')).toHaveLength(1);
    expect(picks(one, 'languages')[0]?.values).toHaveLength(2);

    const three = tasha(3);
    expect(act(three, 'Primeval Awareness')).toBeUndefined();
    expect(granted(three, 'speak with animals|phb').find((g) => g.usesMax)?.usesMax).toBe(1);
    expect(granted(three, 'beast sense|phb')).toEqual([]);

    const ten = tasha(10);
    const plain = build('ranger', 10).s;
    expect(rider(ten, 'favored-foe')?.dice).toBe('1d6');
    expect(ten.speed.walk!.value).toBe(plain.speed.walk!.value + 5);
    expect(ten.speed.climb?.value).toBe(ten.speed.walk!.value);
    expect(resource(ten, "Nature's Veil")?.max.value).toBe(4);
    expect(resource(ten, 'Tireless')?.max.value).toBe(4);
    expect(rider(tasha(14), 'favored-foe')?.dice).toBe('1d8');
  });

  it('Ranger: Hunter, Beast Master, Gloom Stalker and Fey Wanderer', () => {
    const hunter = build('ranger', 15, 'hunter|ranger|phb|phb').s;
    const options = hunter.features.map((f) => f.name);
    // The quick-builder picks each option alphabetically.
    expect(options).toEqual(expect.arrayContaining(['Colossus Slayer', 'Escape the Horde']));
    expect(rider(hunter, 'colossus-slayer')?.dice).toBe('1d8');

    expect(build('ranger', 15, 'beast master|ranger|phb|phb').s.issues).toEqual([]);

    const gloom = build('ranger', 7, 'gloom stalker|ranger|phb|xge').s;
    // The half-orc's 60 ft. of darkvision, 30 ft. more.
    expect(gloom.senses.find((x) => x.value.sense === 'darkvision')?.value.range).toBe(90);
    expect(rider(gloom, 'dread-ambusher')?.dice).toBe('1d8');
    expect(gloom.saves.wis.proficiency).toBe('proficient');

    const fey3 = build('ranger', 3, 'fey wanderer|ranger|phb|tce').s;
    expect(rider(fey3, 'dreadful-strikes')?.dice).toBe('1d4');
    const fey15 = build('ranger', 15, 'fey wanderer|ranger|phb|tce').s;
    expect(rider(fey15, 'dreadful-strikes')?.dice).toBe('1d6');
    expect(granted(fey15, 'summon fey|tce').find((g) => g.usesMax)?.usesMax).toBe(1);
    expect(granted(fey15, 'misty step|phb').find((g) => g.usesMax)?.usesMax).toBe(
      Math.max(1, fey15.abilities.wis.mod),
    );
  });
});
