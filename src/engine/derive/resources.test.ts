import { beforeAll, describe, expect, it } from 'vitest';
import type { Character } from '../../schema/index.ts';
import { testCharacter } from '../../test/characters.ts';
import { fixtureIndex } from '../../test/fixtureIndex.ts';
import { FIXTURE_FEATURE_EFFECTS } from '../../test/fixtureFeatureEffects.ts';
import { GRANTED_SLOT } from '../collect/collect.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import type { FeatureEffectsMap } from '../featureEffects/types.ts';
import { canPay } from '../play/costs.ts';
import { payCost } from '../play/reducers.ts';
import { derive } from './derive.ts';
import type { DerivedSheet } from './types.ts';

let index: ContentIndex;

beforeAll(async () => {
  index = await fixtureIndex();
});

const run = (c: Character, registry: FeatureEffectsMap = FIXTURE_FEATURE_EFFECTS): DerivedSheet =>
  derive(c, index, { registry });

const FURY = 'classFeature:fury|brute|tst|1|tst#furies';

function brute(): Character {
  return testCharacter({ classes: [{ classId: 'brute|tst', levels: 5 }], scores: { con: 14 } });
}

describe('resources (P6)', () => {
  it('counters from features, keyed by their owner, with what is spent', () => {
    const c = brute();
    c.state.resourcesUsed = {
      [FURY]: 2,
      'classFeature:catch breath|brute|tst|2|tst#catch-breath': 9,
    };
    const d = run(c);
    expect(d.resources.map((r) => [r.key, r.name, r.max.value, r.used, r.recharge])).toEqual([
      [FURY, 'Furies', 3, 2, 'long'],
      ['classFeature:catch breath|brute|tst|2|tst#catch-breath', 'Catch Breath', 2, 2, 'shortOne'],
    ]);
  });

  it('later features change a resource and add ways to restore it', () => {
    const registry: FeatureEffectsMap = {
      ...FIXTURE_FEATURE_EFFECTS,
      'classFeature:swift feet|brute|tst|5|tst': {
        level: 'A',
        effects: [
          {
            type: 'resourceModify',
            resourceId: 'furies',
            max: 'table.furies + 1',
            recharge: 'short',
            die: 'd10',
          },
          {
            type: 'restoreWith',
            resourceId: 'furies',
            amount: 1,
            costs: [{ slot: { minLevel: 1 } }],
          },
          { type: 'hpBonus', flat: 'resource.furies.max' },
        ],
      },
    };
    const d = run(brute(), registry);
    expect(d.resources[0]).toMatchObject({
      max: { value: 4, parts: [{ label: 'Swift Feet', value: 4 }] },
      recharge: 'short',
      die: '1d10',
      restoreWith: [{ amount: '1', costs: ['a level 1+ spell slot'] }],
    });
    // `resource.<id>.max` in other formulas.
    expect(d.hp.max.parts.at(-1)).toMatchObject({ label: 'Swift Feet', value: 4 });
  });

  it('every gift has its own counter', () => {
    const c = brute();
    for (const id of ['charm of sparks|tst', 'charm of embers|tst']) {
      c.log[0]!.choices.push({
        key: { owner: { kind: 'reward', id }, slot: GRANTED_SLOT },
        values: [],
        labels: [],
        madeAt: 0,
        via: 'manual',
      });
    }
    const gifts = run(c).resources.filter((r) => r.source.kind === 'reward');
    expect(gifts.map((r) => [r.key, r.name, r.max.value, r.recharge])).toEqual([
      ['reward:charm of sparks|tst#uses', 'Uses', 1, 'none'],
      ['reward:charm of embers|tst#uses', 'Charges', 3, 'none'],
    ]);
  });
});

