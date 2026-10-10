// Golden checks for the 2014 Cleric on 2014 rules (plan step 8.6): one build per domain at a
// level or two, with every book on and the 2014 originals preferred, its numbers read the way the
// mapping gives them. Opt-in:
//   FIVETOOLS_DATA=./5etools-src npx vitest run --config vitest.smoke.config.ts tests/smoke/rules2014Cleric.test.ts
// Checks numbers and names only; it never prints or stores content.

import { beforeAll, describe, expect, it } from 'vitest';
import { importFivetools } from '../../src/adapters/fivetools/index.ts';
import { setChoice } from '../../src/engine/build/build.ts';
import { createCatalog, type Catalog } from '../../src/engine/build/catalog.ts';
import { quickBuild } from '../../src/engine/build/quickBuild.ts';
import { createContentIndex, type ContentIndex } from '../../src/engine/content/contentIndex.ts';
import { derive } from '../../src/engine/derive/derive.ts';
import type { DerivedSheet } from '../../src/engine/derive/types.ts';
import { featureEffects } from '../../src/engine/featureEffects/index.ts';
import type { Character, ContentEntity } from '../../src/schema/index.ts';
import { PREFER_2014, SHOW_2014 } from '../../src/sources/sourceFilter.ts';
import { nodeFileSource } from './nodeFileSource.ts';

const root = process.env.FIVETOOLS_DATA;

