// Golden checks for the 2014 Barbarian paths and Bard colleges on 2024 characters (plan step
// 8.3): one build per subclass at a few levels, with every book and "Show 2014 content" on, its
// numbers read the way the mapping gives them. Opt-in:
//   FIVETOOLS_DATA=./5etools-src npx vitest run --config vitest.smoke.config.ts tests/smoke/legacyBarbarianBard.test.ts
// Checks numbers and names only; it never prints or stores content.

import { beforeAll, describe, expect, it } from 'vitest';
import { importFivetools } from '../../src/adapters/fivetools/index.ts';
import { createCatalog, type Catalog } from '../../src/engine/build/catalog.ts';
import { quickBuild } from '../../src/engine/build/quickBuild.ts';
import { createContentIndex, type ContentIndex } from '../../src/engine/content/contentIndex.ts';
import { derive } from '../../src/engine/derive/derive.ts';
import type { DerivedSheet } from '../../src/engine/derive/types.ts';
import { featureEffects } from '../../src/engine/featureEffects/index.ts';
import { setPick } from '../../src/engine/play/features.ts';
import { toggle } from '../../src/engine/play/reducers.ts';
import { decodeChoiceKey, type Character, type ContentEntity } from '../../src/schema/index.ts';
import { SHOW_2014 } from '../../src/sources/sourceFilter.ts';
import { nodeFileSource } from './nodeFileSource.ts';

const root = process.env.FIVETOOLS_DATA;

