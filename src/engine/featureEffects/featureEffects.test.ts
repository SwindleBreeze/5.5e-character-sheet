import { beforeAll, describe, expect, it } from 'vitest';
import type { ContentEntity, Effect, Entry } from '../../schema/index.ts';
import { fixtureIndex } from '../../test/fixtureIndex.ts';
import { FIXTURE_FEATURE_EFFECTS } from '../../test/fixtureFeatureEffects.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import { nestedFeatureRefs } from '../content/refs.ts';
import { coverageReport } from './coverage.ts';
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
    expect(report.counts).toEqual({ mapped: 19, data: 7, none: 15 });
    expect(report.byAutomation).toEqual({ A: 16, B: 2, C: 1 });
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

  it('lists only the sources asked for', () => {
    expect(coverageReport(index, {}, new Set(['XPHB'])).rows).toEqual([]);
  });
});
