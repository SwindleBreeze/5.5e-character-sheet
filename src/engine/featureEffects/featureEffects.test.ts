import { beforeAll, describe, expect, it } from 'vitest';
import type { ContentEntity, Effect, Entry } from '../../schema/index.ts';
import { fixtureIndex } from '../../test/fixtureIndex.ts';
import { FIXTURE_FEATURE_EFFECTS } from '../../test/fixtureFeatureEffects.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import { nestedFeatureRefs } from '../content/refs.ts';
import { coverageGate, coverageReport } from './coverage.ts';
import { suggestMapping } from './suggest.ts';
import { checkMapping, createFeatureEffectsRegistry, MappingError } from './registry.ts';
import type { FeatureEffectsMap } from './types.ts';
import { validateFeatureEffects } from './validate.ts';

let index: ContentIndex;

beforeAll(async () => {
  index = await fixtureIndex();
});

const FURY = 'classFeature:fury|brute|tst|1|tst';
const FOCUS = 'classFeature:focus|wanderer|tst|2|tst';
const SPARK = 'subclassFeature:path of the spark|brute|tst|spark|tst|3|tst';
const ORIGIN_FEAT = 'feat:arena veteran|tst';

const one = (key: string, ...effects: Effect[]): FeatureEffectsMap => ({
  [key]: { level: 'A', effects },
});

describe('registry', () => {
  it('registers mappings and refuses a key twice', () => {
    const r = createFeatureEffectsRegistry();
    r.register(FIXTURE_FEATURE_EFFECTS);
    expect(Object.keys(r.map())).toHaveLength(Object.keys(FIXTURE_FEATURE_EFFECTS).length);
    expect(() => r.register(one(FURY))).toThrow(MappingError);
    expect(() => r.register(one(FURY))).toThrow(/already registered/);
  });

  it('refuses a broken mapping before it is registered', () => {
    const r = createFeatureEffectsRegistry();
    expect(() => r.register(one('fury|brute|tst|1|tst'))).toThrow(/not a ref key/);
    expect(() =>
      r.register(one(FURY, { type: 'acBonus', value: '1 +' }, { type: 'hpBonus', flat: 'pb' })),
    ).toThrow(/formula "1 \+"/);
    expect(Object.keys(r.map())).toEqual([]);
  });

  it('finds repeated slots, nested ones included', () => {
    const pick: Effect = {
      type: 'proficiencyChoice',
      category: 'skill',
      choice: { slot: 'skills', count: 1, from: 'any' },
    };
    expect(checkMapping(FURY, { level: 'A', effects: [pick] })).toEqual([]);
    expect(
      checkMapping(FURY, {
        level: 'A',
        effects: [pick, { type: 'atLevel', level: 3, effects: [pick] }],
      }),
    ).toEqual(['slot "skills" is declared twice']);
  });
});

describe('validateFeatureEffects', () => {
  it('the fixture mappings are valid', () => {
    expect(validateFeatureEffects(FIXTURE_FEATURE_EFFECTS, index)).toEqual([]);
  });

  it('table keys must exist on the owning class or subclass', () => {
    const issues = validateFeatureEffects(
      {
        ...one(FURY, { type: 'hpBonus', flat: 'table.furies + table.fury-damage' }),
        ...one(FOCUS, { type: 'acBonus', value: 'table.furies' }),
        ...one(ORIGIN_FEAT, { type: 'acBonus', value: 'table.furies + table.brute.furies' }),
        ...one(SPARK, { type: 'acBonus', value: 'table.brute.nope + table.wizard.furies' }),
      },
      index,
    );
    expect(issues.map((i) => [i.key, i.code, i.message])).toEqual([
      [FOCUS, 'tableKey', '"table.furies": no "furies" column on Wanderer'],
      [
        ORIGIN_FEAT,
        'tableKey',
        '"table.furies + table.brute.furies": table.furies needs a class or subclass owner',
      ],
      [
        SPARK,
        'tableKey',
        '"table.brute.nope + table.wizard.furies": no class "brute" with a "nope" column',
      ],
      [
        SPARK,
        'tableKey',
        '"table.brute.nope + table.wizard.furies": no class "wizard" with a "furies" column',
      ],
    ]);
  });

  it('slots are unique per owner and read slots are declared', () => {
    const issues = validateFeatureEffects(
      one(
        'class:brute|tst',
        // `skills` is the class's own data slot.
        {
          type: 'proficiencyChoice',
          category: 'skill',
          choice: { slot: 'skills', count: 1, from: 'any' },
        },
        { type: 'resistance', value: { fromChoice: 'element' } },
        { type: 'ifChoice', slot: 'skills', value: 'athletics', effects: [] },
        { type: 'acBonus', value: 'choice.skills + choice.nope' },
      ),
      index,
    );
    expect(issues.map((i) => [i.code, i.message])).toEqual([
      ['duplicateSlot', 'slot "skills" is also in the data'],
      ['unknownSlot', 'reads slot "element", which is not declared'],
      ['unknownSlot', '"choice.skills + choice.nope" reads slot "nope", which is not declared'],
    ]);
  });

  it('the mapped entity and the entities it names must be loaded', () => {
    const issues = validateFeatureEffects(
      {
        ...one('classFeature:nope|brute|tst|1|tst'),
        ...one(
          FURY,
          { type: 'grantFeat', feat: { kind: 'feat', id: 'missing feat|tst' } },
          { type: 'grantSpells', spells: [{ spell: { id: 'hex mark|tst' }, mode: 'known' }] },
          {
            type: 'when',
            when: { not: { condition: 'condition/frozen|tst' } },
            effects: [],
          },
        ),
      },
      index,
    );
    expect(issues.map((i) => [i.code, i.message])).toEqual([
      ['ownerMissing', 'the mapped entity is not in the content'],
      ['refMissing', 'feat:missing feat|tst is not in the content'],
      ['refMissing', 'rule:condition/frozen|tst is not in the content'],
    ]);
  });
});