describe.skipIf(!root)('2014 Barbarian and Bard subclasses on 2024 characters', () => {
  let index: ContentIndex;
  let catalog: Catalog;
  const registry = featureEffects();

  beforeAll(async () => {
    const result = await importFivetools(nodeFileSource(root!), { now: 1 });
    const all = Object.values(result.entities).flat() as ContentEntity[];
    index = createContentIndex(all);
    const books = result.sources.filter((s) => s.origin !== 'homebrew').map((s) => s.code);
    catalog = createCatalog(all, new Set([...books, SHOW_2014]));
  });

  const sheetOf = (c: Character) => derive(c, index, { registry });
  /** A human soldier of a 2024 class with a 2014 subclass. */
  function character(cls: string, levels: number, subclassId: string): Character {
    return quickBuild(
      {
        name: 'Golden',
        speciesId: 'human|xphb',
        backgroundId: 'soldier|xphb',
        classes: [{ classId: `${cls}|xphb`, levels, subclassId }],
      },
      { index, catalog, registry, now: 1 },
    );
  }
  /** The same, with these toggles switched on (`id` or `id:option`). */
  function build(cls: string, levels: number, subclassId: string, toggles: string[] = []) {
    let c = character(cls, levels, subclassId);
    let s = sheetOf(c);
    for (const t of toggles) {
      const [id, option] = t.split(':');
      c = toggle(c, s, id!, true, { free: true, ...(option ? { option } : {}) });
      s = sheetOf(c);
    }
    expect(s.choices.pending).toEqual([]);
    return s;
  }
  /** Re-pick the subclass-feature option `from` as `to` instead. */
  function repick(c: Character, from: string, to: string): Character {
    const pick = sheetOf(c)
      .features.flatMap((f) => f.choices)
      .find((x) => x.values.includes(from))!;
    return setPick(c, decodeChoiceKey(pick.key), {
      values: [to],
      labels: [],
      valueKinds: ['subclassFeature'],
      entryIndex: pick.entryIndex,
    });
  }
  const resource = (s: DerivedSheet, name: string) => s.resources.find((r) => r.name === name);
  const act = (s: DerivedSheet, name: string) => s.actions.find((a) => a.name === name);
  const attack = (s: DerivedSheet, name: string) => s.attacks.find((a) => a.name === name);
  const values = (list: { value: string }[]) => list.map((v) => v.value).sort();

  it('Barbarian: Path of the Battlerager', () => {
    const sub = 'battlerager|barbarian|xphb|scag';
    // No Spiked Armor worn: no spikes, even raging.
    expect(attack(build('barbarian', 3, sub, ['rage']), 'Armor Spikes')).toBeUndefined();
    const six = build('barbarian', 6, sub, ['rage']);
    expect(act(six, 'Reckless Abandon')?.outcomes.length).toBe(1);
    expect(act(build('barbarian', 6, sub), 'Reckless Abandon')).toBeUndefined();
    expect(act(build('barbarian', 10, sub, ['rage']), 'Battlerager Charge')?.actionType).toBe(
      'bonus',
    );
  });

  it('Barbarian: Path of the Ancestral Guardian', () => {
    const sub = 'ancestral guardian|barbarian|xphb|xge';
    const shield = (level: number) =>
      act(build('barbarian', level, sub, ['rage']), 'Spirit Shield');
    expect(shield(6)).toMatchObject({ actionType: 'reaction', roll: '2d6' });
    expect(shield(10)?.roll).toBe('3d6');
    expect(shield(14)?.roll).toBe('4d6');
    expect(act(build('barbarian', 6, sub), 'Spirit Shield')).toBeUndefined();
    const ten = build('barbarian', 10, sub);
    expect(resource(ten, 'Consult the Spirits')).toMatchObject({ recharge: 'short' });
    expect(resource(ten, 'Consult the Spirits')?.max.value).toBe(1);
  });

  it('Barbarian: Path of the Storm Herald', () => {
    const sub = 'storm herald|barbarian|xphb|xge';
    // The quick-builder picks Desert each time.
    const three = build('barbarian', 3, sub, ['rage']);
    expect(act(three, 'Storm Aura (Desert)')).toMatchObject({ actionType: 'bonus', roll: '2' });
    expect(act(build('barbarian', 10, sub, ['rage']), 'Storm Aura (Desert)')?.roll).toBe('4');
    const six = build('barbarian', 6, sub);
    expect(values(six.defenses.resistances)).toEqual(['fire']);
    const fourteen = build('barbarian', 14, sub, ['rage']);
    const con = fourteen.abilities.con.mod;
    expect(act(fourteen, 'Raging Storm (Desert)')).toMatchObject({
      actionType: 'reaction',
      roll: '7',
      saveDc: 8 + 5 + con,
    });

    let sea = character('barbarian', 10, sub);
    for (const level of [3, 6])
      sea = repick(
        sea,
        `desert|barbarian|phb|storm herald|xge|${level}|xge`,
        `sea|barbarian|phb|storm herald|xge|${level}|xge`,
      );
    let s = sheetOf(sea);
    expect(values(s.defenses.resistances)).toEqual(['lightning']);
    expect(s.speed.swim?.value).toBe(30);
    sea = toggle(sea, s, 'rage', true, { free: true });
    s = sheetOf(sea);
    expect(act(s, 'Storm Aura (Sea)')).toMatchObject({
      roll: '2d6',
      saveDc: 8 + 4 + s.abilities.con.mod,
    });
  });

  it('Barbarian: Path of the Beast', () => {
    const sub = 'beast|barbarian|xphb|tce';
    const bite = build('barbarian', 3, sub, ['rage', 'form-of-the-beast:bite']);
    expect(attack(bite, 'Bite')).toMatchObject({ damageDice: '1d8', damageType: 'piercing' });
    expect(act(bite, 'Bite (Regain Hit Points)')?.outcomes.length).toBe(1);
    const tail = build('barbarian', 3, sub, ['rage', 'form-of-the-beast:tail']);
    expect(attack(tail, 'Tail')?.damageDice).toBe('1d8');
    expect(act(tail, 'Tail Swipe')).toMatchObject({ actionType: 'reaction', roll: '1d8' });
    expect(attack(tail, 'Bite')).toBeUndefined();
    // The quick-builder picks the first adaptation: swimming.
    const six = build('barbarian', 6, sub);
    expect(six.speed.swim?.value).toBe(six.speed.walk?.value);
    const ten = build('barbarian', 10, sub);
    expect(resource(ten, 'Infectious Fury')?.max.value).toBe(4);
    expect(act(ten, 'Infectious Fury')).toMatchObject({
      roll: '2d12',
      saveDc: 8 + 4 + ten.abilities.con.mod,
    });
    expect(resource(build('barbarian', 14, sub), 'Call the Hunt')?.max.value).toBe(5);
  });

  it('Barbarian: Path of Wild Magic', () => {
    const sub = 'wild magic|barbarian|xphb|tce';
    const three = build('barbarian', 3, sub, ['rage']);
    expect(resource(three, 'Magic Awareness')?.max.value).toBe(2);
    expect(act(three, 'Magic Awareness')?.actionType).toBe('action');
    expect(act(three, 'Wild Surge')).toMatchObject({
      roll: '1d8',
      saveDc: 8 + 2 + three.abilities.con.mod,
    });
    expect(resource(build('barbarian', 6, sub), 'Bolstering Magic')?.max.value).toBe(3);
    expect(act(build('barbarian', 10, sub, ['rage']), 'Unstable Backlash')?.actionType).toBe(
      'reaction',
    );
  });

  it('Barbarian: Path of the Giant', () => {
    const sub = 'giant|barbarian|xphb|bgg';
    expect(values(build('barbarian', 3, sub).proficiencies.languages)).toContain('giant');
    const cleaver = (level: number) =>
      build('barbarian', level, sub, ['rage']).attacks[0]?.riders.find(
        (r) => r.id === 'elemental-cleaver',
      )?.dice;
    expect(cleaver(6)).toBe('1d6');
    expect(cleaver(14)).toBe('2d6');
    const ten = build('barbarian', 10, sub, ['rage']);
    expect(act(ten, 'Mighty Impel')).toMatchObject({
      actionType: 'bonus',
      saveDc: 8 + 4 + ten.abilities.str.mod,
    });
  });

  it('Bard: College of Swords', () => {
    const sub = 'swords|bard|xphb|xge';
    const three = build('bard', 3, sub);
    expect(values(three.proficiencies.armor)).toContain('medium');
    expect(values(three.proficiencies.weapons)).toContain('scimitar|xphb');
    // The quick-builder picks Dueling: +2 damage with the one melee weapon held.
    const dueling = three.attacks
      .flatMap((a) => a.damageBonus.parts)
      .find((p) => p.label === 'Dueling');
    expect(dueling?.value).toBe(2);
    for (const name of ['Defensive Flourish', 'Slashing Flourish', 'Mobile Flourish']) {
      expect(act(three, name)).toMatchObject({ roll: '1d6' });
      expect(act(three, name)?.costs[0]?.label).toBe('1 Bardic Inspiration');
    }
    expect(act(build('bard', 5, sub), 'Mobile Flourish')?.roll).toBe('1d8');
    expect(build('bard', 6, sub).attacksPerAction.value).toBe(2);
    expect(act(build('bard', 14, sub), "Master's Flourish")?.roll).toBe('1d6');
  });

  it('Bard: College of Whispers', () => {
    const sub = 'whispers|bard|xphb|xge';
    const blades = (level: number) =>
      build('bard', level, sub).attacks[0]?.riders.find((r) => r.id === 'psychic-blades');
    expect(blades(3)?.dice).toBe('2d6');
    expect(blades(5)?.dice).toBe('3d6');
    expect(blades(10)?.dice).toBe('5d6');
    expect(blades(15)?.dice).toBe('8d6');
    const three = build('bard', 3, sub);
    expect(resource(three, 'Words of Terror')).toMatchObject({ recharge: 'short' });
    expect(act(three, 'Words of Terror')?.saveDc).toBe(8 + 2 + three.abilities.cha.mod);
    const six = build('bard', 6, sub);
    expect(act(six, 'Mantle of Whispers')?.actionType).toBe('reaction');
    expect(six.skills.deception.notes?.length).toBe(1);
    expect(resource(build('bard', 14, sub), 'Shadow Lore')).toMatchObject({ recharge: 'long' });
  });

  it('Bard: College of Creation', () => {
    const sub = 'creation|bard|xphb|tce';
    const three = build('bard', 3, sub);
    expect(resource(three, 'Performance of Creation')?.max.value).toBe(1);
    expect(resource(three, 'Performance of Creation')?.restoreWith).toHaveLength(1);
    expect(act(three, 'Mote of Potential')?.saveDc).toBe(8 + 2 + three.abilities.cha.mod);
    expect(act(build('bard', 6, sub), 'Animating Performance')?.actionType).toBe('action');
  });

  it('Bard: College of Eloquence', () => {
    const sub = 'eloquence|bard|xphb|tce';
    const three = build('bard', 3, sub);
    expect(three.skills.persuasion.floor).toBe(10);
    expect(three.skills.deception.floor).toBe(10);
    expect(act(three, 'Unsettling Words')).toMatchObject({ actionType: 'bonus', roll: '1d6' });
    expect(resource(build('bard', 6, sub), 'Universal Speech')?.max.value).toBe(1);
    const fourteen = build('bard', 14, sub);
    expect(resource(fourteen, 'Infectious Inspiration')?.max.value).toBe(
      Math.max(1, fourteen.abilities.cha.mod),
    );
    expect(act(fourteen, 'Infectious Inspiration')?.actionType).toBe('reaction');
  });
});
