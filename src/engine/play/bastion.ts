// A Bastion (plan step 7.7): tracked, never played. Pure: each returns a new character. Nothing
// here checks how many facilities a level allows, what an order gives or when a turn comes;
// the sheet only remembers what the player wrote down.

import type { Bastion, BastionFacility, Character } from '../../schema/index.ts';

/** The character level from which the Description tab shows the Bastion card. */
export const BASTION_LEVEL = 5;

export type BastionCount = 'hirelings' | 'defenders';

const EMPTY: Bastion = { facilities: [], hirelings: 0, defenders: 0 };

export function bastionOf(c: Character): Bastion {
  return c.bastion ?? EMPTY;
}

/** Shown from level 5, or earlier when the character already has one (after an undone level). */
export function showsBastion(c: Character, charLevel: number): boolean {
  return charLevel >= BASTION_LEVEL || !!c.bastion;
}

/** Stores the Bastion; one with nothing in it is removed, so most characters carry none. */
function withBastion(c: Character, b: Bastion): Character {
  const n = { ...c };
  if (b.facilities.length || b.hirelings || b.defenders) n.bastion = b;
  else delete n.bastion;
  return n;
}

function mapFacility(
  c: Character,
  uid: string,
  f: (row: BastionFacility) => BastionFacility,
): Character {
  const b = bastionOf(c);
  return withBastion(c, {
    ...b,
    facilities: b.facilities.map((row) => (row.uid === uid ? f(row) : row)),
  });
}

export function addFacility(c: Character, row: Omit<BastionFacility, 'order' | 'note'>): Character {
  const b = bastionOf(c);
  return withBastion(c, { ...b, facilities: [...b.facilities, row] });
}

export function removeFacility(c: Character, uid: string): Character {
  const b = bastionOf(c);
  return withBastion(c, { ...b, facilities: b.facilities.filter((r) => r.uid !== uid) });
}

/** The facility's current order; empty or `null` clears it. */
export function setFacilityOrder(c: Character, uid: string, order: string | null): Character {
  return mapFacility(c, uid, (row) => {
    const n = { ...row };
    if (order) n.order = order;
    else delete n.order;
    return n;
  });
}

/** The player's note on a facility; an empty one is removed (spaces are kept while typing). */
export function setFacilityNote(c: Character, uid: string, note: string): Character {
  return mapFacility(c, uid, (row) => {
    const n = { ...row };
    if (note) n.note = note;
    else delete n.note;
    return n;
  });
}

/** Hirelings or defenders: a whole number, never below zero. */
export function setBastionCount(c: Character, key: BastionCount, value: number): Character {
  const v = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  return withBastion(c, { ...bastionOf(c), [key]: v });
}
