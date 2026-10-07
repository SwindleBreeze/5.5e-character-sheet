// Building a character's log (plan §9.2, step 3.10). Pure helpers the quick-builder uses now
// and the creation wizard and level-up use in phases 4 and 5.

import { anyEquipmentType, EQUIPMENT_TYPES } from './equipmentTypes.ts';
import { newCharacter } from './newCharacter.ts';
import {
  ABILITIES,
  encodeChoiceKey,
  type Ability,
  type Character,
  type ChoiceKey,
  type ChoiceRecord,
  type ClassDef,
  type EntityKind,
  type EquipmentOption,
  type HpGain,
  type Id,
  type InventoryItem,
  type LevelEntry,
  type Ref,
} from '../../schema/index.ts';
import type { ContentIndex } from '../content/contentIndex.ts';

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;

/** A character at level 1 in one class, with nothing else picked yet. */
export function startCharacter(name: string, classRef: Ref, now = Date.now()): Character {
  const c = newCharacter(name, now);
  c.log = [{ charLevel: 1, classRef, classLevel: 1, hp: { mode: 'max' }, choices: [] }];
  return c;
}

export function setOrigin(c: Character, speciesRef: Ref, backgroundRef: Ref): Character {
  const n = structuredClone(c);
  const first = n.log[0];
  if (first) first.origin = { speciesRef, backgroundRef };
  return n;
}

export interface ChoiceOptions {
  via?: ChoiceRecord['via'];
  valueKinds?: EntityKind[];
  labels?: string[];
  now?: number;
  /** Log entry for a new record; default: the last one. */
  entryIndex?: number;
}

/** Record a pick. A record for the same key is replaced where it is; a new one goes last. */
export function setChoice(
  c: Character,
  key: ChoiceKey,
  values: string[],
  opts: ChoiceOptions = {},
): Character {
  const n = structuredClone(c);
  const record: ChoiceRecord = {
    key,
    values,
    labels: opts.labels ?? values,
    madeAt: opts.now ?? Date.now(),
    via: opts.via ?? 'creation',
  };
  if (opts.valueKinds) record.valueKinds = opts.valueKinds;
  const encoded = encodeChoiceKey(key);
  for (const entry of n.log) {
    const i = entry.choices.findIndex((r) => encodeChoiceKey(r.key) === encoded);
    if (i >= 0) {
      entry.choices[i] = { ...record, via: opts.via ?? entry.choices[i]!.via };
      return n;
    }
  }
  const entry = n.log[opts.entryIndex ?? n.log.length - 1];
  if (!entry) throw new Error('Cannot record a choice before the character has a level');
  entry.choices.push(record);
  return n;
}

/** Take a level in a class (a new one is multiclassing). */
export function addLevel(
  c: Character,
  classRef: Ref,
  hp: HpGain = { mode: 'avg' },
  subclassRef?: Ref,
): Character {
  const n = structuredClone(c);
  const classLevel = n.log.filter((e) => e.classRef.id === classRef.id).length + 1;
  const entry: LevelEntry = { charLevel: n.log.length + 1, classRef, classLevel, hp, choices: [] };
  if (subclassRef) entry.subclassRef = subclassRef;
  n.log.push(entry);
  return n;
}

/** Choose a subclass on the entry where the class reached its subclass level. */
export function setSubclass(c: Character, cls: ClassDef, subclassRef: Ref): Character {
  const n = structuredClone(c);
  const entries = n.log.filter((e) => e.classRef.id === cls.id);
  for (const e of entries) delete e.subclassRef;
  const at =
    entries.find((e) => e.classLevel === cls.subclassLevel) ??
    entries.find((e) => e.classLevel >= cls.subclassLevel);
  if (at) at.subclassRef = subclassRef;
  return n;
}

/**
 * Base scores from the standard array (15, 14, 13, 12, 10, 8): the class's primary abilities
 * first, then Constitution and Dexterity, then the rest in order.
 */
export function standardArrayScores(primary: readonly Ability[]): Record<Ability, number> {
  const order = [...new Set<Ability>([...primary, 'con', 'dex', ...ABILITIES])];
  const scores = {} as Record<Ability, number>;
  order.forEach((a, i) => (scores[a] = STANDARD_ARRAY[i] ?? 8));
  return scores;
}

/** Copper pieces as coins, largest first (no electrum or platinum). */
export function coins(cp: number): { gp: number; sp: number; cp: number } {
  return { gp: Math.floor(cp / 100), sp: Math.floor((cp % 100) / 10), cp: cp % 10 };
}

/**
 * Add a starting equipment option to the inventory and purse. Armor, a shield and the first
 * weapon are equipped; a two-handed weapon goes in both hands. From a stack (two Daggers), one
 * is held and the rest are stowed.
 */
export function applyEquipment(
  c: Character,
  option: EquipmentOption,
  index: ContentIndex,
  now = Date.now(),
  opts: {
    /** Inventory row uids start with this (default: from `now`). */
    uidPrefix?: string;
    /** The item picked for an "any …" entry, by its index in `option.items`. */
    picks?: Readonly<Record<number, Id>>;
  } = {},
): Character {
  const n = structuredClone(c);
  const hasSlot = (slot: InventoryItem['equipped']) => n.inventory.some((r) => r.equipped === slot);
  const prefix = opts.uidPrefix ?? `${now.toString(36)}-`;
  option.items.forEach((grant, i) => {
    const itemId = grant.itemId ?? opts.picks?.[i];
    const item = itemId ? index.get({ kind: 'item', id: itemId }) : undefined;
    const any = anyEquipmentType(grant);
    const row: InventoryItem = {
      uid: `${prefix}${n.inventory.length}-${i}`,
      name:
        (grant.itemId ? grant.special : undefined) ??
        item?.name ??
        (any ? `Any ${EQUIPMENT_TYPES[any]!.label}` : (grant.special ?? itemId ?? 'Item')),
      quantity: grant.quantity,
      attuned: false,
    };
    if (itemId) row.itemRef = { kind: 'item', id: itemId };
    if (item?.armor && !hasSlot('armor')) row.equipped = 'armor';
    else if (item?.itemKind === 'shield' && !hasSlot('shield') && !hasSlot('bothHands'))
      row.equipped = 'shield';
    else if (item?.weapon && !hasSlot('mainHand') && !hasSlot('bothHands')) {
      // Two hands: a Two-Handed weapon goes in both only while no Shield is held.
      const twoHanded = item.weapon.properties.some((p) => /\/2h\|/i.test(p));
      if (!twoHanded) row.equipped = 'mainHand';
      else if (!hasSlot('shield')) row.equipped = 'bothHands';
    }
    n.inventory.push(row.equipped && row.quantity > 1 ? { ...row, quantity: 1 } : row);
    if (row.equipped && row.quantity > 1) {
      const { equipped: _held, ...rest } = row;
      n.inventory.push({ ...rest, uid: `${row.uid}-rest`, quantity: row.quantity - 1 });
    }
  });
  const add = coins(option.valueCp);
  n.currency = {
    ...n.currency,
    gp: n.currency.gp + add.gp,
    sp: n.currency.sp + add.sp,
    cp: n.currency.cp + add.cp,
  };
  return n;
}
