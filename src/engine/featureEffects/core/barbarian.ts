// Barbarian and its four XPHB subclasses (plan §10.2, step 6.3), checked against the 2024
// Player's Handbook text of each feature. Rage is a switch (B): its resistances, damage bonus
// and Strength advantage apply while it is on, and features that work "while your Rage is
// active" hang off it. Weapon Mastery and Primal Knowledge are in `levels1to3.ts`.

import type { Effect } from '../../../schema/index.ts';
import type { FeatureEffectsMap } from '../types.ts';
import {
  action,
  AT_TABLE,
  fromData,
  notHeavy,
  notIncapacitated,
  numbers,
  TARGETS,
  text,
  toggled,
  uses,
  when,
} from './helpers.ts';

const C = (id: string) => `classFeature:${id}|barbarian|xphb` as const;
const S = (sub: string, id: string) => `subclassFeature:${id}|barbarian|xphb|${sub}|xphb` as const;

const raging = { toggle: 'rage' };

/** A once-per-Long-Rest feature whose use a Rage can restore (Intimidating Presence). */
function restoredByRage(
  id: string,
  name: string,
  def: Partial<Parameters<typeof action>[0]>,
): Effect[] {
  return [
    uses(id, name, 1, 'long'),
    { type: 'restoreWith', resourceId: id, amount: 1, costs: [{ resource: 'rage', amount: 1 }] },
    action({ id, name, actionType: 'bonus', costs: [{ resource: id, amount: 1 }], ...def }),
  ];
}

