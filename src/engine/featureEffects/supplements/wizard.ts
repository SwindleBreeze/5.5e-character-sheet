// Wizard subclasses from the 2024 supplements (plan §10.2, step 6.16): the Bladesinger (FRHoF)
// and the Conjurer, Enchanter, Necromancer and Transmuter (AU). The savants' free spells and the
// always-prepared spells come from the subclass data, as for the XPHB schools. Bladesong is a
// switch; so are carrying the Transmuter's Stone and being under Alter Self.

import type { Effect } from '../../../schema/index.ts';
import type { FeatureEffectsMap } from '../types.ts';
import {
  action,
  AT_TABLE,
  dc,
  numbers,
  restoredBy,
  TARGETS,
  text,
  toggled,
  uses,
  when,
} from '../core/helpers.ts';

const S = (sub: string, src: string, id: string, level: number) =>
  `subclassFeature:${id}|wizard|xphb|${sub}|${src}|${level}|${src}` as const;
const B = (id: string, level: number) => S('bladesinger', 'frhof', id, level);
const AU = (sub: string, id: string, level: number) => S(sub, 'au', id, level);

const intUses = 'max(1, mod.int)';
const unarmored = { all: [{ armor: 'none' as const }, { shield: false }] };
const bladesong = { toggle: 'bladesong' };
const stone = { toggle: 'transmuters-stone' };

/** Uses equal to Intelligence (minimum once) per Long Rest, and the action that spends one. */
function intAction(
  id: string,
  name: string,
  def: Partial<Parameters<typeof action>[0]> = {},
  max = intUses,
): Effect[] {
  return [
    uses(id, name, max, 'long'),
    action({ id, name, actionType: 'other', costs: [{ resource: id, amount: 1 }], ...def }),
  ];
}

/** Pick one of these named options; `ifChoice` effects for each. */
function pickOne(
  slot: string,
  options: [id: string, label: string, effects: Effect[]][],
  retrain?: 'longRest',
): Effect[] {
  return [
    {
      type: 'optionChoice',
      choice: {
        slot,
        count: 1,
        from: options.map(([id]) => id),
        ...(retrain ? { retrain } : {}),
      },
      labels: options.map(([, label]) => label),
    },
    ...options.map(([value, , effects]): Effect => ({ type: 'ifChoice', slot, value, effects })),
  ];
}

/** Transmuter's Stone benefits (Potent Stone adds two more). */
const STONE_RESISTANCES = ['acid', 'cold', 'fire', 'lightning', 'poison', 'thunder'];
const stoneBenefits = (): [string, string, Effect[]][] => [
  ['darkvision', 'Darkvision', [{ type: 'sense', sense: 'darkvision', range: 60 }]],
  ...STONE_RESISTANCES.map((type): [string, string, Effect[]] => [
    `resistance-${type}`,
    `Resistance (${type[0]!.toUpperCase()}${type.slice(1)})`,
    [{ type: 'resistance', value: type }],
  ]),
  ['speed', 'Speed', [{ type: 'speedBonus', value: 10 }]],
];

/** A stone benefit counts only while the stone is carried. */
const whileCarried = (effects: Effect[]) =>
  effects.map((e) => (e.type === 'ifChoice' ? when(stone, [e]) : e));

/** Martial Melee weapons without the Heavy or Two-Handed property. */
const BLADE_WEAPONS = [
  'battleaxe',
  'flail',
  'longsword',
  'morningstar',
  'rapier',
  'scimitar',
  'shortsword',
  'trident',
  'war pick',
  'warhammer',
  'whip',
];

