// Inventory actions (plan §9.2, step 3.19): pure functions from a character to the next one.
// Equipping follows the 2024 rules: one suit of armor, one Shield, and two hands for weapons,
// shields and held items; what no longer fits is stowed. Equipped items are on the body, never
// in a container. Coins pay amounts and make change.

import type {
  Character,
  Currency,
  EquipSlot,
  Id,
  InventoryItem,
  Item,
} from '../../schema/index.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import { equipSlots, isContainer, SLOT_HANDS, variantName } from '../items/items.ts';

export type MakeUid = () => string;

export const newUid: MakeUid = () => crypto.randomUUID();

function clone(c: Character): Character {
  return structuredClone(c);
}

function find(c: Character, uid: string): InventoryItem | undefined {
  return c.inventory.find((r) => r.uid === uid);
}

/** `arrow|xphb` → `Arrow`, for content that isn't loaded. */
function nameFromId(id: string): string {
  return (id.split('|')[0] ?? id).replace(/\b\w/g, (ch) => ch.toUpperCase());
}

/** A new row for a library item, with a magic variant applied, or a custom item. */
export function newRow(opts: {
  uid: string;
  item?: Item;
  variant?: Item;
  name?: string;
  quantity?: number;
  custom?: InventoryItem['custom'];
  chargesMax?: number;
  notes?: string;
}): InventoryItem {
  const { item, variant } = opts;
  const name =
    opts.name?.trim() ||
    (item && variant ? variantName(item, variant) : (item?.name ?? 'Custom item'));
  const row: InventoryItem = {
    uid: opts.uid,
    name,
    quantity: Math.max(1, Math.floor(opts.quantity ?? 1)),
    attuned: false,
  };
  if (item) row.itemRef = { kind: 'item', id: item.id };
  if (item && variant) row.variantRef = { kind: 'item', id: variant.id };
  if (opts.custom) row.custom = opts.custom;
  if (opts.chargesMax !== undefined) row.chargesMax = opts.chargesMax;
  if (opts.notes?.trim()) row.notes = opts.notes.trim();
  return row;
}

export function addItem(c: Character, row: InventoryItem): Character {
  const n = clone(c);
  n.inventory.push(row);
  return n;
}

/** Remove a row. What was inside it goes where it was. */
export function removeItem(c: Character, uid: string): Character {
  const row = find(c, uid);
  if (!row) return c;
  const n = clone(c);
  n.inventory = n.inventory.filter((r) => r.uid !== uid);
  for (const r of n.inventory) {
    if (r.containerUid !== uid) continue;
    if (row.containerUid) r.containerUid = row.containerUid;
    else delete r.containerUid;
  }
  if (n.state.ammoUsed?.[uid] !== undefined) clearAmmo(n, [uid]);
  return n;
}

/** Set how many a row holds. Worn and held items are one each: more go to Carried. */
export function setQuantity(
  c: Character,
  uid: string,
  quantity: number,
  makeUid: MakeUid = newUid,
): Character {
  const n = clone(c);
  const row = find(n, uid);
  if (!row) return c;
  row.quantity = Math.max(0, Math.floor(quantity));
  return unstackHeld(n, makeUid);
}

/**
 * Worn and held items are one each (a hand holds one Dagger): the rest of a worn or held stack
 * goes to Carried, onto a plain carried stack of the same item when there is one. Returns `c`
 * itself when there is none, so characters saved with a held stack are fixed without a write
 * otherwise.
 */
export function unstackHeld(c: Character, makeUid: MakeUid = newUid): Character {
  if (!c.inventory.some((r) => r.equipped && r.quantity > 1)) return c;
  const n = clone(c);
  for (const held of n.inventory.filter((r) => r.equipped && r.quantity > 1)) {
    const extra = held.quantity - 1;
    held.quantity = 1;
    const stack = n.inventory.find(
      (r) =>
        !r.equipped &&
        !r.containerUid &&
        !r.notes &&
        r.chargesMax === undefined &&
        held.chargesMax === undefined &&
        r.name === held.name &&
        r.itemRef?.id === held.itemRef?.id &&
        r.variantRef?.id === held.variantRef?.id,
    );
    if (stack) stack.quantity += extra;
    else {
      const { equipped: _held, ...rest } = held;
      n.inventory.splice(n.inventory.indexOf(held) + 1, 0, {
        ...rest,
        uid: makeUid(),
        quantity: extra,
        attuned: false,
      });
    }
  }
  return n;
}

