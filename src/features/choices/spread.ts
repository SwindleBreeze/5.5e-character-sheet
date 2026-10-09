// A background's ability increases picked freely (a 2014 background on a 2024 character, plan
// step 8.2): +2 to one score and +1 to another, or +1 to three. Values are abilities with
// repeats (`['str', 'str', 'dex']`), as the background's own options store them.

import type { DerivedFeatureChoice } from '../../engine/derive/types.ts';
import { ABILITIES, type Ability } from '../../schema/index.ts';

/** A background ability pick open to more abilities than a 2024 background's three. */
export function isFreeSpread(choice: DerivedFeatureChoice): boolean {
  const from = choice.offer.from;
  return choice.offer.kind === 'backgroundAbility' && Array.isArray(from) && from.length > 3;
}

function countsOf(values: readonly Ability[]): Map<Ability, number> {
  const counts = new Map<Ability, number>();
  for (const a of values) counts.set(a, (counts.get(a) ?? 0) + 1);
  return counts;
}

/**
 * Tap +2 or +1 on an ability. Tapping what is already there takes it off; otherwise the pick
 * stays a valid shape by dropping the earliest other increase that no longer fits (a second
 * +2, a third +1 beside a +2, a fourth +1).
 */
export function toggleSpread(current: readonly Ability[], ability: Ability, amount: 1 | 2) {
  const counts = countsOf(current);
  if (counts.get(ability) === amount) counts.delete(ability);
  else {
    if (amount === 2) for (const [a, n] of counts) if (n === 2) counts.delete(a);
    counts.set(ability, amount);
    // The other +1s that can stay: one beside a +2, two beside a +1 when there is no +2.
    const two = [...counts.values()].includes(2);
    const room = amount === 2 ? 1 : two ? 0 : 2;
    const others = [...counts].filter(([a, n]) => n === 1 && a !== ability).map(([a]) => a);
    while (others.length > room) counts.delete(others.shift()!);
  }
  return ABILITIES.flatMap((a) => Array<Ability>(counts.get(a) ?? 0).fill(a));
}

/** +2 and +1, or +1 three times. */
export function spreadComplete(values: readonly Ability[]): boolean {
  const shape = [...countsOf(values).values()].sort((a, b) => b - a).join();
  return shape === '2,1' || shape === '1,1,1';
}

export function spreadAmount(values: readonly Ability[], ability: Ability): number {
  return values.filter((a) => a === ability).length;
}
