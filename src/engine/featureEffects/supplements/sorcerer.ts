// 2024 supplements (plan §10.2, step 6.16): Spellfire Sorcery (FRHoF) and Shadow Sorcery (RHW).
// They spend the core Sorcerer's Sorcery Points; subclass spells (Counterspell, and Summon
// Beast paid with points) come from their data.

import { refKey, type Effect } from '../../../schema/index.ts';
import type { FeatureEffectsMap } from '../types.ts';
import { action, AT_TABLE, numbers, restoredBy, text, toggled, uses } from '../core/helpers.ts';

const S = (sub: string, src: string, id: string, level: number) =>
  refKey({ kind: 'subclassFeature', id: `${id}|sorcerer|xphb|${sub}|${src}|${level}|${src}` });
const F = (id: string, level: number) => S('spellfire', 'frhof', id, level);
const D = (id: string, level: number) => S('shadow', 'rhw', id, level);

const points = (amount: number) => ({ resource: 'sorcery-points', amount });

/** Once per Long Rest, or again for some Sorcery Points. */
function onceOr(id: string, name: string, cost: number): Effect[] {
  return [uses(id, name, 1, 'long'), restoredBy(id, points(cost))];
}

/** A form taken when Innate Sorcery is used, paid from its own once-per-rest use. */
function form(id: string, name: string, effects: Effect[]): Effect {
  return {
    type: 'toggle',
    toggleId: id,
    name,
    cost: [{ resource: id, amount: 1 }],
    endsOn: ['shortRest', 'longRest'],
    effects,
  };
}

const SHADOW_RESISTS = [
  'acid',
  'bludgeoning',
  'cold',
  'fire',
  'lightning',
  'necrotic',
  'piercing',
  'poison',
  'psychic',
  'slashing',
  'thunder',
];

export const SUP_SORCERER: FeatureEffectsMap = {
  // ---- Spellfire Sorcery ----
  [F('spellfire sorcery', 3)]: text(),
  // One of the two options below, once per turn when Sorcery Points are spent.
  [F('spellfire burst', 3)]: text({ unoffered: AT_TABLE }),
  // Honed Spellfire (14) adds the Sorcerer level.
  [F('bolstering flames', 3)]: numbers([
    action({
      id: 'bolstering-flames',
      name: 'Bolstering Flames',
      actionType: 'other',
      roll: '1d4 + mod.cha + steps(level.sorcerer, 14, level.sorcerer)',
    }),
  ]),
  // Honed Spellfire (14) raises the die.
  [F('radiant fire', 3)]: numbers([
    action({
      id: 'radiant-fire',
      name: 'Radiant Fire',
      actionType: 'other',
      roll: 'steps(level.sorcerer, 3, 1d4, 14, 1d8)',
    }),
  ]),
  [F('spellfire spells', 3)]: text(),
  // Sorcery Points back when a Counterspell target fails its save.
  [F('absorb spells', 6)]: numbers([
    action({ id: 'absorb-spells', name: 'Absorb Spells', actionType: 'other', roll: '1d4' }),
  ]),
  [F('honed spellfire', 14)]: text(),
  // Switched on with Innate Sorcery; the Hit Point Dice and save benefits are the player's.
  [F('crown of spellfire', 18)]: toggled([
    ...onceOr('crown-of-spellfire', 'Crown of Spellfire', 5),
    form('crown-of-spellfire', 'Crown of Spellfire', [{ type: 'speed', mode: 'fly', value: 60 }]),
  ]),

  // ---- Shadow Sorcery ----
  [D('shadow sorcery', 3)]: text(),
  [D('shadow spells', 3)]: text(),
  [D('power of shadow', 3)]: numbers([
    { type: 'sense', sense: 'darkvision', range: 120 },
    { type: 'sense', sense: 'blindsight', range: 10 },
    uses('strength-of-the-grave', 'Strength of the Grave', 1, 'long'),
    action({
      id: 'strength-of-the-grave',
      name: 'Strength of the Grave',
      actionType: 'other',
      costs: [{ resource: 'strength-of-the-grave', amount: 1 }],
      outcomes: [{ heal: 'mod.cha + level.sorcerer' }],
    }),
  ]),
  // Its Summon Beast cast for 3 Sorcery Points is in the subclass data.
  [D('beasts of ill omen', 6)]: text(),
  [D('shadow walk', 14)]: numbers([
    action({ id: 'shadow-walk', name: 'Shadow Walk', actionType: 'bonus' }),
  ]),
  [D('umbral form', 18)]: toggled([
    ...onceOr('umbral-form', 'Umbral Form', 6),
    form(
      'umbral-form',
      'Umbral Form',
      SHADOW_RESISTS.map((value): Effect => ({ type: 'resistance', value })),
    ),
  ]),
};
