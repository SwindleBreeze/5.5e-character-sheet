// Play actions (plan §8.2 rule 4, §9.2 step 3.9): pure functions from a character and its
// derived sheet to the next character. The UI dispatches them and saves the result. None of
// them refuse: limits clamp, so the player stays in charge.

import type { Character, Id, OverrideKey, Ref } from '../../schema/index.ts';
import { cryptoRng, roll, type Rng } from '../dice/roll.ts';
import type {
  DerivedCost,
  DerivedGrantedSpell,
  DerivedOutcome,
  DerivedSheet,
} from '../derive/types.ts';
import type { CastWay } from './casting.ts';
import type { CostChoice, SlotChoice } from './costs.ts';
import { conditionName } from '../static/state.ts';

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
 * over is instant death (three failures). Dropping to 0 HP leaves the character Unconscious,
 * which ends Concentration.
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
  if (rest >= current) s.concentration = null;
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
export function spendFreeCast(
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
  if (spell.chargesRow) {
    // Paid from the item's charges.
    const n = clone(c);
    const row = n.inventory.find((r) => r.uid === spell.chargesRow);
    const cost = Math.min(spell.cost ?? 1, spell.chargesLeft ?? 0);
    if (row && cost > 0) row.chargesUsed = (row.chargesUsed ?? 0) + cost;
    return n;
  }
  return c;
}

/** Expend one spell slot (a shared slot of that level, or a Pact Magic slot). */
export function spendSlot(c: Character, sheet: DerivedSheet, slot: SlotChoice): Character {
  const n = clone(c);
  if (slot.pact) {
    const max = sheet.spellcasting.pact?.max ?? 0;
    n.state.pactSlotsUsed = Math.min(max, n.state.pactSlotsUsed + 1);
  } else if (slot.level > 0) {
    const max = sheet.spellcasting.slots.find((s) => s.level === slot.level)?.max ?? 0;
    const used = [...n.state.slotsUsed];
    while (used.length < slot.level) used.push(0);
    used[slot.level - 1] = Math.min(max, (used[slot.level - 1] ?? 0) + 1);
    n.state.slotsUsed = used;
  }
  return n;
}

/**
 * Cast with a spell slot (level 0 spends nothing) or a Pact Magic slot, noting that a slot
 * was expended this turn. A Concentration spell replaces whatever the character was
 * concentrating on.
 */
export function castSpell(
  c: Character,
  sheet: DerivedSheet,
  opts: { level: number; pact?: boolean; concentration?: Ref },
): Character {
  const n = spendSlot(c, sheet, opts);
  if (opts.pact || opts.level > 0) n.state.turn.slotSpent = true;
  if (opts.concentration) n.state.concentration = opts.concentration;
  return n;
}

/**
 * Spend Hit Dice: from the size asked for first, then the largest sizes with dice left. Each
 * size never goes past its total.
 */
export function spendHitDice(
  c: Character,
  sheet: DerivedSheet,
  amount: number,
  firstFaces?: number,
): Character {
  const n = clone(c);
  let left = Math.max(0, Math.floor(amount));
  const order = [...sheet.hitDice].sort(
    (a, b) => Number(b.faces === firstFaces) - Number(a.faces === firstFaces) || b.faces - a.faces,
  );
  for (const h of order) {
    if (!left) break;
    const used = n.state.hitDiceUsed[h.faces] ?? 0;
    const take = Math.min(left, h.total - used);
    if (take > 0) n.state.hitDiceUsed[h.faces] = used + take;
    left -= Math.max(0, take);
  }
  return n;
}

/**
 * Pay one cost: a resource's uses, the spell slot the player picked, Hit Dice, or an item's
 * charges. A slot cost
 * without a picked slot is left unpaid; an action cost (a Bonus Action) is only a reminder.
 */
export function payCost(
  c: Character,
  sheet: DerivedSheet,
  cost: DerivedCost,
  choice: CostChoice = {},
): Character {
  if (cost.resourceKey) return spendResource(c, sheet, cost.resourceKey, cost.amount ?? 1);
  if (cost.slot && choice.slot) return spendSlot(c, sheet, choice.slot);
  if (cost.hitDice) return spendHitDice(c, sheet, cost.amount ?? 1, choice.hitDie);
  if (cost.charges) {
    const n = clone(c);
    const row = n.inventory.find((r) => r.uid === cost.charges!.rowUid);
    const amount = Math.min(cost.amount ?? 1, cost.charges.left);
    if (row && amount > 0) row.chargesUsed = (row.chargesUsed ?? 0) + amount;
    return n;
  }
  return c;
}

