// Paladin and its four XPHB oaths (plan §10.2, step 6.9), checked against the 2024 Player's
// Handbook text of each feature. Lay on Hands is a pool; Channel Divinity a counter its options
// spend; Aura of Protection adds to the Paladin's own saves (allies are the player's to apply).
// Oath spells and Divine Smite and Find Steed being prepared come from the data.

import type { Effect } from '../../../schema/index.ts';
import type { FeatureEffectsMap } from '../types.ts';
import {
  action,
  AT_TABLE,
  attacksAgainst,
  dc,
  fromData,
  notIncapacitated,
  numbers,
  restoredBy,
  TARGETS,
  text,
  toggled,
  uses,
  when,
} from './helpers.ts';

const C = (id: string, level: number) => `classFeature:${id}|paladin|xphb|${level}|xphb` as const;
const S = (sub: string, id: string, level: number) =>
  `subclassFeature:${id}|paladin|xphb|${sub}|xphb|${level}|xphb` as const;

const divinity = { resource: 'channel-divinity', amount: 1 };
const chaMin1 = 'max(1, mod.cha)';

/** A free cast of a spell the class already has prepared, once per Long Rest. */
function freeCast(id: string): Effect {
  return {
    type: 'grantSpells',
    spells: [
      { mode: 'innate', ability: 'cha', uses: { count: 1, recharge: 'long' }, spell: { id } },
    ],
  };
}

/** A capstone used once per Long Rest, or again for a level 5 spell slot. */
function capstone(id: string, name: string, effects: Effect[] = []): Effect[] {
  const paid = [{ resource: id, amount: 1 }, { action: 'bonus' as const }];
  return [
    uses(id, name, 1, 'long'),
    restoredBy(id, { slot: { minLevel: 5 } }),
    effects.length
      ? {
          type: 'toggle',
          toggleId: id,
          name,
          cost: paid,
          endsOn: ['shortRest', 'longRest'],
          effects,
        }
      : action({ id, name, actionType: 'bonus', costs: [{ resource: id, amount: 1 }] }),
  ];
}