/** Slots cleared by equipping into a slot: the same slot, and what two hands displace. */
const CLEARS: Record<EquipSlot, EquipSlot[]> = {
  armor: ['armor'],
  shield: ['shield'],
  mainHand: ['mainHand'],
  offHand: ['offHand'],
  bothHands: ['mainHand', 'offHand', 'bothHands', 'shield'],
  worn: [],
};

/** Then, while more than two hands are in use, these are freed in order. */
const FREES: Record<EquipSlot, EquipSlot[]> = {
  armor: [],
  shield: ['bothHands', 'offHand', 'mainHand'],
  mainHand: ['bothHands', 'offHand', 'shield'],
  offHand: ['bothHands', 'shield', 'mainHand'],
  bothHands: [],
  worn: [],
};

/**
 * Put a row in a slot, or stow it (`null`). Armor is one suit, a Shield one, and hands are two:
 * whatever the new item displaces is stowed, except that a weapon held in both hands that
 * can be held in one moves to the main hand when a Shield or an off-hand item takes the other.
 * From a stack, one item is equipped (it keeps the row, so its details stay open) and the
 * rest stay where they were. Equipped items leave their container.
 */
export function equipItem(
  c: Character,
  uid: string,
  slot: EquipSlot | null,
  index: ContentIndex,
  makeUid: MakeUid = newUid,
): Character {
  const n = clone(c);
  const at = n.inventory.findIndex((r) => r.uid === uid);
  const row = n.inventory[at];
  if (!row) return c;
  if (!slot) {
    if (!row.equipped) return c;
    delete row.equipped;
    return n;
  }
  if (row.equipped === slot) return c;
  if (row.quantity > 1) {
    const rest: InventoryItem = {
      ...structuredClone(row),
      uid: makeUid(),
      quantity: row.quantity - 1,
      attuned: false,
    };
    row.quantity = 1;
    n.inventory.splice(at + 1, 0, rest);
  }
  delete row.containerUid;
  delete row.equipped;
  const target = row;

  const itemOf = (r: InventoryItem) =>
    r.itemRef ? index.get({ kind: 'item', id: r.itemRef.id }) : undefined;
  const stow = (r: InventoryItem) => {
    const mainFree = !n.inventory.some((x) => x !== target && x.equipped === 'mainHand');
    if (
      r.equipped === 'bothHands' &&
      (slot === 'shield' || slot === 'offHand') &&
      mainFree &&
      equipSlots(itemOf(r)).includes('mainHand')
    ) {
      r.equipped = 'mainHand';
    } else delete r.equipped;
  };
  const others = () => n.inventory.filter((r) => r !== target && r.equipped);
  for (const r of others()) if (CLEARS[slot].includes(r.equipped!)) stow(r);
  const hands = () => others().reduce((h, r) => h + SLOT_HANDS[r.equipped!], SLOT_HANDS[slot]);
  for (const s of FREES[slot]) {
    if (hands() <= 2) break;
    for (const r of others()) if (r.equipped === s) stow(r);
  }
  target.equipped = slot;
  return n;
}

/**
 * Draw a stowed weapon to attack with it (2024: part of an attack with the Attack action):
 * into both hands when it needs them, else a free hand, else the main hand (what was there is
 * stowed). A weapon already in hand stays where it is.
 */
export function drawWeapon(c: Character, uid: string, index: ContentIndex): Character {
  const row = find(c, uid);
  if (!row || row.equipped) return c;
  const slots = equipSlots(row.itemRef && index.get({ kind: 'item', id: row.itemRef.id }));
  if (slots[0] === 'bothHands') return equipItem(c, uid, 'bothHands', index);
  const held = c.inventory.filter((r) => r.equipped);
  const hands = held.reduce((h, r) => h + SLOT_HANDS[r.equipped!], 0);
  const mainFree = !held.some((r) => r.equipped === 'mainHand' || r.equipped === 'bothHands');
  const slot = !mainFree && hands < 2 && slots.includes('offHand') ? 'offHand' : 'mainHand';
  return equipItem(c, uid, slot, index);
}

export function setAttuned(c: Character, uid: string, attuned: boolean): Character {
  const n = clone(c);
  const row = find(n, uid);
  if (!row) return c;
  row.attuned = attuned;
  return n;
}

/** Rows inside a row, at any depth. */
export function descendants(c: Character, uid: string): Set<string> {
  const out = new Set<string>();
  let frontier = [uid];
  while (frontier.length) {
    const next = c.inventory
      .filter((r) => r.containerUid && frontier.includes(r.containerUid) && !out.has(r.uid))
      .map((r) => r.uid);
    next.forEach((u) => out.add(u));
    frontier = next;
  }
  return out;
}

