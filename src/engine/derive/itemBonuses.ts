// Items whose own bonus a mapping turns off (plan §10.3, step 7.12): the data gives it always, the
// rules only in some cases (Bracers of Defense without armor, a Rod of Alertness's aura). The
// mapping adds it back under its condition, or leaves it as a note.

import type { InventoryItem, ItemBonus } from '../../schema/index.ts';
import { effectsOfType, type DeriveContext } from './context.ts';

/** Whether this row's bonus of that kind is off. */
export function itemBonusOff(ctx: DeriveContext, row: InventoryItem, bonus: ItemBonus): boolean {
  return effectsOfType(ctx.collected, 'itemBonusOff').some(
    ({ effect, source }) =>
      effect.bonus === bonus &&
      (source.ref.id === row.itemRef?.id || source.ref.id === row.variantRef?.id),
  );
}
