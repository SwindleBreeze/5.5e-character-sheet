// 2014 options on 2024 characters (plan step 8.3): the 2014 Ranger and Rogue subclasses that no
// 2024 book reprints. Ranger: Horizon Walker and Monster Slayer (XGE), Swarmkeeper (TCE),
// Drakewarden (FTD). Rogue: Inquisitive, Mastermind, Scout and Swashbuckler (XGE). Subclass spells
// and cantrips come from their data. Eye for Weakness rides on the core Sneak Attack's attacks;
// Slayer's Prey is a switch the Monster Slayer's later features hang off. The drake itself isn't
// tracked: its Draconic Essence is the form of a switch that gives the matching resistance.

import { refKey, type Effect, type Predicate } from '../../../schema/index.ts';
import type { FeatureEffectsMap } from '../types.ts';
import {
  action,
  AT_TABLE,
  dc,
  NO_CHOICE,
  numbers,
  restoredBy,
  TARGETS,
  text,
  toggled,
  uses,
  when,
} from '../core/helpers.ts';

const S = (cls: string, sub: string, src: string, id: string, level: number) =>
  refKey({ kind: 'subclassFeature', id: `${id}|${cls}|phb|${sub}|${src}|${level}|${src}` });
const HW = (id: string, level: number) => S('ranger', 'horizon walker', 'xge', id, level);
const MS = (id: string, level: number) => S('ranger', 'monster slayer', 'xge', id, level);
const SK = (id: string, level: number) => S('ranger', 'swarmkeeper', 'tce', id, level);
const DW = (id: string, level: number) => S('ranger', 'drakewarden', 'ftd', id, level);
const INQ = (id: string, level: number) => S('rogue', 'inquisitive', 'xge', id, level);
const MM = (id: string, level: number) => S('rogue', 'mastermind', 'xge', id, level);
const SC = (id: string, level: number) => S('rogue', 'scout', 'xge', id, level);
const SW = (id: string, level: number) => S('rogue', 'swashbuckler', 'xge', id, level);

const wisUses = 'max(1, mod.wis)';
const prey: Predicate = { toggle: 'slayers-prey' };
/** The attacks Sneak Attack applies to (the core Rogue's rider filter). */
const sneaky = {
  source: ['weapon' as const],
  any: [{ properties: ['F'] }, { range: 'ranged' as const }],
};
const ESSENCES = ['acid', 'cold', 'fire', 'lightning', 'poison'];
const title = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/** A counter and the action that spends one use of it. */
function limited(
  id: string,
  name: string,
  max: string | number,
  recharge: 'short' | 'long',
  actionType: 'action' | 'bonus' | 'reaction' | 'other',
  more: { saveDc?: string; roll?: string } = {},
): Effect[] {
  return [
    uses(id, name, max, recharge),
    action({ id, name, actionType, costs: [{ resource: id, amount: 1 }], ...more }),
  ];
}

const plainAction = (id: string, name: string, actionType: 'action' | 'bonus' | 'reaction') =>
  action({ id, name, actionType });

