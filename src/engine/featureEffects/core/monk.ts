// Monk and its four XPHB subclasses (plan §10.2, step 6.8), checked against the 2024 Player's
// Handbook text of each feature. Martial Arts changes Unarmed Strikes and Monk weapons while
// unarmored; Focus Points are a counter that Flurry of Blows, Patient Defense, Step of the Wind,
// Stunning Strike and the subclasses spend. Shadow's and Elements' spells come from their data.

import type { Effect } from '../../../schema/index.ts';
import type { FeatureEffectsMap } from '../types.ts';
import { action, AT_TABLE, dc, fromData, numbers, text, toggled, uses, when } from './helpers.ts';

const C = (id: string, level: number) => `classFeature:${id}|monk|xphb|${level}|xphb` as const;
const S = (sub: string, id: string, level: number) =>
  `subclassFeature:${id}|monk|xphb|${sub}|xphb|${level}|xphb` as const;

const focus = (amount = 1) => ({ resource: 'focus-points', amount });
const unarmored = { all: [{ armor: 'none' as const }, { shield: false }] };
const monkAttacks = [{ source: ['unarmed' as const] }, { tags: ['monkWeapon'] }];
const martialArtsDie = 'table.martial-arts';
const ALL_BUT_FORCE = [
  'acid',
  'bludgeoning',
  'cold',
  'fire',
  'lightning',
  'necrotic',
  'piercing',
  'poison',
  'psychic',
  'radiant',
  'slashing',
  'thunder',
];

