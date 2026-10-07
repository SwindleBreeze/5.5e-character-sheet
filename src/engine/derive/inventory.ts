// The inventory (plan §9.2, step 3.19): weight carried against carrying capacity, containers
// against what they hold, Attunement, and armor training. All from the 2024 rules:
// - Carrying Capacity: Strength × 15 lb. (Small or Medium; Tiny × 7.5, Large × 30, Huge × 60,
//   Gargantuan × 120); drag, lift or push twice that, at a Speed of no more than 5 feet while
//   the weight is more than you can carry. Fifty coins weigh a pound.
// - Attunement: no more than three magic items, never two copies of one item, and only when
//   the item's prerequisite is met.
// - Armor Training: armor without training gives Disadvantage on D20 Tests that involve
//   Strength or Dexterity and stops spellcasting; a Shield without training gives no AC.

import type { Character, Id, InventoryItem, Size } from '../../schema/index.ts';
import {
  armorDrawbacks,
  attunementTags,
  chargesOf,
  type ItemCharges,
  carryMultiplier,
  carrySize,
  isContainer,
  needsAttunement,
  rowItems,
  SIZE_NAMES,
  unitWeight,
} from '../items/items.ts';
import { derived, effectsOfType, type DeriveContext } from './context.ts';
import type { Proficiencies } from './rolls.ts';
import type { DerivedContainer, DerivedInventory, DerivedSpellcasting } from './types.ts';

export const ATTUNEMENT_MAX = 3;
export const COINS_PER_POUND = 50;

/** Armor drawbacks the rolls and AC read. */
export interface GearState {
  /** Armor worn without training: its name. */
  untrainedArmor?: string;
  /** Armor that gives Disadvantage on Stealth: its name. */
  stealthArmor?: string;
  /** A Shield held without training: its name. */
  untrainedShield?: string;
}

const round = (n: number) => Math.round(n * 100) / 100;

function hasShieldTraining(ctx: DeriveContext, armor: ReadonlyMap<string, string[]>): boolean {
  for (const key of armor.keys()) {
    if (key === 'shield' || key === 'shields' || key.startsWith('shield|')) return true;
    if (key.includes('|') && ctx.index.get({ kind: 'item', id: key })?.itemKind === 'shield')
      return true;
  }
  return false;
}

export function gearState(ctx: DeriveContext, profs: Proficiencies): GearState {
  const { armor, shield } = ctx.st.wield;
  const out: GearState = {};
  if (armor) {
    const name = armor.item?.name ?? armor.row.name;
    const ids = [armor.item?.id, armor.item?.baseItemId].filter((x): x is Id => !!x);
    const trained = profs.armor.has(armor.info.category) || ids.some((id) => profs.armor.has(id));
    if (!trained) {
      out.untrainedArmor = name;
      ctx.issues.push({
        severity: 'warn',
        code: 'armorUntrained',
        message: `You lack ${armor.info.category} armor training for your ${name}: Disadvantage on D20 Tests that involve Strength or Dexterity, and you can’t cast spells.`,
      });
    }
    if (armorDrawbacks(armor.item, armor.variant).stealthDis) out.stealthArmor = name;
  }
  if (shield) {
    const name = shield.item?.name ?? shield.row.name;
    const ids = [shield.item?.id, shield.item?.baseItemId].filter((x): x is Id => !!x);
    if (!hasShieldTraining(ctx, profs.armor) && !ids.some((id) => profs.armor.has(id))) {
      out.untrainedShield = name;
      ctx.issues.push({
        severity: 'warn',
        code: 'shieldUntrained',
        message: `You lack Shield training: your ${name} gives no Armor Class.`,
      });
    }
  }
  return out;
}

/**
 * Whether the character meets one alternative of an item's Attunement prerequisite;
 * `undefined` when the sheet can't tell (alignment, psionics…).
 */
function meetsTag(
  ctx: DeriveContext,
  tag: Record<string, unknown>,
  spellcasting: DerivedSpellcasting,
): boolean | undefined {
  const lower = (v: unknown) => String(v).split('|')[0]!.toLowerCase();
  let known = false;
  for (const [key, value] of Object.entries(tag)) {
    let ok: boolean;
    switch (key) {
      case 'class':
        ok = ctx.st.classes.some((c) => (c.cls?.name ?? '').toLowerCase() === lower(value));
        break;
      case 'spellcasting':
        // A spellcaster casts at least one spell with its traits or features, not an item.
        ok =
          spellcasting.casters.length > 0 ||
          spellcasting.granted.some(
            (g) => g.mode !== 'expanded' && g.source.kind !== 'item' && g.source.kind !== 'reward',
          );
        break;
      case 'race': {
        const ref = ctx.character.log[0]?.origin?.speciesRef;
        const name = ref ? (ctx.index.get({ kind: 'species', id: ref.id })?.name ?? ref.id) : '';
        ok = name.toLowerCase().includes(lower(value));
        break;
      }
      case 'creatureType': {
        const ref = ctx.character.log[0]?.origin?.speciesRef;
        const type = ref ? ctx.index.get({ kind: 'species', id: ref.id })?.creatureType : '';
        ok = (type ?? '').toLowerCase() === lower(value);
        break;
      }
      case 'background': {
        const ref = ctx.character.log[0]?.origin?.backgroundRef;
        const name = ref ? (ctx.index.get({ kind: 'background', id: ref.id })?.name ?? '') : '';
        ok = name.toLowerCase() === lower(value);
        break;
      }
      default:
        continue;
    }
    known = true;
    if (!ok) return false;
  }
  return known ? true : undefined;
}

