// Potions on the Actions tab: which items are potions, and what drinking one heals. Drinking one
// is a Bonus Action by the 2024 rules and an action by the 2014 ones.

import type { Item } from '../../schema/index.ts';

/** A potion: marked at import (adapter 11), or by its name in content imported before. */
export function isPotion(item: Pick<Item, 'consumable' | 'name'>): boolean {
  return item.consumable === 'potion' || /^potions? of\b/i.test(item.name);
}

/**
 * The Hit Points a potion restores when drunk, as dice (`2d4 + 2`): the dice its text names
 * where it says Hit Points are regained. None for other potions.
 */
export function potionHealing(item: Pick<Item, 'entries'>): string | undefined {
  for (const entry of item.entries) {
    if (typeof entry !== 'string' || !/regain/i.test(entry) || !/Hit Points?/i.test(entry))
      continue;
    const dice = /\{@dice ([^}|]+)/.exec(entry)?.[1];
    if (dice) return dice.trim();
  }
  return undefined;
}
