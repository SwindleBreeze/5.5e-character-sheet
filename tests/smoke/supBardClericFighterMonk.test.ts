// Golden checks for the 2024 supplement bard, cleric, fighter and monk subclasses (plan §10.2,
// step 6.16): one build per subclass at a few levels, its numbers read the way the rules give
// them. Opt-in:
//   FIVETOOLS_DATA=./5etools-src npx vitest run --config vitest.smoke.config.ts tests/smoke/supBardClericFighterMonk.test.ts
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
import type { ContentEntity } from '../../src/schema/index.ts';
import { nodeFileSource } from './nodeFileSource.ts';

const root = process.env.FIVETOOLS_DATA;

describe.skipIf(!root)('supplement bard, cleric, fighter and monk golden checks', () => {
  let index: ContentIndex;
  let catalog: Catalog;

  beforeAll(async () => {
    const result = await importFivetools(nodeFileSource(root!), { now: 1 });
    const all = Object.values(result.entities).flat() as ContentEntity[];
    index = createContentIndex(all);
    catalog = createCatalog(all, new Set(['XPHB', 'EFA', 'FRHoF', 'RHW', 'AU', 'ABH', 'LFL']));
  });

  /** A human soldier of one class and supplement subclass, with these toggles switched on. */
  function build(cls: string, levels: number, subclassId: string, toggles: string[] = []) {
    const registry = featureEffects();
    let c = quickBuild(
      {
        name: 'Golden',
        speciesId: 'human|xphb',
        backgroundId: 'soldier|xphb',
        classes: [{ classId: `${cls}|xphb`, levels, subclassId }],
      },
      { index, catalog, registry, now: 1 },
    );
    let s = derive(c, index, { registry });
    for (const t of toggles) {
      c = toggle(c, s, t, true, { free: true });
      s = derive(c, index, { registry });
    }
    expect(s.choices.pending).toEqual([]);
    return s;
  }
  const resource = (s: DerivedSheet, name: string) => s.resources.find((r) => r.name === name);
  const act = (s: DerivedSheet, name: string) => s.actions.find((a) => a.name === name);
  const values = (list: { value: string }[]) => list.map((v) => v.value).sort();
  const proficientSkills = (s: DerivedSheet) =>
    Object.entries(s.skills)
      .filter(([, v]) => v.proficiency === 'proficient' || v.proficiency === 'expertise')
      .map(([k]) => k);

  it('Bard: College of the Moon and College of Spirits', () => {
    const moon = 'moon|bard|xphb|frhof';
    const three = build('bard', 3, moon);
    expect(act(three, 'Lunar Vitality')).toMatchObject({ roll: '1d6' });
    expect(act(three, 'Lunar Vitality')?.costs[0]?.label).toBe('1 Bardic Inspiration');
    expect(values(three.proficiencies.languages)).toContain('druidic');
    expect(act(build('bard', 11, moon), 'Lunar Vitality')?.roll).toBe('1d10');
    expect(act(build('bard', 14, moon), 'Lunar Vitality (Full Moon)')?.roll).toBe('1d6');

    const spirits = 'spirits|bard|xphb|rhw';
    const s3 = build('bard', 3, spirits);
    expect(values(s3.proficiencies.tools)).toContain('playing cards|xphb');
    expect(s3.spellcasting.casters[0]!.cantrips).toContain('guidance|xphb');
    expect(act(s3, 'Unleash Spirit')).toMatchObject({
      roll: `1d6 + ${s3.abilities.cha.mod}`,
      saveDc: 8 + 2 + s3.abilities.cha.mod,
    });
    const s6 = build('bard', 6, spirits);
    expect(resource(s6, 'Spiritual Manifestation')).toMatchObject({ recharge: 'short' });
    expect(resource(s6, 'Spiritual Manifestation')?.max.value).toBe(1);
  });

  it('Cleric: Knowledge, Grave and Arcana Domains', () => {
    const knowledge = 'knowledge|cleric|xphb|frhof';
    const k6 = build('cleric', 6, knowledge);
    expect(k6.senses.map((x) => x.value)).toContainEqual({ sense: 'telepathy', range: 60 });
    expect(k6.saves.int.proficiency).toBe('proficient');
    const experts = Object.entries(k6.skills).filter(([, v]) => v.proficiency === 'expertise');
    expect(experts).toHaveLength(2);
    for (const [skill] of experts)
      expect(['arcana', 'history', 'nature', 'religion']).toContain(skill);
    expect(act(k6, 'Mind Magic')?.costs[0]?.label).toBe('1 Channel Divinity');

    const k17 = build('cleric', 17, knowledge, ['divine-foreknowledge']);
    expect(resource(k17, 'Divine Foreknowledge')?.max.value).toBe(1);
    expect(resource(k17, 'Divine Foreknowledge')?.restoreWith).toEqual([
      { amount: '1', costs: ['a level 6+ spell slot'] },
    ]);
    expect(Object.values(k17.saves).every((r) => r.mode === 'advantage')).toBe(true);
    expect(k17.skills.perception.mode).toBe('advantage');

    const grave = 'grave|cleric|xphb|rhw';
    const g3 = build('cleric', 3, grave);
    const pull = (s: DerivedSheet) =>
      s.attacks[0]!.riders.find((r) => r.id === 'pull-of-death')?.dice;
    expect(pull(g3)).toBe('1d4');
    expect(act(g3, 'Path to the Grave')?.roll).toBe('3');
    const g11 = build('cleric', 11, grave);
    expect(pull(g11)).toBe('1d6');
    expect(resource(g11, "Sentinel at Death's Door")?.max.value).toBe(
      Math.max(1, g11.abilities.wis.mod),
    );
    const g17 = build('cleric', 17, grave);
    expect(act(g17, 'Keeper of Souls')?.roll).toBe('34');
    expect(resource(g17, 'Keeper of Souls')).toMatchObject({ recharge: 'short' });

    const arcana = 'arcana|cleric|xphb|au';
    const a3 = build('cleric', 3, arcana);
    expect(act(a3, 'Fortifying Spell')?.roll).toBe('2d8 + 3');
    expect(act(a3, 'Tenacious Spell')?.costs[0]?.label).toBe('1 Channel Divinity');
    const a6 = build('cleric', 6, arcana);
    expect(resource(a6, 'Dispelling Recovery')?.restoreWith).toEqual([
      { amount: '1', costs: ['1 Channel Divinity'] },
    ]);
    // Ten domain spells and Magical Mastery's four Wizard spells.
    expect(build('cleric', 17, arcana).spellcasting.casters[0]!.alwaysPrepared).toHaveLength(14);
  });

  it('Fighter: Banneret and Arcane Archer', () => {
    const banneret = 'banneret|fighter|xphb|frhof';
    const b3 = build('fighter', 3, banneret);
    expect(act(b3, 'Group Recovery')?.roll).toBe('1d4 + 3');
    expect(resource(b3, 'Group Recovery')).toMatchObject({ recharge: 'short' });
    const b18 = build('fighter', 18, banneret);
    expect(values(b18.defenses.conditionImmunities)).toEqual(['charmed', 'frightened']);
    expect(act(b18, 'Shared Resilience')).toMatchObject({ roll: '18', actionType: 'reaction' });
    expect(act(b18, 'Shared Resilience')?.costs[0]?.label).toBe('1 Indomitable');

    const archer = 'arcane archer|fighter|xphb|au';
    const die = (s: DerivedSheet) => resource(s, 'Arcane Shot')?.die;
    const a3 = build('fighter', 3, archer);
    expect(die(a3)).toBe('1d6');
    expect(resource(a3, 'Arcane Shot')?.max.value).toBe(Math.max(1, a3.abilities.int.mod));
    expect(act(a3, 'Arcane Shot')?.saveDc).toBe(8 + 2 + a3.abilities.int.mod);
    expect(proficientSkills(a3)).toEqual(expect.arrayContaining(['arcana', 'nature']));
    const a7 = build('fighter', 7, archer);
    expect(resource(a7, 'Magical Ammunition')?.restoreWith).toEqual([
      { amount: '1', costs: ['1 Second Wind'] },
    ]);
    expect(die(build('fighter', 10, archer))).toBe('1d8');
    expect(die(build('fighter', 15, archer))).toBe('1d10');
    expect(die(build('fighter', 18, archer))).toBe('1d12');
  });

  it('Monk: Warrior of the Mystic Arts', () => {
    const mystic = 'mystic arts|monk|xphb|au';
    const recover = (s: DerivedSheet) => s.actions.filter((a) => a.name.startsWith('Recover'));
    const three = build('monk', 3, mystic);
    expect(three.spellcasting.slots.map((x) => x.max)).toEqual([2]);
    expect(recover(three)).toEqual([]);

    const seven = build('monk', 7, mystic);
    expect(seven.spellcasting.slots.map((x) => x.max)).toEqual([4, 2]);
    expect(resource(seven, 'Focus Points')?.restoreWith).toEqual([
      { amount: '1', costs: ['a level 1+ spell slot'] },
      { amount: '2', costs: ['a level 2+ spell slot'] },
    ]);
    expect(recover(seven).map((a) => a.costs[0]?.amount)).toEqual([2, 3]);

    const twenty = build('monk', 20, mystic);
    expect(recover(twenty).map((a) => a.outcomes)).toEqual(
      [1, 2, 3, 4].map((maxLevel) => [{ regainSlot: { maxLevel } }]),
    );
    expect(recover(twenty).map((a) => a.costs[0]?.amount)).toEqual([2, 3, 5, 6]);
  });
});
