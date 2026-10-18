// The Shop (play-test request): every item of the enabled books, on shelves by what it is for,
// so a player finds "a light", "something to carry things in" or "a martial ranged weapon"
// without knowing its name. Sorted from the item's data alone (its kind, its 5etools type code,
// whether it gives light or holds things), never from its name.

import type { Item } from '../../schema/index.ts';

export type ShopGroupId = 'weapons' | 'armor' | 'gear' | 'tools' | 'mounts' | 'treasure' | 'magic';

/** The groups and their shelves, in the order the Shop shows them. */
export const SHOP_GROUPS: { id: ShopGroupId; title: string; shelves: string[] }[] = [
  {
    id: 'weapons',
    title: 'Weapons and ammunition',
    shelves: [
      'Simple melee weapons',
      'Simple ranged weapons',
      'Martial melee weapons',
      'Martial ranged weapons',
      'Ammunition',
    ],
  },
  {
    id: 'armor',
    title: 'Armor and shields',
    shelves: ['Light armor', 'Medium armor', 'Heavy armor', 'Shields'],
  },
  {
    id: 'gear',
    title: 'Adventuring gear',
    shelves: [
      'Equipment packs',
      'Light',
      'Containers',
      'Food, drink and lodging',
      'Spellcasting focuses',
      'Explosives',
      'Poisons',
      'Other gear',
    ],
  },
  {
    id: 'tools',
    title: 'Tools and instruments',
    shelves: ['Artisan’s tools', 'Musical instruments', 'Gaming sets', 'Other tools'],
  },
  {
    id: 'mounts',
    title: 'Mounts and vehicles',
    shelves: ['Mounts', 'Tack and harness', 'Vehicles', 'Ships', 'Airships'],
  },
  {
    id: 'treasure',
    title: 'Trade goods and treasure',
    shelves: ['Trade goods', 'Gemstones', 'Art objects', 'Other treasure'],
  },
  {
    id: 'magic',
    title: 'Magic items',
    shelves: [
      'Potions',
      'Scrolls',
      'Rings',
      'Wands',
      'Rods',
      'Staffs',
      'Weapons and ammunition',
      'Armor and shields',
      'Wondrous items and others',
      'Magic variants',
    ],
  },
];

export interface Shelf {
  group: ShopGroupId;
  shelf: string;
}

/** Magic: it has a rarity (mundane items have none). */
export function isMagic(item: Item): boolean {
  return !!item.rarity && item.rarity !== 'unknown';
}

const MAGIC_BY_TYPE: Record<string, string> = {
  P: 'Potions',
  SC: 'Scrolls',
  RG: 'Rings',
  WD: 'Wands',
  RD: 'Rods',
  ST: 'Staffs',
};

const BY_TYPE: Record<string, Shelf> = {
  MNT: { group: 'mounts', shelf: 'Mounts' },
  TAH: { group: 'mounts', shelf: 'Tack and harness' },
  VEH: { group: 'mounts', shelf: 'Vehicles' },
  SHP: { group: 'mounts', shelf: 'Ships' },
  AIR: { group: 'mounts', shelf: 'Airships' },
  TG: { group: 'treasure', shelf: 'Trade goods' },
  $G: { group: 'treasure', shelf: 'Gemstones' },
  $A: { group: 'treasure', shelf: 'Art objects' },
  $C: { group: 'treasure', shelf: 'Other treasure' },
  FD: { group: 'gear', shelf: 'Food, drink and lodging' },
  EXP: { group: 'gear', shelf: 'Explosives' },
};

const TOOL_SHELVES: Record<NonNullable<Item['toolType']>, string> = {
  artisan: 'Artisan’s tools',
  instrument: 'Musical instruments',
  gamingSet: 'Gaming sets',
  other: 'Other tools',
};

function magicShelf(item: Item): string {
  if (item.variant || item.itemKind === 'variant') return 'Magic variants';
  const byType = item.itemType && MAGIC_BY_TYPE[item.itemType];
  if (byType) return byType;
  if (item.itemTags?.includes('staff')) return 'Staffs';
  if (item.consumable === 'potion') return 'Potions';
  if (item.itemKind === 'weapon' || item.itemKind === 'ammo') return 'Weapons and ammunition';
  if (item.itemKind === 'armor' || item.itemKind === 'shield') return 'Armor and shields';
  return 'Wondrous items and others';
}

/**
 * Where an item goes in the Shop, or `null` for one it doesn't sell: an item group (Arcane
 * Focus), whose members are on the shelves themselves.
 */
export function shelfOf(item: Item): Shelf | null {
  if (item.groupItemIds) return null;
  if (isMagic(item) || item.variant) return { group: 'magic', shelf: magicShelf(item) };
  const byType = item.itemType && BY_TYPE[item.itemType];
  if (byType) return byType;
  switch (item.itemKind) {
    case 'weapon': {
      const w = item.weapon;
      const kind = w?.category === 'martial' ? 'Martial' : 'Simple';
      return { group: 'weapons', shelf: `${kind} ${w?.ranged ? 'ranged' : 'melee'} weapons` };
    }
    case 'ammo':
      return { group: 'weapons', shelf: 'Ammunition' };
    case 'armor': {
      const category = item.armor?.category ?? 'light';
      return { group: 'armor', shelf: `${category[0]!.toUpperCase()}${category.slice(1)} armor` };
    }
    case 'shield':
      return { group: 'armor', shelf: 'Shields' };
    case 'tool':
      return { group: 'tools', shelf: TOOL_SHELVES[item.toolType ?? 'other'] };
    case 'focus':
      return { group: 'gear', shelf: 'Spellcasting focuses' };
    // A bundle of one thing (ten Iron Spikes) is gear; a pack holds several.
    case 'pack':
      if ((item.packContents?.length ?? 0) > 1) return { group: 'gear', shelf: 'Equipment packs' };
  }
  if (item.itemTags?.includes('light')) return { group: 'gear', shelf: 'Light' };
  if (item.itemTags?.includes('poison')) return { group: 'gear', shelf: 'Poisons' };
  if (item.container) return { group: 'gear', shelf: 'Containers' };
  return { group: 'gear', shelf: 'Other gear' };
}

export interface ShopShelf {
  title: string;
  items: Item[];
}

export interface ShopGroup {
  id: ShopGroupId;
  title: string;
  shelves: ShopShelf[];
  count: number;
}

/** The items on their shelves, empty shelves and groups left out; each shelf by name. */
export function stockShop(items: readonly Item[]): ShopGroup[] {
  const placed = new Map<string, Item[]>();
  for (const item of items) {
    const at = shelfOf(item);
    if (!at) continue;
    const key = `${at.group}/${at.shelf}`;
    placed.set(key, [...(placed.get(key) ?? []), item]);
  }
  return SHOP_GROUPS.map((g) => {
    const shelves = g.shelves
      .map((title) => ({
        title,
        items: (placed.get(`${g.id}/${title}`) ?? []).sort(
          (a, b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source),
        ),
      }))
      .filter((s) => s.items.length);
    return {
      id: g.id,
      title: g.title,
      shelves,
      count: shelves.reduce((n, s) => n + s.items.length, 0),
    };
  }).filter((g) => g.count);
}
