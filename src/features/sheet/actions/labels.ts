// Labels and checks for the Actions tab, shared by its cards.

import type { DerivedAttack, DerivedCost, DerivedSheet } from '../../../engine/derive/types.ts';
import type { Recharge } from '../../../schema/index.ts';

/** How the attack is made, in the words of the 2024 rules. */
export function attackUseLabel(a: DerivedAttack): string {
  switch (a.use.kind) {
    case 'attackAction':
      return 'Attack action';
    case 'lightExtra':
      return a.use.nick ? 'Attack action (Nick)' : 'Bonus Action';
    case 'cast':
      return a.use.time === 'action'
        ? 'Magic action'
        : a.use.time === 'bonus'
          ? 'Bonus Action'
          : a.use.time === 'reaction'
            ? 'Reaction'
            : 'Cast';
  }
}

export const RECHARGE_TEXT: Record<Recharge, string> = {
  short: 'Short or Long Rest',
  long: 'Long Rest',
  shortOne: 'one on a Short Rest, all on a Long Rest',
  dawn: 'dawn',
  none: 'doesn’t recharge',
};

/** Uses left of a resource, or undefined when the cost isn't paid from one. */
export function leftOf(sheet: DerivedSheet, cost: DerivedCost): number | undefined {
  const r = cost.resourceKey ? sheet.resources.find((x) => x.key === cost.resourceKey) : undefined;
  return r ? r.max.value - r.used : undefined;
}
