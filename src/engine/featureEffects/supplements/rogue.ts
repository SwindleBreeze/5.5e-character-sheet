// 2024 supplements (plan §10.2, step 6.16): the Scion of the Three (FRHoF) and the Phantom
// (RHW). Dread Allegiance's cantrip pick comes from the subclass data and sets its resistance;
// Voice of Death's free Speak with Dead is in the data too. Soul trinkets are a counter.

import { refKey, type Effect } from '../../../schema/index.ts';
import type { FeatureEffectsMap } from '../types.ts';
import {
  action,
  fromData,
  numbers,
  restoredBy,
  TARGETS,
  text,
  toggled,
  uses,
} from '../core/helpers.ts';

// Built with `refKey`, like the core Rogue's keys.
const S = (sub: string, src: string, id: string, level: number) =>
  refKey({ kind: 'subclassFeature', id: `${id}|rogue|xphb|${sub}|${src}|${level}|${src}` });
const T = (id: string, level: number) => S('scion of the three', 'frhof', id, level);
const P = (id: string, level: number) => S('phantom', 'rhw', id, level);

const SCION = { kind: 'subclass', id: 'scion of the three|rogue|xphb|frhof' } as const;
/** The cantrip each of the Dead Three gives, and the resistance that comes with it. */
const ALLEGIANCE: [string, string][] = [
  ['minor illusion|xphb', 'psychic'],
  ['blade ward|xphb', 'poison'],
  ['chill touch|xphb', 'necrotic'],
];

const trinket = { resource: 'soul-trinkets', amount: 1 };

export const SUP_ROGUE: FeatureEffectsMap = {
  // ---- Scion of the Three ----
  [T('scion of the three', 3)]: text(),
  [T('bloodthirst', 3)]: numbers([
    uses('bloodthirst', 'Bloodthirst', 'max(1, mod.int)', 'long'),
    action({
      id: 'bloodthirst',
      name: 'Bloodthirst',
      actionType: 'reaction',
      costs: [{ resource: 'bloodthirst', amount: 1 }],
    }),
  ]),
  // The god is picked through the subclass's cantrip slot (changeable after a Long Rest).
  [T('dread allegiance', 3)]: numbers(
    ALLEGIANCE.map(([spell, value]): Effect => ({
      type: 'ifChoice',
      owner: SCION,
      slot: 'spells.0.innate.0',
      value: spell,
      effects: [{ type: 'resistance', value }],
    })),
  ),
  // A Cunning Strike option: its DC is the core Cunning Strike action's.
  [T('strike fear', 9)]: text(),
  [T('aura of malevolence', 13)]: numbers(
    [
      action({
        id: 'aura-of-malevolence',
        name: 'Aura of Malevolence',
        actionType: 'other',
        roll: 'mod.int',
      }),
    ],
    { unoffered: TARGETS },
  ),
  // Bloodthirst gets one use back on a Short Rest; the Sneak Attack die floor is the player's.
  [T('dread incarnate', 17)]: numbers(
    [{ type: 'resourceModify', resourceId: 'bloodthirst', recharge: 'shortOne' }],
    {
      needs: 'a minimum face on damage dice (low Sneak Attack rolls count as 3)',
    },
  ),

  // ---- Phantom ----
  [P('phantom', 3)]: text(),
  // Half the Sneak Attack dice (rounded up) as necrotic damage to a second creature.
  [P('wails from the grave', 3)]: numbers([
    uses('wails-from-the-grave', 'Wails from the Grave', 'max(1, mod.dex)', 'long'),
    action({
      id: 'wails-from-the-grave',
      name: 'Wails from the Grave',
      actionType: 'other',
      costs: [{ resource: 'wails-from-the-grave', amount: 1 }],
      roll: 'dice(ceil(ceil(level.rogue / 2) / 2), 6)',
    }),
  ]),
  [P('whispers of the dead', 3)]: numbers([
    {
      type: 'proficiencyChoice',
      category: ['skill', 'tool'],
      choice: { slot: 'whisper', count: 1, from: 'any', retrain: 'shortRest' },
    },
  ]),
  // Soul trinkets: two at first, up to three at 13 and four at 17; topped up to two at a Long Rest.
  [P('tokens of the departed', 9)]: numbers(
    [
      uses('soul-trinkets', 'Soul Trinkets', 'steps(level.rogue, 9, 2, 13, 3, 17, 4)', 'none'),
      action({
        id: 'deaths-knell',
        name: "Death's Knell",
        actionType: 'other',
        costs: [trinket],
        roll: 'dice(ceil(ceil(level.rogue / 2) / 2), 6)',
      }),
      action({ id: 'spirit-query', name: 'Spirit Query', actionType: 'action', costs: [trinket] }),
      action({
        id: 'gain-soul-trinket',
        name: 'Gain a Soul Trinket',
        actionType: 'reaction',
        outcomes: [{ restore: { resource: 'soul-trinkets', amount: 1 } }],
      }),
      {
        type: 'rollMode',
        target: 'save:con',
        mode: 'advantage',
        note: 'Life Essence (while you hold a soul trinket)',
      },
      {
        type: 'rollMode',
        target: 'save:death',
        mode: 'advantage',
        note: 'Life Essence (while you hold a soul trinket)',
      },
    ],
    { needs: 'a Long Rest refill that stops at a set number (two soul trinkets)' },
  ),
  [P('voice of death', 9)]: fromData(),
  // Once per Long Rest, or again by destroying a soul trinket.
  [P('ghost walk', 13)]: toggled([
    uses('ghost-walk', 'Ghost Walk', 1, 'long'),
    restoredBy('ghost-walk', trinket),
    {
      type: 'toggle',
      toggleId: 'ghost-walk',
      name: 'Ghost Walk',
      cost: [{ resource: 'ghost-walk', amount: 1 }, { action: 'bonus' }],
      endsOn: ['shortRest', 'longRest'],
      effects: [
        { type: 'speed', mode: 'fly', value: 10 },
        { type: 'attackedMode', mode: 'disadvantage' },
      ],
    },
  ]),
  [P("death's friend", 17)]: text(),
};