describe('nested features', () => {
  it('are refs in the text, outside option blocks', () => {
    const ref = (id: string) => ({ type: 'ref', ref: { kind: 'classFeature', id } }) as const;
    const entries: Entry[] = [
      'Intro.',
      ref('a'),
      { type: 'entries', name: 'More', entries: [ref('b')] },
      { type: 'list', items: [ref('c')] },
      { type: 'options', entries: [ref('choice 1'), ref('choice 2')] },
    ];
    const feature = { kind: 'classFeature', entries } as unknown as ContentEntity;
    expect(nestedFeatureRefs(feature).map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(nestedFeatureRefs({ ...feature, kind: 'feat' } as ContentEntity)).toEqual([]);
  });
});

describe('coverageReport', () => {
  it('sorts features into mapped, data-only and unmapped, and finds unoffered choices', () => {
    const report = coverageReport(index, FIXTURE_FEATURE_EFFECTS, new Set(['TST']));
    const row = (name: string) => report.rows.find((r) => r.feature.name === name)!;
    expect(report.counts).toEqual({ mapped: 20, data: 7, none: 15 });
    expect(report.byAutomation).toEqual({ A: 16, B: 3, C: 1 });
    expect(row('Fury')).toMatchObject({ owner: 'Brute', level: 1, status: 'mapped' });
    expect(row('Static Charge')).toMatchObject({ owner: 'Brute: Spark', status: 'mapped' });
    expect(row('Showmanship').status).toBe('data');
    // Its options are features too, and need mappings like any other.
    expect(row('Crowd Pleaser')).toMatchObject({ owner: 'Gladiator', level: 1, status: 'none' });
    expect(row('Tangle')).toMatchObject({ owner: 'Gladiator: Net', status: 'none' });
    expect(row('Spellcasting')).toMatchObject({ status: 'none', offered: true });
    // "Choose a path" is the subclass pick, made in the log.
    expect(row('Brute Path')).toMatchObject({ choiceInText: true, offered: true });
    expect(report.unofferedChoices.map((r) => r.feature.name)).toEqual([]);
  });

  it('counts per class, and the gate lists what keeps a class from being done', () => {
    const report = coverageReport(index, FIXTURE_FEATURE_EFFECTS, new Set(['TST']));
    const brute = report.byClass.find((c) => c.name === 'Brute')!;
    expect(brute.total).toBe(brute.counts.mapped + brute.counts.data + brute.counts.none);
    const gate = coverageGate(report, 'brute|tst');
    // Every unmapped Brute feature is listed; mapped ones are not.
    expect(gate.some((p) => p.startsWith('Brute 1: Fury'))).toBe(false);
    expect(gate.length).toBe(brute.counts.data + brute.counts.none);
    // Mapping every feature, as text where nothing else applies, clears the gate.
    const all = { ...FIXTURE_FEATURE_EFFECTS };
    for (const r of report.rows.filter((x) => x.classId === 'brute|tst' && x.status !== 'mapped'))
      all[`${r.feature.kind}:${r.feature.id}`] = { level: 'C', effects: [] };
    expect(coverageGate(coverageReport(index, all, new Set(['TST'])), 'brute|tst')).toEqual([]);
  });

  it('lists only the sources asked for', () => {
    expect(coverageReport(index, {}, new Set(['XPHB'])).rows).toEqual([]);
  });
});

describe('suggestMapping', () => {
  const feature = (text: string) =>
    ({
      kind: 'classFeature',
      id: 'x|tst',
      name: 'Battle Cry',
      source: 'TST',
      classId: 'brute|tst',
      level: 1,
      entries: [text],
      effects: [],
    }) as never;

  it('drafts uses, resistances, advantage, senses, speed and AC from the text', () => {
    expect(
      suggestMapping(
        feature(
          'You can use this feature a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest. You have Resistance to Fire damage and Advantage on Wisdom saving throws. You gain Darkvision with a range of 60 feet, your Speed increases by 10 feet, and you gain a +1 bonus to Armor Class.',
        ),
      ),
    ).toEqual({
      level: 'A',
      effects: [
        {
          type: 'resource',
          resourceId: 'battle-cry',
          name: 'Battle Cry',
          max: 'pb',
          recharge: 'long',
        },
        { type: 'resistance', value: 'fire' },
        { type: 'rollMode', target: 'save:wis', mode: 'advantage' },
        { type: 'sense', sense: 'darkvision', range: 60 },
        { type: 'speedBonus', value: 10 },
        { type: 'acBonus', value: 1 },
      ],
    });
  });

  it('a modifier’s worth of uses back on a Short or Long Rest; plain text is level C', () => {
    expect(
      suggestMapping(
        feature(
          'You can do this a number of times equal to your {@b Charisma} modifier (minimum of once). You regain all expended uses when you finish a Short or Long Rest.',
        ),
      ).effects,
    ).toEqual([
      {
        type: 'resource',
        resourceId: 'battle-cry',
        name: 'Battle Cry',
        max: 'max(1, mod.cha)',
        recharge: 'short',
      },
    ]);
    expect(suggestMapping(feature('You shout.'))).toEqual({ level: 'C', effects: [] });
  });
});
