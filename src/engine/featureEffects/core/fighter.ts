// Fighter and its four XPHB subclasses (plan §10.2, step 6.7), checked against the 2024
// Player's Handbook text of each feature. Second Wind, Action Surge and Indomitable are counters
// with actions; Battle Master's Superiority Dice and Psi Warrior's Psionic Energy Dice are
// counters with dice, which the maneuvers' and powers' own data spend. Weapon Mastery is in
// `levels1to3.ts`; Eldritch Knight's spellcasting comes from its data (step 3.7).

import type { FeatureEffectsMap } from '../types.ts';
import { action, dc, fromData, numbers, restoredBy, TARGETS, text, uses } from './helpers.ts';

const C = (id: string, level: number) => `classFeature:${id}|fighter|xphb|${level}|xphb` as const;
const S = (sub: string, id: string, level: number) =>
  `subclassFeature:${id}|fighter|xphb|${sub}|xphb|${level}|xphb` as const;

const secondWind = { resource: 'second-wind', amount: 1 };
const superiority = { resource: 'superiority-dice', amount: 1 };
const psionic = { resource: 'psionic-energy', amount: 1 };

/** A Psi Warrior power used once per rest, or again for a Psionic Energy Die. */
function power(
  id: string,
  name: string,
  recharge: 'short' | 'long',
  actionType: 'action' | 'bonus',
) {
  return [
    uses(id, name, 1, recharge),
    restoredBy(id, psionic),
    action({ id, name, actionType, costs: [{ resource: id, amount: 1 }] }),
  ];
}