export const LEGACY_RANGER_ROGUE: FeatureEffectsMap = {
  // ---- Ranger: Horizon Walker ----
  [HW('horizon walker', 3)]: text(),
  [HW('horizon walker magic', 3)]: text(),
  [HW('detect portal', 3)]: numbers(
    limited('detect-portal', 'Detect Portal', 1, 'short', 'action'),
  ),
  // The extra dice as a rider; the hit's own damage type is the player's to change.
  [HW('planar warrior', 3)]: numbers(
    [
      plainAction('planar-warrior', 'Planar Warrior', 'bonus'),
      {
        type: 'damageRider',
        id: 'planar-warrior',
        name: 'Planar Warrior',
        dice: 'steps(level.ranger, 3, 1d8, 11, 2d8)',
        damageType: 'force',
        filter: { source: ['weapon'] },
        oncePerTurn: true,
        optIn: true,
      },
    ],
    {
      unoffered: TARGETS,
      notes: 'The sheet adds the extra dice only; change the hit’s type by hand.',
    },
  ),
  // A free cast with its own counter; how long it lasts is the player's.
  [HW('ethereal step', 7)]: numbers([
    {
      type: 'grantSpells',
      spells: [
        {
          mode: 'innate',
          ability: 'wis',
          uses: { count: 1, recharge: 'short' },
          spell: { id: 'etherealness|xphb' },
        },
      ],
    },
  ]),
  [HW('distant strike', 11)]: text(),
  [HW('spectral defense', 15)]: numbers([
    plainAction('spectral-defense', 'Spectral Defense', 'reaction'),
  ]),

  // ---- Ranger: Monster Slayer ----
  [MS('monster slayer', 3)]: text(),
  [MS('monster slayer magic', 3)]: text(),
  [MS("hunter's sense", 3)]: numbers(
    limited('hunters-sense', "Hunter's Sense", wisUses, 'long', 'action'),
    { unoffered: TARGETS },
  ),
  // Switched on when a target is designated; a rest switches it off.
  [MS("slayer's prey", 3)]: toggled([
    {
      type: 'toggle',
      toggleId: 'slayers-prey',
      name: "Slayer's Prey",
      cost: [{ action: 'bonus' }],
      endsOn: ['shortRest', 'longRest'],
      effects: [
        {
          type: 'damageRider',
          id: 'slayers-prey',
          name: "Slayer's Prey (its target)",
          dice: '1d6',
          filter: { source: ['weapon'] },
          oncePerTurn: true,
          optIn: true,
        },
      ],
    },
  ]),
  // Listed with the rolls while Slayer's Prey is on; the d6 is rolled by hand.
  [MS('supernatural defense', 7)]: toggled(
    [
      when(prey, [
        {
          type: 'rollNote',
          target: 'save:all',
          text: "Supernatural Defense: +1d6 (Slayer's Prey)",
        },
        ...(['athletics', 'acrobatics'] as const).map((s): Effect => ({
          type: 'rollNote',
          target: `skill:${s}`,
          text: "Supernatural Defense: +1d6 to escape (Slayer's Prey)",
        })),
      ]),
    ],
    { needs: 'a dice bonus to rolls in one situation (against one creature)' },
  ),
  [MS("magic-user's nemesis", 11)]: numbers(
    limited('magic-users-nemesis', "Magic-User's Nemesis", 1, 'short', 'reaction', {
      saveDc: dc('wis'),
    }),
  ),
  [MS("slayer's counter", 15)]: numbers([
    when(prey, [plainAction('slayers-counter', "Slayer's Counter", 'reaction')]),
  ]),

  // ---- Ranger: Swarmkeeper ----
  [SK('swarmkeeper', 3)]: text(),
  // The swarm's damage as a rider (its bigger die from Mighty Swarm too) and its save DC.
  [SK('gathered swarm', 3)]: numbers(
    [
      {
        type: 'damageRider',
        id: 'gathered-swarm',
        name: 'Gathered Swarm',
        dice: 'steps(level.ranger, 3, 1d6, 11, 1d8)',
        damageType: 'piercing',
        filter: {},
        oncePerTurn: true,
        optIn: true,
      },
      action({
        id: 'gathered-swarm',
        name: 'Gathered Swarm',
        actionType: 'other',
        saveDc: dc('wis'),
      }),
    ],
    { unoffered: AT_TABLE },
  ),
  [SK('swarmkeeper magic', 3)]: text(),
  [SK('writhing tide', 7)]: toggled([
    uses('writhing-tide', 'Writhing Tide', 'pb', 'long'),
    {
      type: 'toggle',
      toggleId: 'writhing-tide',
      name: 'Writhing Tide',
      cost: [{ resource: 'writhing-tide', amount: 1 }, { action: 'bonus' }],
      endsOn: ['shortRest', 'longRest'],
      effects: [{ type: 'speed', mode: 'fly', value: 10 }],
    },
  ]),
  // The bigger die is in Gathered Swarm's rider; the prone and the half cover are the player's.
  [SK('mighty swarm', 11)]: text(),
  [SK('swarming dispersal', 15)]: numbers(
    limited('swarming-dispersal', 'Swarming Dispersal', 'pb', 'long', 'reaction'),
  ),

  // ---- Ranger: Drakewarden ----
  [DW('drakewarden', 3)]: text(),
  // Thaumaturgy comes from the subclass's data; the language is picked here.
  [DW('draconic gift', 3)]: numbers([
    {
      type: 'proficiencyChoice',
      category: 'language',
      choice: { slot: 'language', count: 1, from: 'any' },
      filter: 'standard|rare',
    },
  ]),
  // Once per Long Rest, or again for a spell slot. The drake's stat block isn't tracked.
  [DW('drake companion', 3)]: numbers(
    [
      ...limited('drake-companion', 'Drake Companion', 1, 'long', 'action'),
      restoredBy('drake-companion', { slot: { minLevel: 1 } }),
    ],
    { unoffered: 'The drake’s damage type is picked each time it is summoned.' },
  ),
  // Switched on while the drake is summoned, in the form of its Draconic Essence.
  [DW('bond of fang and scale', 7)]: toggled(
    [
      {
        type: 'toggle',
        toggleId: 'drake-summoned',
        name: 'Drake summoned',
        effects: [],
        options: ESSENCES.map((value) => ({
          id: value,
          name: title(value),
          effects: [{ type: 'resistance', value }],
        })),
      },
    ],
    { unoffered: 'Picked as the switch’s form, each time the drake is summoned.' },
  ),
  [DW("drake's breath", 11)]: numbers(
    [
      ...limited('drakes-breath', "Drake's Breath", 1, 'long', 'action', {
        saveDc: dc('wis'),
        roll: 'steps(level.ranger, 11, 8d6, 15, 10d6)',
      }),
      restoredBy('drakes-breath', { slot: { minLevel: 3 } }),
    ],
    { unoffered: AT_TABLE },
  ),
  // The drake's bigger bite is its own; the reaction's uses are counted.
  [DW('perfected bond', 15)]: numbers(
    limited('reflexive-resistance', 'Reflexive Resistance', 'pb', 'long', 'reaction'),
  ),

  // ---- Rogue: Inquisitive ----
  [INQ('inquisitive', 3)]: text(),
  [INQ('ear for deceit', 3)]: toggled(
    [
      {
        type: 'rollNote',
        target: 'skill:insight',
        text: 'Ear for Deceit: d20 floor of 8 when judging a lie',
      },
    ],
    { unoffered: NO_CHOICE, needs: 'a roll floor in one situation (spotting a lie)' },
  ),
  [INQ('eye for detail', 3)]: numbers([plainAction('eye-for-detail', 'Eye for Detail', 'bonus')]),
  [INQ('insightful fighting', 3)]: numbers([
    plainAction('insightful-fighting', 'Insightful Fighting', 'bonus'),
  ]),
  [INQ('steady eye', 9)]: numbers(
    (['perception', 'investigation'] as const).map((s): Effect => ({
      type: 'rollMode',
      target: `skill:${s}`,
      mode: 'advantage',
      against: 'moving no more than half your Speed this turn',
    })),
  ),
  [INQ('unerring eye', 13)]: numbers(
    limited('unerring-eye', 'Unerring Eye', wisUses, 'long', 'action'),
  ),
  // Sneak Attack's extra dice against the Insightful Fighting target.
  [INQ('eye for weakness', 17)]: numbers([
    {
      type: 'damageRider',
      id: 'eye-for-weakness',
      name: 'Eye for Weakness (Insightful Fighting target)',
      dice: '3d6',
      filter: sneaky,
      oncePerTurn: true,
      optIn: true,
    },
  ]),

  // ---- Rogue: Mastermind ----
  [MM('mastermind', 3)]: text(),
  [MM('master of intrigue', 3)]: numbers([
    { type: 'proficiency', category: 'tool', value: 'disguise kit|xphb' },
    { type: 'proficiency', category: 'tool', value: 'forgery kit|xphb' },
    {
      type: 'proficiencyChoice',
      category: 'tool',
      choice: { slot: 'gaming-set', count: 1, from: 'any' },
      filter: 'gamingSet',
    },
    {
      type: 'proficiencyChoice',
      category: 'language',
      choice: { slot: 'languages', count: 2, from: 'any' },
      filter: 'standard|rare',
    },
  ]),
  [MM('master of tactics', 3)]: numbers([
    plainAction('master-of-tactics', 'Help (Master of Tactics)', 'bonus'),
  ]),
  [MM('insightful manipulator', 9)]: text({ unoffered: AT_TABLE }),
  [MM('misdirection', 13)]: numbers([plainAction('misdirection', 'Misdirection', 'reaction')]),
  [MM('soul of deceit', 17)]: text({ unoffered: AT_TABLE }),

  // ---- Rogue: Scout ----
  [SC('scout', 3)]: text(),
  [SC('skirmisher', 3)]: numbers([plainAction('skirmisher', 'Skirmisher', 'reaction')]),
  [SC('survivalist', 3)]: numbers(
    (['nature', 'survival'] as const).flatMap((s): Effect[] => [
      { type: 'proficiency', category: 'skill', value: s },
      { type: 'expertise', skill: s },
    ]),
    { unoffered: NO_CHOICE },
  ),
  // Climb and Swim Speeds of their own get the bonus; ones equal to the Speed follow it already.
  [SC('superior mobility', 9)]: numbers([
    { type: 'speedBonus', value: 10 },
    { type: 'speedBonus', value: 10, mode: 'climb' },
    { type: 'speedBonus', value: 10, mode: 'swim' },
  ]),
  // The Initiative advantage; the rest is the player's.
  [SC('ambush master', 13)]: numbers([
    { type: 'rollMode', target: 'initiative', mode: 'advantage' },
  ]),
  [SC('sudden strike', 17)]: numbers([plainAction('sudden-strike', 'Sudden Strike', 'bonus')]),

  // ---- Rogue: Swashbuckler ----
  [SW('swashbuckler', 3)]: text(),
  [SW('fancy footwork', 3)]: text({ unoffered: NO_CHOICE }),
  // The Initiative bonus (never a penalty); the rest is the player's.
  [SW('rakish audacity', 3)]: numbers([{ type: 'initiativeBonus', value: 'max(0, mod.cha)' }]),
  [SW('panache', 9)]: numbers([plainAction('panache', 'Panache', 'action')]),
  [SW('elegant maneuver', 13)]: numbers([
    plainAction('elegant-maneuver', 'Elegant Maneuver', 'bonus'),
  ]),
  [SW('master duelist', 17)]: numbers(
    limited('master-duelist', 'Master Duelist', 1, 'short', 'other'),
  ),
};
