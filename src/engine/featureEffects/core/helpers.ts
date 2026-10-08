// Small builders for the class mapping files (plan §10.2, steps 6.3–6.14). They keep each
// mapping to what the sheet does with a feature; the feature's own text says what it is.

import type { ActionDef, Effect, Formula, Predicate, Recharge } from '../../../schema/index.ts';
import type { FeatureMapping } from '../types.ts';

/** Text only (level C): the imported text and its glance line say it all. */
export function text(
  extra: Omit<Partial<FeatureMapping>, 'level' | 'effects'> = {},
): FeatureMapping {
  return { level: 'C', effects: [], ...extra };
}

/** The feature's own data effects already do what the sheet needs (an ASI's feat pick). */
export function fromData(): FeatureMapping {
  return { level: 'A', effects: [] };
}

export function numbers(effects: Effect[], extra: Partial<FeatureMapping> = {}): FeatureMapping {
  return { level: 'A', effects, ...extra };
}

export function toggled(effects: Effect[], extra: Partial<FeatureMapping> = {}): FeatureMapping {
  return { level: 'B', effects, ...extra };
}

/** Uses with a maximum and a recharge. */
export function uses(
  resourceId: string,
  name: string,
  max: Formula,
  recharge: Recharge,
  more: { die?: Formula; pool?: boolean } = {},
): Effect {
  return { type: 'resource', resourceId, name, max, recharge, ...more };
}

export function action(def: ActionDef): Effect {
  return { type: 'grantAction', action: def };
}

export function when(p: Predicate, effects: Effect[]): Effect {
  return { type: 'when', when: p, effects };
}

export const notHeavy: Predicate = { armor: 'notHeavy' };
export const noArmor: Predicate = { armor: 'none' };
export const notIncapacitated: Predicate = { not: { condition: 'condition/incapacitated|xphb' } };

/** Why a choice in a feature's text isn't offered: it is made at the table, each time. */
export const AT_TABLE = 'Chosen at the table each time it is used.';
/** The creatures it affects are picked at the table. */
export const TARGETS = 'Which creatures it affects is decided at the table.';

/** A save DC of 8 + an ability modifier + Proficiency Bonus (a spell save DC included). */
export const dc = (ability: string) => `8 + mod.${ability} + pb`;

/** Spells always prepared (a class's or subclass's own). */
export function alwaysPrepared(ids: string[]): Effect {
  return {
    type: 'grantSpells',
    spells: ids.map((id) => ({ mode: 'alwaysPrepared' as const, spell: { id } })),
  };
}

/** Uses of a once-per-rest feature that another resource can restore (a Bardic Inspiration). */
export function restoredBy(
  resourceId: string,
  cost: import('../../../schema/index.ts').Cost,
): Effect {
  return { type: 'restoreWith', resourceId, amount: 1, costs: [cost] };
}

/** The text says "choose" but leaves the character nothing to pick (flavor, an example). */
export const NO_CHOICE = 'Its text uses the word, but there is nothing for the character to pick.';
