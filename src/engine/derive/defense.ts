// Armor Class, hit points, hit dice, speed, senses, defenses and size (plan §9.2, step 3.5).

import {
  MOVE_MODES,
  refKey,
  type Ability,
  type InventoryItem,
  type Item,
  type MoveMode,
  type Size,
} from '../../schema/index.ts';
import { choiceKey } from '../collect/collect.ts';
import { armorDrawbacks, magicWorks, needsAttunement } from '../items/items.ts';
import { resolveBound } from '../static/bound.ts';
import {
  contribution,
  derived,
  effectsOfType,
  evalNumber,
  valuesOf,
  withOverride,
  type DeriveContext,
} from './context.ts';
import { itemBonusOff } from './itemBonuses.ts';
import type { Contribution, Derived, DerivedClass, DerivedSheet, SourcedValue } from './types.ts';

type Mods = Record<Ability, number>;

/**
 * AC bonus an item gives on its own (+1 armor, a Ring of Protection), and from its variant.
 * Magic that needs Attunement works only when attuned.
 */
function itemAcBonus(
  row: InventoryItem,
  item: Item | undefined,
  variant: Item | undefined,
): number {
  if (!magicWorks(row, item, variant)) return 0;
  return (item?.bonuses?.ac ?? 0) + (variant?.bonuses?.ac ?? 0);
}

const UNARMORED_DEFENSE = 'Unarmored Defense';

export function deriveAc(ctx: DeriveContext, mods: Mods): Derived & { calculation: string } {
  const { armor, shield } = ctx.st.wield;
  const candidates: { name: string; parts: Contribution[]; shield: boolean }[] = [];

  if (armor) {
    const name = armor.item?.name ?? armor.row.name;
    const parts: Contribution[] = [{ label: name, value: armor.info.ac, kind: 'base' }];
    if (armor.info.category === 'light') parts.push({ label: 'DEX modifier', value: mods.dex });
    if (armor.info.category === 'medium') {
      parts.push({ label: 'DEX modifier (max 2)', value: Math.min(mods.dex, 2) });
    }
    const magic = itemAcBonus(armor.row, armor.item, armor.variant);
    if (magic) parts.push({ label: `${name} bonus`, value: magic });
    candidates.push({ name, parts, shield: true });
  } else {
    candidates.push({
      name: 'Unarmored',
      parts: [
        { label: 'Base', value: 10, kind: 'base' },
        { label: 'DEX modifier', value: mods.dex },
      ],
      shield: true,
    });
    // 2024 multiclassing: Unarmored Defense comes only from the first class that gave it.
    const formulas = effectsOfType(ctx.collected, 'acFormula');
    const firstEntry = (classId?: string) =>
      classId ? ctx.character.log.findIndex((e) => e.classRef.id === classId) : -1;
    const unarmored = formulas
      .filter((f) => f.effect.name === UNARMORED_DEFENSE && f.source.classId)
      .sort((a, b) => firstEntry(a.source.classId) - firstEntry(b.source.classId));
    const kept = unarmored[0];
    for (const later of unarmored.slice(1)) {
      if (later.source.classId === kept?.source.classId) continue;
      ctx.issues.push({
        severity: 'info',
        code: 'unarmoredDefenseAgain',
        message: `You have Unarmored Defense from your first class with it, so the ${later.source.name} of a later class doesn’t apply (multiclassing).`,
        ref: later.source.ref,
      });
    }
    for (const { effect, source } of formulas) {
      if (shield && !effect.shield) continue;
      if (
        effect.name === UNARMORED_DEFENSE &&
        source.classId &&
        kept &&
        source.classId !== kept.source.classId
      )
        continue;
      candidates.push({
        name: effect.name,
        parts: [
          { ...contribution(effect.name, effect.base, source), kind: 'base' },
          ...effect.addAbilities.map((a) => ({
            label: `${a.toUpperCase()} modifier`,
            value: mods[a],
          })),
        ],
        shield: effect.shield,
      });
    }
  }

  const best = candidates.reduce((a, b) =>
    derived(b.parts).value > derived(a.parts).value ? b : a,
  );
  const parts = [...best.parts];
  // Items whose mapping turns their AC bonus off (it applies only in some cases, re-added there).
  const acOf = (row: InventoryItem, item: Item | undefined, variant: Item | undefined) =>
    itemBonusOff(ctx, row, 'ac') ? 0 : itemAcBonus(row, item, variant);
  // A Shield gives its AC only with Shield training (2024).
  if (shield && !ctx.gear?.untrainedShield) {
    const name = shield.item?.name ?? shield.row.name;
    parts.push({
      label: name,
      value: shield.info.ac + acOf(shield.row, shield.item, shield.variant),
    });
  }
  // Other items in use with an AC bonus (rings, cloaks), when attuned if they need it.
  for (const row of ctx.character.inventory) {
    if (!row.equipped || row.equipped === 'armor' || row.equipped === 'shield' || !row.itemRef)
      continue;
    const item = ctx.index.get({ kind: 'item', id: row.itemRef.id });
    const variant = row.variantRef
      ? ctx.index.get({ kind: 'item', id: row.variantRef.id })
      : undefined;
    if (needsAttunement(item, variant) && !row.attuned) continue;
    const bonus = acOf(row, item, variant);
    if (bonus && !item?.weapon)
      parts.push({ label: item?.name ?? row.name, value: bonus, source: row.itemRef });
  }
  for (const { effect, source } of effectsOfType(ctx.collected, 'acBonus')) {
    parts.push(contribution(source.name, evalNumber(ctx, effect.value, source), source));
  }
  return { ...withOverride(derived(parts), ctx.character, 'ac'), calculation: best.name };
}