export const BARBARIAN: FeatureEffectsMap = {
  [`${C('rage')}|1|xphb`]: toggled(
    [
      uses('rage', 'Rage', 'table.rages', 'shortOne'),
      {
        type: 'toggle',
        toggleId: 'rage',
        name: 'Rage',
        cost: [{ resource: 'rage', amount: 1 }, { action: 'bonus' }],
        endsOn: ['shortRest', 'longRest'],
        effects: [
          { type: 'resistance', value: 'bludgeoning' },
          { type: 'resistance', value: 'piercing' },
          { type: 'resistance', value: 'slashing' },
          { type: 'rollMode', target: 'check:str', mode: 'advantage' },
          { type: 'rollMode', target: 'save:str', mode: 'advantage' },
          {
            type: 'attackMod',
            label: 'Rage',
            filter: { source: ['weapon', 'unarmed'], ability: ['str'] },
            damage: 'table.rage-damage',
          },
        ],
      },
    ],
    { notes: 'Not in Heavy armor. No spells or Concentration while it lasts.' },
  ),
  [`${C('unarmored defense')}|1|xphb`]: numbers([
    {
      type: 'acFormula',
      name: 'Unarmored Defense',
      base: 10,
      addAbilities: ['dex', 'con'],
      shield: true,
    },
  ]),
  [`${C('danger sense')}|2|xphb`]: numbers([
    when(notIncapacitated, [{ type: 'rollMode', target: 'save:dex', mode: 'advantage' }]),
  ]),
  [`${C('reckless attack')}|2|xphb`]: toggled([
    {
      type: 'toggle',
      toggleId: 'reckless-attack',
      name: 'Reckless Attack',
      effects: [
        { type: 'rollMode', target: 'attack:str', mode: 'advantage' },
        { type: 'attackedMode', mode: 'advantage' },
      ],
    },
  ]),
  [`${C('barbarian subclass')}|3|xphb`]: text(),
  [`${C('ability score improvement')}|4|xphb`]: fromData(),
  [`${C('ability score improvement')}|8|xphb`]: fromData(),
  [`${C('ability score improvement')}|12|xphb`]: fromData(),
  [`${C('ability score improvement')}|16|xphb`]: fromData(),
  [`${C('extra attack')}|5|xphb`]: numbers([{ type: 'extraAttack', count: 2 }]),
  [`${C('fast movement')}|5|xphb`]: numbers([when(notHeavy, [{ type: 'speedBonus', value: 10 }])]),
  [`${C('subclass feature')}|6|xphb`]: text(),
  [`${C('subclass feature')}|10|xphb`]: text(),
  [`${C('subclass feature')}|14|xphb`]: text(),
  [`${C('feral instinct')}|7|xphb`]: numbers([
    { type: 'rollMode', target: 'initiative', mode: 'advantage' },
  ]),
  [`${C('instinctive pounce')}|7|xphb`]: text(),
  [`${C('brutal strike')}|9|xphb`]: text({ unoffered: AT_TABLE }),
  [`${C('improved brutal strike')}|13|xphb`]: text(),
  [`${C('improved brutal strike')}|17|xphb`]: text(),
  [`${C('relentless rage')}|11|xphb`]: text(),
  [`${C('persistent rage')}|15|xphb`]: numbers([
    uses('persistent-rage', 'Persistent Rage', 1, 'long'),
    action({
      id: 'persistent-rage',
      name: 'Persistent Rage',
      actionType: 'other',
      costs: [{ resource: 'persistent-rage', amount: 1 }],
      outcomes: [{ restore: { resource: 'rage', amount: 'resource.rage.max' } }],
    }),
  ]),
  [`${C('indomitable might')}|18|xphb`]: text(),
  [`${C('epic boon')}|19|xphb`]: text(),
  [`${C('primal champion')}|20|xphb`]: numbers([
    { type: 'abilityBonus', ability: 'str', value: 4, max: 25 },
    { type: 'abilityBonus', ability: 'con', value: 4, max: 25 },
  ]),

  // ---- Path of the Berserker ----
  [`${S('berserker', 'path of the berserker')}|3|xphb`]: text(),
  [`${S('berserker', 'frenzy')}|3|xphb`]: numbers([
    when({ all: [raging, { toggle: 'reckless-attack' }] }, [
      {
        type: 'damageRider',
        id: 'frenzy',
        name: 'Frenzy',
        dice: 'dice(table.rage-damage, 6)',
        filter: { source: ['weapon', 'unarmed'], ability: ['str'] },
        oncePerTurn: true,
        optIn: true,
      },
    ]),
  ]),
  [`${S('berserker', 'mindless rage')}|6|xphb`]: numbers([
    when(raging, [
      { type: 'conditionImmunity', value: 'charmed' },
      { type: 'conditionImmunity', value: 'frightened' },
    ]),
  ]),
  [`${S('berserker', 'retaliation')}|10|xphb`]: text(),
  [`${S('berserker', 'intimidating presence')}|14|xphb`]: numbers(
    restoredByRage('intimidating-presence', 'Intimidating Presence', {
      saveDc: '8 + mod.str + pb',
    }),
    { unoffered: TARGETS },
  ),

  // ---- Path of the Wild Heart ----
  [`${S('wild heart', 'path of the wild heart')}|3|xphb`]: text(),
  // The rituals come from the subclass's own data.
  [`${S('wild heart', 'animal speaker')}|3|xphb`]: text(),
  [`${S('wild heart', 'rage of the wilds')}|3|xphb`]: toggled(
    [
      when(raging, [
        {
          type: 'toggle',
          toggleId: 'rage-of-the-wilds',
          name: 'Rage of the Wilds',
          effects: [],
          options: [
            {
              id: 'bear',
              name: 'Bear',
              effects: [
                'acid',
                'bludgeoning',
                'cold',
                'fire',
                'lightning',
                'piercing',
                'poison',
                'slashing',
                'thunder',
              ].map((value): Effect => ({ type: 'resistance', value })),
            },
            { id: 'eagle', name: 'Eagle', effects: [] },
            { id: 'wolf', name: 'Wolf', effects: [] },
          ],
        },
      ]),
    ],
    { unoffered: 'Picked each time Rage starts: switch on Rage of the Wilds with that option.' },
  ),
  [`${S('wild heart', 'aspect of the wilds')}|6|xphb`]: numbers([
    {
      type: 'optionChoice',
      choice: { slot: 'aspect', count: 1, from: ['owl', 'panther', 'salmon'], retrain: 'longRest' },
      labels: ['Owl', 'Panther', 'Salmon'],
    },
    {
      type: 'ifChoice',
      slot: 'aspect',
      value: 'owl',
      effects: [{ type: 'sense', sense: 'darkvision', range: 60 }],
    },
    {
      type: 'ifChoice',
      slot: 'aspect',
      value: 'panther',
      effects: [{ type: 'speed', mode: 'climb', value: 'walk' }],
    },
    {
      type: 'ifChoice',
      slot: 'aspect',
      value: 'salmon',
      effects: [{ type: 'speed', mode: 'swim', value: 'walk' }],
    },
  ]),
  [`${S('wild heart', 'nature speaker')}|10|xphb`]: text(),
  [`${S('wild heart', 'power of the wilds')}|14|xphb`]: toggled(
    [
      when(raging, [
        {
          type: 'toggle',
          toggleId: 'power-of-the-wilds',
          name: 'Power of the Wilds',
          effects: [],
          options: [
            {
              id: 'falcon',
              name: 'Falcon',
              effects: [when({ armor: 'none' }, [{ type: 'speed', mode: 'fly', value: 'walk' }])],
            },
            { id: 'lion', name: 'Lion', effects: [] },
            { id: 'ram', name: 'Ram', effects: [] },
          ],
        },
      ]),
    ],
    { unoffered: 'Picked each time Rage starts: switch on Power of the Wilds with that option.' },
  ),

  // ---- Path of the World Tree ----
  [`${S('world tree', 'path of the world tree')}|3|xphb`]: text(),
  [`${S('world tree', 'vitality of the tree')}|3|xphb`]: numbers(
    [
      action({
        id: 'vitality-surge',
        name: 'Vitality Surge',
        actionType: 'other',
        outcomes: [{ tempHp: 'level.barbarian' }],
      }),
      action({
        id: 'life-giving-force',
        name: 'Life-Giving Force',
        actionType: 'other',
        roll: 'dice(table.rage-damage, 6)',
      }),
    ],
    { unoffered: TARGETS },
  ),
  [`${S('world tree', 'branches of the tree')}|6|xphb`]: numbers([
    action({
      id: 'branches-of-the-tree',
      name: 'Branches of the Tree',
      actionType: 'reaction',
      saveDc: '8 + mod.str + pb',
    }),
  ]),
  [`${S('world tree', 'battering roots')}|10|xphb`]: text(),
  [`${S('world tree', 'travel along the tree')}|14|xphb`]: text({ unoffered: TARGETS }),

  // ---- Path of the Zealot ----
  [`${S('zealot', 'path of the zealot')}|3|xphb`]: text(),
  [`${S('zealot', 'divine fury')}|3|xphb`]: numbers(
    [
      when(raging, [
        {
          type: 'damageRider',
          id: 'divine-fury',
          name: 'Divine Fury (Necrotic or Radiant)',
          dice: '1d6 + floor(level.barbarian / 2)',
          filter: { source: ['weapon', 'unarmed'] },
          oncePerTurn: true,
          optIn: false,
        },
      ]),
    ],
    { unoffered: 'Necrotic or Radiant, chosen each time the damage is dealt.' },
  ),
  [`${S('zealot', 'warrior of the gods')}|3|xphb`]: numbers([
    uses(
      'warrior-of-the-gods',
      'Warrior of the Gods',
      'steps(level.barbarian, 3, 4, 6, 5, 12, 6, 17, 7)',
      'long',
      {
        die: 'd12',
        pool: true,
      },
    ),
  ]),
  [`${S('zealot', 'fanatical focus')}|6|xphb`]: text(),
  [`${S('zealot', 'zealous presence')}|10|xphb`]: numbers(
    restoredByRage('zealous-presence', 'Zealous Presence', {}),
    {
      unoffered: TARGETS,
    },
  ),
  [`${S('zealot', 'rage of the gods')}|14|xphb`]: toggled([
    uses('rage-of-the-gods', 'Rage of the Gods', 1, 'long'),
    {
      type: 'toggle',
      toggleId: 'rage-of-the-gods',
      name: 'Rage of the Gods',
      cost: [{ resource: 'rage-of-the-gods', amount: 1 }],
      endsOn: ['shortRest', 'longRest'],
      effects: [
        { type: 'speed', mode: 'fly', value: 'walk' },
        { type: 'resistance', value: 'necrotic' },
        { type: 'resistance', value: 'psychic' },
        { type: 'resistance', value: 'radiant' },
      ],
    },
  ]),
};
