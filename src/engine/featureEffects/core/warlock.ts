// Warlock, its four XPHB patrons and its invocations (plan §10.2, step 6.13), checked against
// the 2024 Player's Handbook text of each. Pact Magic, the invocation picks and Mystic Arcanum
// come from the class data (step 3.7, 5.8); patron spells and most invocation spells from
// theirs. Pact of the Blade is a switch the pact weapon invocations hang off.

import type { Effect } from '../../../schema/index.ts';
import type { FeatureEffectsMap } from '../types.ts';
import {
  action,
  AT_TABLE,
  dc,
  fromData,
  NO_CHOICE,
  numbers,
  restoredBy,
  TARGETS,
  text,
  toggled,
  uses,
  when,
} from './helpers.ts';

const C = (id: string, level: number) => `classFeature:${id}|warlock|xphb|${level}|xphb` as const;
const S = (sub: string, id: string, level: number) =>
  `subclassFeature:${id}|warlock|xphb|${sub}|xphb|${level}|xphb` as const;
const I = (id: string) => `optionalFeature:${id}|xphb` as const;

const chaUses = 'max(1, mod.cha)';
const pactSlot = { slot: { minLevel: 1 } };
const pactWeapon = { toggle: 'pact-weapon' };

/** Free casts of a spell. */
function freeCasts(
  id: string,
  count: string | number,
  recharge: 'short' | 'long' = 'long',
): Effect {
  return {
    type: 'grantSpells',
    spells: [{ mode: 'innate', ability: 'cha', uses: { count, recharge }, spell: { id } }],
  };
}

/** Once per rest, or again for a Pact Magic slot. */
function onceOrSlot(
  id: string,
  name: string,
  recharge: 'short' | 'long',
  def: Partial<Parameters<typeof action>[0]>,
): Effect[] {
  return [
    uses(id, name, 1, recharge),
    restoredBy(id, pactSlot),
    action({ id, name, actionType: 'other', costs: [{ resource: id, amount: 1 }], ...def }),
  ];
}

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