export function deriveClasses(ctx: DeriveContext): DerivedClass[] {
  // Content that isn't loaded (a removed homebrew source): the character's snapshot names it.
  const snapshot = (kind: 'class' | 'subclass', id: string) =>
    ctx.character.snapshots[refKey({ kind, id })];
  return ctx.st.classes.map((c) => {
    const saved = c.cls ? undefined : snapshot('class', c.classId);
    const out: DerivedClass = {
      classId: c.classId,
      name: c.cls?.name ?? saved?.name ?? c.classId,
      level: c.level,
      hitDie: c.cls?.hitDie ?? saved?.hitDie ?? 8,
    };
    if (c.subclassId) {
      out.subclassId = c.subclassId;
      out.subclassName =
        c.subclass?.name ?? snapshot('subclass', c.subclassId)?.name ?? c.subclassId;
    }
    return out;
  });
}

export function deriveHp(
  ctx: DeriveContext,
  mods: Mods,
  classes: DerivedClass[],
): DerivedSheet['hp'] {
  const dieOf = new Map(classes.map((c) => [c.classId, c.hitDie]));
  const parts: Contribution[] = [];
  let fromLevels = 0;
  ctx.character.log.forEach((entry, i) => {
    const die = dieOf.get(entry.classRef.id) ?? 8;
    const hp = entry.hp;
    // Level 1 always takes the full hit die (2024).
    fromLevels += i === 0 || hp.mode === 'max' ? die : hp.mode === 'roll' ? hp.value : die / 2 + 1;
  });
  if (ctx.character.log.length) parts.push({ label: 'Hit dice', value: fromLevels, kind: 'base' });
  const level = ctx.character.log.length;
  if (level) parts.push({ label: `CON modifier × ${level}`, value: mods.con * level });
  for (const { effect, source } of effectsOfType(ctx.collected, 'hpBonus')) {
    const perLevel =
      effect.perLevel === undefined ? 0 : evalNumber(ctx, effect.perLevel, source) * level;
    const flat = effect.flat === undefined ? 0 : evalNumber(ctx, effect.flat, source);
    parts.push(contribution(source.name, perLevel + flat, source));
  }
  const max = withOverride(derived(parts), ctx.character, 'hpMax');
  const { damage, tempHp, wardHp } = ctx.character.state;
  const hp: DerivedSheet['hp'] = {
    max,
    current: Math.max(0, max.value - damage),
    temp: tempHp,
  };
  const tempBonuses = effectsOfType(ctx.collected, 'tempHpBonus');
  if (tempBonuses.length) {
    hp.tempBonus = {
      value: tempBonuses.reduce((sum, e) => sum + e.effect.value, 0),
      sources: tempBonuses.map((e) => e.source.name),
    };
  }
  const hitDie = effectsOfType(ctx.collected, 'hitDieHealing');
  if (hitDie.length) {
    const floors = hitDie.map((e) => e.effect.floor ?? 0);
    hp.hitDieHealing = {
      ...(Math.max(...floors) > 0 ? { floor: Math.max(...floors) } : {}),
      ...(hitDie.some((e) => e.effect.max) ? { max: true } : {}),
      ...(hitDie.some((e) => e.effect.double) ? { double: true } : {}),
      sources: hitDie.map((e) => e.source.name),
    };
  }
  const ward = effectsOfType(ctx.collected, 'ward')[0];
  if (ward) {
    const wardMax = derived([
      contribution(ward.source.name, evalNumber(ctx, ward.effect.max, ward.source), ward.source),
    ]);
    hp.ward = { name: ward.effect.name, max: wardMax, current: Math.min(wardHp, wardMax.value) };
  }
  return hp;
}

