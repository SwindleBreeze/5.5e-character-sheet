// Items in the inventory (plan §9.2, step 3.19): what a row is, where it can be worn or held,
// whether its magic needs Attunement, its charges, and magic variants applied to base items.

import type { EquipSlot, InventoryItem, Item, Size } from '../../schema/index.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import { propertyAbbr } from '../static/attackTraits.ts';

/** The row's item and the magic variant applied to it, when loaded. */
export function rowItems(index: ContentIndex, row: InventoryItem): { item?: Item; variant?: Item } {
  const item = row.itemRef ? index.get({ kind: 'item', id: row.itemRef.id }) : undefined;
  const variant = row.variantRef ? index.get({ kind: 'item', id: row.variantRef.id }) : undefined;
  return { ...(item ? { item } : {}), ...(variant ? { variant } : {}) };
}

/**
 * Whether the item needs Attunement for its magic: `true`, or the prerequisite text
 * (`by a paladin`). A magic variant can need it when the base item doesn't (Flame Tongue).
 */
export function needsAttunement(item?: Item, variant?: Item): boolean | string {
  const fromVariant = variant?.attunement ?? variant?.variant?.inherits.reqAttune;
  const value = item?.attunement ?? fromVariant;
  return typeof value === 'string' ? value : value === true;
}

/**
 * Whether the item's magic works for the character: always, unless it needs Attunement and
 * the character isn't attuned. Without Attunement only its nonmagical benefits apply (2024).
 */
export function magicWorks(row: InventoryItem, item?: Item, variant?: Item): boolean {
  return !needsAttunement(item, variant) || row.attuned;
}

/** 5etools `reqAttuneTags` of the item or its variant. */
export function attunementTags(item?: Item, variant?: Item): Record<string, unknown>[] {
  return item?.attunementTags ?? variant?.attunementTags ?? [];
}

export interface ItemCharges {
  /** Missing when the item's charges are dice that haven't been rolled for this row. */
  max?: number;
  /** Dice the maximum is rolled with (`1d3`). */
  dice?: string;
  used: number;
  recharge?: string;
  /** Regained when it recharges; missing means all. */
  amount?: string;
}

/** The row's charges, from the item or its variant; none when it has none. */
export function chargesOf(row: InventoryItem, item?: Item, variant?: Item): ItemCharges | null {
  const fixed = item?.charges ?? variant?.charges;
  const dice = item?.chargesDice ?? variant?.chargesDice;
  if (fixed === undefined && dice === undefined) return null;
  const out: ItemCharges = { used: row.chargesUsed ?? 0 };
  const max = row.chargesMax ?? fixed;
  if (max !== undefined) out.max = max;
  if (dice !== undefined) out.dice = dice;
  const recharge = item?.recharge ?? variant?.recharge;
  if (recharge) out.recharge = recharge;
  const amount = item?.rechargeAmount ?? variant?.rechargeAmount;
  if (amount) out.amount = amount;
  return out;
}

export const RECHARGE_TEXT: Record<string, string> = {
  dawn: 'at dawn',
  dusk: 'at dusk',
  midnight: 'at midnight',
  restLong: 'on a Long Rest',
  restShort: 'on a Short Rest',
};

/**
 * Armor's Strength requirement and Stealth disadvantage. A variant can lift them: classic
 * Mithral Armor sets `strength` and `stealth` in what it passes on.
 */
export function armorDrawbacks(
  item?: Item,
  variant?: Item,
): { strReq?: number; stealthDis: boolean } {
  const inherits = variant?.variant?.inherits ?? {};
  const out: { strReq?: number; stealthDis: boolean } = {
    stealthDis: 'stealth' in inherits ? inherits.stealth === true : !!item?.armor?.stealthDis,
  };
  const str = 'strength' in inherits ? Number(inherits.strength) || 0 : item?.armor?.strReq;
  if (str) out.strReq = str;
  return out;
}

export function hasProperty(item: Item | undefined, abbr: string): boolean {
  return !!item?.weapon?.properties.some((p) => propertyAbbr(p) === abbr);
}

/**
 * Where an item can go. Armor is worn as armor and a Shield as a shield. A weapon is held in
 * one hand or both; a Two-Handed one needs both to attack, so it goes in both. Ammunition and
 * unopened packs aren't held. Anything else can be worn (a ring, a cloak) or held (a torch, a
 * focus). Custom items can go anywhere but armor and shield, which need the item's AC.
 */
export function equipSlots(item?: Item): EquipSlot[] {
  if (!item) return ['mainHand', 'offHand', 'bothHands', 'worn'];
  if (item.armor) return ['armor'];
  if (item.itemKind === 'shield') return ['shield'];
  if (item.weapon) {
    if (hasProperty(item, '2H')) return ['bothHands'];
    if (item.weapon.versatile) return ['mainHand', 'offHand', 'bothHands'];
    return ['mainHand', 'offHand'];
  }
  if (item.itemKind === 'ammo' || item.packContents) return [];
  return ['mainHand', 'offHand', 'worn'];
}

