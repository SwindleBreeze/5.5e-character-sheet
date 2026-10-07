// Damage rolls for the Actions tab: the weapon's dice, riders and the flat bonus as one roll.

import { formatRoll, parseRoll, type RollTerm } from '../../../engine/dice/roll.ts';

/**
 * One damage roll from dice parts (`1d12`, a rider's `1d6`) and a flat bonus. A Critical Hit
 * rolls all of the attack's damage dice twice and adds the modifiers once (2024).
 */
export function damageRoll(dice: readonly string[], bonus: number, crit = false): string {
  const terms: RollTerm[] = [];
  let flat = bonus;
  for (const part of dice) {
    if (!part) continue;
    const expr = parseRoll(part);
    terms.push(...expr.terms);
    flat += expr.flat;
  }
  return formatRoll({
    terms: crit ? terms.map((t) => ({ ...t, count: t.count * 2 })) : terms,
    flat,
  });
}