export function deriveHitDice(
  ctx: DeriveContext,
  classes: DerivedClass[],
): DerivedSheet['hitDice'] {
  const total = new Map<number, number>();
  for (const c of classes) total.set(c.hitDie, (total.get(c.hitDie) ?? 0) + c.level);
  return [...total]
    .sort(([a], [b]) => b - a)
    .map(([faces, n]) => ({
      faces,
      total: n,
      used: Math.min(n, ctx.character.state.hitDiceUsed[faces] ?? 0),
    }));
}

/** What the character carries, against what they can carry and drag (`deriveInventory`). */
export interface Load {
  weight: number;
  carry: number;
  dragLiftPush: number;
}

export function deriveSpeed(
  ctx: DeriveContext,
  strScore: number,
  load?: Load,
): DerivedSheet['speed'] {
  const base = new Map<
    MoveMode,
    { value: number | 'walk'; label: string; source?: Contribution['source'] }
  >();
  for (const { effect, source } of effectsOfType(ctx.collected, 'speed')) {
    const value = effect.value === 'walk' ? 'walk' : evalNumber(ctx, effect.value, source);
    const current = base.get(effect.mode);
    // The best speed for a mode wins; a "equal to your Speed" one only fills a gap.
    if (!current || (value !== 'walk' && (current.value === 'walk' || value > current.value))) {
      base.set(effect.mode, { value, label: source.name, source: source.ref });
    }
  }
  for (const { effect } of effectsOfType(ctx.collected, 'speedOff')) {
    if (effect.mode !== 'walk') base.delete(effect.mode);
  }
  if (!base.has('walk')) base.set('walk', { value: 30, label: 'Base speed' });

  const bonuses = new Map<MoveMode, Contribution[]>();
  for (const { effect, source } of effectsOfType(ctx.collected, 'speedBonus')) {
    const mode = effect.mode ?? 'walk';
    bonuses.set(mode, [
      ...(bonuses.get(mode) ?? []),
      contribution(source.name, evalNumber(ctx, effect.value, source), source),
    ]);
  }
  const armor = ctx.st.wield.armor;
  const eased = effectsOfType(ctx.collected, 'armorEase').some((e) => e.effect.strength);
  const strReq = armor && !eased ? armorDrawbacks(armor.item, armor.variant).strReq : undefined;
  const penalties: Contribution[] = [];
  if (strReq && strScore < strReq) {
    penalties.push({ label: `${armor?.item?.name ?? 'Armor'} (needs STR ${strReq})`, value: -10 });
  }
  const exhaustion = ctx.character.state.exhaustion;
  if (exhaustion > 0) penalties.push({ label: `Exhaustion ${exhaustion}`, value: -5 * exhaustion });

  const out: DerivedSheet['speed'] = {};
  const walkEntry = base.get('walk')!;
  const walkParts: Contribution[] = [
    {
      label: walkEntry.label,
      value: walkEntry.value === 'walk' ? 30 : walkEntry.value,
      kind: 'base',
      ...(walkEntry.source ? { source: walkEntry.source } : {}),
    },
    ...(bonuses.get('walk') ?? []),
    ...penalties,
  ];
  // Doubled (Boots of Speed): the Speed with its bonuses and penalties, times the multiplier.
  const multiplied = (parts: Contribution[]): Contribution[] => {
    let total = parts.reduce((sum, p) => sum + p.value, 0);
    const out = [...parts];
    for (const { effect, source } of effectsOfType(ctx.collected, 'speedMultiplier')) {
      if (total <= 0) break;
      out.push(
        contribution(`${source.name} (×${effect.value})`, total * (effect.value - 1), source),
      );
      total *= effect.value;
    }
    return out;
  };
  // More than they can carry: they can only drag, lift or push it, at a Speed of no more than
  // 5 feet; more than they can drag: they can't move with it all.
  const limit =
    load && load.weight > load.dragLiftPush
      ? {
          value: 0,
          label: `Carrying ${load.weight} lb., more than you can drag (${load.dragLiftPush} lb.)`,
        }
      : load && load.weight > load.carry
        ? {
            value: 5,
            label: `Carrying ${load.weight} lb., more than you can carry (${load.carry} lb.): at most 5 ft.`,
          }
        : undefined;
  const loaded = (d: Derived): Derived =>
    limit && d.value > limit.value
      ? {
          value: limit.value,
          parts: [...d.parts, { label: limit.label, value: limit.value - d.value }],
        }
      : d;

  out.walk = withOverride(loaded(derived(multiplied(walkParts))), ctx.character, 'speed.walk');
  for (const mode of MOVE_MODES) {
    if (mode === 'walk') continue;
    const entry = base.get(mode);
    if (!entry) continue;
    const parts: Contribution[] =
      entry.value === 'walk'
        ? [
            {
              label: `${entry.label} (equal to Speed)`,
              value: Math.max(0, out.walk.value),
              kind: 'base',
              ...(entry.source ? { source: entry.source } : {}),
            },
          ]
        : [
            {
              label: entry.label,
              value: entry.value,
              kind: 'base',
              ...(entry.source ? { source: entry.source } : {}),
            },
            ...(bonuses.get(mode) ?? []),
            ...penalties,
          ];
    out[mode] = withOverride(loaded(derived(parts)), ctx.character, `speed.${mode}`);
  }
  for (const d of Object.values(out)) if (d.value < 0) d.value = 0;
  return out;
}

