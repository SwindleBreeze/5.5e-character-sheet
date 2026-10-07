// Weights, coin values and item descriptions for the Inventory tab.

import type { DerivedContainer } from '../../../engine/derive/types.ts';
import type { InventoryItem, Item } from '../../../schema/index.ts';
import type { ItemCharges } from '../../../engine/items/items.ts';
import { RECHARGE_TEXT } from '../../../engine/items/items.ts';

/** `12`, `0.25`, `2.5`: pounds without trailing zeros. */
export function lb(n: number): string {
  return `${Math.round(n * 100) / 100}`;
}

/** Copper pieces as gold: `12 GP`, `12.5 GP`, `0.05 GP`. */
export function gp(cp: number): string {
  return `${Math.round(cp) / 100} GP`;
}

const KIND_NAMES: Partial<Record<Item['itemKind'], string>> = {
  weapon: 'Weapon',
  armor: 'Armor',
  shield: 'Shield',
  gear: 'Adventuring gear',
  pack: 'Pack',
  tool: 'Tool',
  ammo: 'Ammunition',
  focus: 'Spellcasting focus',
  wondrous: 'Wondrous item',
};

/** `Weapon, uncommon`, `Wondrous item, rare`. */
export function itemKindText(item: Item | undefined, variant: Item | undefined): string {
  if (!item) return 'Custom item';
  const kind = KIND_NAMES[item.itemKind] ?? 'Item';
  const rarity = variant?.rarity ?? item.rarity;
  return rarity && rarity !== 'none' && rarity !== 'unknown' ? `${kind}, ${rarity}` : kind;
}

/** `Regains 1d6 charges at dawn`, `Regains all charges on a Long Rest`. */
export function rechargeText(ch: ItemCharges): string | null {
  if (!ch.recharge) return null;
  const when = RECHARGE_TEXT[ch.recharge];
  if (!when) return 'Regains charges as its text says.';
  return `Regains ${ch.amount ? `${ch.amount} charges` : 'all charges'} ${when}.`;
}

/** Quantity, if more than one: ` ×3`. */
export function quantityText(row: InventoryItem): string {
  return row.quantity === 1 ? '' : ` ×${row.quantity}`;
}

/** `8/30 lb. inside`, `12/20 Arrows`, or the weight inside a container of no set limit. */
export function containerText(c: DerivedContainer): string {
  if (c.capacity !== undefined) return `${lb(c.contents)}/${lb(c.capacity)} lb. inside`;
  if (c.counts?.length) {
    const shown = c.counts.some((x) => x.count) ? c.counts.filter((x) => x.count) : c.counts;
    return shown.map((x) => `${x.count}/${x.max} ${x.name}`).join(', ');
  }
  return `${lb(c.contents)} lb. inside`;
}

export function containerFull(c: DerivedContainer): boolean {
  return (
    (c.capacity !== undefined && c.contents > c.capacity) ||
    !!c.counts?.some((x) => x.count > x.max)
  );
}
