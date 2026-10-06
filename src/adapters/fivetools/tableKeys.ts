// Class table columns are referenced by a normalized key, never by label (plan §4.3):
// display text → NFKD without diacritics → lowercase → non-alphanumeric runs to `-` → trim.
// Collisions within one table get `-2`, `-3`… and are reported.

import { stripTags } from '../../richtext/tagRegistry.ts';
import type { TableColumn } from '../../schema/index.ts';
import { asArray, isObject } from './raw.ts';

export function normalizeKey(label: string): string {
  return stripTags(label)
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Keys for labels in order, unique within the list. `onCollision` gets each renamed key. */
export function assignKeys(labels: string[], onCollision?: (key: string, label: string) => void) {
  const used = new Map<string, number>();
  return labels.map((label) => {
    const base = normalizeKey(label) || 'column';
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    if (seen === 0) return base;
    const key = `${base}-${seen + 1}`;
    onCollision?.(key, label);
    return key;
  });
}

/** One table cell as stored: numbers stay numbers, dashes become 0, dice become `NdM`. */
export function cellValue(raw: unknown): string | number {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const text = raw.trim();
    if (text === '' || /^[—–-]$/.test(text)) return 0;
    const n = Number(text.replace(/^\+/, ''));
    return Number.isFinite(n) ? n : text;
  }
  if (isObject(raw)) {
    if ((raw.type === 'bonus' || raw.type === 'bonusSpeed') && typeof raw.value === 'number') {
      return raw.value;
    }
    if (raw.type === 'dice' && Array.isArray(raw.toRoll)) {
      return raw.toRoll
        .filter(isObject)
        .map((d) => `${String(d.number ?? 1)}d${String(d.faces ?? 6)}`)
        .join('+');
    }
    if (raw.type === 'cell' && raw.entry !== undefined) return cellValue(raw.entry);
  }
  return String(raw ?? '');
}

const SLOT_TITLE = /spell slots per spell level/i;

export interface ParsedTable {
  columns: TableColumn[];
  /** Spell slots by level (index 0 = level 1), then slot level 1..9. */
  slotTable?: number[][];
}

/**
 * Convert 5etools `classTableGroups` / `subclassTableGroups`. Groups titled "Spell Slots per
 * Spell Level" (or with `rowsSpellProgression`) become the slot table; the rest are columns.
 */
export function parseTableGroups(
  groups: unknown,
  onCollision?: (key: string, label: string) => void,
): ParsedTable {
  const labels: string[] = [];
  const columnValues: (string | number)[][] = [];
  let slotTable: number[][] | undefined;

  for (const group of asArray(groups)) {
    if (!isObject(group)) continue;
    const groupLabels = asArray(group.colLabels).map((l) => (typeof l === 'string' ? l : ''));
    const isSlots =
      Array.isArray(group.rowsSpellProgression) ||
      (typeof group.title === 'string' && SLOT_TITLE.test(group.title));
    const rows = asArray(
      isSlots && group.rowsSpellProgression ? group.rowsSpellProgression : group.rows,
    );

    if (isSlots) {
      slotTable = rows.map((row) =>
        asArray(row).map((v) => {
          const n = cellValue(v);
          return typeof n === 'number' ? n : 0;
        }),
      );
      continue;
    }
    groupLabels.forEach((label, col) => {
      labels.push(label);
      columnValues.push(rows.map((row) => cellValue(asArray(row)[col])));
    });
  }

  const keys = assignKeys(labels, onCollision);
  const columns = keys.map((key, i) => ({
    key,
    label: labels[i] ?? '',
    values: columnValues[i] ?? [],
  }));
  return slotTable ? { columns, slotTable } : { columns };
}
