// Starting equipment (plan §9.3 step 4.4): what a class's or background's lettered options hold,
// in words, and the "any …" entries (any musical instrument, any simple weapon) a player picks
// an item for. Pure.

import {
  refKey,
  type Character,
  type EquipmentItemGrant,
  type EquipmentOption,
  type Id,
  type Item,
  type Ref,
} from '../../schema/index.ts';
import { formatCoins } from '../../richtext/entityMeta.ts';
import { baseWeapons } from '../choices/queries.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import type { Catalog } from './catalog.ts';
import { applyEquipment } from './build.ts';
import { anyEquipmentType, EQUIPMENT_TYPES } from './equipmentTypes.ts';

export { anyEquipmentType, EQUIPMENT_TYPES } from './equipmentTypes.ts';

/** The items an "any …" entry can be, by name. */
export function equipmentTypeItems(catalog: Catalog, code: string): Item[] {
  const type = EQUIPMENT_TYPES[code];
  if (!type) return [];
  const pool = type.weapon
    ? baseWeapons(catalog).filter((w) => !w.variantBase?.firearm)
    : catalog.of('item').filter((i) => !i.rarity && !i.groupItemIds?.length && !i.baseItemId);
  return pool.filter(type.matches);
}

function plural(name: string, quantity: number): string {
  return quantity > 1 ? `${quantity} × ${name}` : name;
}

/** One entry in words: `Greataxe`, `4 × Handaxe`, `Any musical instrument`. */
export function grantText(grant: EquipmentItemGrant, index: ContentIndex): string {
  const code = anyEquipmentType(grant);
  if (code) return plural(`Any ${EQUIPMENT_TYPES[code]!.label}`, grant.quantity);
  const name =
    grant.special ??
    (grant.itemId ? (index.get({ kind: 'item', id: grant.itemId })?.name ?? grant.itemId) : 'Item');
  return plural(name, grant.quantity);
}

/** An option in words: `Greataxe, 4 × Handaxe, Explorer’s Pack, 15 GP`. */
export function equipmentOptionText(option: EquipmentOption, index: ContentIndex): string {
  const parts = option.items.map((g) => grantText(g, index));
  if (option.valueCp) parts.push(formatCoins(option.valueCp));
  return parts.join(', ') || 'Nothing';
}

/** Where the item picked for an "any …" entry is kept on a draft. */
export function anyItemKey(owner: Ref, optionKey: string, grantIndex: number): string {
  return `${refKey(owner)}#${optionKey}#${grantIndex}`;
}

/** The starting equipment options of a character's first class and background. */
export function startingEquipmentOwners(
  c: Character,
  index: ContentIndex,
): { ref: Ref; name: string; options: EquipmentOption[] }[] {
  const out: { ref: Ref; name: string; options: EquipmentOption[] }[] = [];
  const first = c.log[0];
  const cls = first ? index.get({ kind: 'class', id: first.classRef.id }) : undefined;
  if (cls?.startingEquipment.length)
    out.push({
      ref: { kind: 'class', id: cls.id },
      name: cls.name,
      options: cls.startingEquipment,
    });
  const bgRef = first?.origin?.backgroundRef;
  const bg = bgRef ? index.get({ kind: 'background', id: bgRef.id }) : undefined;
  if (bg?.equipment.length)
    out.push({ ref: { kind: 'background', id: bg.id }, name: bg.name, options: bg.equipment });
  return out;
}

/** The option a character picked for an owner's starting equipment. */
export function pickedEquipment(
  c: Character,
  owner: Ref,
  options: readonly EquipmentOption[],
): EquipmentOption | undefined {
  const record = c.log[0]?.choices.find(
    (r) =>
      r.key.owner.kind === owner.kind && r.key.owner.id === owner.id && r.key.slot === 'equipment',
  );
  return options.find((o) => o.key === record?.values[0]);
}

/** Prefix of the inventory rows starting equipment adds while a character is a draft. */
export const START_ROW = 'start:';

/**
 * A draft's inventory and coins from its starting equipment picks, made again from scratch:
 * the rows starting equipment added before are replaced, and the coins are the options' coins.
 * Armor, a Shield and a weapon are equipped (`applyEquipment`). Items picked for "any …"
 * entries come from `draft.anyItems`; one not picked yet is a row named by its kind.
 */
export function syncStartingEquipment(c: Character, index: ContentIndex): Character {
  let n: Character = {
    ...structuredClone(c),
    inventory: c.inventory.filter((r) => !r.uid.startsWith(START_ROW)),
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
  };
  for (const owner of startingEquipmentOwners(c, index)) {
    const option = pickedEquipment(c, owner.ref, owner.options);
    if (!option) continue;
    const picks: Record<number, Id> = {};
    option.items.forEach((_, i) => {
      const id = c.draft?.anyItems?.[anyItemKey(owner.ref, option.key, i)];
      if (id) picks[i] = id;
    });
    n = applyEquipment(n, option, index, 0, {
      uidPrefix: `${START_ROW}${refKey(owner.ref)}:`,
      picks,
    });
  }
  return n;
}

/** "Any …" entries of the picked options still without an item. */
export function unpickedAnyItems(c: Character, index: ContentIndex): string[] {
  const out: string[] = [];
  for (const owner of startingEquipmentOwners(c, index)) {
    const option = pickedEquipment(c, owner.ref, owner.options);
    option?.items.forEach((g, i) => {
      if (anyEquipmentType(g) && !c.draft?.anyItems?.[anyItemKey(owner.ref, option.key, i)])
        out.push(`${owner.name}: ${grantText(g, index)}`);
    });
  }
  return out;
}
