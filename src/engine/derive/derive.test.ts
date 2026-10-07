import { beforeAll, describe, expect, it } from 'vitest';
import type { Character } from '../../schema/index.ts';
import { testCharacter, type TestChoice } from '../../test/characters.ts';
import { fixtureIndex } from '../../test/fixtureIndex.ts';
import { FIXTURE_FEATURE_EFFECTS } from '../../test/fixtureFeatureEffects.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import { derive } from './derive.ts';
import type { DerivedSheet } from './types.ts';

let index: ContentIndex;

beforeAll(async () => {
  index = await fixtureIndex();
});

const run = (c: Character): DerivedSheet => derive(c, index, { registry: FIXTURE_FEATURE_EFFECTS });

const item = (id: string) => ({ kind: 'item', id }) as const;
const species = { kind: 'species', id: 'mossling|tst' } as const;
const background = { kind: 'background', id: 'arena hand|tst' } as const;

/** Brute 5 (Path of the Spark), Mossling, Arena Hand; Arena Veteran at level 4. */
function brute(extra: TestChoice[] = []): Character {
  return testCharacter({
    classes: [{ classId: 'brute|tst', levels: 5, subclassId: 'spark|brute|tst|tst' }],
    speciesId: 'mossling|tst',
    backgroundId: 'arena hand|tst',
    scores: { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 },
    choices: [
      { owner: background, slot: 'ability', values: ['str', 'str', 'con'] },
      {
        owner: { kind: 'class', id: 'brute|tst' },
        slot: 'skills',
        values: ['athletics', 'perception'],
      },
      { owner: species, slot: 'size', values: ['M'] },
      { owner: species, slot: 'spellsSet', values: ['1'] },
      {
        owner: { kind: 'classFeature', id: 'ability score improvement|brute|tst|4|tst' },
        slot: 'feat',
        values: ['arena veteran|tst'],
        valueKinds: ['feat'],
        atLevel: 4,
      },
      {
        owner: { kind: 'feat', id: 'arena veteran|tst' },
        slot: 'ability',
        values: ['str'],
        atLevel: 4,
      },
      {
        owner: { kind: 'feat', id: 'arena veteran|tst' },
        slot: 'skills',
        values: ['performance'],
        atLevel: 4,
      },
      ...extra,
    ],
    inventory: [
      { itemRef: item('buckler|tst'), equipped: 'shield' },
      { itemRef: item('net blade|tst'), equipped: 'mainHand' },
    ],
  });
}

describe('derive: abilities and rolls', () => {
  it('scores: base, background, feat picks', () => {
    const d = run(brute());
    expect(d.abilities.str.score.value).toBe(18);
    expect(d.abilities.str.score.parts.map((p) => [p.label, p.value])).toEqual([
      ['Base score', 15],
      ['Arena Hand', 1],
      ['Arena Hand', 1],
      ['Arena Veteran', 1],
    ]);
    expect(Object.fromEntries(Object.entries(d.abilities).map(([a, v]) => [a, v.mod]))).toEqual({
      str: 4,
      dex: 1,
      con: 2,
      int: -1,
      wis: 1,
      cha: 0,
    });
  });

  it('caps increases at 20 and checks the background pattern', () => {
    const c = brute();
    c.baseScores.str = 19;
    const d = run(c);
    expect(d.abilities.str.score.value).toBe(20);
    expect(d.abilities.str.score.parts.map((p) => [p.label, p.value])).toEqual([
      ['Base score', 19],
      ['Arena Hand', 1],
      ['Arena Hand (max 20)', 0],
      ['Arena Veteran (max 20)', 0],
    ]);
    expect(d.issues.map((i) => i.code)).not.toContain('backgroundAbility');

    const bad = brute();
    bad.log[0]!.choices[0]!.values = ['str', 'str', 'str'];
    expect(run(bad).issues.map((i) => i.code)).toContain('backgroundAbility');
  });

  it('proficiency bonus, saves, skills, passives and initiative', () => {
    const d = run(brute());
    expect(d.pb.value).toBe(3);
    expect(d.saves.str.bonus.value).toBe(7);
    expect(d.saves.str.proficiency).toBe('proficient');
    expect(d.saves.con.bonus.value).toBe(5);
    expect(d.saves.dex).toMatchObject({ proficiency: 'none', bonus: { value: 1 } });
    expect(d.skills.athletics.bonus.value).toBe(7);
    expect(d.skills.perception.bonus.value).toBe(4);
    expect(d.skills.performance.bonus.value).toBe(3);
    expect(d.skills.stealth).toMatchObject({ proficiency: 'none', bonus: { value: 1 } });
    expect(d.passives.perception.value).toBe(14);
    expect(d.initiative.bonus.value).toBe(1);
    expect(d.concentration.bonus.value).toBe(5);
    expect(d.deathSave.bonus.value).toBe(0);
  });

  it('roll modifiers from an active toggle: advantage on Strength checks and saves', () => {
    const c = brute();
    c.state.activeToggles.fury = {};
    const d = run(c);
    expect(d.saves.str).toMatchObject({ mode: 'advantage', advantage: ['Fury'] });
    expect(d.skills.athletics.mode).toBe('advantage');
    expect(d.checks.str.mode).toBe('advantage');
    expect(d.skills.stealth.mode).toBe('normal');
    // Passive scores get +5 for advantage.
    expect(d.passives.perception.value).toBe(14);
    expect(d.skills.athletics.passive.value).toBe(22);
  });

  it('exhaustion: −2 per level on d20 tests, −5 ft per level of speed', () => {
    const c = brute();
    c.state.exhaustion = 2;
    const d = run(c);
    expect(d.saves.str.bonus.value).toBe(3);
    expect(d.initiative.bonus.value).toBe(-3);
    expect(d.deathSave.bonus.value).toBe(-4);
    // Not a d20 test.
    expect(d.passives.perception.value).toBe(14);
    expect(d.speed.walk?.value).toBe(30);
  });

  it('overrides replace a value and say so', () => {
    const c = brute();
    c.overrides = { 'save.dex': 9, 'skill.stealth': 6, initiative: 4, pb: 4, 'score.cha': 14 };
    const d = run(c);
    expect(d.saves.dex.bonus.value).toBe(9);
    expect(d.saves.dex.bonus.parts.at(-1)).toMatchObject({ kind: 'override', value: 9 });
    expect(d.skills.stealth.bonus.value).toBe(6);
    expect(d.passives.perception.value).toBe(15);
    expect(d.initiative.bonus.value).toBe(4);
    expect(d.pb.value).toBe(4);
    expect(d.abilities.cha).toMatchObject({ mod: 2, score: { value: 14 } });
  });
});

