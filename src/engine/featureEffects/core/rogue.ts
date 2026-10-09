// Rogue and its four XPHB subclasses (plan §10.2, step 6.11), checked against the 2024
// Player's Handbook text of each feature. Sneak Attack is a rider with its dice from the table;
// Cunning Strike's options stay text (their die cost is in their names), with the save DC
// worked out. Soulknife's Psychic Blade is an attack of its own. Expertise, Thieves' Cant and
// Weapon Mastery are in `levels1to3.ts` and `levels4to20.ts`; Arcane Trickster's spellcasting
// comes from its data (step 3.7).

import { refKey, SKILLS, type Effect } from '../../../schema/index.ts';
import type { FeatureEffectsMap } from '../types.ts';
import {
  action,
  attacksAgainst,
  dc,
  fromData,
  numbers,
  restoredBy,
  TARGETS,
  text,
  uses,
} from './helpers.ts';

// Built with `refKey`: Cunning Strike's option ids hold a colon (`poison (cost: 1d6)`).
const C = (id: string, level: number) =>
  refKey({ kind: 'classFeature', id: `${id}|rogue|xphb|${level}|xphb` });
const S = (sub: string, id: string, level: number) =>
  refKey({ kind: 'subclassFeature', id: `${id}|rogue|xphb|${sub}|xphb|${level}|xphb` });

const psionic = { resource: 'psionic-energy', amount: 1 };