function sourcedList<T>(items: { value: T; key: string; source: string }[]): SourcedValue<T>[] {
  const byKey = new Map<string, SourcedValue<T>>();
  for (const { value, key, source } of items) {
    const entry = byKey.get(key);
    if (!entry) byKey.set(key, { value, sources: [source] });
    else if (!entry.sources.includes(source)) entry.sources.push(source);
  }
  return [...byKey.values()];
}

export function deriveSenses(ctx: DeriveContext): DerivedSheet['senses'] {
  const best = new Map<string, { range: number; sources: string[] }>();
  const senses = effectsOfType(ctx.collected, 'sense');
  for (const { effect, source } of senses) {
    if (effect.stack) continue;
    const current = best.get(effect.sense);
    if (!current || effect.range > current.range)
      best.set(effect.sense, { range: effect.range, sources: [source.name] });
    else if (effect.range === current.range && !current.sources.includes(source.name))
      current.sources.push(source.name);
  }
  // Senses that add to one the character already has (or give it).
  for (const { effect, source } of senses) {
    if (!effect.stack) continue;
    const current = best.get(effect.sense);
    if (!current) best.set(effect.sense, { range: effect.range, sources: [source.name] });
    else {
      current.range += effect.range;
      current.sources.push(source.name);
    }
  }
  return [...best].map(([sense, { range, sources }]) => ({ value: { sense, range }, sources }));
}

export function deriveDefenses(ctx: DeriveContext): DerivedSheet['defenses'] {
  const lists = { resistance: [], immunity: [], conditionImmunity: [] } as Record<
    'resistance' | 'immunity' | 'conditionImmunity',
    { value: string; key: string; source: string }[]
  >;
  for (const { effect, source } of ctx.collected.effects) {
    if (
      effect.type === 'resistance' ||
      effect.type === 'immunity' ||
      effect.type === 'conditionImmunity'
    ) {
      const value = resolveBound(effect.value, source, (k) => valuesOf(ctx.recon, k));
      if (value) lists[effect.type].push({ value, key: value.toLowerCase(), source: source.name });
    } else if (effect.type === 'resistanceChoice') {
      for (const value of valuesOf(
        ctx.recon,
        choiceKey(source.ref, effect.choice.slot, source.n),
      )) {
        lists.resistance.push({ value, key: value.toLowerCase(), source: source.name });
      }
    }
  }
  return {
    resistances: sourcedList(lists.resistance),
    immunities: sourcedList(lists.immunity),
    conditionImmunities: sourcedList(lists.conditionImmunity),
    attacked: effectsOfType(ctx.collected, 'attackedMode').map(({ effect, source }) => ({
      mode: effect.mode,
      ...(effect.against ? { against: effect.against } : {}),
      source: source.name,
    })),
  };
}

const SIZES = new Set<string>(['T', 'S', 'M', 'L', 'H', 'G']);

export function deriveSize(ctx: DeriveContext): Size {
  const ref = ctx.character.log[0]?.origin?.speciesRef;
  if (!ref) return 'M';
  const picked = valuesOf(ctx.recon, choiceKey(ref, 'size'))[0];
  if (picked && SIZES.has(picked)) return picked as Size;
  return ctx.index.get({ kind: 'species', id: ref.id })?.size[0] ?? 'M';
}
