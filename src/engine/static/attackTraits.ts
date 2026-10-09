// What an attack is, for matching attack filters (P3/P4) and the `wielding` predicate (P1).

import type { Ability, AttackFilter, Id, Item } from '../../schema/index.ts';

export type Hand = 'main' | 'off' | 'both';

export interface AttackTraits {
  range: 'melee' | 'ranged';
  source: 'weapon' | 'unarmed' | 'spell' | 'natural';
  weaponCategory?: 'simple' | 'martial';
  /** Item-property abbreviations, upper case (`F`, `L`, `2H`). */
  properties: string[];
  /** The ability the attack uses, once known. */
  ability?: Ability;
  itemId?: Id;
  /** The magic variant applied to it (a Flame Tongue longsword), for filters naming it. */
  variantId?: Id;
  /** A magic weapon: a magic item itself, or with a magic variant applied. */
  magic?: boolean;
  /** Derived tags: `monkWeapon`, `offHand`, `twoHanded`. */
  tags: string[];
}

/** A magic item: it has a rarity (5etools' `unknown` marks mundane gear with no rarity set). */
export function isMagicItem(item: Item): boolean {
  return !!item.rarity && item.rarity !== 'unknown';
}

/** `itemProperty/2h|xphb` → `2H`. */
export function propertyAbbr(ruleId: Id): string {
  const slash = ruleId.indexOf('/');
  const bar = ruleId.indexOf('|');
  return ruleId.slice(slash + 1, bar < 0 ? undefined : bar).toUpperCase();
}

/** Ranged by type; content imported before adapter 3 falls back to the Ammunition property. */
export function isRangedWeapon(item: Item): boolean {
  const w = item.weapon;
  if (!w) return false;
  return w.ranged ?? w.properties.some((p) => propertyAbbr(p) === 'A');
}

export function weaponTraits(item: Item, hand?: Hand): AttackTraits {
  const w = item.weapon;
  const properties = (w?.properties ?? []).map(propertyAbbr);
  const range = isRangedWeapon(item) ? 'ranged' : 'melee';
  const tags: string[] = [];
  // 2024 Monk weapons: Simple Melee weapons, and Martial Melee weapons with the Light property.
  if (range === 'melee' && (w?.category === 'simple' || properties.includes('L'))) {
    tags.push('monkWeapon');
  }
  if (hand === 'off') tags.push('offHand');
  if (hand === 'both') tags.push('twoHanded');
  const traits: AttackTraits = { range, source: 'weapon', properties, itemId: item.id, tags };
  if (w) traits.weaponCategory = w.category;
  if (isMagicItem(item)) traits.magic = true;
  return traits;
}

export const UNARMED_TRAITS: AttackTraits = {
  range: 'melee',
  source: 'unarmed',
  properties: [],
  tags: [],
};

const upper = (values: readonly string[]) => values.map((v) => v.toUpperCase());

export function matchesFilter(filter: AttackFilter, t: AttackTraits): boolean {
  if (filter.range && filter.range !== t.range) return false;
  if (filter.source && !filter.source.includes(t.source)) return false;
  if (filter.weaponCategory && filter.weaponCategory !== t.weaponCategory) return false;
  if (filter.properties && !upper(filter.properties).every((p) => t.properties.includes(p))) {
    return false;
  }
  if (filter.notProperties && upper(filter.notProperties).some((p) => t.properties.includes(p))) {
    return false;
  }
  // Before the ability is chosen (the `wielding` predicate), any ability matches.
  if (filter.ability && t.ability && !filter.ability.includes(t.ability)) return false;
  if (
    filter.itemIds &&
    !filter.itemIds.some(
      (id) => id === t.itemId || (t.variantId !== undefined && id === t.variantId),
    )
  )
    return false;
  if (
    filter.notItemIds?.some(
      (id) => id === t.itemId || (t.variantId !== undefined && id === t.variantId),
    )
  )
    return false;
  if (filter.magic !== undefined && filter.magic !== !!t.magic) return false;
  if (filter.tags && !filter.tags.every((tag) => t.tags.includes(tag))) return false;
  if (filter.any && !filter.any.some((f) => matchesFilter(f, t))) return false;
  return true;
}
