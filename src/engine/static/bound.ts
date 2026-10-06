// P10: values that come from a pick (Elemental Affinity: "the damage type you chose").

import type { Bound, ChoiceKey } from '../../schema/index.ts';
import { choiceKey } from '../collect/collect.ts';
import type { EffectSource } from '../collect/types.ts';

/** The usable picks for a choice key. */
export type ValuesOf = (key: ChoiceKey) => readonly string[];

/**
 * A plain value, or the first pick in the named slot of the effect's own owner. Undefined
 * while that choice has not been made.
 */
export function resolveBound<T extends string>(
  value: Bound<T>,
  source: EffectSource,
  valuesOf: ValuesOf,
): T | undefined {
  if (typeof value !== 'object') return value;
  return valuesOf(choiceKey(source.ref, value.fromChoice, source.n))[0] as T | undefined;
}
