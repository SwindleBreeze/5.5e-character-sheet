// Spell slots (plan §9.2, step 3.7): a class's own table when it is the only slot caster, the
// multiclass table otherwise (2024 rules), and Pact Magic kept apart.

import type { ClassDef, ClassSpellcasting, Subclass } from '../../schema/index.ts';
import { cellToValue } from '../formula/evaluate.ts';
import { isDice } from '../formula/dice.ts';

/** Slots by caster level (index 0 = level 1), then slot level 1..9 — the multiclass table. */
export const MULTICLASS_SLOTS: readonly (readonly number[])[] = [
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

/**
 * A class's share of the multiclass caster level. 5etools `artificer` progression is the
 * 2024 half caster that rounds up (Paladin, Ranger); 2014 half casters round down.
 */
export function casterLevelShare(
  progression: ClassSpellcasting['progression'],
  level: number,
): number {
  switch (progression) {
    case 'full':
      return level;
    case 'artificer':
      return Math.ceil(level / 2);
    case 'half':
      return Math.floor(level / 2);
    case 'third':
      return Math.floor(level / 3);
    case 'pact':
      return 0;
  }
}

export function slotRow(
  table: readonly (readonly number[])[] | undefined,
  level: number,
): number[] {
  if (!table || level < 1) return [];
  return [...(table[Math.min(level, table.length) - 1] ?? [])];
}

/** Highest spell level with a slot in a row of slots; 0 for none. */
export function highestSlot(row: readonly number[]): number {
  for (let i = row.length - 1; i >= 0; i--) if ((row[i] ?? 0) > 0) return i + 1;
  return 0;
}

/** Pact Magic from a class table: `spell-slots` and `slot-level` columns. */
export function pactSlots(cls: ClassDef | Subclass | undefined, level: number) {
  const col = (key: string) =>
    cls?.table?.find((c) => c.key === key)?.values[Math.max(0, level - 1)];
  const count = cellToValue(col('spell-slots'));
  const slotLevel = cellToValue(col('slot-level'));
  if (isDice(count) || isDice(slotLevel) || !count || !slotLevel) return undefined;
  return { count, level: slotLevel };
}
