// What a rest gives back (plan §9.2, step 3.22): the character before and after a rest,
// compared, as lines a player can read before confirming. Pure.

import type { Character, Id, Ref } from '../../schema/index.ts';
import type { DerivedSheet } from '../derive/types.ts';

/**
 * The fixed value of a Hit Die, as when gaining a level (half the die plus 1). The rules roll
 * Hit Dice on a rest; some tables take this instead.
 */
export function hitDieFixed(faces: number): number {
  return faces / 2 + 1;
}

/** At least 1 Hit Point is needed to start a Short or Long Rest (2024). */
export function canRest(sheet: DerivedSheet): boolean {
  return sheet.hp.current > 0;
}

const times = (n: number) => (n === 1 ? 'one' : String(n));

/**
 * What changed between `before` and `after`, for the rest's summary. `nameOf` names spells
 * and the concentration effect.
 */
export function restSummary(
  before: Character,
  after: Character,
  sheet: DerivedSheet,
  nameOf: (ref: Ref) => string,
): string[] {
  const out: string[] = [];
  const b = before.state;
  const a = after.state;
  const max = sheet.hp.max.value;

  const healed = Math.min(b.damage, max) - Math.min(a.damage, max);
  if (healed > 0) {
    const now = max - Math.min(a.damage, max);
    out.push(`Hit Points: ${healed} back (${now === max ? 'full' : `${now} of ${max}`})`);
  }
  if (b.tempHp > 0 && a.tempHp === 0) out.push(`Temporary Hit Points end (${b.tempHp})`);
  for (const h of sheet.hitDice) {
    const back = (b.hitDiceUsed[h.faces] ?? 0) - (a.hitDiceUsed[h.faces] ?? 0);
    if (back > 0) out.push(`Hit Dice: ${back} d${h.faces} back`);
    if (back < 0) out.push(`Hit Dice: ${-back} d${h.faces} spent`);
  }
  const slots = b.slotsUsed
    .map((used, i) => ({ level: i + 1, back: used - (a.slotsUsed[i] ?? 0) }))
    .filter((s) => s.back > 0);
  if (slots.length) {
    out.push(`Spell slots back: ${slots.map((s) => `level ${s.level} × ${s.back}`).join(', ')}`);
  }
  if (b.pactSlotsUsed > a.pactSlotsUsed) {
    out.push(`Pact Magic slots back: ${b.pactSlotsUsed - a.pactSlotsUsed}`);
  }
  for (const r of sheet.resources) {
    const back = (b.resourcesUsed[r.key] ?? 0) - (a.resourcesUsed[r.key] ?? 0);
    if (back > 0) out.push(`${r.name}: ${back} back`);
  }
  for (const g of sheet.spellcasting.granted) {
    if (!g.usesKey) continue;
    const back = (b.resourcesUsed[g.usesKey] ?? 0) - (a.resourcesUsed[g.usesKey] ?? 0);
    const name = nameOf({ kind: 'spell', id: g.spellId as Id });
    if (back > 0) out.push(`${name} (${g.sourceName}): ${times(back)} free cast back`);
  }
  for (const row of before.inventory) {
    const now = after.inventory.find((r) => r.uid === row.uid);
    const back = (row.chargesUsed ?? 0) - (now?.chargesUsed ?? 0);
    if (back > 0) out.push(`${row.name}: ${back} charges back`);
  }
  if (a.exhaustion < b.exhaustion) {
    out.push(
      a.exhaustion ? `Exhaustion: level ${b.exhaustion} → ${a.exhaustion}` : 'Exhaustion ends',
    );
  }
  if (b.concentration && !a.concentration) {
    out.push(`Concentration on ${nameOf(b.concentration)} ends`);
  }
  for (const t of sheet.toggles) {
    if (b.activeToggles[t.toggleId] && !a.activeToggles[t.toggleId]) out.push(`${t.name} ends`);
  }
  return out;
}
