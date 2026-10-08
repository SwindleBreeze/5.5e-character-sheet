// 2024 supplements (plan §10.2, step 6.16): the Winter Walker (FRHoF) and the Hollow Warden
// (RHW). Subclass spells come from their data. Favored Enemy's free Hunter's Mark casts are a
// spell grant's counter, not a resource, so Wrath of the Wild can't spend one on the sheet.

import { refKey, type Effect, type Predicate } from '../../../schema/index.ts';
import type { FeatureEffectsMap } from '../types.ts';
import {
  action,
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
  refKey({ kind: 'subclassFeature', id: `${id}|ranger|xphb|${sub}|${src}|${level}|${src}` });
const W = (id: string, level: number) => S('winter walker', 'frhof', id, level);
const H = (id: string, level: number) => S('hollow warden', 'rhw', id, level);

const wisUses = 'max(1, mod.wis)';
const wrath: Predicate = { toggle: 'wrath-of-the-wild' };

export const SUP_RANGER: FeatureEffectsMap = {
  // ---- Winter Walker ----
  [W('winter walker', 3)]: text(),
  // Cold resistance and the once-per-turn cold rider; ignoring Cold resistance is the player's.
  [W('frigid explorer', 3)]: numbers([
    { type: 'resistance', value: 'cold' },
    {
      type: 'damageRider',
      id: 'polar-strikes',
      name: 'Polar Strikes',
      dice: 'steps(level.ranger, 3, 1d4, 11, 1d6)',
      damageType: 'cold',
      filter: { source: ['weapon'] },
      oncePerTurn: true,
      optIn: true,
    },
  ]),
  // Temporary Hit Points each time Hunter's Mark is cast.
  [W("hunter's rime", 3)]: numbers([
    action({
      id: 'hunters-rime',
      name: "Hunter's Rime",
      actionType: 'other',
      outcomes: [{ tempHp: '1d10 + level.ranger' }],
    }),
  ]),
  [W('winter walker spells', 3)]: text(),
  [W('fortifying soul', 7)]: numbers(
    [
      uses('fortifying-soul', 'Fortifying Soul', 1, 'long'),
      action({
        id: 'fortifying-soul',
        name: 'Fortifying Soul',
        actionType: 'action',
        costs: [{ resource: 'fortifying-soul', amount: 1 }],
        roll: '1d10 + level.ranger',
      }),
    ],
    { unoffered: TARGETS },
  ),
  [W('chilling retribution', 11)]: numbers([
    uses('chilling-retribution', 'Chilling Retribution', wisUses, 'long'),
    action({
      id: 'chilling-retribution',
      name: 'Chilling Retribution',
      actionType: 'reaction',
      costs: [{ resource: 'chilling-retribution', amount: 1 }],
      saveDc: dc('wis'),
    }),
  ]),
  // Switched on with a Hunter's Mark cast; once per Long Rest or again for a level 4+ slot.
  [W('frozen haunt', 15)]: toggled(
    [
      uses('frozen-haunt', 'Frozen Haunt', 1, 'long'),
      restoredBy('frozen-haunt', { slot: { minLevel: 4 } }),
      {
        type: 'toggle',
        toggleId: 'frozen-haunt',
        name: 'Frozen Haunt',
        cost: [{ resource: 'frozen-haunt', amount: 1 }],
        endsOn: ['shortRest', 'longRest'],
        effects: [
          { type: 'immunity', value: 'cold' },
          ...['grappled', 'prone', 'restrained'].map((value): Effect => ({
            type: 'conditionImmunity',
            value,
          })),
          action({ id: 'frozen-soul', name: 'Frozen Soul', actionType: 'other', roll: '2d4' }),
        ],
      },
    ],
    { unoffered: TARGETS },
  ),

  // ---- Hollow Warden ----
  [H('hollow warden', 3)]: text(),
  [H('hollow warden spells', 3)]: text(),
  [H('wrath of the wild', 3)]: toggled(
    [
      {
        type: 'toggle',
        toggleId: 'wrath-of-the-wild',
        name: 'Wrath of the Wild',
        cost: [{ action: 'bonus' }],
        endsOn: ['shortRest', 'longRest'],
        effects: [
          { type: 'acBonus', value: 'steps(level.ranger, 3, 1, 11, 2)' },
          action({
            id: 'unnerving-aura',
            name: 'Unnerving Aura',
            actionType: 'other',
            saveDc: dc('wis'),
          }),
          action({
            id: 'prowling-retribution',
            name: 'Prowling Retribution',
            actionType: 'reaction',
          }),
        ],
      },
    ],
    {
      unoffered: TARGETS,
      notes: 'Spend a use of Favored Enemy (a free Hunter’s Mark cast) when you switch it on.',
      needs: 'a cost paid from a spell grant’s free-cast counter (Favored Enemy)',
    },
  ),
  // The Con save bonus always; the heal only while transformed (Bloodied is the player's).
  [H('hungering might', 7)]: numbers([
    { type: 'rollBonus', target: 'save:con', value: wisUses },
    when(wrath, [
      action({
        id: 'hungering-might',
        name: 'Hungering Might',
        actionType: 'other',
        outcomes: [{ heal: '1d10 + mod.wis' }],
      }),
    ]),
  ]),
  [H('rot and violence', 11)]: text(),
  [H('ancient might', 15)]: numbers([
    {
      type: 'damageRider',
      id: 'ominous-strikes',
      name: 'Ominous Strikes (Frightened target)',
      dice: 'mod.wis',
      filter: {},
      optIn: true,
    },
    { type: 'conditionImmunity', value: 'exhaustion' },
    uses('persistent-wrath', 'Persistent Wrath', 1, 'long'),
    restoredBy('persistent-wrath', { slot: { minLevel: 4 } }),
    when(wrath, [
      action({
        id: 'persistent-wrath',
        name: 'Persistent Wrath',
        actionType: 'other',
        costs: [{ resource: 'persistent-wrath', amount: 1 }],
        outcomes: [{ heal: '2 * level.ranger' }],
      }),
    ]),
  ]),
};
