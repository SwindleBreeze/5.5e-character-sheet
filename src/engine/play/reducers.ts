// Play actions (plan §8.2 rule 4, §9.2 step 3.9): pure functions from a character and its
// derived sheet to the next character. The UI dispatches them and saves the result. None of
// them refuse: limits clamp, so the player stays in charge.

import type { Character, Id, Ref } from '../../schema/index.ts';
import { cryptoRng, roll, type Rng } from '../dice/roll.ts';
import type { DerivedGrantedSpell, DerivedOutcome, DerivedSheet } from '../derive/types.ts';

export const MAX_EXHAUSTION = 6;

function clone(c: Character): Character {
  return structuredClone(c);
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** HP right now, from the sheet's maximum and the damage taken. */
function currentHp(c: Character, sheet: DerivedSheet): number {
  return Math.max(0, sheet.hp.max.value - c.state.damage);
}

/**
 * Damage goes to temporary HP, then the ward (P12), then HP (2024 rules). At 0 HP a hit is a
 * failed death save (two on a critical hit); damage that leaves at least the HP maximum
 * over is instant death (three failures).
 */
export function applyDamage(
  c: Character,
  sheet: DerivedSheet,
  amount: number,
  opts: { critical?: boolean } = {},
): Character {
  let rest = Math.max(0, Math.floor(amount));
  if (!rest) return c;
  const n = clone(c);
  const s = n.state;
  const fromTemp = Math.min(s.tempHp, rest);
  s.tempHp -= fromTemp;
  rest -= fromTemp;
  if (sheet.hp.ward) {
    const ward = Math.min(s.wardHp, sheet.hp.ward.max.value);
    const fromWard = Math.min(ward, rest);
    s.wardHp = ward - fromWard;
    rest -= fromWard;
  }
  if (!rest) return n;
  const max = sheet.hp.max.value;
  const current = currentHp(c, sheet);
  if (current === 0) {
    const failures = rest >= max ? 3 : s.deathSaves.failures + (opts.critical ? 2 : 1);
    s.deathSaves.failures = Math.min(3, failures);
    return n;
  }
  s.damage = Math.min(max, s.damage + rest);
  if (rest - current >= max) s.deathSaves.failures = 3;
  return n;
}

/** Healing from 0 HP also clears death saves. */
export function heal(c: Character, sheet: DerivedSheet, amount: number): Character {
  const hp = Math.max(0, Math.floor(amount));
  if (!hp) return c;
  const n = clone(c);
  if (currentHp(c, sheet) === 0) n.state.deathSaves = { successes: 0, failures: 0 };
  n.state.damage = Math.max(0, Math.min(n.state.damage, sheet.hp.max.value) - hp);
  return n;
}

/** Temporary HP don't stack: the larger amount is kept, unless replacing on purpose. */
export function setTempHp(
  c: Character,
  amount: number,
  opts: { replace?: boolean } = {},
): Character {
  const n = clone(c);
  const value = Math.max(0, Math.floor(amount));
  n.state.tempHp = opts.replace ? value : Math.max(n.state.tempHp, value);
  return n;
}

/** A death saving throw: 20 regains 1 HP, 1 is two failures, 10 or more succeeds. */
export function deathSave(c: Character, sheet: DerivedSheet, d20: number): Character {
  if (currentHp(c, sheet) > 0) return c;
  const n = clone(c);
  const saves = n.state.deathSaves;
  if (d20 >= 20) {
    n.state.damage = Math.max(0, sheet.hp.max.value - 1);
    n.state.deathSaves = { successes: 0, failures: 0 };
  } else if (d20 <= 1) saves.failures = Math.min(3, saves.failures + 2);
  else if (d20 >= 10) saves.successes = Math.min(3, saves.successes + 1);
  else saves.failures = Math.min(3, saves.failures + 1);
  return n;
}

/** The Constitution save to keep concentrating after damage: half the damage, 10 to 30. */
export function concentrationDc(damage: number): number {
  return clamp(Math.floor(damage / 2), 10, 30);
}

export function setConcentration(c: Character, ref: Ref | null): Character {
  const n = clone(c);
  n.state.concentration = ref;
  return n;
}

export function spendResource(
  c: Character,
  sheet: DerivedSheet,
  key: string,
  amount = 1,
): Character {
  const r = sheet.resources.find((x) => x.key === key);
  if (!r || amount <= 0) return c;
  const n = clone(c);
  n.state.resourcesUsed[key] = clamp((n.state.resourcesUsed[key] ?? 0) + amount, 0, r.max.value);
  return n;
}

export function restoreResource(c: Character, key: string, amount = 1): Character {
  if (amount <= 0 || !(key in c.state.resourcesUsed)) return c;
  const n = clone(c);
  const left = Math.max(0, (n.state.resourcesUsed[key] ?? 0) - amount);
  if (left) n.state.resourcesUsed[key] = left;
  else delete n.state.resourcesUsed[key];
  return n;
}

/** One free cast of a granted spell: its own counter, or the resource it is paid from. */
export function useGrantedSpell(
  c: Character,
  sheet: DerivedSheet,
  spell: DerivedGrantedSpell,
): Character {
  if (spell.usesKey && spell.usesMax !== undefined) {
    const n = clone(c);
    n.state.resourcesUsed[spell.usesKey] = Math.min(spell.usesMax, (spell.usesUsed ?? 0) + 1);
    return n;
  }
  if (spell.resourceKey) return spendResource(c, sheet, spell.resourceKey, spell.cost ?? 1);
  return c;
}

/**
 * Cast with a spell slot (level 0 spends nothing) or a Pact Magic slot. Concentration spells
 * replace whatever the character was concentrating on.
 */
export function castSpell(
  c: Character,
  sheet: DerivedSheet,
  opts: { level: number; pact?: boolean; concentration?: Ref },
): Character {
  const n = clone(c);
  if (opts.pact) {
    const max = sheet.spellcasting.pact?.max ?? 0;
    n.state.pactSlotsUsed = Math.min(max, n.state.pactSlotsUsed + 1);
  } else if (opts.level > 0) {
    const max = sheet.spellcasting.slots.find((s) => s.level === opts.level)?.max ?? 0;
    const used = [...n.state.slotsUsed];
    while (used.length < opts.level) used.push(0);
    used[opts.level - 1] = Math.min(max, (used[opts.level - 1] ?? 0) + 1);
    n.state.slotsUsed = used;
  }
  if (opts.concentration) n.state.concentration = opts.concentration;
  return n;
}

export function restoreSlot(c: Character, opts: { level: number; pact?: boolean }): Character {
  const n = clone(c);
  if (opts.pact) n.state.pactSlotsUsed = Math.max(0, n.state.pactSlotsUsed - 1);
  else if (opts.level > 0) {
    const used = [...n.state.slotsUsed];
    used[opts.level - 1] = Math.max(0, (used[opts.level - 1] ?? 0) - 1);
    n.state.slotsUsed = used;
  }
  return n;
}

/** Roll an outcome's dice: `1d8 + 5` → a number. */
function rollAmount(expr: string, rng: Rng): number {
  return Math.max(0, roll(expr, rng).total);
}

function applyOutcomes(
  c: Character,
  sheet: DerivedSheet,
  outcomes: readonly DerivedOutcome[],
  rng: Rng,
  slotLevel?: number,
): Character {
  let n = c;
  for (const o of outcomes) {
    if ('heal' in o) n = heal(n, sheet, rollAmount(o.heal, rng));
    else if ('tempHp' in o) n = setTempHp(n, rollAmount(o.tempHp, rng));
    else if ('toggleOn' in o) n = toggle(n, sheet, o.toggleOn, true, { rng, free: true });
    else if ('restore' in o) {
      if (o.restore.resourceKey) n = restoreResource(n, o.restore.resourceKey, o.restore.amount);
    } else {
      // Regain one spent slot: the one asked for, or the highest spent one allowed.
      const spent = sheet.spellcasting.slots.filter(
        (s) => s.level <= o.regainSlot.maxLevel && (n.state.slotsUsed[s.level - 1] ?? 0) > 0,
      );
      const level = slotLevel ?? spent.at(-1)?.level;
      if (level !== undefined && level <= o.regainSlot.maxLevel) n = restoreSlot(n, { level });
    }
  }
  return n;
}

function payCosts(
  c: Character,
  sheet: DerivedSheet,
  costs: { resourceKey?: string; amount?: number }[],
) {
  let n = c;
  for (const cost of costs) {
    if (cost.resourceKey) n = spendResource(n, sheet, cost.resourceKey, cost.amount ?? 1);
  }
  return n;
}

/**
 * P8: switch a toggle. Switching on pays its costs, applies its on-activate outcomes and
 * switches off the others of its group.
 */
export function toggle(
  c: Character,
  sheet: DerivedSheet,
  toggleId: string,
  on: boolean,
  opts: { option?: string; rng?: Rng; free?: boolean } = {},
): Character {
  const t = sheet.toggles.find((x) => x.toggleId === toggleId);
  let n = clone(c);
  if (!on) {
    delete n.state.activeToggles[toggleId];
    return n;
  }
  if (t?.group) {
    for (const other of sheet.toggles) {
      if (other.group === t.group && other.toggleId !== toggleId)
        delete n.state.activeToggles[other.toggleId];
    }
  }
  n.state.activeToggles[toggleId] = opts.option ? { option: opts.option } : {};
  if (t && !opts.free) {
    n = payCosts(n, sheet, t.costs);
    n = applyOutcomes(n, sheet, t.onActivate, opts.rng ?? cryptoRng);
  }
  return n;
}

/** P7: use an action: pay its costs, then apply its outcomes. */
export function useAction(
  c: Character,
  sheet: DerivedSheet,
  actionId: string,
  opts: { rng?: Rng; slotLevel?: number } = {},
): Character {
  const action = sheet.actions.find((a) => a.id === actionId);
  if (!action) return c;
  const paid = payCosts(c, sheet, action.costs);
  return applyOutcomes(paid, sheet, action.outcomes, opts.rng ?? cryptoRng, opts.slotLevel);
}

export function addCondition(c: Character, id: Id): Character {
  if (c.state.conditions.includes(id)) return c;
  const n = clone(c);
  n.state.conditions.push(id);
  return n;
}

export function removeCondition(c: Character, id: Id): Character {
  const n = clone(c);
  n.state.conditions = n.state.conditions.filter((x) => x !== id);
  return n;
}

export function setExhaustion(c: Character, level: number): Character {
  const n = clone(c);
  n.state.exhaustion = clamp(Math.floor(level), 0, MAX_EXHAUSTION);
  return n;
}

export function setHeroicInspiration(c: Character, on: boolean): Character {
  const n = clone(c);
  n.state.heroicInspiration = on;
  return n;
}

export function useItemCharge(c: Character, rowUid: string, amount = 1): Character {
  const n = clone(c);
  const row = n.inventory.find((r) => r.uid === rowUid);
  if (!row) return c;
  row.chargesUsed = Math.max(0, (row.chargesUsed ?? 0) + amount);
  return n;
}

/** P4: note a once-per-turn rider as used; `endTurn` clears them. */
export function useRider(c: Character, riderId: string): Character {
  if (c.state.turn.ridersUsed.includes(riderId)) return c;
  const n = clone(c);
  n.state.turn.ridersUsed.push(riderId);
  return n;
}

export function endTurn(c: Character): Character {
  const n = clone(c);
  n.state.turn = { ridersUsed: [] };
  return n;
}

function resetSpellUses(n: Character, sheet: DerivedSheet, recharges: readonly string[]) {
  for (const g of sheet.spellcasting.granted) {
    const uses = g.uses;
    if (
      g.usesKey &&
      typeof uses === 'object' &&
      'count' in uses &&
      recharges.includes(uses.recharge)
    ) {
      delete n.state.resourcesUsed[g.usesKey];
    }
  }
}

function endToggles(n: Character, sheet: DerivedSheet, rest: 'shortRest' | 'longRest') {
  for (const t of sheet.toggles) {
    if (t.endsOn.includes(rest) || (rest === 'longRest' && t.endsOn.includes('shortRest'))) {
      delete n.state.activeToggles[t.toggleId];
    }
  }
}

/**
 * Short Rest (2024): spend Hit Dice (each heals its roll plus the CON modifier), regain
 * short-rest resources (one use for `shortOne`) and Pact Magic slots.
 */
export function shortRest(
  c: Character,
  sheet: DerivedSheet,
  spend: { faces: number; rolls: number[] }[] = [],
): Character {
  let n = clone(c);
  let healing = 0;
  for (const { faces, rolls } of spend) {
    const pool = sheet.hitDice.find((h) => h.faces === faces);
    if (!pool) continue;
    const available = pool.total - (n.state.hitDiceUsed[faces] ?? 0);
    const used = rolls.slice(0, Math.max(0, available));
    n.state.hitDiceUsed[faces] = (n.state.hitDiceUsed[faces] ?? 0) + used.length;
    healing += used.reduce((sum, r) => sum + Math.max(0, r + sheet.abilities.con.mod), 0);
  }
  for (const r of sheet.resources) {
    if (r.recharge === 'short') delete n.state.resourcesUsed[r.key];
    if (r.recharge === 'shortOne') n = restoreResource(n, r.key, 1);
  }
  resetSpellUses(n, sheet, ['short']);
  n.state.pactSlotsUsed = 0;
  endToggles(n, sheet, 'shortRest');
  n.state.turn = { ridersUsed: [] };
  return heal(n, sheet, healing);
}

const LONG_REST_RECHARGES = ['short', 'shortOne', 'long', 'dawn'];

/**
 * Long Rest (2024): all HP and all spent Hit Dice back, all slots and resources, one level of
 * Exhaustion less. Temporary HP, the ward, death saves and concentration end.
 */
export function longRest(c: Character, sheet: DerivedSheet): Character {
  const n = clone(c);
  const s = n.state;
  s.damage = 0;
  s.tempHp = 0;
  s.wardHp = 0;
  s.hitDiceUsed = {};
  s.slotsUsed = [];
  s.pactSlotsUsed = 0;
  for (const r of sheet.resources) {
    if (LONG_REST_RECHARGES.includes(r.recharge)) delete s.resourcesUsed[r.key];
  }
  resetSpellUses(n, sheet, LONG_REST_RECHARGES);
  s.exhaustion = Math.max(0, s.exhaustion - 1);
  s.deathSaves = { successes: 0, failures: 0 };
  s.concentration = null;
  endToggles(n, sheet, 'longRest');
  s.turn = { ridersUsed: [] };
  return n;
}