export const FIGHTER: FeatureEffectsMap = {
  [C('fighting style', 1)]: text(),
  [C('second wind', 1)]: numbers([
    uses('second-wind', 'Second Wind', 'table.second-wind', 'shortOne'),
    action({
      id: 'second-wind',
      name: 'Second Wind',
      actionType: 'bonus',
      costs: [secondWind],
      outcomes: [{ heal: '1d10 + level.fighter' }],
    }),
  ]),
  [C('action surge', 2)]: numbers([
    uses('action-surge', 'Action Surge', 'steps(level.fighter, 2, 1, 17, 2)', 'short'),
    action({
      id: 'action-surge',
      name: 'Action Surge',
      actionType: 'other',
      costs: [{ resource: 'action-surge', amount: 1 }],
    }),
  ]),
  [C('action surge', 17)]: text(),
  [C('tactical mind', 2)]: numbers([
    action({
      id: 'tactical-mind',
      name: 'Tactical Mind',
      actionType: 'other',
      costs: [secondWind],
      roll: '1d10',
    }),
  ]),
  [C('fighter subclass', 3)]: text(),
  ...Object.fromEntries(
    [4, 6, 8, 12, 14, 16].map((level) => [C('ability score improvement', level), fromData()]),
  ),
  [C('extra attack', 5)]: numbers([{ type: 'extraAttack', count: 2 }]),
  [C('two extra attacks', 11)]: numbers([{ type: 'extraAttack', count: 3 }]),
  [C('three extra attacks', 20)]: numbers([{ type: 'extraAttack', count: 4 }]),
  [C('tactical shift', 5)]: text(),
  [C('subclass feature', 7)]: text(),
  [C('subclass feature', 10)]: text(),
  [C('subclass feature', 15)]: text(),
  [C('subclass feature', 18)]: text(),
  [C('indomitable', 9)]: numbers([
    uses('indomitable', 'Indomitable', 'steps(level.fighter, 9, 1, 13, 2, 17, 3)', 'long'),
    action({
      id: 'indomitable',
      name: 'Indomitable',
      actionType: 'other',
      costs: [{ resource: 'indomitable', amount: 1 }],
    }),
  ]),
  [C('indomitable', 13)]: text(),
  [C('indomitable', 17)]: text(),
  [C('tactical master', 9)]: text(),
  [C('studied attacks', 13)]: text(),
  [C('epic boon', 19)]: text(),

  // ---- Battle Master ----
  [S('battle master', 'battle master', 3)]: text(),
  [S('battle master', 'combat superiority', 3)]: numbers([
    uses(
      'superiority-dice',
      'Superiority Dice',
      'steps(level.fighter, 3, 4, 7, 5, 15, 6)',
      'short',
      {
        die: 'steps(level.fighter, 3, d8, 10, d10, 18, d12)',
      },
    ),
    // The maneuvers' save DC, worked out: the better of Strength and Dexterity.
    action({
      id: 'maneuver-dc',
      name: 'Maneuver save DC',
      actionType: 'other',
      saveDc: '8 + max(mod.str, mod.dex) + pb',
    }),
  ]),
  [S('battle master', 'student of war', 3)]: numbers([
    {
      type: 'proficiencyChoice',
      category: 'tool',
      choice: { slot: 'tools', count: 1, from: 'any' },
      filter: 'artisan',
    },
    {
      type: 'proficiencyChoice',
      category: 'skill',
      choice: {
        slot: 'skills',
        count: 1,
        from: [
          'acrobatics',
          'animal handling',
          'athletics',
          'history',
          'insight',
          'intimidation',
          'persuasion',
          'perception',
          'survival',
        ],
      },
    },
  ]),
  [S('battle master', 'maneuver options', 3)]: text(),
  [S('battle master', 'know your enemy', 7)]: numbers([
    uses('know-your-enemy', 'Know Your Enemy', 1, 'long'),
    restoredBy('know-your-enemy', superiority),
    action({
      id: 'know-your-enemy',
      name: 'Know Your Enemy',
      actionType: 'bonus',
      costs: [{ resource: 'know-your-enemy', amount: 1 }],
    }),
  ]),
  [S('battle master', 'improved combat superiority', 10)]: text(),
  [S('battle master', 'relentless', 15)]: text(),
  [S('battle master', 'ultimate combat superiority', 18)]: text(),

  // ---- Champion ----
  [S('champion', 'champion', 3)]: text(),
  [S('champion', 'improved critical', 3)]: numbers([
    {
      type: 'attackMod',
      label: 'Improved Critical',
      filter: { source: ['weapon', 'unarmed'] },
      critRange: 19,
    },
  ]),
  [S('champion', 'remarkable athlete', 3)]: numbers([
    { type: 'rollMode', target: 'initiative', mode: 'advantage' },
    { type: 'rollMode', target: 'skill:athletics', mode: 'advantage' },
  ]),
  [S('champion', 'additional fighting style', 7)]: text(),
  [S('champion', 'heroic warrior', 10)]: text(),
  [S('champion', 'superior critical', 15)]: numbers([
    {
      type: 'attackMod',
      label: 'Superior Critical',
      filter: { source: ['weapon', 'unarmed'] },
      critRange: 18,
    },
  ]),
  [S('champion', 'survivor', 18)]: numbers([
    { type: 'rollMode', target: 'save:death', mode: 'advantage' },
    action({
      id: 'heroic-rally',
      name: 'Heroic Rally',
      actionType: 'other',
      outcomes: [{ heal: '5 + mod.con' }],
    }),
  ]),

  // ---- Eldritch Knight ----
  [S('eldritch knight', 'eldritch knight', 3)]: text(),
  [S('eldritch knight', 'spellcasting', 3)]: text(),
  [S('eldritch knight', 'war bond', 3)]: text(),
  [S('eldritch knight', 'war magic', 7)]: text(),
  [S('eldritch knight', 'eldritch strike', 10)]: text(),
  [S('eldritch knight', 'arcane charge', 15)]: text(),
  [S('eldritch knight', 'improved war magic', 18)]: text(),

  // ---- Psi Warrior ----
  [S('psi warrior', 'psi warrior', 3)]: text(),
  [S('psi warrior', 'psionic power', 3)]: numbers([
    uses('psionic-energy', 'Psionic Energy Dice', 'table.number', 'shortOne', {
      die: 'table.die-size',
    }),
  ]),
  [S('psi warrior', 'protective field', 3)]: numbers([
    action({
      id: 'protective-field',
      name: 'Protective Field',
      actionType: 'reaction',
      costs: [psionic],
      roll: 'table.die-size + mod.int',
    }),
  ]),
  [S('psi warrior', 'psionic strike', 3)]: numbers([
    {
      type: 'damageRider',
      id: 'psionic-strike',
      name: 'Psionic Strike',
      dice: 'table.die-size + mod.int',
      damageType: 'force',
      filter: { source: ['weapon'] },
      oncePerTurn: true,
      cost: psionic,
      optIn: true,
    },
  ]),
  [S('psi warrior', 'telekinetic movement', 3)]: numbers(
    power('telekinetic-movement', 'Telekinetic Movement', 'short', 'action'),
    {
      unoffered: TARGETS,
    },
  ),
  [S('psi warrior', 'telekinetic adept', 7)]: text(),
  [S('psi warrior', 'psi-powered leap', 7)]: numbers(
    power('psi-powered-leap', 'Psi-Powered Leap', 'short', 'bonus'),
  ),
  [S('psi warrior', 'telekinetic thrust', 7)]: numbers([
    action({
      id: 'telekinetic-thrust',
      name: 'Telekinetic Thrust',
      actionType: 'other',
      saveDc: dc('int'),
    }),
  ]),
  [S('psi warrior', 'guarded mind', 10)]: numbers([{ type: 'resistance', value: 'psychic' }]),
  [S('psi warrior', 'bulwark of force', 15)]: numbers(
    power('bulwark-of-force', 'Bulwark of Force', 'long', 'bonus'),
    {
      unoffered: TARGETS,
    },
  ),
  [S('psi warrior', 'telekinetic master', 18)]: text(),
};
