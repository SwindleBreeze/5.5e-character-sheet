// How a limited-use counter's maximum is worked out, in words (play-test fix: "why 2 uses?").
// The uses often come from another trait's text (a Goliath's Giant Ancestry), so the counter
// says what the number is: your Proficiency Bonus, your Wisdom modifier, your Wizard level…
// Only the common shapes are put in words; a plain number needs none.

import { ABILITY_NAMES, type Ability, type Formula } from '../../schema/index.ts';

const cap = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
const readable = (key: string) => cap(key.replace(/[-_]/g, ' '));

/** One term: `pb`, `mod.wis`, `level.wizard`, `table.rages`. */
function term(t: string): string | undefined {
  if (t === 'pb') return 'your Proficiency Bonus';
  const mod = /^mod\.(\w+)$/.exec(t);
  if (mod) return `your ${ABILITY_NAMES[mod[1] as Ability] ?? mod[1]} modifier`;
  const level = /^level\.([\w -]+)$/.exec(t);
  if (level) return `your ${readable(level[1]!)} level`;
  if (t === 'level') return 'your level';
  const table = /^table\.(?:[\w-]+\.)?([\w-]+)$/.exec(t);
  if (table) return `the ${readable(table[1]!)} column of your class table`;
  return undefined;
}

export function maxInWords(formula: Formula): string | undefined {
  if (typeof formula === 'number') return undefined;
  const f = formula.trim();
  if (/^\d+$/.test(f)) return undefined;
  const plain = term(f);
  if (plain) return plain;
  // max(1, mod.wis): at least 1.
  const atLeast =
    /^max\(\s*(-?\d+)\s*,\s*(.+)\)$/.exec(f) ?? /^max\(\s*(.+?)\s*,\s*(-?\d+)\s*\)$/.exec(f);
  if (atLeast) {
    const [n, inner] = /^-?\d+$/.test(atLeast[1]!)
      ? [atLeast[1], atLeast[2]]
      : [atLeast[2], atLeast[1]];
    const words = maxInWords(inner!);
    return words ? `${words} (at least ${n})` : undefined;
  }
  // 2 * pb, 5 * level.paladin.
  const times = /^(\d+)\s*\*\s*(.+)$/.exec(f);
  if (times) {
    const words = term(times[2]!.trim());
    return words ? `${times[1] === '2' ? 'twice' : `${times[1]} ×`} ${words}` : undefined;
  }
  // 1 + level.warlock.
  const plus = /^(\d+)\s*\+\s*(.+)$/.exec(f) ?? /^(.+?)\s*\+\s*(\d+)$/.exec(f);
  if (plus) {
    const [n, t] = /^\d+$/.test(plus[1]!) ? [plus[1], plus[2]] : [plus[2], plus[1]];
    const words = term(t!.trim());
    return words ? `${words} + ${n}` : undefined;
  }
  // steps(level.wizard, …): more at higher levels.
  const steps = /^steps\(\s*([^,]+),/.exec(f);
  if (steps) {
    const words = term(steps[1]!.trim());
    return words ? `goes up with ${words}` : undefined;
  }
  return undefined;
}