export const MONK: FeatureEffectsMap = {
  [C('martial arts', 1)]: text(),
  [C('bonus unarmed strike', 1)]: numbers([
    action({
      id: 'bonus-unarmed-strike',
      name: 'Bonus Unarmed Strike',
      actionType: 'bonus',
      attack: { source: ['unarmed'] },
    }),
  ]),
  [C('martial arts die', 1)]: numbers([
    when(
      unarmored,
      monkAttacks.map((filter): Effect => ({
        type: 'attackMod',
        label: 'Martial Arts',
        filter,
        damageDie: martialArtsDie,
      })),
    ),
  ]),
  [C('dexterous attacks', 1)]: numbers([
    when(
      unarmored,
      monkAttacks.map((filter): Effect => ({
        type: 'attackMod',
        label: 'Dexterous Attacks',
        filter,
        abilities: ['str', 'dex'],
      })),
    ),
  ]),
  [C('unarmored defense', 1)]: numbers([
    {
      type: 'acFormula',
      name: 'Unarmored Defense',
      base: 10,
      addAbilities: ['dex', 'wis'],
      shield: false,
    },
  ]),
  [C("monk's focus", 2)]: numbers([
    uses('focus-points', 'Focus Points', 'table.focus-points', 'short'),
  ]),
  [C('flurry of blows', 2)]: numbers([
    action({
      id: 'flurry-of-blows',
      name: 'Flurry of Blows',
      actionType: 'bonus',
      costs: [focus()],
      attack: { source: ['unarmed'] },
    }),
  ]),
  [C('patient defense', 2)]: numbers([
    action({
      id: 'patient-defense',
      name: 'Patient Defense',
      actionType: 'bonus',
      costs: [focus()],
    }),
  ]),
  [C('step of the wind', 2)]: numbers([
    action({
      id: 'step-of-the-wind',
      name: 'Step of the Wind',
      actionType: 'bonus',
      costs: [focus()],
    }),
  ]),
  [C('unarmored movement', 2)]: numbers([
    when(unarmored, [{ type: 'speedBonus', value: 'table.unarmored-movement' }]),
  ]),
  [C('uncanny metabolism', 2)]: numbers([
    uses('uncanny-metabolism', 'Uncanny Metabolism', 1, 'long'),
    action({
      id: 'uncanny-metabolism',
      name: 'Uncanny Metabolism',
      actionType: 'other',
      costs: [{ resource: 'uncanny-metabolism', amount: 1 }],
      outcomes: [
        { restore: { resource: 'focus-points', amount: 'resource.focus-points.max' } },
        { heal: `${martialArtsDie} + level.monk` },
      ],
    }),
  ]),
  [C('deflect attacks', 3)]: numbers(
    [
      action({
        id: 'deflect-attacks',
        name: 'Deflect Attacks',
        actionType: 'reaction',
        roll: '1d10 + mod.dex + level.monk',
        saveDc: dc('wis'),
      }),
    ],
    { unoffered: AT_TABLE },
  ),
  [C('monk subclass', 3)]: text(),
  ...Object.fromEntries(
    [4, 8, 12, 16].map((level) => [C('ability score improvement', level), fromData()]),
  ),
  [C('slow fall', 4)]: numbers([
    action({ id: 'slow-fall', name: 'Slow Fall', actionType: 'reaction', roll: '5 * level.monk' }),
  ]),
  [C('extra attack', 5)]: numbers([{ type: 'extraAttack', count: 2 }]),
  [C('stunning strike', 5)]: numbers([
    action({
      id: 'stunning-strike',
      name: 'Stunning Strike',
      actionType: 'other',
      costs: [focus()],
      saveDc: dc('wis'),
    }),
  ]),
  [C('empowered strikes', 6)]: text(),
  [C('subclass feature', 6)]: text(),
  [C('subclass feature', 11)]: text(),
  [C('subclass feature', 17)]: text(),
  [C('evasion', 7)]: text(),
  [C('acrobatic movement', 9)]: text(),
  [C('heightened focus', 10)]: text({ unoffered: AT_TABLE }),
  [C('self-restoration', 10)]: text(),
  [C('deflect energy', 13)]: text(),
  [C('disciplined survivor', 14)]: numbers(
    (['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((value): Effect => ({
      type: 'proficiency',
      category: 'save',
      value,
    })),
  ),
  [C('perfect focus', 15)]: text(),
  [C('superior defense', 18)]: toggled([
    {
      type: 'toggle',
      toggleId: 'superior-defense',
      name: 'Superior Defense',
      cost: [focus(3)],
      endsOn: ['shortRest', 'longRest'],
      effects: ALL_BUT_FORCE.map((value): Effect => ({ type: 'resistance', value })),
    },
  ]),
  [C('epic boon', 19)]: text(),
  [C('body and mind', 20)]: numbers([
    { type: 'abilityBonus', ability: 'dex', value: 4, max: 25 },
    { type: 'abilityBonus', ability: 'wis', value: 4, max: 25 },
  ]),

  // ---- Warrior of Mercy ----
  [S('mercy', 'warrior of mercy', 3)]: text(),
  [S('mercy', 'hand of harm', 3)]: numbers([
    {
      type: 'damageRider',
      id: 'hand-of-harm',
      name: 'Hand of Harm',
      dice: `${martialArtsDie} + mod.wis`,
      damageType: 'necrotic',
      filter: { source: ['unarmed'] },
      oncePerTurn: true,
      cost: focus(),
      optIn: true,
    },
  ]),
  [S('mercy', 'hand of healing', 3)]: numbers([
    action({
      id: 'hand-of-healing',
      name: 'Hand of Healing',
      actionType: 'action',
      costs: [focus()],
      roll: `${martialArtsDie} + mod.wis`,
    }),
  ]),
  [S('mercy', 'implements of mercy', 3)]: numbers([
    { type: 'proficiency', category: 'skill', value: 'insight' },
    { type: 'proficiency', category: 'skill', value: 'medicine' },
    { type: 'proficiency', category: 'tool', value: 'herbalism kit|xphb' },
  ]),
  [S('mercy', "physician's touch", 6)]: text(),
  [S('mercy', 'flurry of healing and harm', 11)]: numbers([
    uses('flurry-of-healing-and-harm', 'Flurry of Healing and Harm', 'max(1, mod.wis)', 'long'),
  ]),
  [S('mercy', 'hand of ultimate mercy', 17)]: numbers([
    uses('hand-of-ultimate-mercy', 'Hand of Ultimate Mercy', 1, 'long'),
    action({
      id: 'hand-of-ultimate-mercy',
      name: 'Hand of Ultimate Mercy',
      actionType: 'action',
      costs: [{ resource: 'hand-of-ultimate-mercy', amount: 1 }, focus(5)],
      roll: '4d10 + mod.wis',
    }),
  ]),

  // ---- Warrior of Shadow ----
  [S('shadow', 'warrior of shadow', 3)]: text(),
  [S('shadow', 'shadow arts', 3)]: text(),
  [S('shadow', 'darkness', 3)]: text(),
  [S('shadow', 'darkvision', 3)]: numbers([{ type: 'sense', sense: 'darkvision', range: 60 }]),
  [S('shadow', 'shadowy figments', 3)]: text(),
  [S('shadow', 'shadow step', 6)]: numbers([
    action({ id: 'shadow-step', name: 'Shadow Step', actionType: 'bonus' }),
  ]),
  [S('shadow', 'improved shadow step', 11)]: text(),
  [S('shadow', 'cloak of shadows', 17)]: numbers([
    action({
      id: 'cloak-of-shadows',
      name: 'Cloak of Shadows',
      actionType: 'action',
      costs: [focus(3)],
    }),
  ]),

  // ---- Warrior of the Elements ----
  [S('elements', 'warrior of the elements', 3)]: text(),
  [S('elements', 'elemental attunement', 3)]: toggled([
    {
      type: 'toggle',
      toggleId: 'elemental-attunement',
      name: 'Elemental Attunement',
      cost: [focus()],
      endsOn: ['shortRest', 'longRest'],
      effects: [],
    },
  ]),
  [S('elements', 'manipulate elements', 3)]: text(),
  [S('elements', 'elemental burst', 6)]: numbers(
    [
      action({
        id: 'elemental-burst',
        name: 'Elemental Burst',
        actionType: 'action',
        costs: [focus(2)],
        roll: `3 * ${martialArtsDie}`,
        saveDc: dc('wis'),
      }),
    ],
    { unoffered: AT_TABLE },
  ),
  [S('elements', 'stride of the elements', 11)]: numbers([
    when({ toggle: 'elemental-attunement' }, [
      { type: 'speed', mode: 'fly', value: 'walk' },
      { type: 'speed', mode: 'swim', value: 'walk' },
    ]),
  ]),
  [S('elements', 'elemental epitome', 17)]: numbers(
    [
      when({ toggle: 'elemental-attunement' }, [
        {
          type: 'damageRider',
          id: 'empowered-strikes',
          name: 'Empowered Strikes',
          dice: martialArtsDie,
          filter: { source: ['unarmed'] },
          oncePerTurn: true,
          optIn: true,
        },
      ]),
    ],
    { unoffered: AT_TABLE },
  ),

  // ---- Warrior of the Open Hand ----
  [S('open hand', 'warrior of the open hand', 3)]: text(),
  [S('open hand', 'open hand technique', 3)]: numbers([
    action({
      id: 'open-hand-technique',
      name: 'Open Hand Technique',
      actionType: 'other',
      saveDc: dc('wis'),
    }),
  ]),
  [S('open hand', 'wholeness of body', 6)]: numbers([
    uses('wholeness-of-body', 'Wholeness of Body', 'max(1, mod.wis)', 'long'),
    action({
      id: 'wholeness-of-body',
      name: 'Wholeness of Body',
      actionType: 'bonus',
      costs: [{ resource: 'wholeness-of-body', amount: 1 }],
      outcomes: [{ heal: `${martialArtsDie} + mod.wis` }],
    }),
  ]),
  [S('open hand', 'fleet step', 11)]: text(),
  [S('open hand', 'quivering palm', 17)]: numbers([
    action({
      id: 'quivering-palm',
      name: 'Quivering Palm',
      actionType: 'other',
      costs: [focus(4)],
      roll: '10d12',
      saveDc: dc('wis'),
    }),
  ]),
};
