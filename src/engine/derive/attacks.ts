// Attacks (plan §9.2, step 3.6; P3, P4 and weapon mastery). Every weapon in the inventory (the
// ones in hand first) and the Unarmed Strike; spell attacks are added with spellcasting.

import type { Ability, Effect, InventoryItem, Item } from '../../schema/index.ts';
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
import { buildRoll, type Proficiencies } from './rolls.ts';
import type { Contribution, Derived, DerivedAttack, DerivedRider } from './types.ts';

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

/** Whether the character is proficient with a weapon (category, item, or 2024 text rules). */
export function weaponProficient(item: Item, profs: Proficiencies): boolean {
  const w = item.weapon;
  if (!w) return false;
  if (profs.weapons.has(w.category)) return true;
  if (profs.weapons.has(item.id) || (item.baseItemId && profs.weapons.has(item.baseItemId)))
    return true;
  const props = new Set(w.properties.map(propertyAbbr));
  // "Martial weapons that have the Finesse or Light property" (2024 Rogue).
  for (const text of profs.weapons.keys()) {
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

function riderList(ctx: DeriveContext, traits: AttackTraits): DerivedRider[] {
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
    if (effect.cost) {
      rider.cost =
        'resource' in effect.cost
          ? `${String(effect.cost.amount)} ${effect.cost.resource}`
          : 'slot' in effect.cost
            ? `a level ${effect.cost.slot.minLevel}+ spell slot`
            : 'hitDice' in effect.cost
              ? `${String(effect.cost.hitDice)} Hit Dice`
              : effect.cost.action;
    }
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
  const itemBonus = (b: 'weapon' | 'weaponAttack' | 'weaponDamage') =>
    (input.item?.bonuses?.[b] ?? 0) + (input.variant?.bonuses?.[b] ?? 0);
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
    riders: riderList(ctx, traits),
    notes,
  };
  if (input.row) attack.rowUid = input.row.uid;
  if (input.item) attack.itemRef = { kind: 'item', id: input.item.id };
  return attack;
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
): { attacks: DerivedAttack[]; attacksPerAction: Derived } {
  const attacks: DerivedAttack[] = [];
  const hands = new Map<string, Hand>(ctx.st.wield.wielded.map((w) => [w.row.uid, w.hand]));

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
    const traits = weaponTraits(item, hand);
    const finesse = traits.properties.includes('F');
    const own: Ability[] = traits.range === 'ranged' ? ['dex'] : finesse ? ['str', 'dex'] : ['str'];
    const twoHands = hand === 'both';
    const versatile = item.weapon.versatile;
    const baseDie = cellToValue(twoHands && versatile ? versatile : item.weapon.damage);
    const attack = buildAttack(
      ctx,
      {
        id: `item:${row.uid}`,
        name: row.name || item.name,
        kind: 'weapon',
        traits,
        ownAbilities: own,
        proficient: weaponProficient(item, profs),
        baseDie,
        damageType: item.weapon.damageType,
        distance: distanceOf(item, traits.range === 'ranged'),
        ready: !!hand,
        item,
        ...(variant ? { variant } : {}),
        row,
      },
      scores,
      mods,
      pb,
    );
    if (versatile && !twoHands) attack.versatileDice = versatile;
    const masteryId = item.weapon.masteryId;
    const base = item.baseItemId ?? item.id;
    if (masteryId && (profs.masteries.has(base) || profs.masteries.has(item.id))) {
      const rule = ctx.index.get({ kind: 'rule', id: masteryId });
      attack.mastery = {
        id: masteryId,
        name: rule?.name ?? masteryId.split('/')[1]?.split('|')[0] ?? masteryId,
      };
    }
    attacks.push(attack);
  }

  // Unarmed Strike: 1 + Strength, always proficient (2024).
  attacks.push(
    buildAttack(
      ctx,
      {
        id: 'unarmed',
        name: 'Unarmed Strike',
        kind: 'unarmed',
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
    ),
  );

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
