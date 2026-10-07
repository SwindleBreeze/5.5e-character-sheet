// How spells read on the Spells tab: casting time, level and school, list headings.

import type { Spell } from '../../../schema/index.ts';
import { titleCase } from '../components/format.ts';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** `Action`, `Bonus Action`, `Reaction`, `1 minute`, `8 hours`. */
export function castingTime(spell: Spell): string {
  const t = spell.time[0];
  if (!t) return '';
  switch (t.unit) {
    case 'action':
      return 'Action';
    case 'bonus':
      return 'Bonus Action';
    case 'reaction':
      return 'Reaction';
    default:
      return plural(t.amount, t.unit);
  }
}

/** `Level 1 Illusion`, `Evocation cantrip`. */
export function levelSchool(spell: Spell): string {
  const school = titleCase(spell.school);
  return spell.level === 0 ? `${school} cantrip` : `Level ${spell.level} ${school}`;
}

export function levelHeading(level: number): string {
  return level === 0 ? 'Cantrips' : `Level ${level}`;
}
