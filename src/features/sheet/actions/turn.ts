// The Actions tab by the part of the turn each thing takes (play-test fix): an Action, a Bonus
// Action, a Reaction, or none. Attacks, feature actions, switches, spells cast as a Bonus Action
// or a Reaction, and potions each go under the one they take.

import type { ContentIndex } from '../../../engine/content/contentIndex.ts';
import type {
  DerivedAction,
  DerivedAttack,
  DerivedSheet,
  DerivedToggle,
} from '../../../engine/derive/types.ts';
import { isPotion, potionHealing } from '../../../engine/items/potions.ts';
import { isRules2014 } from '../../../engine/rules/legacy.ts';
import type { ActionType, Character, InventoryItem, Item } from '../../../schema/index.ts';
import type { SpellEntry } from '../spells/entries.ts';

export type TurnPart = ActionType;

export const TURN_PARTS: { part: TurnPart; title: string }[] = [
  { part: 'action', title: 'Action' },
  { part: 'bonus', title: 'Bonus' },
  { part: 'reaction', title: 'Reaction' },
  { part: 'other', title: 'Other' },
];

/** What each part of the turn allows: for the player to keep in mind, never tracked. */
export const TURN_NOTES: Record<TurnPart, string> = {
  action: 'One Action on your turn: one of these.',
  bonus: 'One Bonus Action on your turn, when something gives you one.',
  reaction:
    'One Reaction per round, when its trigger happens. It comes back at the start of your turn.',
  other: 'No action needed: these come on their own or cost nothing.',
};

export interface PotionRow {
  row: InventoryItem;
  item: Item;
  /** Dice it heals, for a healing potion. */
  heals?: string;
}

export interface TurnGroup {
  /** Attacks ready to make (in hand, the Light extra attack, cantrips). */
  attacks: DerivedAttack[];
  /** Weapons that are stowed: drawn as part of an attack. */
  stowed: DerivedAttack[];
  actions: DerivedAction[];
  /** The actions everyone has (Dash, Dodge… Opportunity Attack). */
  standard: DerivedAction[];
  toggles: DerivedToggle[];
  /** Spells cast in this part of the turn that aren't attacks listed above. */
  spells: SpellEntry[];
  potions: PotionRow[];
}

const empty = (): TurnGroup => ({
  attacks: [],
  stowed: [],
  actions: [],
  standard: [],
  toggles: [],
  spells: [],
  potions: [],
});

/** The part of the turn an attack takes. */
export function attackPart(a: DerivedAttack): TurnPart {
  switch (a.use.kind) {
    case 'attackAction':
      return 'action';
    // With Nick, the extra attack is part of the Attack action.
    case 'lightExtra':
      return a.use.nick ? 'action' : 'bonus';
    case 'cast':
      return a.use.time;
  }
}

/** The part of the turn switching a toggle on takes: what its cost says, else none. */
export function togglePart(t: DerivedToggle): TurnPart {
  return t.costs.find((c) => c.action)?.action ?? 'other';
}

/** The part of the turn a spell's casting time takes, if it is one of them. */
function spellPart(e: SpellEntry): TurnPart | undefined {
  const unit = e.spell?.time[0]?.unit;
  return unit === 'action' || unit === 'bonus' || unit === 'reaction' ? unit : undefined;
}

export function turnGroups(
  character: Character,
  sheet: DerivedSheet,
  index: ContentIndex,
  ready: readonly SpellEntry[],
): Record<TurnPart, TurnGroup> {
  const out: Record<TurnPart, TurnGroup> = {
    action: empty(),
    bonus: empty(),
    reaction: empty(),
    other: empty(),
  };
  for (const a of sheet.attacks) {
    const group = out[attackPart(a)];
    if (a.kind === 'weapon' && !a.ready) group.stowed.push(a);
    else group.attacks.push(a);
  }
  for (const a of sheet.actions)
    (a.standard ? out[a.actionType].standard : out[a.actionType].actions).push(a);
  for (const t of sheet.toggles) out[togglePart(t)].toggles.push(t);

  // Bonus Action and Reaction spells (Healing Word, Shield); action ones stay on the Spells tab,
  // as there are too many. A spell that is an attack is already listed with the attacks.
  const asAttack = new Set(sheet.attacks.flatMap((a) => (a.spellRef ? [a.spellRef.id] : [])));
  const seen = new Set<string>();
  for (const e of ready) {
    const part = spellPart(e);
    if ((part !== 'bonus' && part !== 'reaction') || asAttack.has(e.id) || seen.has(e.id)) continue;
    seen.add(e.id);
    out[part].spells.push(e);
  }

  // Drinking a potion: a Bonus Action by the 2024 rules, an action by the 2014 ones.
  const potionPart: TurnPart = isRules2014(character) ? 'action' : 'bonus';
  for (const row of character.inventory) {
    const item = row.itemRef ? index.get({ kind: 'item', id: row.itemRef.id }) : undefined;
    if (!item || item.kind !== 'item' || !isPotion(item)) continue;
    const heals = potionHealing(item);
    out[potionPart].potions.push({ row, item, ...(heals ? { heals } : {}) });
  }
  return out;
}

/** How many things a part of the turn lists, for its tab. */
export function groupSize(g: TurnGroup): number {
  return (
    g.attacks.length +
    g.stowed.length +
    g.actions.length +
    g.toggles.length +
    g.spells.length +
    g.potions.length
  );
}
