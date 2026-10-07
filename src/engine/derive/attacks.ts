// Attacks (plan §9.2, step 3.6; P3, P4 and weapon mastery). Every weapon in the inventory (the
// ones in hand first), the Light property's extra attack, and the Unarmed Strike; spell attacks
// are added with spellcasting.

import type { Ability, Effect, Id, InventoryItem, Item } from '../../schema/index.ts';
import type { EffectSource } from '../collect/types.ts';
import { averageOf, formatValue, isDice, type Value } from '../formula/dice.ts';
import { cellToValue } from '../formula/evaluate.ts';
import {
  matchesFilter,
  propertyAbbr,
  UNARMED_TRAITS,
  weaponTraits,
  type AttackTraits,
  type Hand,
} from '../static/attackTraits.ts';
import { resolveBound } from '../static/bound.ts';
import {
  contribution,
  derived,
  effectsOfType,
  evalValue,
  valuesOf,
  type DeriveContext,
} from './context.ts';
import { magicWorks, rowItems } from '../items/items.ts';
import { buildRoll, type Proficiencies } from './rolls.ts';
import { costOf } from './resources.ts';
import type {
  AmmoSource,
  AttackUse,
  Contribution,
  Derived,
  DerivedAmmo,
  DerivedAttack,
  DerivedResource,
  DerivedRider,
} from './types.ts';

type Mods = Record<Ability, number>;
type AttackMod = Extract<Effect, { type: 'attackMod' }>;

const PROPERTY_NAMES: Record<string, string> = {
  A: 'Ammunition',
  F: 'Finesse',
  H: 'Heavy',
  L: 'Light',
  LD: 'Loading',
  R: 'Reach',
  T: 'Thrown',
  '2H': 'Two-Handed',
  V: 'Versatile',
};

/**
 * Whether weapon proficiencies (lowercased values: a category, an item id, or 2024 text such
 * as Rogue's) cover a weapon.
 */
export function weaponProficient(item: Item, weapons: ReadonlySet<string>): boolean {
  const w = item.weapon;
  if (!w) return false;
  if (weapons.has(w.category)) return true;
  if (weapons.has(item.id) || (item.baseItemId && weapons.has(item.baseItemId))) return true;
  const props = new Set(w.properties.map(propertyAbbr));
  // "Martial weapons that have the Finesse or Light property" (2024 Rogue).
  for (const text of weapons) {
    if (!text.includes(w.category)) continue;
    const needs = (['finesse', 'light'] as const).filter((p) => text.includes(p));
    if (needs.some((p) => props.has(p === 'finesse' ? 'F' : 'L'))) return true;
  }
  return false;
}

function modsFor(ctx: DeriveContext, traits: AttackTraits) {
  return effectsOfType(ctx.collected, 'attackMod').filter((a) =>
    matchesFilter(a.effect.filter, traits),
  );
}

/** The best ability among the attack's own options and the ones attack modifiers allow. */
function pickAbility(own: Ability[], mods: { effect: AttackMod }[], scores: Mods): Ability {
  const options = new Set<Ability>(own);
  for (const { effect } of mods) for (const a of effect.abilities ?? []) options.add(a);
  return [...options].reduce((best, a) => (scores[a] > scores[best] ? a : best));
}

function riderList(
  ctx: DeriveContext,
  traits: AttackTraits,
  resources: readonly DerivedResource[],
): DerivedRider[] {
  const out: DerivedRider[] = [];
  for (const { effect, source } of effectsOfType(ctx.collected, 'damageRider')) {
    if (!matchesFilter(effect.filter, traits)) continue;
    const rider: DerivedRider = {
      id: effect.id,
      name: effect.name,
      dice: formatValue(evalValue(ctx, effect.dice, source)),
      oncePerTurn: !!effect.oncePerTurn,
      optIn: effect.optIn,
    };
    const type = effect.damageType
      ? resolveBound(effect.damageType, source, (k) => valuesOf(ctx.recon, k))
      : undefined;
    if (type) rider.damageType = type;
    if (effect.cost) rider.cost = costOf(ctx, effect.cost, resources, source);
    out.push(rider);
  }
  return out;
}

/** The larger of two damage dice by average (Martial Arts: weapon die or Martial Arts die). */
function largerDie(base: Value, override: Value): Value {
  return averageOf(override) > averageOf(base) ? override : base;
}

