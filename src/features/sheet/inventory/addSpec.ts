// An item picked in the add-item form, as an inventory row: on the sheet and in the Shop.

import { newRow, newUid } from '../../../engine/play/inventory.ts';
import type { InventoryItem } from '../../../schema/index.ts';
import type { AddSpec } from './AddItemSheet.tsx';

/** A row for what was picked; charges given as dice (`1d3`) are rolled once, with `roll`. */
export function rowFromSpec(
  spec: AddSpec,
  roll: (expr: string, label: string) => number,
): InventoryItem {
  const row = newRow({ uid: newUid(), ...spec });
  const dice = spec.item?.chargesDice ?? spec.variant?.chargesDice;
  const fixed = spec.item?.charges ?? spec.variant?.charges;
  if (dice && fixed === undefined) row.chargesMax = roll(dice, `${row.name}: charges`);
  return row;
}