export function deriveInventory(
  ctx: DeriveContext,
  strScore: number,
  size: Size,
  spellcasting: DerivedSpellcasting,
): DerivedInventory {
  const { character } = ctx;
  const rows = character.inventory;
  const byUid = new Map(rows.map((r) => [r.uid, r]));
  const items = new Map(rows.map((r) => [r.uid, rowItems(ctx.index, r)]));
  const weightless = (r: InventoryItem) => !!items.get(r.uid)?.item?.containerWeightless;
  const rowWeight = (r: InventoryItem) => unitWeight(r, items.get(r.uid)?.item) * r.quantity;
  const parentOf = (r: InventoryItem) => (r.containerUid ? byUid.get(r.containerUid) : undefined);

  // Carried weight: every row but those inside a weightless container (at any depth).
  const counted = (r: InventoryItem) => {
    const seen = new Set<string>();
    for (let p = parentOf(r); p && !seen.has(p.uid); p = parentOf(p)) {
      seen.add(p.uid);
      if (weightless(p)) return false;
    }
    return true;
  };
  const itemWeight = round(rows.filter(counted).reduce((sum, r) => sum + rowWeight(r), 0));
  const c = character.currency;
  const coins = c.cp + c.sp + c.ep + c.gp + c.pp;
  const weight = derived([
    { label: 'Items', value: itemWeight, kind: 'base' },
    ...(coins
      ? [{ label: `${coins} coins (50 to the pound)`, value: round(coins / COINS_PER_POUND) }]
      : []),
  ]);
  weight.value = round(weight.value);

  const steps = Math.max(
    0,
    ...effectsOfType(ctx.collected, 'carrySize').map((e) => e.effect.steps),
  );
  const sizeUsed = carrySize(size, steps);
  const multiplier = carryMultiplier(sizeUsed);
  const carry = derived([
    {
      label: `Strength ${strScore} × ${multiplier} (${SIZE_NAMES[sizeUsed]}${steps ? `, counted ${steps === 1 ? 'one size' : `${steps} sizes`} larger` : ''})`,
      value: strScore * multiplier,
      kind: 'base',
    },
  ]);
  const dragLiftPush = carry.value * 2;
  if (weight.value > dragLiftPush) {
    ctx.issues.push({
      severity: 'warn',
      code: 'overDragLimit',
      message: `You have ${weight.value} lb.; you can drag, lift or push at most ${dragLiftPush} lb.`,
    });
  } else if (weight.value > carry.value) {
    ctx.issues.push({
      severity: 'info',
      code: 'overCapacity',
      message: `You have ${weight.value} lb.; you can carry ${carry.value} lb. Past that you can only drag, lift or push it, with a Speed of no more than 5 feet.`,
    });
  }

  // Containers: what is inside each, against what it holds.
  const children = new Map<string, InventoryItem[]>();
  for (const r of rows) {
    const p = parentOf(r);
    if (p && p.uid !== r.uid) children.set(p.uid, [...(children.get(p.uid) ?? []), r]);
  }
  const contentsOf = (r: InventoryItem, seen: Set<string>): number => {
    let sum = 0;
    for (const child of children.get(r.uid) ?? []) {
      if (seen.has(child.uid)) continue;
      seen.add(child.uid);
      sum += rowWeight(child);
      if (!weightless(child)) sum += contentsOf(child, seen);
    }
    return sum;
  };
  const nameOfId = (id: Id) => ctx.index.get({ kind: 'item', id })?.name ?? id.split('|')[0] ?? id;
  // A container that holds items by count (a Quiver: 20 Arrows). A pack of them counts as its
  // contents. Without a weight limit too, it holds nothing else.
  const countItems = (
    r: InventoryItem,
    limits: Record<Id, number>,
    entry: DerivedContainer,
    kids: InventoryItem[],
  ) => {
    const counts = new Map<Id, number>();
    for (const child of kids) {
      const pack = items.get(child.uid)?.item?.packContents;
      const units: [Id, number][] =
        pack?.length && pack.every((p) => p.itemId in limits)
          ? pack.map((p) => [p.itemId, p.quantity * child.quantity])
          : child.itemRef
            ? [[child.itemRef.id, child.quantity]]
            : [];
      const fits = units.length > 0 && units.every(([id]) => id in limits);
      for (const [id, n] of units) if (id in limits) counts.set(id, (counts.get(id) ?? 0) + n);
      if (!fits && entry.capacity === undefined) {
        ctx.issues.push({
          severity: 'warn',
          code: 'containerFull',
          message: `${child.name} doesn’t go in ${r.name}; it holds ${Object.keys(limits).map(nameOfId).join(', ')}.`,
        });
      }
    }
    entry.counts = Object.entries(limits).map(([itemId, max]) => ({
      itemId,
      name: nameOfId(itemId),
      count: counts.get(itemId) ?? 0,
      max: max * Math.max(1, r.quantity),
    }));
    for (const c of entry.counts) {
      if (c.count <= c.max) continue;
      ctx.issues.push({
        severity: 'warn',
        code: 'containerFull',
        message: `${r.name} holds ${c.max} ${c.name}; it has ${c.count} in it.`,
      });
    }
  };
  const containers: Record<string, DerivedContainer> = {};
  for (const r of rows) {
    const item = items.get(r.uid)?.item;
    const kids = children.get(r.uid);
    if (!isContainer(item) && !kids) continue;
    const entry: DerivedContainer = {
      contents: round(contentsOf(r, new Set([r.uid]))),
      weightless: weightless(r),
    };
    if (item?.containerCapacityLb !== undefined)
      entry.capacity = item.containerCapacityLb * Math.max(1, r.quantity);
    containers[r.uid] = entry;
    if (entry.capacity !== undefined && entry.contents > entry.capacity) {
      ctx.issues.push({
        severity: 'warn',
        code: 'containerFull',
        message: `${r.name} holds ${entry.capacity} lb.; it has ${entry.contents} lb. in it.`,
      });
    }
    if (item?.containerItems) countItems(r, item.containerItems, entry, kids ?? []);
  }

  // Attunement.
  // Custom items and items not loaded count when marked; library items only if they need it.
  const attunedRows = rows.filter((r) => {
    const { item, variant } = items.get(r.uid)!;
    return r.attuned && (!item || !!needsAttunement(item, variant));
  });
  if (attunedRows.length > ATTUNEMENT_MAX) {
    ctx.issues.push({
      severity: 'warn',
      code: 'attunement',
      message: `${attunedRows.length} items attuned; the limit is ${ATTUNEMENT_MAX}.`,
    });
  }
  const copies = new Map<string, InventoryItem[]>();
  for (const r of attunedRows) {
    if (!r.itemRef) continue;
    const key = `${r.itemRef.id}+${r.variantRef?.id ?? ''}`;
    copies.set(key, [...(copies.get(key) ?? []), r]);
  }
  for (const list of copies.values()) {
    if (list.length < 2) continue;
    ctx.issues.push({
      severity: 'warn',
      code: 'attunementCopies',
      message: `You can’t attune to more than one copy of ${list[0]!.name}.`,
    });
  }
  const unqualified: string[] = [];
  for (const r of rows) {
    const { item, variant } = items.get(r.uid)!;
    const need = needsAttunement(item, variant);
    const tags = attunementTags(item, variant);
    if (!need || !tags.length) continue;
    // Alternatives: one met (or one the sheet can't judge) is enough.
    if (tags.some((t) => meetsTag(ctx, t, spellcasting) !== false)) continue;
    unqualified.push(r.uid);
    if (!r.attuned) continue;
    ctx.issues.push({
      severity: 'warn',
      code: 'attunementPrereq',
      message: `${r.name} requires Attunement${typeof need === 'string' ? ` ${need}` : ''}, which you don’t meet; your Attunement to it ends.`,
    });
  }

  const charges: Record<string, ItemCharges> = {};
  for (const r of rows) {
    const { item, variant } = items.get(r.uid)!;
    const ch = chargesOf(r, item, variant);
    if (ch) charges[r.uid] = ch;
  }

  return {
    charges,
    weight,
    carry,
    dragLiftPush,
    carrySize: sizeUsed,
    attuned: attunedRows.length,
    attunementMax: ATTUNEMENT_MAX,
    unqualified,
    containers,
  };
}

/** Whether a character may attune to this row now, and why not. */
export function attuneBlock(
  character: Character,
  sheet: { inventory: DerivedInventory },
  row: InventoryItem,
): string | null {
  if (row.attuned) return null;
  if (sheet.inventory.unqualified.includes(row.uid)) {
    return `You don’t meet its prerequisite.`;
  }
  if (sheet.inventory.attuned >= ATTUNEMENT_MAX) {
    return `You’re attuned to ${ATTUNEMENT_MAX} items; end your Attunement to one first.`;
  }
  const copy = character.inventory.find(
    (r) =>
      r.uid !== row.uid &&
      r.attuned &&
      r.itemRef?.id === row.itemRef?.id &&
      r.variantRef?.id === row.variantRef?.id,
  );
  if (row.itemRef && copy) return `You’re already attuned to a copy of ${row.name}.`;
  return null;
}