export const PALADIN: FeatureEffectsMap = {
  [C('lay on hands', 1)]: numbers([
    uses('lay-on-hands', 'Lay on Hands', '5 * level.paladin', 'long', { pool: true }),
    action({ id: 'lay-on-hands', name: 'Lay on Hands', actionType: 'bonus' }),
  ]),
  [C('spellcasting', 1)]: text(),
  [C('fighting style', 2)]: text(),
  [C("paladin's smite", 2)]: numbers([freeCast('divine smite|xphb')]),
  [C('channel divinity', 3)]: numbers(
    [uses('channel-divinity', 'Channel Divinity', 'table.channel-divinity', 'shortOne')],
    { unoffered: AT_TABLE },
  ),
  [C('divine sense', 3)]: numbers([
    action({ id: 'divine-sense', name: 'Divine Sense', actionType: 'bonus', costs: [divinity] }),
  ]),
  [C('paladin subclass', 3)]: text(),
  ...Object.fromEntries(
    [4, 8, 12, 16].map((level) => [C('ability score improvement', level), fromData()]),
  ),
  [C('extra attack', 5)]: numbers([{ type: 'extraAttack', count: 2 }]),
  [C('faithful steed', 5)]: numbers([freeCast('find steed|xphb')]),
  [C('aura of protection', 6)]: numbers([
    when(notIncapacitated, [{ type: 'rollBonus', target: 'save:all', value: chaMin1 }]),
  ]),
  [C('subclass feature', 7)]: text(),
  [C('subclass feature', 15)]: text(),
  [C('subclass feature', 20)]: text(),
  [C('abjure foes', 9)]: numbers([
    action({
      id: 'abjure-foes',
      name: 'Abjure Foes',
      actionType: 'action',
      costs: [divinity],
      saveDc: dc('cha'),
    }),
  ]),
  [C('aura of courage', 10)]: numbers([
    when(notIncapacitated, [{ type: 'conditionImmunity', value: 'frightened' }]),
  ]),
  [C('radiant strikes', 11)]: numbers([
    {
      type: 'damageRider',
      id: 'radiant-strikes',
      name: 'Radiant Strikes',
      dice: '1d8',
      damageType: 'radiant',
      filter: { range: 'melee', source: ['weapon', 'unarmed'] },
      optIn: false,
    },
  ]),
  [C('restoring touch', 14)]: text(),
  [C('aura expansion', 18)]: text(),
  [C('epic boon', 19)]: text(),

  // ---- Oath of Devotion ----
  [S('devotion', 'oath of devotion', 3)]: text(),
  [S('devotion', 'oath of devotion spells', 3)]: text(),
  [S('devotion', 'sacred weapon', 3)]: toggled([
    {
      type: 'toggle',
      toggleId: 'sacred-weapon',
      name: 'Sacred Weapon',
      cost: [divinity],
      endsOn: ['shortRest', 'longRest'],
      effects: [
        {
          type: 'attackMod',
          label: 'Sacred Weapon',
          filter: { range: 'melee', source: ['weapon'] },
          toHit: chaMin1,
        },
      ],
    },
  ]),
  [S('devotion', 'aura of devotion', 7)]: numbers([
    when(notIncapacitated, [{ type: 'conditionImmunity', value: 'charmed' }]),
  ]),
  [S('devotion', 'smite of protection', 15)]: text(),
  [S('devotion', 'holy nimbus', 20)]: numbers(capstone('holy-nimbus', 'Holy Nimbus')),

  // ---- Oath of Glory ----
  [S('glory', 'oath of glory', 3)]: text(),
  [S('glory', 'oath of glory spells', 3)]: text(),
  [S('glory', 'inspiring smite', 3)]: numbers(
    [
      action({
        id: 'inspiring-smite',
        name: 'Inspiring Smite',
        actionType: 'other',
        costs: [divinity],
        roll: '2d8 + level.paladin',
      }),
    ],
    { unoffered: TARGETS },
  ),
  [S('glory', 'peerless athlete', 3)]: toggled([
    {
      type: 'toggle',
      toggleId: 'peerless-athlete',
      name: 'Peerless Athlete',
      cost: [divinity, { action: 'bonus' }],
      endsOn: ['shortRest', 'longRest'],
      effects: [
        { type: 'rollMode', target: 'skill:athletics', mode: 'advantage' },
        { type: 'rollMode', target: 'skill:acrobatics', mode: 'advantage' },
      ],
    },
  ]),
  [S('glory', 'aura of alacrity', 7)]: numbers([{ type: 'speedBonus', value: 10 }]),
  [S('glory', 'glorious defense', 15)]: numbers([
    uses('glorious-defense', 'Glorious Defense', chaMin1, 'long'),
    action({
      id: 'glorious-defense',
      name: 'Glorious Defense',
      actionType: 'reaction',
      costs: [{ resource: 'glorious-defense', amount: 1 }],
    }),
  ]),
  [S('glory', 'living legend', 20)]: toggled(
    capstone('living-legend', 'Living Legend', [
      { type: 'rollMode', target: 'check:cha', mode: 'advantage' },
    ]),
  ),

  // ---- Oath of the Ancients ----
  [S('ancients', 'oath of the ancients', 3)]: text(),
  [S('ancients', 'oath of the ancients spells', 3)]: text(),
  [S('ancients', "nature's wrath", 3)]: numbers(
    [
      action({
        id: 'natures-wrath',
        name: "Nature's Wrath",
        actionType: 'action',
        costs: [divinity],
        saveDc: dc('cha'),
      }),
    ],
    { unoffered: TARGETS },
  ),
  [S('ancients', 'aura of warding', 7)]: numbers([
    when(
      notIncapacitated,
      ['necrotic', 'psychic', 'radiant'].map((value): Effect => ({ type: 'resistance', value })),
    ),
  ]),
  [S('ancients', 'undying sentinel', 15)]: numbers([
    uses('undying-sentinel', 'Undying Sentinel', 1, 'long'),
    action({
      id: 'undying-sentinel',
      name: 'Undying Sentinel',
      actionType: 'other',
      costs: [{ resource: 'undying-sentinel', amount: 1 }],
      outcomes: [{ heal: '3 * level.paladin' }],
    }),
  ]),
  [S('ancients', 'elder champion', 20)]: numbers(capstone('elder-champion', 'Elder Champion')),

  // ---- Oath of Vengeance ----
  [S('vengeance', 'oath of vengeance', 3)]: text(),
  [S('vengeance', 'oath of vengeance spells', 3)]: text(),
  [S('vengeance', 'vow of enmity', 3)]: numbers([
    action({ id: 'vow-of-enmity', name: 'Vow of Enmity', actionType: 'other', costs: [divinity] }),
    attacksAgainst('the target of your Vow of Enmity'),
  ]),
  [S('vengeance', 'relentless avenger', 7)]: text(),
  [S('vengeance', 'soul of vengeance', 15)]: text(),
  [S('vengeance', 'avenging angel', 20)]: toggled(
    capstone('avenging-angel', 'Avenging Angel', [{ type: 'speed', mode: 'fly', value: 60 }]),
  ),
};
