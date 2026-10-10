import { beforeAll, describe, expect, it } from 'vitest';
import {
  encodeChoiceKey,
  type InventoryItem,
  type Item,
  type Predicate,
} from '../../schema/index.ts';
import { testCharacter, type TestChoice } from '../../test/characters.ts';
import { fixtureIndex } from '../../test/fixtureIndex.ts';
import { collectEffects } from '../collect/collect.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import type { FeatureEffectsMap } from '../featureEffects/types.ts';
import { matchesFilter, propertyAbbr, weaponTraits } from './attackTraits.ts';
import { resolveBound } from './bound.ts';
import { buildStaticState, holds } from './state.ts';

let index: ContentIndex;

beforeAll(async () => {
  index = await fixtureIndex();
});

const item = (id: string) => ({ kind: 'item', id }) as const;

function stateWith(inventory: Partial<InventoryItem>[], extra: { conditions?: string[] } = {}) {
  const c = testCharacter({ classes: [{ classId: 'wanderer|tst', levels: 3 }], inventory });
  c.state.conditions = extra.conditions ?? [];
  return buildStaticState(c, index);
}

describe('equipment and wield state (P2)', () => {
  it('reads armor, shield and hands from equip slots', () => {
    const s = stateWith([
      { itemRef: item('padded vest|tst'), equipped: 'armor' },
      { itemRef: item('buckler|tst'), equipped: 'shield' },
      { itemRef: item('net blade|tst'), equipped: 'mainHand' },
      { itemRef: item('torch|tst') },
    ]);
    expect(s.wield.armor?.info).toEqual({ category: 'light', ac: 11 });
    expect(s.wield.shield?.info).toEqual({ ac: 2 });
    expect(s.wield.wielded.map((w) => [w.item.name, w.hand])).toEqual([['Net Blade', 'main']]);
    expect(s.wield).toMatchObject({ handsUsed: 2, freeHands: 0, conflicts: [] });
  });

  it('flags what cannot fit: a second armor, a third hand', () => {
    const s = stateWith([
      { itemRef: item('padded vest|tst'), equipped: 'armor' },
      { itemRef: item('arena mail|tst'), equipped: 'armor' },
      { itemRef: item('walking staff|tst'), equipped: 'bothHands' },
      { itemRef: item('shiv|tst'), equipped: 'offHand' },
    ]);
    expect(s.wield.armor?.item?.name).toBe('Padded Vest');
    expect(s.wield.conflicts.map((r) => r.itemRef?.id)).toEqual(['arena mail|tst', 'shiv|tst']);
    expect(s.wield.wielded.map((w) => w.hand)).toEqual(['both']);
  });

  it('weapon traits: range, properties and the Monk-weapon tag', () => {
    const get = (id: string) => index.get(item(id)) as Item;
    expect(weaponTraits(get('shiv|tst'), 'off')).toMatchObject({
      range: 'melee',
      weaponCategory: 'simple',
      properties: ['F', 'L', 'T'],
      tags: ['monkWeapon', 'offHand'],
    });
    expect(weaponTraits(get('arc bow|tst')).range).toBe('ranged');
    expect(weaponTraits(get('arc bow|tst')).tags).toEqual([]);
    expect(weaponTraits(get('net blade|tst')).tags).toEqual([]);
    expect(weaponTraits(get('walking staff|tst'), 'both').tags).toEqual([
      'monkWeapon',
      'twoHanded',
    ]);
    expect(propertyAbbr('itemProperty/2h|xphb')).toBe('2H');
  });

  it('matches attack filters', () => {
    const shiv = weaponTraits(index.get(item('shiv|tst')) as Item, 'main');
    expect(matchesFilter({ range: 'melee', properties: ['f'] }, shiv)).toBe(true);
    expect(matchesFilter({ notProperties: ['L'] }, shiv)).toBe(false);
    expect(matchesFilter({ source: ['unarmed'] }, shiv)).toBe(false);
    expect(matchesFilter({ weaponCategory: 'martial' }, shiv)).toBe(false);
    expect(matchesFilter({ itemIds: ['shiv|tst'] }, shiv)).toBe(true);
    expect(matchesFilter({ ability: ['str'] }, shiv)).toBe(true);
    expect(matchesFilter({ ability: ['str'] }, { ...shiv, ability: 'dex' })).toBe(false);
    // Every weapon but one (a cursed weapon's hold), by the item or its variant.
    expect(matchesFilter({ notItemIds: ['shiv|tst'] }, shiv)).toBe(false);
    expect(matchesFilter({ notItemIds: ['axe|tst'] }, shiv)).toBe(true);
    expect(matchesFilter({ notItemIds: ['axe|tst'] }, { ...shiv, variantId: 'axe|tst' })).toBe(
      false,
    );
    // Magic weapons: a magic item, or a mundane one with a magic variant.
    expect(matchesFilter({ magic: true }, shiv)).toBe(false);
    expect(matchesFilter({ magic: false }, shiv)).toBe(true);
    expect(matchesFilter({ magic: true }, { ...shiv, magic: true })).toBe(true);
    expect(weaponTraits({ ...(index.get(item('shiv|tst')) as Item), rarity: 'rare' }).magic).toBe(
      true,
    );
  });
});

