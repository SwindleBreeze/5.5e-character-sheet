// Ability score generation (plan §9.3 step 4.4; 2024 Player's Handbook, step 3 of character
// creation): the standard array assigned by tap, point buy, typed scores, and 4d6 drop lowest.
// Pure: dice come from an injected random source.

import {
  ABILITIES,
  ABILITY_NAMES,
  type Ability,
  type ClassDef,
  type ScoreMethod,
} from '../../schema/index.ts';
import { STANDARD_ARRAY } from './build.ts';

export const POINT_BUY_BUDGET = 27;
/** What each score costs (2024 Ability Score Point Costs table): 8 is free, 15 costs 9. */
export const POINT_BUY_COST: Readonly<Record<number, number>> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};
export const POINT_BUY_MIN = 8;
export const POINT_BUY_MAX = 15;
/** Typed scores (an existing character, or the DM's own method). */
export const MANUAL_MIN = 3;
export const MANUAL_MAX = 18;

type Scores = Record<Ability, number>;

/** Points spent on these scores; Infinity when one is outside 8–15. */
export function pointBuyCost(scores: Readonly<Scores>): number {
  return ABILITIES.reduce((sum, a) => sum + (POINT_BUY_COST[scores[a]] ?? Infinity), 0);
}

/** The scores a method starts from: point buy at 8 each, the array by the class's priorities. */
export function startingScores(
  method: ScoreMethod,
  primary: readonly Ability[],
  rolled?: readonly number[],
): Scores {
  if (method === 'pointBuy') return Object.fromEntries(ABILITIES.map((a) => [a, 8])) as Scores;
  if (method === 'manual') return Object.fromEntries(ABILITIES.map((a) => [a, 10])) as Scores;
  const values =
    method === 'rolled' && rolled?.length === 6
      ? [...rolled].sort((a, b) => b - a)
      : [...STANDARD_ARRAY];
  const order = [...new Set<Ability>([...primary, 'con', 'dex', ...ABILITIES])];
  const scores = {} as Scores;
  order.forEach((a, i) => (scores[a] = values[i] ?? 8));
  return scores;
}

/**
 * Give an ability a value from a fixed set (the standard array, or rolled scores): the ability
 * that had it takes this one's old value, so every value is used once.
 */
export function assignFromSet(scores: Readonly<Scores>, ability: Ability, value: number): Scores {
  const n = { ...scores };
  const other = ABILITIES.find((a) => a !== ability && n[a] === value);
  if (other) n[other] = n[ability];
  n[ability] = value;
  return n;
}

/** Whether scores are one of each value of a set (a permutation of it). */
export function usesSet(scores: Readonly<Scores>, set: readonly number[]): boolean {
  const a = ABILITIES.map((x) => scores[x]).sort((x, y) => x - y);
  const b = [...set].sort((x, y) => x - y);
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** One score: roll four d6 and add the highest three. */
export function roll4d6(random: () => number = Math.random): number[] {
  return Array.from({ length: 4 }, () => 1 + Math.floor(random() * 6));
}

/** The total of the highest three dice. */
export function dropLowest(dice: readonly number[]): number {
  const sorted = [...dice].sort((a, b) => b - a);
  return sorted.slice(0, 3).reduce((s, d) => s + d, 0);
}

/** Six scores, each 4d6 drop lowest. */
export function rollScores(random: () => number = Math.random): number[][] {
  return Array.from({ length: 6 }, () => roll4d6(random));
}

/** `Strength or Dexterity`; `Dexterity and Wisdom`. */
export function primaryText(cls: Pick<ClassDef, 'primaryAbility'>): string {
  return cls.primaryAbility
    .map((group) => group.map((a) => ABILITY_NAMES[a]).join(' and '))
    .join(' or ');
}

/** A class's primary abilities, in the order to fill them (Fighter: Strength first). */
export function primaryOrder(cls: Pick<ClassDef, 'primaryAbility'> | undefined): Ability[] {
  return cls?.primaryAbility[0] ?? [];
}