export const WARLOCK: FeatureEffectsMap = {
  [C('eldritch invocations', 1)]: text(),
  [C('pact magic', 1)]: text(),
  [C('eldritch invocation options', 1)]: text(),
  [C('magical cunning', 2)]: numbers([
    uses('magical-cunning', 'Magical Cunning', 1, 'long'),
    action({
      id: 'magical-cunning',
      name: 'Magical Cunning',
      actionType: 'other',
      costs: [{ resource: 'magical-cunning', amount: 1 }],
    }),
  ]),
  [C('warlock subclass', 3)]: text(),
  ...Object.fromEntries(
    [4, 8, 12, 16].map((level) => [C('ability score improvement', level), fromData()]),
  ),
  [C('subclass feature', 6)]: text(),
  [C('subclass feature', 10)]: text(),
  [C('subclass feature', 14)]: text(),
  [C('contact patron', 9)]: numbers([freeCasts('contact other plane|xphb', 1)]),
  ...Object.fromEntries([11, 13, 15, 17].map((level) => [C('mystic arcanum', level), text()])),
  [C('epic boon', 19)]: text(),
  [C('eldritch master', 20)]: text(),

  // ---- Archfey Patron ----
  [S('archfey', 'archfey patron', 3)]: text({ unoffered: NO_CHOICE }),
  [S('archfey', 'archfey spells', 3)]: text(),
  [S('archfey', 'steps of the fey', 3)]: numbers([freeCasts('misty step|xphb', chaUses)], {
    unoffered: AT_TABLE,
  }),
  [S('archfey', 'misty escape', 6)]: text(),
  [S('archfey', 'beguiling defenses', 10)]: numbers([
    { type: 'conditionImmunity', value: 'charmed' },
    ...onceOrSlot('beguiling-defenses', 'Beguiling Defenses', 'long', {
      actionType: 'reaction',
      saveDc: dc('cha'),
    }),
  ]),
  [S('archfey', 'bewitching magic', 14)]: text(),

  // ---- Celestial Patron ----
  [S('celestial', 'celestial patron', 3)]: text(),
  [S('celestial', 'celestial spells', 3)]: text(),
  [S('celestial', 'healing light', 3)]: numbers([
    uses('healing-light', 'Healing Light', '1 + level.warlock', 'long', { die: 'd6', pool: true }),
    action({ id: 'healing-light', name: 'Healing Light', actionType: 'bonus' }),
  ]),
  [S('celestial', 'radiant soul', 6)]: numbers([{ type: 'resistance', value: 'radiant' }]),
  [S('celestial', 'celestial resilience', 10)]: numbers(
    [
      action({
        id: 'celestial-resilience',
        name: 'Celestial Resilience',
        actionType: 'other',
        outcomes: [{ tempHp: 'level.warlock + mod.cha' }],
      }),
    ],
    { unoffered: TARGETS },
  ),
  [S('celestial', 'searing vengeance', 14)]: numbers(
    [
      uses('searing-vengeance', 'Searing Vengeance', 1, 'long'),
      action({
        id: 'searing-vengeance',
        name: 'Searing Vengeance',
        actionType: 'other',
        costs: [{ resource: 'searing-vengeance', amount: 1 }],
        roll: '2d8 + mod.cha',
      }),
    ],
    { unoffered: TARGETS },
  ),

  // ---- Fiend Patron ----
  [S('fiend', 'fiend patron', 3)]: text(),
  [S('fiend', 'fiend spells', 3)]: text(),
  [S('fiend', "dark one's blessing", 3)]: numbers([
    action({
      id: 'dark-ones-blessing',
      name: "Dark One's Blessing",
      actionType: 'other',
      outcomes: [{ tempHp: 'max(1, mod.cha + level.warlock)' }],
    }),
  ]),
  [S('fiend', "dark one's own luck", 6)]: numbers([
    uses('dark-ones-own-luck', "Dark One's Own Luck", chaUses, 'long'),
    action({
      id: 'dark-ones-own-luck',
      name: "Dark One's Own Luck",
      actionType: 'other',
      costs: [{ resource: 'dark-ones-own-luck', amount: 1 }],
      roll: '1d10',
    }),
  ]),
  [S('fiend', 'fiendish resilience', 10)]: numbers([
    {
      type: 'resistanceChoice',
      choice: { slot: 'resilience', count: 1, from: ALL_BUT_FORCE, retrain: 'shortRest' },
    },
  ]),
  [S('fiend', 'hurl through hell', 14)]: numbers(
    onceOrSlot('hurl-through-hell', 'Hurl Through Hell', 'long', {
      roll: '8d10',
      saveDc: dc('cha'),
    }),
  ),

  // ---- Great Old One Patron ----
  [S('great old one', 'great old one patron', 3)]: text({ unoffered: NO_CHOICE }),
  [S('great old one', 'great old one spells', 3)]: text(),
  [S('great old one', 'awakened mind', 3)]: numbers(
    [action({ id: 'awakened-mind', name: 'Awakened Mind', actionType: 'bonus' })],
    { unoffered: TARGETS },
  ),
  [S('great old one', 'psychic spells', 3)]: text(),
  [S('great old one', 'clairvoyant combatant', 6)]: numbers(
    onceOrSlot('clairvoyant-combatant', 'Clairvoyant Combatant', 'short', { saveDc: dc('cha') }),
  ),
  [S('great old one', 'eldritch hex', 10)]: text({ unoffered: AT_TABLE }),
  [S('great old one', 'thought shield', 10)]: numbers([{ type: 'resistance', value: 'psychic' }]),
  [S('great old one', 'create thrall', 14)]: text(),

  // ---- Eldritch Invocations (not part of the class gate; mapped where numbers change) ----
  [I('agonizing blast')]: numbers([
    {
      type: 'optionChoice',
      choice: { slot: 'cantrip', count: 1, from: { query: 'knownDamageCantrips' } },
      labels: [],
    },
    { type: 'spellMod', filter: '', spells: { fromChoice: 'cantrip' }, damageBonus: 'mod.cha' },
  ]),
  [I("devil's sight")]: numbers([{ type: 'sense', sense: "devil's sight", range: 120 }]),
  [I('eldritch mind')]: numbers([
    { type: 'rollMode', target: 'save:concentration', mode: 'advantage' },
  ]),
  [I('gift of the depths')]: numbers([{ type: 'speed', mode: 'swim', value: 'walk' }]),
  [I('pact of the blade')]: toggled([
    {
      type: 'toggle',
      toggleId: 'pact-weapon',
      name: 'Pact weapon',
      effects: [
        {
          type: 'attackMod',
          label: 'Pact of the Blade',
          filter: { source: ['weapon'], range: 'melee' },
          abilities: ['cha'],
        },
      ],
    },
  ]),
  [I('thirsting blade')]: numbers([when(pactWeapon, [{ type: 'extraAttack', count: 2 }])]),
  [I('devouring blade')]: numbers([when(pactWeapon, [{ type: 'extraAttack', count: 3 }])]),
  [I('eldritch smite')]: numbers([
    when(pactWeapon, [
      {
        type: 'damageRider',
        id: 'eldritch-smite',
        name: 'Eldritch Smite',
        dice: 'dice(1 + table.warlock.slot-level, 8)',
        damageType: 'force',
        filter: { source: ['weapon'] },
        oncePerTurn: true,
        cost: pactSlot,
        optIn: true,
      },
    ]),
  ]),
  [I('lifedrinker')]: numbers([
    when(pactWeapon, [
      {
        type: 'damageRider',
        id: 'lifedrinker',
        name: 'Lifedrinker (Necrotic, Psychic or Radiant)',
        dice: '1d6',
        filter: { source: ['weapon'] },
        oncePerTurn: true,
        optIn: true,
      },
    ]),
  ]),
};