export const SUP_WIZARD: FeatureEffectsMap = {
  // ---- Bladesinger (FRHoF) ----
  [B('bladesinger', 3)]: text(),
  [B('bladesong', 3)]: toggled(
    [
      uses('bladesong', 'Bladesong', intUses, 'long'),
      {
        type: 'toggle',
        toggleId: 'bladesong',
        name: 'Bladesong',
        cost: [{ resource: 'bladesong', amount: 1 }, { action: 'bonus' }],
        endsOn: ['shortRest', 'longRest'],
        effects: [
          when(unarmored, [
            { type: 'acBonus', value: intUses },
            { type: 'speedBonus', value: 10 },
            { type: 'rollMode', target: 'skill:acrobatics', mode: 'advantage' },
            {
              type: 'attackMod',
              label: 'Bladesong',
              filter: { source: ['weapon'] },
              abilities: ['int'],
            },
            { type: 'rollBonus', target: 'save:concentration', value: 'mod.int' },
          ]),
        ],
      },
    ],
    {
      notes:
        'Intelligence only with weapons you are proficient with. Arcane Recovery gives back one use.',
    },
  ),
  [B('training in war and song', 3)]: numbers([
    ...BLADE_WEAPONS.map((w): Effect => ({
      type: 'proficiency',
      category: 'weapon',
      value: `${w}|xphb`,
    })),
    {
      type: 'proficiencyChoice',
      category: 'skill',
      choice: {
        slot: 'skill',
        count: 1,
        from: ['acrobatics', 'athletics', 'performance', 'persuasion'],
      },
    },
  ]),
  [B('extra attack', 6)]: numbers([{ type: 'extraAttack', count: 2 }]),
  [B('song of defense', 10)]: numbers([
    when(bladesong, [
      action({
        id: 'song-of-defense',
        name: 'Song of Defense',
        actionType: 'reaction',
        costs: [{ slot: { minLevel: 1 } }],
      }),
    ]),
  ]),
  [B('song of victory', 14)]: numbers([
    action({
      id: 'song-of-victory',
      name: 'Song of Victory',
      actionType: 'bonus',
      attack: { source: ['weapon'] },
    }),
  ]),

  // ---- Conjurer (AU) ----
  [AU('conjurer', 'conjurer', 3)]: text(),
  [AU('conjurer', 'benign transposition', 3)]: numbers(
    intAction('benign-transposition', 'Benign Transposition', { actionType: 'bonus' }),
  ),
  [AU('conjurer', 'conjuration savant', 3)]: text(),
  [AU('conjurer', 'distant transposition', 6)]: numbers([
    restoredBy('benign-transposition', { slot: { minLevel: 3 } }),
  ]),
  [AU('conjurer', 'durable summons', 6)]: text(),
  [AU('conjurer', 'focused conjuration', 10)]: text(),
  [AU('conjurer', 'splintered summons', 14)]: numbers(
    [
      uses('splintered-summons', 'Splintered Summons', 1, 'long'),
      restoredBy('splintered-summons', { slot: { minLevel: 5 } }),
    ],
    { unoffered: AT_TABLE },
  ),

  // ---- Enchanter (AU) ----
  [AU('enchanter', 'enchanter', 3)]: text(),
  [AU('enchanter', 'enchanting conversationalist', 3)]: numbers([
    {
      type: 'proficiencyChoice',
      category: 'skill',
      choice: { slot: 'skill', count: 1, from: ['deception', 'intimidation', 'persuasion'] },
    },
    ...(['deception', 'intimidation', 'persuasion'] as const).map((skill): Effect => ({
      type: 'ifChoice',
      slot: 'skill',
      value: skill,
      effects: [{ type: 'rollBonus', target: `skill:${skill}`, value: intUses }],
    })),
  ]),
  [AU('enchanter', 'enchantment savant', 3)]: text(),
  [AU('enchanter', 'hypnotic presence', 3)]: numbers(
    intAction('hypnotic-presence', 'Hypnotic Presence', {
      actionType: 'action',
      saveDc: dc('int'),
    }),
    { unoffered: TARGETS },
  ),
  [AU('enchanter', 'split enchantment', 6)]: numbers([
    uses('split-enchantment', 'Split Enchantment', 'max(0, mod.int)', 'long'),
  ]),
  [AU('enchanter', 'instinctive charm', 10)]: numbers(
    [
      uses('instinctive-charm', 'Instinctive Charm', 1, 'long'),
      restoredBy('instinctive-charm', { slot: { minLevel: 1 } }),
      action({
        id: 'instinctive-charm',
        name: 'Instinctive Charm',
        actionType: 'reaction',
        costs: [{ resource: 'instinctive-charm', amount: 1 }],
        saveDc: dc('int'),
      }),
    ],
    { notes: 'Only an Enchantment spell cast with a slot restores it.', unoffered: TARGETS },
  ),
  [AU('enchanter', 'alter memories', 14)]: numbers(
    [
      action({
        id: 'alter-memories',
        name: 'Alter Memories',
        actionType: 'action',
        saveDc: dc('int'),
      }),
    ],
    { unoffered: TARGETS },
  ),

  // ---- Necromancer (AU) ----
  [AU('necromancer', 'necromancer', 3)]: text(),
  [AU('necromancer', 'necromancy savant', 3)]: text(),
  [AU('necromancer', 'necromancy spellbook', 3)]: numbers([
    { type: 'resistance', value: 'necrotic' },
  ]),
  [AU('necromancer', 'grave power', 6)]: text(),
  [AU('necromancer', 'undead thralls', 6)]: text(),
  [AU('necromancer', 'harvest undead', 10)]: numbers([
    action({
      id: 'harvest-undead',
      name: 'Harvest Undead',
      actionType: 'reaction',
      outcomes: [{ heal: 'level.wizard' }],
    }),
  ]),
  [AU('necromancer', "death's master", 14)]: numbers(
    [
      uses('bolster-undead', 'Bolster Undead', 1, 'long'),
      action({
        id: 'bolster-undead',
        name: 'Bolster Undead',
        actionType: 'bonus',
        costs: [{ resource: 'bolster-undead', amount: 1 }],
      }),
    ],
    { unoffered: TARGETS },
  ),

  // ---- Transmuter (AU) ----
  [AU('transmuter', 'transmuter', 3)]: text(),
  [AU('transmuter', 'transmutation savant', 3)]: text(),
  [AU('transmuter', "transmuter's stone", 3)]: toggled(
    [
      ...whileCarried(pickOne('benefit', stoneBenefits(), 'longRest')),
      {
        type: 'toggle',
        toggleId: 'transmuters-stone',
        name: "Carrying your Transmuter's Stone",
        effects: [{ type: 'proficiency', category: 'save', value: 'con' }],
      },
    ],
    { notes: 'The benefit applies while you carry the stone yourself.' },
  ),
  [AU('transmuter', 'wondrous alteration', 3)]: toggled([
    {
      type: 'toggle',
      toggleId: 'alter-self',
      name: 'Alter Self',
      effects: [],
      options: [
        { id: 'aquatic-adaptation', name: 'Aquatic Adaptation', effects: [] },
        {
          id: 'change-appearance',
          name: 'Change Appearance',
          effects: [{ type: 'rollMode', target: 'skill:deception', mode: 'advantage' }],
        },
        {
          id: 'natural-weapons',
          name: 'Natural Weapons',
          effects: [
            {
              type: 'attackMod',
              label: 'Natural Weapons',
              filter: { source: ['unarmed'] },
              abilities: ['int'],
              damageDie: '2d6',
            },
            { type: 'rollMode', target: 'save:concentration', mode: 'advantage' },
          ],
        },
      ],
    },
  ]),
  [AU('transmuter', 'empowered transmutation', 6)]: numbers([
    uses('empowered-transmutation', 'Empowered Transmutation', intUses, 'long'),
  ]),
  [AU('transmuter', 'potent stone', 10)]: numbers(
    whileCarried(
      pickOne(
        'benefit',
        [
          ...stoneBenefits(),
          [
            'mighty-build',
            'Mighty Build',
            [
              { type: 'rollMode', target: 'save:str', mode: 'advantage' },
              { type: 'carrySize', steps: 1 },
            ],
          ],
          ['tremorsense', 'Tremorsense', [{ type: 'sense', sense: 'tremorsense', range: 30 }]],
        ],
        'longRest',
      ),
    ),
    { notes: 'A second stone benefit, different from the first (two Resistances may differ).' },
  ),
  [AU('transmuter', 'shape-shifter', 10)]: numbers([
    uses('shape-shifter', 'Shape-Shifter', 1, 'long'),
  ]),
  [AU('transmuter', 'master transmuter', 14)]: numbers(
    [action({ id: 'master-transmuter', name: 'Master Transmuter', actionType: 'action' })],
    { unoffered: AT_TABLE },
  ),
};
