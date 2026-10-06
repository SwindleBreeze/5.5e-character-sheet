import { describe, expect, it } from 'vitest';
import {
  abilityEffects,
  defenseEffects,
  featEffects,
  progressionEffects,
  progressionLevels,
  proficiencyEffects,
  senseEffects,
  speedEffects,
  spellEffects,
} from './effectsFromData.ts';

describe('abilityEffects', () => {
  it('fixed bonuses and a choice in one set', () => {
    expect(
      abilityEffects({ ability: [{ cha: 2, choose: { from: ['str', 'dex'], count: 2 } }] }),
    ).toEqual([
      { type: 'abilityBonus', ability: 'cha', value: 2 },
      {
        type: 'abilityChoice',
        choice: { slot: 'ability', count: 2, from: ['str', 'dex'] },
        value: 1,
      },
    ]);
  });

  it('several sets become alternatives behind an option choice', () => {
    const effects = abilityEffects({
      ability: [
        { choose: { from: ['str', 'dex'], amount: 2 } },
        { choose: { from: ['str', 'dex'], count: 2 } },
      ],
    });
    expect(effects).toEqual([
      {
        type: 'optionChoice',
        choice: { slot: 'abilitySet', count: 1, from: ['0', '1'] },
        labels: ['+2 to one score', '+1 to 2 scores'],
      },
      {
        type: 'ifChoice',
        slot: 'abilitySet',
        value: '0',
        effects: [
          {
            type: 'abilityChoice',
            choice: { slot: 'ability.0', count: 1, from: ['str', 'dex'] },
            value: 2,
          },
        ],
      },
      {
        type: 'ifChoice',
        slot: 'abilitySet',
        value: '1',
        effects: [
          {
            type: 'abilityChoice',
            choice: { slot: 'ability.1', count: 2, from: ['str', 'dex'] },
            value: 1,
          },
        ],
      },
    ]);
  });

  it('keeps a max and skips weighted background choices', () => {
    expect(abilityEffects({ ability: [{ choose: { from: ['con'] }, max: 30 }] })).toEqual([
      {
        type: 'abilityChoice',
        choice: { slot: 'ability', count: 1, from: ['con'] },
        value: 1,
        max: 30,
      },
    ]);
    expect(
      abilityEffects({ ability: [{ choose: { weighted: { from: ['str'], weights: [2, 1] } } }] }),
    ).toEqual([]);
  });
});

describe('proficiencyEffects', () => {
  it('fixed, chosen and "any" proficiencies with numbered slots', () => {
    expect(
      proficiencyEffects({
        skillProficiencies: [{ history: true, choose: { from: ['arcana', 'nature'] } }],
        languageProficiencies: [{ common: true, anyStandard: 2 }],
        toolProficiencies: [{ anyArtisansTool: 1, anyMusicalInstrument: 1 }],
        weaponProficiencies: [{ 'net blade|tst': true }],
      }),
    ).toEqual([
      { type: 'proficiency', category: 'skill', value: 'history' },
      {
        type: 'proficiencyChoice',
        category: 'skill',
        choice: { slot: 'skills', count: 1, from: ['arcana', 'nature'] },
      },
      {
        type: 'proficiencyChoice',
        category: 'tool',
        choice: { slot: 'tools', count: 1, from: 'any' },
        filter: 'artisan',
      },
      {
        type: 'proficiencyChoice',
        category: 'tool',
        choice: { slot: 'tools.1', count: 1, from: 'any' },
        filter: 'instrument',
      },
      { type: 'proficiency', category: 'language', value: 'common' },
      {
        type: 'proficiencyChoice',
        category: 'language',
        choice: { slot: 'languages', count: 2, from: 'any' },
        filter: 'standard',
      },
      { type: 'proficiency', category: 'weapon', value: 'net blade|tst' },
    ]);
  });

  it('mixed skill-or-tool picks list both categories', () => {
    expect(
      proficiencyEffects({
        skillToolLanguageProficiencies: [{ choose: [{ from: ['anySkill', 'anyTool'], count: 3 }] }],
      }),
    ).toEqual([
      {
        type: 'proficiencyChoice',
        category: ['skill', 'tool'],
        choice: { slot: 'skillsToolsLanguages', count: 3, from: 'any' },
      },
    ]);
  });

  it('expertise in a proficient skill', () => {
    expect(proficiencyEffects({ expertise: [{ anyProficientSkill: 1 }] })).toEqual([
      {
        type: 'expertiseChoice',
        choice: { slot: 'expertise', count: 1, from: 'any' },
        filter: 'proficient',
      },
    ]);
  });
});