describe('derive: defenses', () => {
  it('AC: the best calculation, then shield', () => {
    const d = run(brute());
    expect(d.ac).toMatchObject({ value: 15, calculation: 'Hardened Hide' });
    expect(d.ac.parts.map((p) => [p.label, p.value])).toEqual([
      ['Hardened Hide', 10],
      ['DEX modifier', 1],
      ['CON modifier', 2],
      ['Buckler', 2],
    ]);
  });

  it('AC: Unarmored Defense from the first class that gave it only (2024 multiclassing)', () => {
    // A registry where the Brute's own unarmored formula is an "Unarmored Defense" too.
    const registry = structuredClone(FIXTURE_FEATURE_EFFECTS);
    const hide = registry['classFeature:hardened hide|brute|tst|1|tst']!;
    hide.effects = hide.effects.map((e) =>
      e.type === 'acFormula' ? { ...e, name: 'Unarmored Defense' } : e,
    );
    const c = testCharacter({
      classes: [
        { classId: 'wanderer|tst', levels: 1 },
        { classId: 'brute|tst', levels: 1 },
      ],
      scores: { dex: 14, wis: 10, con: 18 },
    });
    const d = derive(c, index, { registry });
    // The Wanderer's (DEX + WIS: 12), not the Brute's (DEX + CON: 16).
    expect(d.ac.value).toBe(12);
    expect(d.issues.map((i) => i.code)).toContain('unarmoredDefenseAgain');
  });

  it('Extra Attack from two classes doesn’t stack (2024 multiclassing)', () => {
    const c = testCharacter({
      classes: [
        { classId: 'brute|tst', levels: 5 },
        { classId: 'wanderer|tst', levels: 5 },
      ],
    });
    expect(run(c).attacksPerAction.value).toBe(2);
  });

  it('AC: armor, magic items in use, overrides; heavy armor slows the weak', () => {
    const c = brute();
    c.inventory = [
      {
        uid: 'a',
        name: 'Arena Mail',
        quantity: 1,
        attuned: false,
        itemRef: item('arena mail|tst'),
        equipped: 'armor',
      },
      {
        uid: 'b',
        name: 'Cloak',
        quantity: 1,
        attuned: true,
        itemRef: item('cloak of cheers|tst'),
        equipped: 'worn',
      },
    ];
    c.baseScores.str = 10; // 14 with the picks: below Arena Mail's 15.
    const d = run(c);
    expect(d.ac).toMatchObject({ value: 18, calculation: 'Arena Mail' });
    expect(d.defenses.resistances.map((r) => r.value)).toEqual(['poison', 'thunder']);
    expect(d.speed.walk?.value).toBe(20);
    expect(d.speed.walk?.parts.map((p) => p.label)).toEqual([
      'Mossling',
      'Arena Mail (needs STR 15)',
    ]);
    c.overrides.ac = 21;
    expect(run(c).ac.value).toBe(21);
  });

  it('HP: full die at level 1, then average or rolled, plus CON per level', () => {
    const d = run(brute());
    expect(d.hp.max.value).toBe(50);
    expect(d.hp.max.parts.map((p) => [p.label, p.value])).toEqual([
      ['Hit dice', 40],
      ['CON modifier × 5', 10],
    ]);
    const rolled = brute();
    rolled.log[1]!.hp = { mode: 'roll', value: 12 };
    rolled.state.damage = 20;
    rolled.state.tempHp = 5;
    expect(run(rolled).hp).toMatchObject({ max: { value: 55 }, current: 35, temp: 5 });
    expect(run(brute()).hitDice).toEqual([{ faces: 12, total: 5, used: 0 }]);
  });

  it('speed, senses, resistances, proficiencies and size', () => {
    const c = brute();
    c.state.activeToggles.fury = {};
    const d = run(c);
    expect(d.speed.walk?.value).toBe(40);
    expect(d.speed.climb?.value).toBe(40);
    expect(d.senses).toEqual([
      { value: { sense: 'darkvision', range: 60 }, sources: ['Mossling'] },
    ]);
    expect(d.defenses.resistances.map((r) => r.value)).toEqual([
      'bludgeoning',
      'piercing',
      'slashing',
      'poison',
    ]);
    expect(d.proficiencies.armor.map((p) => p.value)).toEqual(['light', 'medium', 'buckler|tst']);
    expect(d.proficiencies.weapons.map((p) => p.value)).toEqual(['simple', 'martial']);
    expect(d.size).toBe('M');
    expect(d.classes).toEqual([
      {
        classId: 'brute|tst',
        name: 'Brute',
        level: 5,
        hitDie: 12,
        subclassId: 'spark|brute|tst|tst',
        subclassName: 'Path of the Spark',
      },
    ]);
  });
});

