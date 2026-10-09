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

/**
 * Where a roll's bonus comes from, shown with its result: `DEX modifier +2 · Proficiency
 * Bonus +2 · Bless +1d4`. Parts adding nothing are left out.
 */
export function rollBreakdown(
  bonus: Derived,
  dice: readonly { label: string; dice: string }[] = [],
): string {
  return bonus.parts
    .filter((p) => p.value !== 0 || p.kind === 'set' || p.kind === 'override')
    .map((p) => `${p.label} ${partValue(p)}`)
    .concat(
      dice.map(
        (d) => `${d.label} ${d.dice.startsWith('-') ? `−${d.dice.slice(1)}` : `+${d.dice}`}`,
      ),
    )
    .join(' · ');
}

/** The dice a d20 roll adds (Bless: `+1d4`), as a roll expression suffix. */
export function extraDice(r: DerivedRoll): string {
  return r.dice.map((d) => (d.dice.startsWith('-') ? d.dice : `+${d.dice}`)).join('');
}

/** Advantage that applies only in a situation: "Advantage against being Charmed: Fey Ancestry". */
export function situationalLines(roll: DerivedRoll): string[] {
  return (roll.situational ?? []).map(
    (s) =>
      `${s.mode === 'advantage' ? 'Advantage' : 'Disadvantage'} against ${s.against}: ${s.source}`,
  );
}

/** What changes a roll beyond its bonus: advantage and why, added dice, a floor on the d20. */
export function rollNoteLines(r: DerivedRoll): string[] {
  return [
    ...r.advantage.map((a) => `Advantage: ${a}`),
    ...r.disadvantage.map((a) => `Disadvantage: ${a}`),
    ...situationalLines(r),
    ...(r.notes ?? []).map((n) => `${n.text} (${n.source})`),
    ...r.dice.map((d) => `Adds ${d.dice}: ${d.label}`),
    ...(r.floor ? [`A d20 roll below ${r.floor} counts as ${r.floor}`] : []),
  ];
}
