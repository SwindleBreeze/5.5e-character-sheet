// What a cost can be paid with right now (plan §9.2, step 3.18): the spell slots and Hit Dice
// a player picks from, and whether a cost is affordable at all.

import type { DerivedCost, DerivedSheet } from '../derive/types.ts';

/** A spell slot to spend: a level of the shared slots, or a Pact Magic slot. */
export interface SlotChoice {
  level: number;
  pact?: boolean;
}

/** What the player picked for the costs that need a choice. */
export interface CostChoice {
  slot?: SlotChoice;
  /** The Hit Die size to spend first. */
  hitDie?: number;
}

/**
 * Slots that can pay for something of `minLevel` or higher: every level at or above it with a
 * slot left, then the Pact Magic slots when their level is high enough. A higher slot works
 * for a lower-level spell (2024).
 */
export function slotChoices(
  sheet: DerivedSheet,
  minLevel: number,
): (SlotChoice & { left: number })[] {
  const out: (SlotChoice & { left: number })[] = sheet.spellcasting.slots
    .filter((s) => s.level >= minLevel && s.max - s.used > 0)
    .map((s) => ({ level: s.level, left: s.max - s.used }));
  const pact = sheet.spellcasting.pact;
  if (pact && pact.level >= minLevel && pact.max - pact.used > 0) {
    out.push({ level: pact.level, pact: true, left: pact.max - pact.used });
  }
  return out;
}

/** Hit Die sizes with dice left, largest first. */
export function hitDieChoices(sheet: DerivedSheet): { faces: number; left: number }[] {
  return sheet.hitDice
    .map((h) => ({ faces: h.faces, left: h.total - h.used }))
    .filter((h) => h.left > 0)
    .sort((a, b) => b.faces - a.faces);
}

/** Whether a cost can be paid now. Costs that are only an action (a Bonus Action) always can. */
export function canPay(sheet: DerivedSheet, cost: DerivedCost): boolean {
  if (cost.resourceKey) {
    const r = sheet.resources.find((x) => x.key === cost.resourceKey);
    return !r || r.max.value - r.used >= (cost.amount ?? 1);
  }
  if (cost.slot) return slotChoices(sheet, cost.slot.minLevel).length > 0;
  if (cost.charges) return cost.charges.left >= (cost.amount ?? 1);
  if (cost.hitDice) {
    const left = hitDieChoices(sheet).reduce((sum, h) => sum + h.left, 0);
    return left >= (cost.amount ?? 1);
  }
  return true;
}

export function canPayAll(sheet: DerivedSheet, costs: readonly DerivedCost[]): boolean {
  return costs.every((c) => canPay(sheet, c));
}

/** The choices paying these costs needs: a slot picker, a Hit Die size picker, or neither. */
export function choicesNeeded(
  sheet: DerivedSheet,
  costs: readonly DerivedCost[],
): { slot?: { minLevel: number }; hitDie?: boolean } {
  const out: { slot?: { minLevel: number }; hitDie?: boolean } = {};
  for (const c of costs) {
    if (c.slot) out.slot = c.slot;
    if (c.hitDice && hitDieChoices(sheet).length > 1) out.hitDie = true;
  }
  return out;
}