export const ROGUE: FeatureEffectsMap = {
  [C('sneak attack', 1)]: numbers([
    {
      type: 'damageRider',
      id: 'sneak-attack',
      name: 'Sneak Attack',
      dice: 'table.sneak-attack',
      filter: { source: ['weapon'], any: [{ properties: ['F'] }, { range: 'ranged' }] },
      oncePerTurn: true,
      optIn: true,
    },
  ]),
  [C('cunning action', 2)]: numbers([
    action({ id: 'cunning-action', name: 'Cunning Action', actionType: 'bonus' }),
  ]),
  [C('rogue subclass', 3)]: text(),
  [C('steady aim', 3)]: numbers([
    action({ id: 'steady-aim', name: 'Steady Aim', actionType: 'bonus' }),
  ]),
  ...Object.fromEntries(
    [4, 8, 10, 12, 16].map((level) => [C('ability score improvement', level), fromData()]),
  ),
  [C('cunning strike', 5)]: numbers([
    action({
      id: 'cunning-strike',
      name: 'Cunning Strike',
      actionType: 'other',
      saveDc: dc('dex'),
    }),
  ]),
  [C('poison (cost: 1d6)', 5)]: text(),
  [C('trip (cost: 1d6)', 5)]: text(),
  [C('withdraw (cost: 1d6)', 5)]: text(),
  [C('uncanny dodge', 5)]: numbers([
    action({ id: 'uncanny-dodge', name: 'Uncanny Dodge', actionType: 'reaction' }),
  ]),
  [C('evasion', 7)]: text(),
  [C('reliable talent', 7)]: numbers(
    SKILLS.map((s): Effect => ({
      type: 'rollFloor',
      target: `skill:${s}`,
      value: 10,
      proficientOnly: true,
    })),
  ),
  [C('subclass feature', 9)]: text(),
  [C('subclass feature', 13)]: text(),
  [C('subclass feature', 17)]: text(),
  [C('improved cunning strike', 11)]: text(),
  [C('devious strikes', 14)]: text(),
  [C('daze (cost: 2d6)', 14)]: text(),
  [C('knock out (cost: 6d6)', 14)]: text(),
  [C('obscure (cost: 3d6)', 14)]: text(),
  [C('slippery mind', 15)]: numbers([
    { type: 'proficiency', category: 'save', value: 'wis' },
    { type: 'proficiency', category: 'save', value: 'cha' },
  ]),
  [C('elusive', 18)]: text(),
  [C('epic boon', 19)]: text(),
  [C('stroke of luck', 20)]: numbers([
    uses('stroke-of-luck', 'Stroke of Luck', 1, 'short'),
    action({
      id: 'stroke-of-luck',
      name: 'Stroke of Luck',
      actionType: 'other',
      costs: [{ resource: 'stroke-of-luck', amount: 1 }],
    }),
  ]),

  // ---- Arcane Trickster ----
  [S('arcane trickster', 'arcane trickster', 3)]: text(),
  [S('arcane trickster', 'spellcasting', 3)]: text(),
  [S('arcane trickster', 'mage hand legerdemain', 3)]: text(),
  [S('arcane trickster', 'magical ambush', 9)]: text(),
  [S('arcane trickster', 'versatile trickster', 13)]: text(),
  [S('arcane trickster', 'spell thief', 17)]: numbers([
    uses('spell-thief', 'Spell Thief', 1, 'long'),
    action({
      id: 'spell-thief',
      name: 'Spell Thief',
      actionType: 'reaction',
      costs: [{ resource: 'spell-thief', amount: 1 }],
      saveDc: dc('int'),
    }),
  ]),

  // ---- Assassin ----
  [S('assassin', 'assassin', 3)]: text(),
  [S('assassin', 'assassinate', 3)]: numbers([
    { type: 'rollMode', target: 'initiative', mode: 'advantage' },
    attacksAgainst('creatures that haven’t taken a turn yet (first round of combat)'),
    {
      type: 'damageRider',
      id: 'surprising-strikes',
      name: 'Surprising Strikes (first round)',
      dice: 'level.rogue',
      filter: { source: ['weapon'] },
      oncePerTurn: true,
      optIn: true,
    },
  ]),
  [S('assassin', "assassin's tools", 3)]: numbers([
    { type: 'proficiency', category: 'tool', value: 'disguise kit|xphb' },
    { type: 'proficiency', category: 'tool', value: "poisoner's kit|xphb" },
  ]),
  [S('assassin', 'infiltration expertise', 9)]: text(),
  [S('assassin', 'envenom weapons', 13)]: text(),
  [S('assassin', 'death strike', 17)]: numbers([
    action({ id: 'death-strike', name: 'Death Strike', actionType: 'other', saveDc: dc('dex') }),
  ]),

  // ---- Soulknife ----
  [S('soulknife', 'soulknife', 3)]: text(),
  [S('soulknife', 'psionic power', 3)]: numbers([
    uses('psionic-energy', 'Psionic Energy Dice', 'table.number', 'shortOne', {
      die: 'table.die-size',
    }),
  ]),
  [S('soulknife', 'psi-bolstered knack', 3)]: numbers([
    action({
      id: 'psi-bolstered-knack',
      name: 'Psi-Bolstered Knack',
      actionType: 'other',
      roll: 'table.die-size',
    }),
  ]),
  [S('soulknife', 'psychic whispers', 3)]: numbers(
    [
      action({
        id: 'psychic-whispers',
        name: 'Psychic Whispers',
        actionType: 'action',
        roll: 'table.die-size',
      }),
    ],
    { unoffered: TARGETS },
  ),
  [S('soulknife', 'psychic blades', 3)]: numbers([
    {
      type: 'attack',
      id: 'psychic-blade',
      name: 'Psychic Blade',
      damage: '1d6',
      damageType: 'psychic',
      range: 'melee',
      distance: '5 ft. or 60/120 ft.',
      abilities: ['str', 'dex'],
      properties: ['F', 'T'],
    },
  ]),
  [S('soulknife', 'soul blades', 9)]: text(),
  [S('soulknife', 'homing strikes', 9)]: numbers([
    action({
      id: 'homing-strikes',
      name: 'Homing Strikes',
      actionType: 'other',
      roll: 'table.die-size',
    }),
  ]),
  [S('soulknife', 'psychic teleportation', 9)]: numbers([
    action({
      id: 'psychic-teleportation',
      name: 'Psychic Teleportation',
      actionType: 'bonus',
      costs: [psionic],
      roll: 'table.die-size',
    }),
  ]),
  [S('soulknife', 'psychic veil', 13)]: numbers([
    uses('psychic-veil', 'Psychic Veil', 1, 'long'),
    restoredBy('psychic-veil', psionic),
    action({
      id: 'psychic-veil',
      name: 'Psychic Veil',
      actionType: 'action',
      costs: [{ resource: 'psychic-veil', amount: 1 }],
    }),
  ]),
  [S('soulknife', 'rend mind', 17)]: numbers([
    uses('rend-mind', 'Rend Mind', 1, 'long'),
    restoredBy('rend-mind', { resource: 'psionic-energy', amount: 3 }),
    action({
      id: 'rend-mind',
      name: 'Rend Mind',
      actionType: 'other',
      costs: [{ resource: 'rend-mind', amount: 1 }],
      saveDc: dc('dex'),
    }),
  ]),

  // ---- Thief ----
  [S('thief', 'thief', 3)]: text(),
  [S('thief', 'fast hands', 3)]: numbers([
    action({ id: 'fast-hands', name: 'Fast Hands', actionType: 'bonus' }),
  ]),
  [S('thief', 'second-story work', 3)]: numbers([{ type: 'speed', mode: 'climb', value: 'walk' }]),
  [S('thief', 'supreme sneak', 9)]: text(),
  [S('thief', 'use magic device', 13)]: text(),
  [S('thief', "thief's reflexes", 17)]: text(),
};