describe('predicates (P1)', () => {
  const unarmored: Predicate = { all: [{ armor: 'none' }, { shield: false }] };
  // Dueling: a melee weapon in one hand and no other weapon.
  const dueling: Predicate = {
    all: [
      { wielding: { range: 'melee', notProperties: ['2H'] } },
      { not: { wielding: { tags: ['offHand'] } } },
      { not: { wielding: { tags: ['twoHanded'] } } },
    ],
  };

  it('armor and shield (Unarmored Defense)', () => {
    expect(holds(unarmored, stateWith([]))).toBe(true);
    expect(
      holds(unarmored, stateWith([{ itemRef: item('buckler|tst'), equipped: 'shield' }])),
    ).toBe(false);
    const light = stateWith([{ itemRef: item('padded vest|tst'), equipped: 'armor' }]);
    expect(holds({ armor: 'light' }, light)).toBe(true);
    expect(holds({ armor: 'notHeavy' }, light)).toBe(true);
    expect(holds({ armor: 'any' }, light)).toBe(true);
    const heavy = stateWith([{ itemRef: item('arena mail|tst'), equipped: 'armor' }]);
    expect(holds({ armor: 'notHeavy' }, heavy)).toBe(false);
    expect(holds({ armor: 'heavy' }, heavy)).toBe(true);
  });

  it('items in use and attunement', () => {
    const none = stateWith([]);
    expect(holds({ attuned: true }, none)).toBe(false);
    expect(holds({ itemInUse: ['cloak of cheers|tst'] }, none)).toBe(false);
    const worn = stateWith([
      { itemRef: item('cloak of cheers|tst'), equipped: 'worn', attuned: true },
    ]);
    expect(holds({ attuned: true }, worn)).toBe(true);
    expect(holds({ itemInUse: ['shiv|tst', 'cloak of cheers|tst'] }, worn)).toBe(true);
    // Carried but not worn: not in use.
    const carried = stateWith([{ itemRef: item('cloak of cheers|tst'), attuned: true }]);
    expect(holds({ itemInUse: ['cloak of cheers|tst'] }, carried)).toBe(false);
  });

  it('wielding and free hands (Dueling only with one weapon)', () => {
    const one = stateWith([{ itemRef: item('net blade|tst'), equipped: 'mainHand' }]);
    expect(holds(dueling, one)).toBe(true);
    expect(holds({ freeHands: 1 }, one)).toBe(true);
    const two = stateWith([
      { itemRef: item('net blade|tst'), equipped: 'mainHand' },
      { itemRef: item('shiv|tst'), equipped: 'offHand' },
    ]);
    expect(holds(dueling, two)).toBe(false);
    expect(holds({ freeHands: 1 }, two)).toBe(false);
    const staff = stateWith([{ itemRef: item('walking staff|tst'), equipped: 'bothHands' }]);
    expect(holds(dueling, staff)).toBe(false);
    expect(holds({ wielding: { tags: ['monkWeapon'] } }, staff)).toBe(true);
  });

  it('levels, conditions, toggles and combinators', () => {
    const s = stateWith([], { conditions: ['condition/prone|tst'] });
    expect(holds({ level: 3 }, s)).toBe(true);
    expect(holds({ level: 4 }, s)).toBe(false);
    expect(holds({ level: 3, classId: 'wanderer|tst' }, s)).toBe(true);
    expect(holds({ level: 1, classId: 'brute|tst' }, s)).toBe(false);
    expect(holds({ condition: 'condition/prone|tst' }, s)).toBe(true);
    expect(holds({ toggle: 'fury' }, s)).toBe(false);
    expect(holds({ any: [{ level: 9 }, { condition: 'condition/prone|tst' }] }, s)).toBe(true);
    expect(holds({ not: { level: 1 } }, s)).toBe(false);
    // A condition from another book counts: a 2014 character's Prone is Prone (step 8.6).
    expect(holds({ condition: 'condition/prone|xphb' }, s)).toBe(true);
    expect(holds({ condition: 'condition/stunned|tst' }, s)).toBe(false);
  });
});