export const SLOT_NAMES: Record<EquipSlot, string> = {
  armor: 'Armor',
  shield: 'Shield',
  mainHand: 'Main hand',
  offHand: 'Off hand',
  bothHands: 'Both hands',
  worn: 'Worn',
};

/** Hands each slot takes. */
export const SLOT_HANDS: Record<EquipSlot, number> = {
  armor: 0,
  shield: 1,
  mainHand: 1,
  offHand: 1,
  bothHands: 2,
  worn: 0,
};

/** Whether an item holds others (a Backpack, a Bag of Holding, a Quiver, a Chest). */
export function isContainer(item?: Item): boolean {
  return (
    !!item?.container || item?.containerCapacityLb !== undefined || !!item?.containerWeightless
  );
}

/** One item's weight in pounds: the custom weight, else the item's, else none. */
export function unitWeight(row: InventoryItem, item?: Item): number {
  return row.custom?.weightLb ?? item?.weightLb ?? 0;
}

// ---- Carrying capacity (2024 rules glossary) ----

const SIZE_ORDER: Size[] = ['T', 'S', 'M', 'L', 'H', 'G'];

/** Carry: Strength × this many pounds, by size. Drag, lift or push: twice that. */
const CARRY_MULTIPLIER: Record<Size, number> = { T: 7.5, S: 15, M: 15, L: 30, H: 60, G: 120 };

export const SIZE_NAMES: Record<Size, string> = {
  T: 'Tiny',
  S: 'Small',
  M: 'Medium',
  L: 'Large',
  H: 'Huge',
  G: 'Gargantuan',
};

/** The size that counts for carrying capacity, `steps` larger (Powerful Build: 1). */
export function carrySize(size: Size, steps: number): Size {
  const i = Math.min(SIZE_ORDER.length - 1, Math.max(0, SIZE_ORDER.indexOf(size) + steps));
  return SIZE_ORDER[i] ?? size;
}

export function carryMultiplier(size: Size): number {
  return CARRY_MULTIPLIER[size];
}

// ---- Magic variants (5etools generic variants) ----

function matching(candidate: unknown, requirement: unknown, every: boolean): boolean {
  if (Array.isArray(requirement)) {
    return Array.isArray(candidate)
      ? candidate.some((c) => requirement.includes(c))
      : requirement.includes(candidate);
  }
  if (requirement !== null && typeof requirement === 'object') {
    return matchesAll(candidate, requirement as Record<string, unknown>, every);
  }
  return Array.isArray(candidate)
    ? candidate.some((c) => c === requirement)
    : candidate === requirement;
}

/** `every`: all keys must match (`requires`); otherwise any one does (`excludes`). */
function matchesAll(
  candidate: unknown,
  requirements: Record<string, unknown> | undefined,
  every: boolean,
): boolean {
  if (candidate === null || typeof candidate !== 'object' || !requirements) return false;
  const c = candidate as Record<string, unknown>;
  for (const key of Object.keys(requirements)) {
    const match = matching(c[key], requirements[key], every);
    if (every && !match) return false;
    if (!every && match) return true;
  }
  return every;
}

/**
 * 5etools' edition rule: a classic base item takes only classic variants, a 2024 one takes
 * all but classic variants, and an item of no edition takes any.
 */
function editionMatches(base: unknown, variant: unknown): boolean {
  if (base === variant) return true;
  if (base === 'classic') return false;
  if (base === undefined) return true;
  return variant !== 'classic';
}

/**
 * Whether a magic variant applies to a base item, the way 5etools builds its specific
 * variants: the edition rule, one `requires` filter matching in full, no `excludes` match.
 * Only base items with their raw fields kept (`variantBase`) take variants.
 */
export function variantApplies(base: Item, variant: Item): boolean {
  const v = variant.variant;
  const raw = base.variantBase;
  if (!v || !raw) return false;
  if (!editionMatches(raw.edition, v.edition)) return false;
  if (!v.requires.some((r) => matchesAll(raw, r, true))) return false;
  return !(v.excludes && matchesAll(raw, v.excludes, false));
}

/** `+1 Longsword`, `Armor of Fire Resistance`: the base name with the variant's parts. */
export function variantName(base: Item, variant: Item): string {
  const inherits = variant.variant?.inherits ?? {};
  let name = base.name;
  if (typeof inherits.nameRemove === 'string') name = name.split(inherits.nameRemove).join('');
  return `${variant.variant?.namePrefix ?? ''}${name}${variant.variant?.nameSuffix ?? ''}`;
}