describe('defenses, senses, speed and feats', () => {
  it('resistances, choices and conditional notes', () => {
    expect(
      defenseEffects({
        resist: ['fire', { choose: { from: ['cold', 'acid'] } }],
        conditionImmune: ['poisoned'],
        immune: [{ immune: ['psychic'], cond: true }],
      }),
    ).toEqual([
      { type: 'resistance', value: 'fire' },
      {
        type: 'resistanceChoice',
        choice: { slot: 'resistance', count: 1, from: ['cold', 'acid'] },
      },
      { type: 'note', text: 'immunity: psychic (conditional)' },
      { type: 'conditionImmunity', value: 'poisoned' },
    ]);
  });

  it('senses from fields and lists', () => {
    expect(senseEffects({ darkvision: 60, senses: [{ blindsight: 10 }] })).toEqual([
      { type: 'sense', sense: 'darkvision', range: 60 },
      { type: 'sense', sense: 'blindsight', range: 10 },
    ]);
  });

  it('speeds, with `true` meaning equal to walking speed', () => {
    expect(speedEffects({ speed: { walk: 30, fly: true, swim: 20 } })).toEqual([
      { type: 'speed', mode: 'walk', value: 30 },
      { type: 'speed', mode: 'swim', value: 20 },
      { type: 'speed', mode: 'fly', value: 'walk' },
    ]);
    expect(speedEffects({ speed: 25 })).toEqual([{ type: 'speed', mode: 'walk', value: 25 }]);
  });

  it('granted and chosen feats', () => {
    expect(
      featEffects({
        feats: [{ 'spark initiate|tst': true }, { anyFromCategory: { category: ['O'] } }],
      }),
    ).toEqual([
      { type: 'grantFeat', feat: { kind: 'feat', id: 'spark initiate|tst' } },
      { type: 'featChoice', slot: 'feat', categories: ['origin'], count: 1 },
    ]);
  });
});