/** Put a row in a container (`null`: out of any). An equipped item is stowed first. */
export function moveItem(c: Character, uid: string, containerUid: string | null): Character {
  const row = find(c, uid);
  if (!row) return c;
  if (containerUid && (containerUid === uid || descendants(c, uid).has(containerUid))) return c;
  if (containerUid && !find(c, containerUid)) return c;
  const n = clone(c);
  const r = find(n, uid)!;
  if (containerUid) {
    r.containerUid = containerUid;
    delete r.equipped;
  } else delete r.containerUid;
  return n;
}

export function setItemNotes(c: Character, uid: string, notes: string): Character {
  const n = clone(c);
  const row = find(n, uid);
  if (!row) return c;
  if (notes.trim()) row.notes = notes;
  else delete row.notes;
  return n;
}

/**
 * Make an item-group row one item of its group (a Druidic Focus becomes a Yew Wand). It keeps
 * its place, quantity and notes; it is put away, since the new item may be held differently.
 */
export function chooseGroupItem(
  c: Character,
  uid: string,
  itemId: string,
  index: ContentIndex,
): Character {
  const row = find(c, uid);
  const group = row?.itemRef ? index.get({ kind: 'item', id: row.itemRef.id }) : undefined;
  if (!row || !group?.groupItemIds?.includes(itemId)) return c;
  const n = clone(c);
  const target = find(n, uid)!;
  target.itemRef = { kind: 'item', id: itemId };
  target.name = index.get({ kind: 'item', id: itemId })?.name ?? nameFromId(itemId);
  delete target.equipped;
  return n;
}

/** Name, weight and value of a custom item. */
export function updateCustomItem(
  c: Character,
  uid: string,
  patch: { name?: string; weightLb?: number | null; valueCp?: number | null },
): Character {
  const n = clone(c);
  const row = find(n, uid);
  if (!row) return c;
  if (patch.name !== undefined && patch.name.trim()) row.name = patch.name.trim();
  const custom = { ...row.custom };
  for (const key of ['weightLb', 'valueCp'] as const) {
    const v = patch[key];
    if (v === undefined) continue;
    if (v === null || !Number.isFinite(v)) delete custom[key];
    else custom[key] = Math.max(0, v);
  }
  if (Object.keys(custom).length) row.custom = custom;
  else delete row.custom;
  return n;
}

/** Charges left on a row, 0 to its maximum. */
export function setChargesLeft(c: Character, uid: string, left: number, max: number): Character {
  const n = clone(c);
  const row = find(n, uid);
  if (!row) return c;
  const used = Math.min(max, Math.max(0, max - Math.floor(left)));
  if (used) row.chargesUsed = used;
  else delete row.chargesUsed;
  return n;
}

/** The maximum charges of a row whose item gives them as dice. */
export function setChargesMax(c: Character, uid: string, max: number): Character {
  const n = clone(c);
  const row = find(n, uid);
  if (!row) return c;
  row.chargesMax = Math.max(0, Math.floor(max));
  if ((row.chargesUsed ?? 0) > row.chargesMax) row.chargesUsed = row.chargesMax;
  return n;
}

/**
 * Open one pack: its contents become rows. The first item that holds weight (the Backpack of
 * an Explorer's Pack) takes the rest; otherwise they go where the pack was.
 */
export function unpackItem(
  c: Character,
  uid: string,
  index: ContentIndex,
  makeUid: MakeUid = newUid,
): Character {
  const row = find(c, uid);
  const item = row?.itemRef ? index.get({ kind: 'item', id: row.itemRef.id }) : undefined;
  if (!row || !item?.packContents?.length) return c;
  let n = clone(c);
  const at = n.inventory.findIndex((r) => r.uid === uid);
  if (row.quantity > 1) n.inventory[at]!.quantity -= 1;
  else n = removeItem(n, uid);

  const rows = item.packContents.map((p) => {
    const content = index.get({ kind: 'item', id: p.itemId });
    const r: InventoryItem = {
      uid: makeUid(),
      itemRef: { kind: 'item', id: p.itemId },
      name: content?.name ?? nameFromId(p.itemId),
      quantity: p.quantity,
      attuned: false,
    };
    return { r, content };
  });
  const holder = rows.find(
    ({ content }) => isContainer(content) && content?.containerCapacityLb !== undefined,
  )?.r;
  for (const { r } of rows) {
    const into = r !== holder && holder ? holder.uid : row.containerUid;
    if (into) r.containerUid = into;
  }
  const insertAt = row.quantity > 1 ? at + 1 : at;
  n.inventory.splice(Math.min(insertAt, n.inventory.length), 0, ...rows.map(({ r }) => r));
  return n;
}