interface AttackInput {
  id: string;
  name: string;
  kind: 'weapon' | 'unarmed';
  use: AttackUse;
  traits: AttackTraits;
  ownAbilities: Ability[];
  proficient: boolean;
  baseDie: Value;
  damageType: string;
  distance: string;
  ready: boolean;
  item?: Item;
  variant?: Item;
  row?: InventoryItem;
}

function buildAttack(
  ctx: DeriveContext,
  input: AttackInput,
  scores: Mods,
  mods: Mods,
  pb: number,
  resources: readonly DerivedResource[],
): DerivedAttack {
  const broad = modsFor(ctx, input.traits);
  const ability = pickAbility(input.ownAbilities, broad, scores);
  const traits: AttackTraits = { ...input.traits, ability };
  const applied = modsFor(ctx, traits);

  const hitParts: Contribution[] = [
    { label: `${ability.toUpperCase()} modifier`, value: mods[ability] },
  ];
  const damageParts: Contribution[] = [];
  const offHand = traits.tags.includes('offHand');
  // The Light extra attack adds no positive ability modifier to damage (2024).
  if (!offHand || mods[ability] < 0) {
    damageParts.push({ label: `${ability.toUpperCase()} modifier`, value: mods[ability] });
  }
  // Magic that needs Attunement works only when attuned; the weapon itself always does.
  const magic = !input.row || magicWorks(input.row, input.item, input.variant);
  const itemBonus = (b: 'weapon' | 'weaponAttack' | 'weaponDamage') =>
    magic ? (input.item?.bonuses?.[b] ?? 0) + (input.variant?.bonuses?.[b] ?? 0) : 0;
  const magicHit = itemBonus('weapon') + itemBonus('weaponAttack');
  const magicDamage = itemBonus('weapon') + itemBonus('weaponDamage');
  const magicName = input.variant?.name ?? input.item?.name ?? input.name;
  const magicHitPart = magicHit ? [{ label: magicName, value: magicHit }] : [];
  if (magicDamage) damageParts.push({ label: magicName, value: magicDamage });

  let die = input.baseDie;
  let critRange = 20;
  const dieSources: string[] = [];
  for (const { effect, source } of applied) {
    if (effect.toHit !== undefined) {
      const v = evalValue(ctx, effect.toHit, source);
      if (!isDice(v)) hitParts.push(contribution(effect.label, v, source));
    }
    if (effect.damage !== undefined) {
      const v = evalValue(ctx, effect.damage, source);
      if (!isDice(v)) damageParts.push(contribution(effect.label, v, source));
    }
    if (effect.damageDie !== undefined) {
      const next = largerDie(die, evalValue(ctx, effect.damageDie, source));
      if (next !== die) dieSources.push(effect.label);
      die = next;
    }
    if (effect.critRange !== undefined) critRange = Math.min(critRange, effect.critRange);
  }

  const roll = buildRoll(
    ctx,
    { type: 'attack', traits },
    [...hitParts, ...magicHitPart],
    input.proficient ? 'proficient' : 'none',
    pb,
  );

  const notes = [
    ...traits.properties.map((p) => PROPERTY_NAMES[p] ?? p),
    ...dieSources.map((s) => `${s} die`),
  ];
  const attack: DerivedAttack = {
    id: input.id,
    name: input.name,
    kind: input.kind,
    use: input.use,
    ready: input.ready,
    range: traits.range,
    distance: input.distance,
    ability,
    proficient: input.proficient,
    toHit: roll,
    damageDice: isDice(die) ? formatValue({ ...die, flat: 0 }) : '',
    damageBonus: derived([
      ...(isDice(die) || die === 0
        ? []
        : [{ label: input.name, value: die, kind: 'base' as const }]),
      ...damageParts,
    ]),
    damageType: input.damageType,
    critRange,
    propertyIds: input.item?.weapon?.properties ?? [],
    riders: riderList(ctx, traits, resources),
    notes,
  };
  if (input.row) attack.rowUid = input.row.uid;
  if (input.item) attack.itemRef = { kind: 'item', id: input.item.id };
  return attack;
}

/**
 * What an Ammunition weapon can fire: rows of its ammunition (magic ones with their bonus, a
 * specific magic piece built on it too) and unopened bundles of it ("Arrows (20)").
 */
/** `firearm bullet` → `Firearm Bullet`. */
const titleCase = (s: string) => s.replace(/(^|\s)\S/g, (m) => m.toUpperCase());