describe('derive: other builds', () => {
  it('Wanderer 7: Unarmored Defense and Movement only without armor or shield', () => {
    const c = testCharacter({
      classes: [{ classId: 'wanderer|tst', levels: 7, subclassId: 'mist|wanderer|tst|tst' }],
      speciesId: 'mossling|tst',
      backgroundId: 'arena hand|tst',
      scores: { str: 10, dex: 16, con: 12, int: 10, wis: 15, cha: 8 },
      choices: [{ owner: background, slot: 'ability', values: ['cha', 'str', 'con'] }],
    });
    const d = run(c);
    expect(d.ac).toMatchObject({ value: 15, calculation: 'Unarmored Defense' });
    expect(d.speed.walk?.value).toBe(35);
    expect(d.hp.max.value).toBe(45);
    expect(d.saves.dex.bonus.value).toBe(6);

    c.inventory = [
      {
        uid: 'v',
        name: 'Vest',
        quantity: 1,
        attuned: false,
        itemRef: item('padded vest|tst'),
        equipped: 'armor',
      },
    ];
    const armored = run(c);
    expect(armored.ac).toMatchObject({ value: 14, calculation: 'Padded Vest' });
    expect(armored.speed.walk?.value).toBe(30);
  });

  it('Lorekeeper 5 / Pactbinder 2: hit points, hit dice, first-class saves, ward', () => {
    const c = testCharacter({
      classes: [
        { classId: 'lorekeeper|tst', levels: 5, subclassId: 'ink|lorekeeper|tst|tst' },
        { classId: 'pactbinder|tst', levels: 2 },
      ],
      scores: { str: 8, dex: 12, con: 14, int: 16, wis: 12, cha: 13 },
    });
    c.state.wardHp = 20;
    const d = run(c);
    expect(d.charLevel).toBe(7);
    expect(d.hp.max.value).toBe(46);
    expect(d.hitDice).toEqual([
      { faces: 8, total: 2, used: 0 },
      { faces: 6, total: 5, used: 0 },
    ]);
    expect(d.saves.int.proficiency).toBe('proficient');
    expect(d.saves.cha.proficiency).toBe('none');
    expect(d.proficiencies.armor.map((p) => [p.value, p.sources])).toEqual([
      ['light', ['Pactbinder']],
    ]);
    expect(d.hp.ward).toMatchObject({ name: 'Glyph Ward', max: { value: 13 }, current: 13 });
  });

  it('reports a missing subclass, pending choices and broken formulas', () => {
    const c = testCharacter({ classes: [{ classId: 'brute|tst', levels: 3 }] });
    const d = derive(c, index, {
      registry: {
        ...FIXTURE_FEATURE_EFFECTS,
        'classFeature:catch breath|brute|tst|2|tst': {
          level: 'A',
          effects: [{ type: 'hpBonus', flat: 'table.no-such-column' }],
        },
      },
    });
    expect(d.issues.map((i) => i.code)).toEqual(['subclassMissing', 'formula']);
    expect(d.choices.pending.map((p) => [p.offer.key.slot, p.count])).toEqual([
      ['skills', 2],
      ['mastery', 2],
      ['equipment', 1],
    ]);
    expect(run(testCharacter({ classes: [] })).hp.max.value).toBe(0);
  });
});