describe.skipIf(!root)('the 2014 Cleric on 2014 rules (local data)', () => {
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

  const sheetOf = (c: Character) => derive(c, index, { registry });
  /** A half-orc soldier cleric of one domain (`name|source`) on 2014 rules. */
  function character(levels: number, sub: string): Character {
    return quickBuild(
      {
        name: 'Golden',
        speciesId: 'half-orc|phb',
        backgroundId: 'soldier|phb',
        classes: [{ classId: 'cleric|phb', levels, subclassId: sub.replace('|', '|cleric|phb|') }],
        ruleset: '2014',
      },
      { index, catalog, registry, now: 1 },
    );
  }
  /** The same cleric with Wisdom 16 (+3), so its Wisdom numbers show. */
  function wise(levels: number, sub: string): Character {
    const c = character(levels, sub);
    return { ...c, baseScores: { ...c.baseScores, wis: 16 } };
  }
  function build(levels: number, sub: string): DerivedSheet {
    const s = sheetOf(wise(levels, sub));
    expect(s.choices.pending).toEqual([]);
    return s;
  }
  const resource = (s: DerivedSheet, name: string) => s.resources.find((r) => r.name === name);
  const act = (s: DerivedSheet, name: string) => s.actions.find((a) => a.name === name);
  const cost = (s: DerivedSheet, name: string) => act(s, name)?.costs.map((c) => c.label);
  const rider = (s: DerivedSheet, id: string) =>
    s.attacks.flatMap((a) => a.riders).find((r) => r.id === id);
  const values = (list: { value: string }[]) => list.map((v) => v.value).sort();
  const proficient = (s: DerivedSheet) =>
    Object.entries(s.skills)
      .filter(([, v]) => v.proficiency === 'proficient' || v.proficiency === 'expertise')
      .map(([k]) => k);
  /** A cantrip row's damage bonus from Potent Spellcasting. */
  const potent = (s: DerivedSheet) =>
    s.attacks
      .filter((a) => a.kind === 'spell')
      .flatMap((a) => a.damageBonus.parts)
      .find((p) => p.label === 'Potent Spellcasting')?.value;
  const CD = '1 Channel Divinity';

  it('Channel Divinity: 1, 2 and 3 uses at 2, 6 and 18, back on a Short Rest', () => {
    expect(resource(build(1, 'life|phb'), 'Channel Divinity')).toBeUndefined();
    for (const [level, max] of [
      [2, 1],
      [5, 1],
      [6, 2],
      [17, 2],
      [18, 3],
    ] as const) {
      const s = build(level, 'life|phb');
      expect(resource(s, 'Channel Divinity'), `${level}`).toMatchObject({ recharge: 'short' });
      expect(resource(s, 'Channel Divinity')?.max.value, `${level}`).toBe(max);
      expect(resource(s, 'Harness Divine Power')?.max.value, `${level}`).toBe(max);
    }
    const s2 = build(2, 'life|phb');
    // Turn Undead: a Wisdom save against the spell save DC (8 + 2 + 3).
    expect(act(s2, 'Turn Undead')).toMatchObject({ actionType: 'action', saveDc: 13 });
    expect(cost(s2, 'Turn Undead')).toEqual([CD]);
    expect(act(s2, 'Harness Divine Power')?.actionType).toBe('bonus');
    expect(cost(s2, 'Harness Divine Power')).toEqual([CD, '1 Harness Divine Power']);
    expect(resource(s2, 'Harness Divine Power')).toMatchObject({ recharge: 'long' });
  });

  it('Divine Intervention at 10', () => {
    expect(act(build(9, 'life|phb'), 'Divine Intervention')).toBeUndefined();
    const s = build(10, 'life|phb');
    expect(resource(s, 'Divine Intervention')).toMatchObject({ recharge: 'long' });
    expect(resource(s, 'Divine Intervention')?.max.value).toBe(1);
    expect(act(s, 'Divine Intervention')).toMatchObject({ actionType: 'action', roll: '1d100' });
  });

  it('Life: heavy armor, Preserve Life, Divine Strike', () => {
    const s2 = build(2, 'life|phb');
    expect(values(s2.proficiencies.armor)).toContain('heavy');
    expect(act(s2, 'Preserve Life')?.roll).toBe('10');
    expect(cost(s2, 'Preserve Life')).toEqual([CD]);
    expect(rider(build(7, 'life|phb'), 'divine-strike')).toBeUndefined();
    expect(rider(build(8, 'life|phb'), 'divine-strike')).toMatchObject({
      dice: '1d8',
      damageType: 'radiant',
    });
    expect(rider(build(14, 'life|phb'), 'divine-strike')?.dice).toBe('2d8');
  });

  it('Blessed Strikes (Tasha’s) replaces Divine Strike or Potent Spellcasting when picked', () => {
    for (const [sub, own] of [
      ['war|phb', 'divine strike'],
      ['light|phb', 'potent spellcasting'],
    ] as const) {
      let c = wise(8, sub);
      let s = sheetOf(c);
      const pick = s.features
        .flatMap((f) => f.choices)
        .find((x) => x.offer.key.slot === 'blessed-strikes');
      expect(pick?.values, sub).toEqual(['domain']);
      if (own === 'divine strike') expect(rider(s, 'divine-strike'), sub).toBeDefined();
      else expect(potent(s), sub).toBe(3);
      expect(rider(s, 'blessed-strikes'), sub).toBeUndefined();

      c = setChoice(c, pick!.offer.key, ['blessed'], { labels: ['Blessed Strikes'] });
      s = sheetOf(c);
      expect(s.choices.pending, sub).toEqual([]);
      expect(rider(s, 'divine-strike'), sub).toBeUndefined();
      expect(potent(s), sub).toBeUndefined();
      expect(rider(s, 'blessed-strikes'), sub).toMatchObject({
        dice: '1d8',
        damageType: 'radiant',
      });
    }
  });

  it('Light: Warding Flare, Radiance of the Dawn, Potent Spellcasting, Corona of Light', () => {
    const s2 = build(2, 'light|phb');
    expect(resource(s2, 'Warding Flare')).toMatchObject({ recharge: 'long' });
    expect(resource(s2, 'Warding Flare')?.max.value).toBe(3);
    expect(act(s2, 'Warding Flare')?.actionType).toBe('reaction');
    expect(act(s2, 'Radiance of the Dawn')).toMatchObject({ roll: '2d10 + 2', saveDc: 13 });
    expect(cost(s2, 'Radiance of the Dawn')).toEqual([CD]);
    expect(potent(s2)).toBeUndefined();
    expect(potent(build(8, 'light|phb'))).toBe(3);
    expect(act(build(17, 'light|phb'), 'Corona of Light')?.actionType).toBe('action');
  });

  it('Trickery and War', () => {
    const t6 = build(6, 'trickery|phb');
    expect(act(t6, 'Blessing of the Trickster')?.actionType).toBe('action');
    expect(act(t6, 'Invoke Duplicity')?.actionType).toBe('action');
    expect(cost(t6, 'Invoke Duplicity')).toEqual([CD]);
    expect(cost(t6, 'Cloak of Shadows')).toEqual([CD]);
    expect(rider(build(8, 'trickery|phb'), 'divine-strike')?.damageType).toBe('poison');

    const w6 = build(6, 'war|phb');
    expect(values(w6.proficiencies.weapons)).toContain('martial');
    expect(values(w6.proficiencies.armor)).toContain('heavy');
    expect(resource(w6, 'War Priest')).toMatchObject({ recharge: 'long' });
    expect(resource(w6, 'War Priest')?.max.value).toBe(3);
    expect(act(w6, 'War Priest')?.actionType).toBe('bonus');
    expect(cost(w6, 'Guided Strike')).toEqual([CD]);
    expect(act(w6, "War God's Blessing")?.actionType).toBe('reaction');
    expect(cost(w6, "War God's Blessing")).toEqual([CD]);
    const w8 = build(8, 'war|phb');
    expect(rider(w8, 'divine-strike')?.dice).toBe('1d8');
    expect(rider(w8, 'divine-strike')?.damageType).toBeUndefined();
  });

  it('Arcana and Grave', () => {
    const a2 = build(2, 'arcana|scag');
    expect(proficient(a2)).toContain('arcana');
    expect(act(a2, 'Arcane Abjuration')).toMatchObject({ actionType: 'action', saveDc: 13 });
    expect(cost(a2, 'Arcane Abjuration')).toEqual([CD]);

    const g6 = build(6, 'grave|xge');
    expect(resource(g6, 'Eyes of the Grave')?.max.value).toBe(3);
    expect(act(g6, 'Eyes of the Grave')?.actionType).toBe('action');
    expect(cost(g6, 'Path to the Grave')).toEqual([CD]);
    expect(resource(g6, "Sentinel at Death's Door")?.max.value).toBe(3);
    expect(act(g6, "Sentinel at Death's Door")?.actionType).toBe('reaction');
    expect(potent(build(8, 'grave|xge'))).toBe(3);
  });

  it('the other domains: their Channel Divinity at 2 and Divine Strike at 8', () => {
    for (const [sub, name, type] of [
      ['nature|phb', 'Charm Animals and Plants', undefined],
      ['tempest|phb', 'Destructive Wrath', 'thunder'],
      ['death|dmg', undefined, 'necrotic'],
      ['solidarity (psa)|psa', 'Preserve Life', undefined],
      ['strength (psa)|psa', 'Feat of Strength', undefined],
      ['zeal (psa)|psa', 'Consuming Fervor', undefined],
      ['forge|xge', "Artisan's Blessing", 'fire'],
      ['order|tce', "Order's Demand", 'psychic'],
      ['twilight|tce', 'Twilight Sanctuary', 'radiant'],
    ] as const) {
      const s2 = build(2, sub);
      if (name) expect(cost(s2, name), sub).toEqual([CD]);
      const s8 = build(8, sub);
      expect(rider(s8, 'divine-strike')?.dice, sub).toBe('1d8');
      expect(rider(s8, 'divine-strike')?.damageType, sub).toBe(type);
    }
    // Touch of Death: 5 + twice the cleric level, on a melee hit.
    expect(rider(build(2, 'death|dmg'), 'touch-of-death')?.dice).toBe('9');
    for (const sub of ['knowledge|phb', 'knowledge (psa)|psa', 'ambition (psa)|psa', 'peace|tce'])
      expect(potent(build(8, sub)), sub).toBe(3);
    expect(cost(build(2, 'knowledge|phb'), 'Knowledge of the Ages')).toEqual([CD]);
    expect(cost(build(2, 'ambition (psa)|psa'), 'Invoke Duplicity')).toEqual([CD]);
    expect(act(build(2, 'peace|tce'), 'Balm of Peace')?.roll).toBe('2d6 + 3');
  });
});
