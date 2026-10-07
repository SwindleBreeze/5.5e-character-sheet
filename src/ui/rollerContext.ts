// The roller's API and helpers (plan §9.2, step 3.15). The provider and its toasts are in
// Roller.tsx.

import { createContext, useContext } from 'react';
import type { RollMode, RollResult } from '../engine/dice/roll.ts';

export interface RollRequest {
  /** What is rolled: `Athletics`, `Strength save`. */
  label: string;
  /** Dice and bonus, e.g. `1d20+5` or `2d6+3`. */
  expr: string;
  mode?: RollMode;
  /** For attack rolls: the lowest natural d20 that is a Critical Hit (20, or 19 with a feature). */
  critOn?: number;
}

export interface ShownRoll extends RollRequest {
  id: number;
  result: RollResult;
}

export interface RollerApi {
  roll: (request: RollRequest) => RollResult;
  /** Rolls made in the current scope, newest first: the last `HISTORY_SIZE`, in memory only. */
  history: () => ShownRoll[];
  /** Whose rolls are kept: a character's id while its sheet is open, `''` elsewhere. */
  setScope: (scope: string) => void;
}

/** Rolls kept per character (plan §9.2, step 3.22). */
export const HISTORY_SIZE = 50;

export const RollerContext = createContext<RollerApi | null>(null);

/** `1d20 + 5`, `1d20 - 1`: a d20 test with its bonus. */
export function d20Expr(bonus: number): string {
  return bonus ? `1d20${bonus < 0 ? '-' : '+'}${Math.abs(bonus)}` : '1d20';
}

/** The dice in a result: `12, 7 → 12` for advantage, `4 + 3` for two dice. */
export function describeDice(result: RollResult): string {
  return result.terms
    .map((t) => {
      const kept = t.kept.map((i) => t.rolls[i]!);
      const shown =
        t.rolls.length > kept.length
          ? `${t.rolls.join(', ')} → ${kept.join(' + ')}`
          : kept.join(' + ');
      return `${t.sign < 0 ? '−' : ''}${t.count}d${t.faces} (${shown})`;
    })
    .concat(result.flat ? [`${result.flat < 0 ? '−' : '+'} ${Math.abs(result.flat)}`] : [])
    .join(' ');
}

export function useRoller(): RollerApi {
  const api = useContext(RollerContext);
  if (!api) throw new Error('useRoller must be used inside <RollerProvider>');
  return api;
}
