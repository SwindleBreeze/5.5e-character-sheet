// Display helpers shared by the sheet components.

import type { Ability, Skill } from '../../../schema/index.ts';
import type { Contribution, Derived, DerivedRoll } from '../../../engine/derive/types.ts';

/** `+3`, `−1` (a real minus sign), `+0`. */
export function signed(n: number): string {
  return n < 0 ? `−${Math.abs(n)}` : `+${n}`;
}

export const ABILITY_ABBR: Readonly<Record<Ability, string>> = {
  str: 'STR',
  dex: 'DEX',
  con: 'CON',
  int: 'INT',
  wis: 'WIS',
  cha: 'CHA',
};

const SMALL_WORDS = new Set(['of', 'the', 'and']);

/** `sleight of hand` → `Sleight of Hand`. */
export function titleCase(text: string): string {
  return text
    .split(' ')
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

export function skillName(skill: Skill): string {
  return titleCase(skill);
}

export function isOverridden(d: Derived<unknown>): boolean {
  return d.parts.some((p) => p.kind === 'override');
}

/** How a part reads in a breakdown: a base or set value as is, a bonus with its sign. */
export function partValue(p: Contribution): string {
  return p.kind === 'base' || p.kind === 'set' || p.kind === 'override'
    ? String(p.value)
    : signed(p.value);
}

/** The dice a d20 roll adds (Bless: `+1d4`), as a roll expression suffix. */
export function extraDice(r: DerivedRoll): string {
  return r.dice.map((d) => (d.dice.startsWith('-') ? d.dice : `+${d.dice}`)).join('');
}