/**
 * Set a Long Rest caster's list of prepared spells. Spells taken off the list count as replaced
 * until the next Long Rest (Paladins and Rangers may replace one; more is a warning).
 */
export function setPrepared(c: Character, casterKey: string, ids: readonly Id[]): Character {
  const n = clone(c);
  const before = n.state.prepared[casterKey] ?? [];
  const removed = before.filter((id) => !ids.includes(id)).length;
  n.state.prepared[casterKey] = [...new Set(ids)];
  if (removed) {
    n.state.prepSwaps = {
      ...n.state.prepSwaps,
      [casterKey]: (n.state.prepSwaps?.[casterKey] ?? 0) + removed,
    };
  }
  return n;
}

/**
 * Cast a spell one of the ways `castWays` offers: a slot is expended (once per turn), a free
 * use is counted, a cantrip, ritual or at-will casting costs nothing. A Concentration spell
 * replaces what the character was concentrating on.
 */
export function castSpellAs(
  c: Character,
  sheet: DerivedSheet,
  spell: { ref: Ref; concentration: boolean; granted?: DerivedGrantedSpell },
  way: CastWay,
): Character {
  let n = c;
  if (way.kind === 'slot') {
    n = castSpell(n, sheet, { level: way.level, ...(way.pact ? { pact: true } : {}) });
  } else if (way.kind === 'free' && spell.granted) {
    n = spendFreeCast(n, sheet, spell.granted);
  }
  return spell.concentration ? setConcentration(n, spell.ref) : n;
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

/**
 * Rolls an outcome's dice (`1d8 + 5`) to a total. The sheet passes one that shows the roll;
 * by default it rolls with the given random source.
 */
export type RollAmount = (expr: string, label: string) => number;

const rollWith =
  (rng: Rng): RollAmount =>
  (expr) =>
    roll(expr, rng).total;

function applyOutcomes(
  c: Character,
  sheet: DerivedSheet,
  outcomes: readonly DerivedOutcome[],
  rollAmount: RollAmount,
  label: string,
  slotLevel?: number,
): Character {
  let n = c;
  for (const o of outcomes) {
    if ('heal' in o) n = heal(n, sheet, Math.max(0, rollAmount(o.heal, `${label}: healing`)));
    else if ('tempHp' in o)
      n = setTempHp(
        n,
        Math.max(0, rollAmount(o.tempHp, `${label}: temporary HP`)) +
          (sheet.hp.tempBonus?.value ?? 0),
      );
    else if ('toggleOn' in o) n = toggle(n, sheet, o.toggleOn, true, { rollAmount, free: true });
    else if ('restore' in o) {
      if (o.restore.resourceKey) n = restoreResource(n, o.restore.resourceKey, o.restore.amount);
    } else if (
      o.regainSlot.pact &&
      slotLevel === undefined &&
      n.state.pactSlotsUsed > 0 &&
      (sheet.spellcasting.pact?.level ?? 0) <= o.regainSlot.maxLevel
    ) {
      // A spent Pact Magic slot comes back first (a Rod of the Pact Keeper).
      n = restoreSlot(n, { level: sheet.spellcasting.pact!.level, pact: true });
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
  costs: readonly DerivedCost[],
  choice: CostChoice = {},
) {
  return costs.reduce((n, cost) => payCost(n, sheet, cost, choice), c);
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
  opts: {
    option?: string;
    rng?: Rng;
    rollAmount?: RollAmount;
    free?: boolean;
    choice?: CostChoice;
  } = {},
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
    n = payCosts(n, sheet, t.costs, opts.choice);
    n = applyOutcomes(
      n,
      sheet,
      t.onActivate,
      opts.rollAmount ?? rollWith(opts.rng ?? cryptoRng),
      t.name,
    );
  }
  return n;
}

/** P7: use an action: pay its costs, then apply its outcomes. */
export function useAction(
  c: Character,
  sheet: DerivedSheet,
  actionId: string,
  opts: { rng?: Rng; rollAmount?: RollAmount; slotLevel?: number; choice?: CostChoice } = {},
): Character {
  const action = sheet.actions.find((a) => a.id === actionId);
  if (!action) return c;
  const paid = payCosts(c, sheet, action.costs, opts.choice);
  return applyOutcomes(
    paid,
    sheet,
    action.outcomes,
    opts.rollAmount ?? rollWith(opts.rng ?? cryptoRng),
    action.name,
    opts.slotLevel,
  );
}

/** Conditions that include Incapacitated, which ends Concentration (2024). */
const INCAPACITATING = new Set([
  'incapacitated',
  'paralyzed',
  'petrified',
  'stunned',
  'unconscious',
]);

/** A condition that includes Incapacitated also ends Concentration. */
export function addCondition(c: Character, id: Id): Character {
  if (c.state.conditions.includes(id)) return c;
  const n = clone(c);
  n.state.conditions.push(id);
  if (INCAPACITATING.has(conditionName(id))) n.state.concentration = null;
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

/** Set death-save marks directly (tapping the pips), each 0 to 3. */
export function setDeathSaves(
  c: Character,
  saves: { successes: number; failures: number },
): Character {
  const n = clone(c);
  n.state.deathSaves = {
    successes: clamp(Math.floor(saves.successes), 0, 3),
    failures: clamp(Math.floor(saves.failures), 0, 3),
  };
  return n;
}

/** Set how many hit dice of one size are spent, 0 to the number the sheet has. */
export function setHitDiceUsed(
  c: Character,
  sheet: DerivedSheet,
  faces: number,
  used: number,
): Character {
  const total = sheet.hitDice.find((h) => h.faces === faces)?.total ?? 0;
  const n = clone(c);
  n.state.hitDiceUsed[faces] = clamp(Math.floor(used), 0, total);
  return n;
}

/** The player's own value for a number on the sheet (plan §4.4); `undefined` clears it. */
export function setOverride(
  c: Character,
  key: OverrideKey,
  value: number | string | boolean | undefined,
): Character {
  const n = clone(c);
  if (value === undefined) delete n.overrides[key];
  else n.overrides[key] = value;
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

/**
 * Items that regain all their charges on a rest. Those regaining a rolled number are left to
 * the Inventory tab, as are dawn, dusk and midnight, which aren't rests.
 */
function rechargeItems(n: Character, sheet: DerivedSheet, on: string[]) {
  for (const row of n.inventory) {
    const ch = sheet.inventory.charges[row.uid];
    if (ch?.recharge && !ch.amount && on.includes(ch.recharge)) delete row.chargesUsed;
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
 * What one Hit Point Die rolled to regain HP restores: the roll (raised to a floor, or the
 * maximum, when a feature says so) plus the CON modifier, at least 1; doubled by a Periapt of
 * Wound Closure.
 */
export function hitDieHeal(sheet: DerivedSheet, faces: number, roll: number): number {
  const how = sheet.hp.hitDieHealing;
  const face = how?.max ? faces : Math.max(roll, how?.floor ?? 0);
  const restored = Math.max(1, face + sheet.abilities.con.mod);
  return how?.double ? restored * 2 : restored;
}

/**
 * Short Rest (2024): spend Hit Dice (each heals its roll plus the CON modifier, at least 1), regain
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
    healing += used.reduce((sum, r) => sum + hitDieHeal(sheet, faces, r), 0);
  }
  for (const r of sheet.resources) {
    if (r.recharge === 'short') delete n.state.resourcesUsed[r.key];
    if (r.recharge === 'shortOne') n = restoreResource(n, r.key, 1);
  }
  resetSpellUses(n, sheet, ['short']);
  rechargeItems(n, sheet, ['restShort']);
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
  rechargeItems(n, sheet, ['restShort', 'restLong']);
  s.exhaustion = Math.max(0, s.exhaustion - 1);
  s.deathSaves = { successes: 0, failures: 0 };
  s.concentration = null;
  delete s.prepSwaps;
  endToggles(n, sheet, 'longRest');
  s.turn = { ridersUsed: [] };
  return n;
}
