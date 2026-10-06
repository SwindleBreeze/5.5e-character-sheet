// P2: what the character wears and holds, from the inventory's equip slots.

import type { Character, InventoryItem, Item } from '../../schema/index.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import { weaponTraits, type AttackTraits, type Hand } from './attackTraits.ts';

export interface Worn<T> {
  row: InventoryItem;
  /** Missing for custom items and content that is not loaded. */
  item?: Item;
  /** The magic variant applied to the row, if any (`+1 weapon`). */
  variant?: Item;
  info: T;
}

export interface Wielded {
  row: InventoryItem;
  item: Item;
  variant?: Item;
  hand: Hand;
  traits: AttackTraits;
}

export interface WieldState {
  armor?: Worn<{ category: 'light' | 'medium' | 'heavy'; ac: number }>;
  shield?: Worn<{ ac: number }>;
  /** Weapons in hand. */
  wielded: Wielded[];
  handsUsed: number;
  freeHands: number;
  /** Rows that could not count: a second suit of armor, a third hand… (shown as issues). */
  conflicts: InventoryItem[];
}

const HANDS: Partial<Record<NonNullable<InventoryItem['equipped']>, number>> = {
  shield: 1,
  mainHand: 1,
  offHand: 1,
  bothHands: 2,
};

const HAND_OF: Partial<Record<NonNullable<InventoryItem['equipped']>, Hand>> = {
  mainHand: 'main',
  offHand: 'off',
  bothHands: 'both',
};

function itemOf(index: ContentIndex, row: InventoryItem) {
  const item = row.itemRef ? index.get({ kind: 'item', id: row.itemRef.id }) : undefined;
  const variant = row.variantRef ? index.get({ kind: 'item', id: row.variantRef.id }) : undefined;
  return { item, variant };
}

export function buildWieldState(character: Character, index: ContentIndex): WieldState {
  const state: WieldState = { wielded: [], handsUsed: 0, freeHands: 2, conflicts: [] };
  for (const row of character.inventory) {
    const slot = row.equipped;
    if (!slot || slot === 'worn') continue;
    const { item, variant } = itemOf(index, row);
    const extra = { ...(item ? { item } : {}), ...(variant ? { variant } : {}) };

    if (slot === 'armor') {
      if (state.armor || !item?.armor) {
        state.conflicts.push(row);
        continue;
      }
      state.armor = { row, ...extra, info: { category: item.armor.category, ac: item.armor.ac } };
      continue;
    }

    const hands = HANDS[slot] ?? 0;
    if (state.handsUsed + hands > 2 || (slot === 'shield' && state.shield)) {
      state.conflicts.push(row);
      continue;
    }
    state.handsUsed += hands;
    if (slot === 'shield') {
      state.shield = { row, ...extra, info: { ac: item?.shieldAc ?? 2 } };
      continue;
    }
    const hand = HAND_OF[slot];
    if (hand && item?.weapon) {
      state.wielded.push({
        row,
        item,
        ...(variant ? { variant } : {}),
        hand,
        traits: weaponTraits(item, hand),
      });
    }
  }
  state.freeHands = Math.max(0, 2 - state.handsUsed);
  return state;
}