describe('spellEffects', () => {
  it('fixed, chosen, limited-use and expanded spells with stable slots', () => {
    const [effect] = spellEffects({
      additionalSpells: [
        {
          ability: 'wis',
          known: { _: ['glow|tst#c', { choose: 'level=0|class=Gladiator', count: 2 }] },
          innate: { 3: { daily: { '1e': ['dim|tst', 'dark|tst'] } }, 5: { will: ['shine|tst'] } },
          expanded: { s2: [{ all: 'level=2|school=V' }] },
        },
      ],
    });
    expect(effect).toEqual({
      type: 'grantSpells',
      spells: [
        { mode: 'known', ability: 'wis', spell: { id: 'glow|tst' } },
        {
          mode: 'known',
          ability: 'wis',
          spell: { choose: 'level=0|class=Gladiator', count: 2, slot: 'spells.0.known.0' },
        },
        {
          mode: 'innate',
          atLevel: 3,
          ability: 'wis',
          uses: { count: 1, recharge: 'long' },
          spell: { id: 'dim|tst' },
        },
        {
          mode: 'innate',
          atLevel: 3,
          ability: 'wis',
          uses: { count: 1, recharge: 'long' },
          spell: { id: 'dark|tst' },
        },
        { mode: 'innate', atLevel: 5, ability: 'wis', uses: 'atWill', spell: { id: 'shine|tst' } },
        { mode: 'expanded', atSpellLevel: 2, ability: 'wis', spell: { all: 'level=2|school=V' } },
      ],
    });
  });

  it('several blocks are alternatives, each with its own slots', () => {
    const effects = spellEffects({
      additionalSpells: [
        { name: 'A', ability: { choose: ['int', 'wis'] }, known: { _: [{ choose: 'level=0' }] } },
        { name: 'B', known: { _: [{ choose: { from: ['x|tst', 'y|tst'], count: 1 } }] } },
      ],
    });
    expect(effects[0]).toEqual({
      type: 'optionChoice',
      choice: { slot: 'spellsSet', count: 1, from: ['0', '1'] },
      labels: ['A', 'B'],
    });
    expect(effects[1]).toEqual({
      type: 'ifChoice',
      slot: 'spellsSet',
      value: '0',
      effects: [
        {
          type: 'grantSpells',
          spells: [
            {
              mode: 'known',
              ability: { slot: 'spells.0.ability', from: ['int', 'wis'] },
              spell: { choose: 'level=0', count: 1, slot: 'spells.0.known.0' },
            },
          ],
        },
      ],
    });
    expect(effects[2]).toMatchObject({
      effects: [
        { spells: [{ spell: { from: ['x|tst', 'y|tst'], count: 1, slot: 'spells.1.known.0' } }] },
      ],
    });
  });

  it('reads one-off, ability-based, PB and shared uses, and cast levels', () => {
    const effects = spellEffects({
      name: 'Gift',
      additionalSpells: [
        {
          innate: {
            _: {
              limited: { '2e': ['spark|tst#4'] },
              daily: { int: ['glow|tst'], pb: ['dim|tst'] },
              rest: { 1: ['dark|tst', 'shine|tst'] },
            },
          },
        },
      ],
    });
    expect(effects).toEqual([
      // "Cast one of these once per Short Rest": one counter the two spells share.
      {
        type: 'resource',
        resourceId: 'spells.0.innate._.rest.1',
        name: 'Gift',
        max: 1,
        recharge: 'short',
      },
      {
        type: 'grantSpells',
        spells: [
          {
            mode: 'innate',
            uses: { count: 2, recharge: 'none' },
            spell: { id: 'spark|tst' },
            castAtLevel: 4,
          },
          {
            mode: 'innate',
            uses: { count: 'max(1,mod.int)', recharge: 'long' },
            spell: { id: 'glow|tst' },
          },
          { mode: 'innate', uses: { count: 'pb', recharge: 'long' }, spell: { id: 'dim|tst' } },
          {
            mode: 'innate',
            uses: { resource: 'spells.0.innate._.rest.1', cost: 1 },
            spell: { id: 'dark|tst' },
          },
          {
            mode: 'innate',
            uses: { resource: 'spells.0.innate._.rest.1', cost: 1 },
            spell: { id: 'shine|tst' },
          },
        ],
      },
    ]);
  });

  it('casts paid from a named resource keep their cost', () => {
    const [effect] = spellEffects({
      additionalSpells: [
        { innate: { 3: { resource: { 2: ['dim|tst'] } } }, resourceName: 'Focus Point' },
      ],
    });
    expect(effect).toEqual({
      type: 'grantSpells',
      spells: [
        {
          mode: 'innate',
          atLevel: 3,
          uses: { resourceName: 'Focus Point', cost: 2 },
          spell: { id: 'dim|tst' },
        },
      ],
    });
  });
});

describe('progressions', () => {
  it('reads object and array forms as running totals', () => {
    expect(progressionLevels({ 2: 2, 10: 4 })).toEqual({ 2: 2, 10: 4 });
    expect(progressionLevels([0, 2, 2, 3])).toEqual({ 2: 2, 4: 3 });
    expect(progressionLevels({ '*': 1 })).toEqual({ 0: 1 });
  });

  it('one choice per increase, gated by level', () => {
    expect(
      progressionEffects(
        [{ key: 'epic-boon', name: 'Epic Boon', categories: ['epicBoon'], atLevels: { 19: 1 } }],
        [
          { key: 'tricks', name: 'Tricks', featureTypes: ['CT'], atLevels: { 2: 2, 5: 3 } },
          { key: 'any', name: 'Any', featureTypes: ['X'], atLevels: { 0: 1 } },
        ],
      ),
    ).toEqual([
      {
        type: 'atLevel',
        level: 19,
        effects: [
          {
            type: 'featChoice',
            slot: 'featProgression.epic-boon.19',
            categories: ['epicBoon'],
            count: 1,
          },
        ],
      },
      {
        type: 'atLevel',
        level: 2,
        effects: [
          {
            type: 'optionalFeatureChoice',
            slot: 'optfeat.tricks.2',
            featureTypes: ['CT'],
            count: 2,
          },
        ],
      },
      {
        type: 'atLevel',
        level: 5,
        effects: [
          {
            type: 'optionalFeatureChoice',
            slot: 'optfeat.tricks.5',
            featureTypes: ['CT'],
            count: 1,
          },
        ],
      },
      { type: 'optionalFeatureChoice', slot: 'optfeat.any', featureTypes: ['X'], count: 1 },
    ]);
  });
});
