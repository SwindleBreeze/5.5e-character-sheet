import { beforeAll, describe, expect, it } from 'vitest';
import type { ClassDef, Prereqs } from '../schema/index.ts';
import { testCharacter } from '../test/characters.ts';
import { fixtureIndex } from '../test/fixtureIndex.ts';
import { FIXTURE_FEATURE_EFFECTS } from '../test/fixtureFeatureEffects.ts';
import type { ContentIndex } from './content/contentIndex.ts';
import { derive } from './derive/derive.ts';
import { checkPrereqs, multiclassPrereqs, prereqContext, type PrereqContext } from './prereq.ts';

let index: ContentIndex;
beforeAll(async () => {
  index = await fixtureIndex();
});

function ctx(over: Partial<PrereqContext> = {}): PrereqContext {
  return {
    charLevel: 4,
    classLevels: new Map([['warlock', 3]]),
    scores: { str: 13, dex: 10, con: 10, int: 10, wis: 10, cha: 12 },
    proficiencies: { armor: new Set(['light']), skill: new Set(['stealth']) },
    spellcasting: true,
    has: new Set(['optionalFeature:pact of the blade|xphb', 'feat:alert|xphb']),
    featureNames: new Set(['fighting style']),
    ...over,
  };
}

describe('checkPrereqs (P13)', () => {
  it('no prerequisites are met', () => {
    expect(checkPrereqs([], ctx())).toEqual({ met: true, unmet: [], unknown: [] });
  });

  it('level: character level, or the level of a class from any source', () => {
    expect(checkPrereqs([[{ type: 'level', level: 4 }]], ctx()).met).toBe(true);
    expect(checkPrereqs([[{ type: 'level', level: 5 }]], ctx())).toEqual({
      met: false,
      unmet: ['Level 5+'],
      unknown: [],
    });
    const warlock = (level: number): Prereqs => [
      [{ type: 'level', level, classId: 'warlock|xphb' }],
    ];
    expect(checkPrereqs(warlock(3), ctx()).met).toBe(true);
    expect(checkPrereqs(warlock(5), ctx()).unmet).toEqual(['Level 5 Warlock']);
    expect(checkPrereqs(warlock(1), ctx({ classLevels: new Map() })).met).toBe(false);
  });

  it('ability: any one of the alternatives, each with all of its scores', () => {
    const strOrDex: Prereqs = [[{ type: 'ability', anyOf: [{ str: 13 }, { dex: 13 }] }]];
    expect(checkPrereqs(strOrDex, ctx()).met).toBe(true);
    const both: Prereqs = [[{ type: 'ability', anyOf: [{ str: 13, cha: 13 }] }]];
    expect(checkPrereqs(both, ctx())).toMatchObject({
      met: false,
      unmet: ['Strength 13+ and Charisma 13+'],
    });
  });

  it('proficiency, spellcasting, features and feats', () => {
    const armor = (value: string): Prereqs => [[{ type: 'proficiency', category: 'armor', value }]];
    expect(checkPrereqs(armor('light'), ctx()).met).toBe(true);
    expect(checkPrereqs(armor('medium'), ctx()).unmet).toEqual(['Medium armor proficiency']);
    expect(checkPrereqs([[{ type: 'spellcasting' }]], ctx({ spellcasting: false })).met).toBe(
      false,
    );
    const blade = { kind: 'optionalFeature', id: 'pact of the blade|xphb' } as const;
    expect(checkPrereqs([[{ type: 'feature', ref: blade }]], ctx()).met).toBe(true);
    const without = ctx({ has: new Set(), nameOf: () => 'Pact of the Blade' });
    expect(checkPrereqs([[{ type: 'feature', ref: blade }]], without)).toEqual({
      met: false,
      unmet: ['Pact of the Blade'],
      unknown: [],
    });
    expect(
      checkPrereqs([[{ type: 'feat', ref: { kind: 'feat', id: 'alert|xphb' } }]], ctx()).met,
    ).toBe(true);
  });

  it('a named feature is checked; other text is unknown, shown and never blocking', () => {
    const style: Prereqs = [[{ type: 'other', text: 'Feature: Fighting Style' }]];
    expect(checkPrereqs(style, ctx()).met).toBe(true);
    expect(checkPrereqs(style, ctx({ featureNames: new Set() })).met).toBe(false);
    expect(checkPrereqs([[{ type: 'other', text: 'Special' }]], ctx())).toEqual({
      met: true,
      unmet: [],
      unknown: ['Special'],
    });
  });

  it('alternatives: met when any is; otherwise the closest one is reported', () => {
    const prereqs: Prereqs = [
      [
        { type: 'level', level: 8 },
        { type: 'spellcasting' },
        { type: 'ability', anyOf: [{ int: 13 }] },
      ],
      [{ type: 'level', level: 6 }],
    ];
    expect(checkPrereqs(prereqs, ctx())).toEqual({
      met: false,
      unmet: ['Level 6+'],
      unknown: [],
    });
    expect(checkPrereqs(prereqs, ctx({ charLevel: 6 })).met).toBe(true);
  });

  it('reads a derived sheet: levels, scores, armor and progression names', () => {
    const c = testCharacter({
      classes: [{ classId: 'gladiator|tst', levels: 3 }],
      scores: { str: 14, cha: 12 },
    });
    const sheet = derive(c, index, { registry: FIXTURE_FEATURE_EFFECTS });
    const context = prereqContext(sheet, index);
    expect(context.classLevels.get('gladiator')).toBe(3);
    expect(context.proficiencies.armor?.has('light')).toBe(true);
    expect(context.spellcasting).toBe(true);
    // The fixture feats: Arena Veteran (level 4, STR or CHA 13), Net Style (Arena Style).
    const veteran = index.get({ kind: 'feat', id: 'arena veteran|tst' })!;
    expect(checkPrereqs(veteran.prerequisites, context)).toEqual({
      met: false,
      unmet: ['Level 4+'],
      unknown: [],
    });
    const net = index.get({ kind: 'feat', id: 'net style|tst' })!;
    expect(checkPrereqs(net.prerequisites, context).met).toBe(true);
    const encore = index.get({ kind: 'optionalFeature', id: 'encore|tst' })!;
    expect(checkPrereqs(encore.prerequisites, context).met).toBe(true);
    expect(
      checkPrereqs(encore.prerequisites, { ...context, classLevels: new Map([['gladiator', 2]]) })
        .unmet,
    ).toEqual(['Level 3 Gladiator']);
  });

  it('multiclassing: 13 in the primary abilities, as alternatives', () => {
    const fighter = {
      multiclass: { prereq: [['str'], ['dex']] },
      primaryAbility: [['str'], ['dex']],
    } as unknown as ClassDef;
    const paladin = {
      multiclass: { prereq: [['str', 'cha']] },
      primaryAbility: [['str', 'cha']],
    } as unknown as ClassDef;
    expect(multiclassPrereqs(fighter)).toEqual([
      [{ type: 'ability', anyOf: [{ str: 13 }, { dex: 13 }] }],
    ]);
    expect(checkPrereqs(multiclassPrereqs(fighter), ctx()).met).toBe(true);
    expect(checkPrereqs(multiclassPrereqs(paladin), ctx()).unmet).toEqual([
      'Strength 13+ and Charisma 13+',
    ]);
  });
});