// ---- Ammunition (2024 Ammunition property) ----

/**
 * Each attack expends one piece of ammunition: from a row of it, or from a bundle of it
 * ("Arrows (20)"), which is opened first. The piece is noted as used, for recovery.
 */
export function spendAmmo(
  c: Character,
  rowUid: string,
  ammoType: Id,
  index: ContentIndex,
  makeUid: MakeUid = newUid,
): Character {
  const row = find(c, rowUid);
  if (!row || row.quantity <= 0) return c;
  const item = row.itemRef ? index.get({ kind: 'item', id: row.itemRef.id }) : undefined;
  let n: Character;
  let target = rowUid;
  if (row.itemRef?.id !== ammoType && item?.baseItemId !== ammoType && item?.packContents) {
    const before = new Set(c.inventory.map((r) => r.uid));
    n = unpackItem(c, rowUid, index, makeUid);
    const opened = n.inventory.find((r) => !before.has(r.uid) && r.itemRef?.id === ammoType);
    if (!opened || opened.quantity <= 0) return c;
    target = opened.uid;
  } else n = clone(c);
  find(n, target)!.quantity -= 1;
  n.state.ammoUsed = { ...n.state.ammoUsed, [target]: (n.state.ammoUsed?.[target] ?? 0) + 1 };
  return n;
}

function clearAmmo(n: Character, rowUids: readonly string[]) {
  const used = { ...n.state.ammoUsed };
  for (const uid of rowUids) delete used[uid];
  if (Object.keys(used).length) n.state.ammoUsed = used;
  else delete n.state.ammoUsed;
}

/**
 * After a fight, a minute spent recovers half the ammunition used (rounded down, for each
 * kind); the rest is lost.
 */
export function recoverAmmo(c: Character, rowUids: readonly string[]): Character {
  const n = clone(c);
  for (const uid of rowUids) {
    const row = find(n, uid);
    const used = n.state.ammoUsed?.[uid] ?? 0;
    if (row) row.quantity += Math.floor(used / 2);
  }
  clearAmmo(n, rowUids);
  return n;
}

/** The used ammunition is lost (nothing recovered). */
export function loseAmmo(c: Character, rowUids: readonly string[]): Character {
  const n = clone(c);
  clearAmmo(n, rowUids);
  return n;
}

// ---- Coins ----

export type Coin = keyof Currency;

/** Worth in copper pieces (2024 Coin Values: 1 PP = 10 GP, 1 GP = 2 EP = 10 SP = 100 CP). */
export const COIN_CP: Record<Coin, number> = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 };

const ASCENDING: Coin[] = ['cp', 'sp', 'ep', 'gp', 'pp'];

export function coinValueCp(c: Currency): number {
  return ASCENDING.reduce((sum, k) => sum + c[k] * COIN_CP[k], 0);
}

/**
 * Pay an amount in copper pieces from a purse, or `null` when it holds too little. The
 * preferred coin goes first, then the smallest coins up; when what's left is less than any
 * coin held, the smallest coin that covers it is broken and the change comes back in gold,
 * silver and copper.
 */
export function payCoins(purse: Currency, cp: number, prefer?: Coin): Currency | null {
  const amount = Math.max(0, Math.round(cp));
  if (coinValueCp(purse) < amount) return null;
  const out = { ...purse };
  let left = amount;
  for (const k of prefer ? [prefer, ...ASCENDING.filter((x) => x !== prefer)] : ASCENDING) {
    const use = Math.min(out[k], Math.floor(left / COIN_CP[k]));
    out[k] -= use;
    left -= use * COIN_CP[k];
  }
  if (left > 0) {
    const broken = ASCENDING.find((k) => out[k] > 0 && COIN_CP[k] > left)!;
    out[broken] -= 1;
    let change = COIN_CP[broken] - left;
    for (const k of ['gp', 'sp', 'cp'] as const) {
      if (COIN_CP[k] >= COIN_CP[broken]) continue;
      const give = Math.floor(change / COIN_CP[k]);
      out[k] += give;
      change -= give * COIN_CP[k];
    }
  }
  return out;
}

/** Set the purse; counts are whole and not negative. */
export function setCurrency(c: Character, purse: Currency): Character {
  const n = clone(c);
  for (const k of ASCENDING) n.currency[k] = Math.max(0, Math.floor(purse[k] || 0));
  return n;
}
