// Familiars, steeds, companions and summons on the sheet (plan §10.3, step 7.6): pure reducers
// for the list and each one's hit points, and the numbers its stat block is worked out with.
// The sheet tracks them; it never plays them (no turns, no commands).

import type { Character, Creature, Extra, Id } from '../../schema/index.ts';
import { ABILITIES } from '../../schema/index.ts';
import type { DerivedCaster, DerivedSheet } from '../derive/types.ts';
import { scaledHp, type ScaleContext } from './scaling.ts';

function clone(c: Character): Character {
  return structuredClone(c);
}

function uid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `x${Date.now().toString(36)}${Math.random()}`;
}

/** Add a creature, or a name written in by hand. Starts at full hit points. */
export function addExtra(
  c: Character,
  spec: { creature?: Creature; name?: string; spellLevel?: number; hpMax?: number },
): Character {
  const n = clone(c);
  const extra: Extra = {
    uid: uid(),
    name: spec.name?.trim() || spec.creature?.name || 'Companion',
    damage: 0,
    tempHp: 0,
  };
  if (spec.creature) extra.creatureRef = { kind: 'creature', id: spec.creature.id };
  const level = spec.spellLevel ?? spec.creature?.summon?.spellLevel;
  if (level !== undefined && spec.creature?.summon?.spellId) extra.spellLevel = level;
  if (spec.hpMax !== undefined) extra.hpMax = spec.hpMax;
  n.extras = [...(n.extras ?? []), extra];
  return n;
}

export function removeExtra(c: Character, extraUid: string): Character {
  const n = clone(c);
  n.extras = (n.extras ?? []).filter((e) => e.uid !== extraUid);
  return n;
}

/** Change one extra; the others are left alone. */
export function updateExtra(
  c: Character,
  extraUid: string,
  change: (e: Extra) => Extra,
): Character {
  if (!c.extras?.some((e) => e.uid === extraUid)) return c;
  const n = clone(c);
  n.extras = (n.extras ?? []).map((e) => (e.uid === extraUid ? change(e) : e));
  return n;
}

/** Damage comes off temporary HP first, and HP never drop below 0. */
export function damageExtra(c: Character, extraUid: string, amount: number, max: number) {
  return updateExtra(c, extraUid, (e) => {
    const fromTemp = Math.min(e.tempHp, amount);
    const rest = amount - fromTemp;
    return { ...e, tempHp: e.tempHp - fromTemp, damage: Math.min(max, e.damage + rest) };
  });
}

export function healExtra(c: Character, extraUid: string, amount: number) {
  return updateExtra(c, extraUid, (e) => ({ ...e, damage: Math.max(0, e.damage - amount) }));
}

/** Temporary HP don't add up: the higher number is kept. */
export function setExtraTempHp(c: Character, extraUid: string, amount: number) {
  return updateExtra(c, extraUid, (e) => ({ ...e, tempHp: Math.max(e.tempHp, amount) }));
}

/** A new summoning: back to full hit points, no temporary HP. */
export function resetExtra(c: Character, extraUid: string) {
  return updateExtra(c, extraUid, (e) => ({ ...e, damage: 0, tempHp: 0 }));
}

export function setExtraSpellLevel(c: Character, extraUid: string, level: number) {
  return updateExtra(c, extraUid, (e) => ({ ...e, spellLevel: level }));
}

/** The player's own maximum; undefined goes back to the stat block's. */
export function setExtraHpMax(c: Character, extraUid: string, max: number | undefined) {
  return updateExtra(c, extraUid, (e) => {
    const { hpMax: _old, ...rest } = e;
    return max === undefined ? rest : { ...rest, hpMax: max };
  });
}

export function setExtraNotes(c: Character, extraUid: string, notes: string) {
  return updateExtra(c, extraUid, (e) => {
    const { notes: _old, ...rest } = e;
    return notes.trim() ? { ...rest, notes } : rest;
  });
}

/** The class a summon's class id names (`ranger|xphb` → `ranger`). */
const className = (id: Id) => (id.split('|')[0] ?? id).toLowerCase();

/**
 * Whose spell attack and save DC a summon uses: the caster of the class that summons it, else
 * the caster that has its spell, else the first caster.
 */
export function summonerCaster(
  sheet: DerivedSheet,
  creature?: Creature,
): DerivedCaster | undefined {
  const casters = sheet.spellcasting.casters;
  const summon = creature?.summon;
  if (summon?.classId) {
    const name = className(summon.classId);
    const byClass = casters.find((c) => c.classId && className(c.classId) === name);
    if (byClass) return byClass;
  }
  if (summon?.spellId) {
    const id = summon.spellId;
    const bySpell = casters.find((c) =>
      [...c.prepared, ...c.alwaysPrepared, ...c.cantrips, ...(c.spellbook ?? [])].includes(id),
    );
    if (bySpell) return bySpell;
  }
  return casters[0];
}

/** What a summon's stat block is worked out with, for this character. */
export function scaleContext(
  sheet: DerivedSheet,
  creature?: Creature,
  extra?: Extra,
): ScaleContext {
  const classLevels: Record<string, number> = {};
  for (const c of sheet.classes) classLevels[c.name.toLowerCase()] = c.level;
  const mods = Object.fromEntries(ABILITIES.map((a) => [a, sheet.abilities[a].mod])) as Record<
    (typeof ABILITIES)[number],
    number
  >;
  const ctx: ScaleContext = { classLevels, charLevel: sheet.charLevel, pb: sheet.pb.value, mods };
  const level = extra?.spellLevel ?? creature?.summon?.spellLevel;
  if (level !== undefined) ctx.spellLevel = level;
  const caster = summonerCaster(sheet, creature);
  if (caster) {
    ctx.spellAttack = caster.attack.bonus.value;
    ctx.spellDc = caster.dc.value;
  } else if (creature?.summon?.spellId) {
    // A spell granted outside a class (a feat, a species): its own numbers.
    const granted = sheet.spellcasting.granted.find((g) => g.spellId === creature.summon?.spellId);
    if (granted?.attackBonus !== undefined) ctx.spellAttack = granted.attackBonus;
    if (granted?.dc !== undefined) ctx.spellDc = granted.dc;
  }
  return ctx;
}

export interface ExtraHp {
  current: number;
  max: number;
  temp: number;
  /** The maximum is the player's own, or nothing could be worked out (0). */
  maxFrom: 'statBlock' | 'player' | 'unknown';
}

/** An extra's hit points: the player's maximum, else the stat block's, worked out. */
export function extraHp(extra: Extra, creature: Creature | undefined, ctx: ScaleContext): ExtraHp {
  const fromBlock = creature ? scaledHp(creature, ctx).value : undefined;
  const max = extra.hpMax ?? fromBlock ?? 0;
  const maxFrom =
    extra.hpMax !== undefined ? 'player' : fromBlock !== undefined ? 'statBlock' : 'unknown';
  return { current: Math.max(0, max - extra.damage), max, temp: extra.tempHp, maxFrom };
}