describe('toggles v2 (P8) and choice-bound values (P10)', () => {
  const owner = { kind: 'classFeature', id: 'focus|wanderer|tst|2|tst' } as const;
  const registry: FeatureEffectsMap = {
    'classFeature:focus|wanderer|tst|2|tst': {
      level: 'B',
      effects: [
        {
          type: 'toggle',
          toggleId: 'form',
          name: 'Starry Form',
          group: 'forms',
          options: [
            {
              id: 'archer',
              name: 'Archer',
              effects: [{ type: 'sense', sense: 'archer', range: 1 }],
            },
            {
              id: 'chalice',
              name: 'Chalice',
              effects: [{ type: 'sense', sense: 'chalice', range: 1 }],
            },
          ],
          effects: [{ type: 'sense', sense: 'starlight', range: 10 }],
        },
        {
          type: 'toggle',
          toggleId: 'other-form',
          name: 'Other Form',
          group: 'forms',
          effects: [{ type: 'sense', sense: 'other', range: 1 }],
        },
        { type: 'resistanceChoice', choice: { slot: 'element', count: 1, from: ['fire', 'cold'] } },
        { type: 'resistance', value: { fromChoice: 'element' } },
      ],
    },
  };

  function senses(active: Record<string, { option?: string }>, choices: TestChoice[] = []) {
    const c = testCharacter({ classes: [{ classId: 'wanderer|tst', levels: 2 }], choices });
    c.state.activeToggles = active;
    const s = buildStaticState(c, index);
    const collected = collectEffects(c, index, { registry, holds: (p) => holds(p, s) });
    return {
      collected,
      names: collected.effects.flatMap((a) => (a.effect.type === 'sense' ? [a.effect.sense] : [])),
    };
  }

  it('applies an active toggle with its chosen form', () => {
    expect(senses({}).names).toEqual([]);
    expect(senses({ form: { option: 'chalice' } }).names).toEqual(['starlight', 'chalice']);
  });

  it('only one toggle of a group applies', () => {
    expect(senses({ form: { option: 'archer' }, 'other-form': {} }).names).toEqual([
      'starlight',
      'archer',
    ]);
  });

  it('resolves a value bound to a pick', () => {
    const { collected } = senses({}, [{ owner, slot: 'element', values: ['cold'], atLevel: 2 }]);
    const bound = collected.effects.find((a) => a.effect.type === 'resistance')!;
    const valuesOf = (key: Parameters<typeof encodeChoiceKey>[0]) =>
      collected.records.get(encodeChoiceKey(key))?.record.values ?? [];
    const value = bound.effect.type === 'resistance' ? bound.effect.value : 'none';
    expect(resolveBound(value, bound.source, valuesOf)).toBe('cold');
    expect(resolveBound('fire', bound.source, valuesOf)).toBe('fire');
    expect(resolveBound({ fromChoice: 'nothing' }, bound.source, valuesOf)).toBeUndefined();
  });
});
