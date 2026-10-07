// Words for what a class, background or species gives, for the wizard's lists and details
// (plan §9.3, step 4.4).

import { readable } from '../../engine/choices/options.ts';
import type { ContentIndex } from '../../engine/content/contentIndex.ts';
import { primaryText } from '../../engine/build/scores.ts';
import { SIZE_NAMES } from '../../engine/items/items.ts';
import type { CardItem } from './EntityCards.tsx';
import { ABILITY_NAMES, type Background, type ClassDef, type Species } from '../../schema/index.ts';

/** `a`, `a and b`, `a, b and c`. */
export function andList(values: readonly string[]): string {
  if (values.length <= 2) return values.join(' and ');
  return `${values.slice(0, -1).join(', ')} and ${values.at(-1)}`;
}

const ARMOR: Record<string, string> = {
  light: 'Light armor',
  medium: 'Medium armor',
  heavy: 'Heavy armor',
  shield: 'Shields',
};

function itemOrText(value: string, index: ContentIndex): string {
  if (value.includes('|')) return index.get({ kind: 'item', id: value })?.name ?? readable(value);
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function armorText(values: readonly string[], index: ContentIndex): string {
  return values.length ? andList(values.map((v) => ARMOR[v] ?? itemOrText(v, index))) : 'None';
}

export function weaponText(values: readonly string[], index: ContentIndex): string {
  const words = values.map((v) =>
    v === 'simple' ? 'Simple weapons' : v === 'martial' ? 'Martial weapons' : itemOrText(v, index),
  );
  return words.length ? andList(words) : 'None';
}

export function toolText(values: readonly string[], index: ContentIndex): string {
  return values.length ? andList(values.map((v) => itemOrText(v, index))) : 'None';
}

/** `Choose 2: Athletics, Intimidation…`. */
export function skillChoiceText(cls: ClassDef): string {
  const s = cls.startingProficiencies.skills;
  if (!s) return 'None';
  const list =
    s.from === 'any' ? 'any skills' : Array.isArray(s.from) ? s.from.map(readable).join(', ') : '';
  return `Choose ${s.count}: ${list}`;
}

/** `d12 hit die · Strength`. */
export function classLine(cls: ClassDef): string {
  return [`d${cls.hitDie} hit die`, primaryText(cls), cls.spellcasting ? 'Spellcaster' : '']
    .filter(Boolean)
    .join(' · ');
}

export function backgroundSkills(bg: Background): string[] {
  return bg.effects.flatMap((e) =>
    e.type === 'proficiency' && e.category === 'skill' && typeof e.value === 'string'
      ? [readable(e.value)]
      : [],
  );
}

/** `Int, Wis, Cha · Magic Initiate (Cleric) · Insight, Religion`. */
export function backgroundLine(bg: Background, index: ContentIndex): string {
  const abilities = [...new Set(bg.abilityOptions.flatMap((o) => o.from))]
    .map((a) => ABILITY_NAMES[a].slice(0, 3))
    .join(', ');
  const feat = bg.featId ? index.get({ kind: 'feat', id: bg.featId })?.name : undefined;
  return [abilities, feat, backgroundSkills(bg).join(', ')].filter(Boolean).join(' · ');
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

/** Species with their lineages under them; species without any under "Species". */
export function speciesCards(all: readonly Species[]): CardItem[] {
  const byId = new Map(all.map((s) => [s.id, s]));
  const hasVariants = new Set(all.flatMap((s) => (s.variantOf ? [s.variantOf] : [])));
  const out: CardItem[] = [];
  for (const s of all) {
    if (s.variantOf && byId.has(s.variantOf)) continue;
    if (!hasVariants.has(s.id)) {
      out.push({ id: s.id, name: s.name, detail: speciesLine(s), group: 'Species' });
      continue;
    }
    out.push({ id: s.id, name: s.name, detail: speciesLine(s), group: s.name });
    for (const v of all.filter((x) => x.variantOf === s.id))
      out.push({ id: v.id, name: variantName(v), detail: speciesLine(v), group: s.name });
  }
  return out;
}