function ammoFor(ctx: DeriveContext, ammoType: Id, noHandToLoad: boolean): DerivedAmmo {
  const loose: AmmoSource[] = [];
  const bundles: AmmoSource[] = [];
  const isAmmo = (row: InventoryItem, item?: Item) =>
    row.itemRef?.id === ammoType || item?.baseItemId === ammoType;
  for (const row of ctx.character.inventory) {
    if (row.quantity <= 0) continue;
    const { item, variant } = rowItems(ctx.index, row);
    if (isAmmo(row, item)) {
      const magic = magicWorks(row, item, variant);
      const bonus = (b: 'weapon' | 'weaponAttack' | 'weaponDamage') =>
        magic ? (item?.bonuses?.[b] ?? 0) + (variant?.bonuses?.[b] ?? 0) : 0;
      loose.push({
        rowUid: row.uid,
        name: row.name,
        count: row.quantity,
        bundle: false,
        hitBonus: bonus('weapon') + bonus('weaponAttack'),
        damageBonus: bonus('weapon') + bonus('weaponDamage'),
      });
    } else if (
      item?.packContents?.length &&
      item.packContents.every((p) => p.itemId === ammoType)
    ) {
      const each = item.packContents.reduce((n, p) => n + p.quantity, 0);
      bundles.push({
        rowUid: row.uid,
        name: row.name,
        count: each * row.quantity,
        bundle: true,
        hitBonus: 0,
        damageBonus: 0,
      });
    }
  }
  const sources = [...loose, ...bundles];
  const used = Object.entries(ctx.character.state.ammoUsed ?? {}).flatMap(([rowUid, count]) => {
    const row = ctx.character.inventory.find((r) => r.uid === rowUid);
    if (!row || count <= 0 || !isAmmo(row, rowItems(ctx.index, row).item)) return [];
    return [{ rowUid, name: row.name, count }];
  });
  return {
    itemId: ammoType,
    name:
      ctx.index.get({ kind: 'item', id: ammoType })?.name ??
      titleCase(ammoType.split('|')[0] ?? ammoType),
    sources,
    total: sources.reduce((n, s) => n + s.count, 0),
    used,
    noHandToLoad,
  };
}

function distanceOf(item: Item, ranged: boolean): string {
  const w = item.weapon!;
  const reach = w.properties.some((p) => propertyAbbr(p) === 'R') ? 10 : 5;
  if (ranged || !w.range) return w.range ? `${w.range[0]}/${w.range[1]} ft.` : `${reach} ft.`;
  return `${reach} ft. or ${w.range[0]}/${w.range[1]} ft.`;
}