describe('actions (P7) and toggles (P8)', () => {
  it('feature actions with costs and outcomes; standard actions', () => {
    const d = run(brute());
    const breath = d.actions.find((a) => a.name === 'Catch Breath');
    expect(breath).toMatchObject({
      actionType: 'bonus',
      sourceName: 'Catch Breath',
      costs: [
        {
          label: '1 Catch Breath',
          amount: 1,
          resourceKey: 'classFeature:catch breath|brute|tst|2|tst#catch-breath',
        },
      ],
      outcomes: [{ heal: '1d8 + 5' }],
    });
    expect(d.actions.filter((a) => a.standard).map((a) => [a.name, a.actionType])).toEqual([
      ...[
        'Attack',
        'Dash',
        'Disengage',
        'Dodge',
        'Help',
        'Hide',
        'Influence',
        'Magic',
        'Ready',
        'Search',
        'Study',
        'Utilize',
      ].map((name) => [name, 'action']),
      ['Opportunity Attack', 'reaction'],
    ]);
    expect(d.actions.find((a) => a.name === 'Attack')).toMatchObject({
      source: { kind: 'rule', id: 'action/attack|xphb' },
      attackIds: ['unarmed'],
    });
  });

  it('an action that makes attacks (Flurry of Strikes)', () => {
    const c = testCharacter({ classes: [{ classId: 'wanderer|tst', levels: 7 }] });
    const d = run(c);
    expect(d.resources.map((r) => [r.name, r.max.value, r.recharge])).toEqual([
      ['Focus Points', 7, 'short'],
    ]);
    expect(d.actions.find((a) => a.name === 'Flurry of Strikes')).toMatchObject({
      actionType: 'bonus',
      attackIds: ['unarmed'],
      costs: [{ label: '1 Focus Points', amount: 1 }],
    });
  });

  it('features that consume a named resource', () => {
    const c = testCharacter({ classes: [{ classId: 'gladiator|tst', levels: 3 }] });
    const d = run(c);
    expect(d.resources.map((r) => [r.name, r.max.value])).toEqual([['Bravado', 3]]);
    expect(d.actions.find((a) => a.name === 'Arena Training')).toMatchObject({
      actionType: 'other',
      costs: [
        {
          label: '1 Bravado',
          amount: 1,
          resourceKey: 'classFeature:arena training|gladiator|tst|1|tst#bravado',
        },
      ],
    });
  });

  it('toggles with their costs and state', () => {
    const c = brute();
    expect(run(c).toggles).toEqual([
      {
        toggleId: 'fury',
        name: 'Fury',
        source: { kind: 'classFeature', id: 'fury|brute|tst|1|tst' },
        sourceName: 'Fury',
        active: false,
        options: [],
        costs: [{ label: '1 Furies', amount: 1, resourceKey: FURY }, { label: 'a Bonus Action' }],
        onActivate: [],
        endsOn: ['longRest'],
      },
    ]);
    c.state.activeToggles.fury = {};
    expect(run(c).toggles[0]?.active).toBe(true);
  });

  it('more than three attuned items is a warning', () => {
    const c = brute();
    c.inventory = Array.from({ length: 4 }, (_, i) => ({
      uid: `r${i}`,
      name: `Ring ${i}`,
      quantity: 1,
      attuned: true,
    }));
    expect(run(c).issues.map((i) => i.message)).toContain('4 items attuned; the limit is 3.');
  });
});

describe("costs paid in an item's charges", () => {
  it('an action of an item in use spends its charges, and stops when they run out', () => {
    const registry: FeatureEffectsMap = {
      ...FIXTURE_FEATURE_EFFECTS,
      'item:ring of loud shouting|tst': {
        level: 'A',
        effects: [
          {
            type: 'grantAction',
            action: {
              id: 'shout',
              name: 'Shout',
              actionType: 'action',
              costs: [{ charges: 2 }],
            },
          },
        ],
      },
    };
    const c = brute();
    c.inventory = [
      {
        uid: 'ring',
        itemRef: { kind: 'item', id: 'ring of loud shouting|tst' },
        name: 'Ring of Loud Shouting',
        quantity: 1,
        attuned: false,
        equipped: 'worn',
      },
    ];
    const cost = () =>
      run(c, registry)
        .actions.find((a) => a.name === 'Shout')!
        .costs.find((x) => x.charges)!;
    expect(cost()).toMatchObject({
      label: '2 charges',
      amount: 2,
      charges: { rowUid: 'ring', left: 3 },
    });
    const paid = payCost(c, run(c, registry), cost());
    expect(paid.inventory[0]?.chargesUsed).toBe(2);
    expect(
      canPay(
        run(paid, registry),
        run(paid, registry).actions.find((a) => a.name === 'Shout')!.costs[0]!,
      ),
    ).toBe(false);
  });
});
