// What a class, background or species gives at a glance, for the wizard's cards and menus (plan
// §9.3 step 4.4, §9.3b step 4B.5).

import { readable } from '../../engine/choices/options.ts';
import type { ContentIndex } from '../../engine/content/contentIndex.ts';
import { primaryText } from '../../engine/build/scores.ts';
import { SIZE_NAMES } from '../../engine/items/items.ts';
import {
  ABILITY_NAMES,
  type Ability,
  type Background,
  type ClassDef,
  type Species,
} from '../../schema/index.ts';

const abbr = (a: Ability) => ABILITY_NAMES[a].slice(0, 3).toUpperCase();

/** `d8 hit die`, `Primary: Dexterity`, `Spellcaster`. */
export function classChips(cls: ClassDef): string[] {
  return [
    `d${cls.hitDie} hit die`,
    `Primary: ${primaryText(cls)}`,
    ...(cls.spellcasting ? ['Spellcaster'] : []),
  ];
}

function backgroundSkills(bg: Background): string[] {
  return bg.effects.flatMap((e) =>
    e.type === 'proficiency' && e.category === 'skill' && typeof e.value === 'string'
      ? [readable(e.value)]
      : [],
  );
}

/** `+2 STR, +1 CON` from a background's picks (largest first, as they are stored). */
export function spreadChip(values: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].map(([a, n]) => `+${n} ${abbr(a as Ability)}`).join(', ');
}

/**
 * A background at a glance: its three abilities (or the increases picked, once picked), its
 * Origin feat and its skills.
 */
export function backgroundChips(
  bg: Background,
  index: ContentIndex,
  picked?: readonly string[],
): string[] {
  const from = [...new Set(bg.abilityOptions.flatMap((o) => o.from))];
  const feat = bg.featId ? index.get({ kind: 'feat', id: bg.featId })?.name : undefined;
  const skills = backgroundSkills(bg);
  return [
    picked?.length
      ? spreadChip(picked)
      : from.length
        ? `+2/+1 or +1 each: ${from.map(abbr).join(' · ')}`
        : '',
    feat ? `Feat: ${feat}` : '',
    skills.length ? `Skills: ${skills.join(', ')}` : '',
  ].filter(Boolean);
}

/** `Medium · 30 ft.`; `Small or Medium · 30 ft.`. */
export function speciesLine(species: Species): string {
  const size = species.size.map((s) => SIZE_NAMES[s] ?? s).join(' or ');
  const walk = species.speed.walk;
  return [size, walk ? `${walk} ft.` : ''].filter(Boolean).join(' · ');
}

/** A lineage's own name: `Elf; Drow Lineage` → `Drow Lineage`, `Dragonborn (Black)` → `Black`. */
export function variantName(species: Species): string {
  const semi = species.name.split('; ');
  if (semi.length > 1) return semi.slice(1).join('; ');
  const paren = /\(([^)]+)\)\s*$/.exec(species.name);
  return paren?.[1] ?? species.name;
}