export function deriveAttacks(
  ctx: DeriveContext,
  scores: Mods,
  mods: Mods,
  profs: Proficiencies,
  pb: number,
  resources: readonly DerivedResource[],
): { attacks: DerivedAttack[]; attacksPerAction: Derived } {
  const attacks: DerivedAttack[] = [];
  const wield = ctx.st.wield;
  const hands = new Map<string, Hand>(wield.wielded.map((w) => [w.row.uid, w.hand]));
  const isLight = (w: { traits: AttackTraits }) => w.traits.properties.includes('L');

  const rows = [...ctx.character.inventory].sort(
    (a, b) => Number(hands.has(b.uid)) - Number(hands.has(a.uid)),
  );
  for (const row of rows) {
    if (!row.itemRef) continue;
    const item = ctx.index.get({ kind: 'item', id: row.itemRef.id });
    if (!item?.weapon) continue;
    const variant = row.variantRef
      ? ctx.index.get({ kind: 'item', id: row.variantRef.id })
      : undefined;
    const hand = hands.get(row.uid);
    const wieldTraits = weaponTraits(item, hand);
    // Holding a weapon in the off hand changes nothing by itself (2024): only the Light extra
    // attack below drops the ability modifier, so only it carries the `offHand` tag.
    const traits = { ...wieldTraits, tags: wieldTraits.tags.filter((t) => t !== 'offHand') };
    const finesse = traits.properties.includes('F');
    const own: Ability[] = traits.range === 'ranged' ? ['dex'] : finesse ? ['str', 'dex'] : ['str'];
    const twoHands = hand === 'both';
    const versatile = item.weapon.versatile;
    const baseDie = cellToValue(twoHands && versatile ? versatile : item.weapon.damage);
    const masteryId = item.weapon.masteryId;
    const base = item.baseItemId ?? item.id;
    const mastery =
      masteryId && (profs.masteries.has(base) || profs.masteries.has(item.id))
        ? {
            id: masteryId,
            name:
              ctx.index.get({ kind: 'rule', id: masteryId })?.name ??
              masteryId.split('/')[1]?.split('|')[0] ??
              masteryId,
          }
        : undefined;
    const input: AttackInput = {
      id: `item:${row.uid}`,
      name: row.name || item.name,
      kind: 'weapon',
      use: { kind: 'attackAction' },
      traits,
      ownAbilities: own,
      proficient: weaponProficient(item, new Set(profs.weapons.keys())),
      baseDie,
      damageType: item.weapon.damageType,
      distance: distanceOf(item, traits.range === 'ranged'),
      // A Two-Handed weapon needs both hands to attack: held in one, the other must be free.
      ready:
        !!hand && (hand === 'both' || !traits.properties.includes('2H') || wield.freeHands >= 1),
      item,
      ...(variant ? { variant } : {}),
      row,
    };
    const attack = buildAttack(ctx, input, scores, mods, pb, resources);
    // Versatile: a melee attack with both hands, which needs the other hand free (a shield
    // always takes it). A stowed weapon could be drawn into two free hands.
    const canTwoHand = hand ? wield.freeHands >= 1 : !wield.shield;
    if (versatile && !twoHands && canTwoHand && traits.range === 'melee')
      attack.versatileDice = versatile;
    if (mastery) attack.mastery = mastery;
    // Ammunition: a one-handed weapon needs a free hand to load (the weapon holds the other).
    const ammoType = item.weapon.ammoType;
    if (ammoType && traits.properties.includes('A')) {
      const oneHanded = !traits.properties.includes('2H') && hand !== 'both';
      attack.ammo = ammoFor(ctx, ammoType, !!hand && oneHanded && wield.freeHands < 1);
    }
    attacks.push(attack);

    // The Light property: after attacking with a Light weapon in the Attack action, one extra
    // attack with a different Light weapon. Offered for a Light weapon in the off hand while
    // another Light weapon is in hand.
    const otherLight = wield.wielded.some((w) => w.row.uid !== row.uid && isLight(w));
    if (hand === 'off' && isLight({ traits }) && otherLight) {
      const nick = mastery?.name.toLowerCase() === 'nick';
      const extra = buildAttack(
        ctx,
        {
          ...input,
          id: `item:${row.uid}:light`,
          use: { kind: 'lightExtra', nick },
          traits: wieldTraits,
        },
        scores,
        mods,
        pb,
        resources,
      );
      if (mastery) extra.mastery = mastery;
      attacks.push(extra);
    }
  }

  // Unarmed Strike: 1 + Strength, always proficient (2024).
  const unarmed = buildAttack(
    ctx,
    {
      id: 'unarmed',
      name: 'Unarmed Strike',
      kind: 'unarmed',
      use: { kind: 'attackAction' },
      traits: UNARMED_TRAITS,
      ownAbilities: ['str'],
      proficient: true,
      baseDie: 1,
      damageType: 'bludgeoning',
      distance: '5 ft.',
      ready: true,
    },
    scores,
    mods,
    pb,
    resources,
  );
  // Grapple and Shove: DC 8 + Strength modifier + Proficiency Bonus. The ability is the one the
  // strike uses, so a feature that allows Dexterity for it (2024 Monk) applies here too.
  unarmed.grapple = {
    dc: derived([
      { label: 'Base', value: 8, kind: 'base' },
      { label: `${unarmed.ability.toUpperCase()} modifier`, value: mods[unarmed.ability] },
      { label: 'Proficiency', value: pb },
    ]),
    freeHand: wield.freeHands > 0,
  };
  attacks.push(unarmed);

  // Extra Attack does not stack: the largest count wins.
  let perAction: Contribution = { label: 'Attack action', value: 1, kind: 'base' };
  const counts: { value: number; source: EffectSource }[] = [
    ...effectsOfType(ctx.collected, 'extraAttack').map((a) => ({
      value: a.effect.count,
      source: a.source,
    })),
    ...effectsOfType(ctx.collected, 'attackMod')
      .filter((a) => a.effect.extraAttacks !== undefined)
      .map((a) => ({ value: a.effect.extraAttacks!, source: a.source })),
  ];
  for (const c of counts) {
    if (c.value > perAction.value)
      perAction = { ...contribution(c.source.name, c.value, c.source), kind: 'set' };
  }
  return { attacks, attacksPerAction: { value: perAction.value, parts: [perAction] } };
}
