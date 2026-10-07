// What every derive stage shares: the collected effects, the choices that count, the formula
// scope and the issue list.

import {
  encodeChoiceKey,
  type Character,
  type ChoiceKey,
  type Effect,
  type Formula,
  type OverrideKey,
} from '../../schema/index.ts';
import { usableValues, type Reconciliation } from '../choices/reconcile.ts';
import type { AppliedEffect, Collected, EffectSource } from '../collect/types.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import { averageOf, isDice, type Value } from '../formula/dice.ts';
import { evaluateFormula } from '../formula/evaluate.ts';
import { FormulaError } from '../formula/parse.ts';
import type { StaticState } from '../static/state.ts';
import type { GearState } from './inventory.ts';
import { makeScope, type ScopeContext } from './scope.ts';
import type { Contribution, Derived, RuleIssue } from './types.ts';

export interface DeriveContext {
  character: Character;
  index: ContentIndex;
  collected: Collected;
  st: StaticState;
  recon: Reconciliation;
  scope: ScopeContext;
  issues: RuleIssue[];
  /** Armor drawbacks, once proficiencies are known. */
  gear?: GearState;
}

/** Applied effects of one type, typed. */
export function effectsOfType<T extends Effect['type']>(
  collected: Collected,
  type: T,
): { effect: Extract<Effect, { type: T }>; source: EffectSource }[] {
  return collected.effects.filter(
    (a): a is AppliedEffect & { effect: Extract<Effect, { type: T }> } => a.effect.type === type,
  );
}

/** The picks that count for a choice key (plan §4.4). */
export function valuesOf(recon: Reconciliation, key: ChoiceKey): string[] {
  return usableValues(recon.byKey.get(encodeChoiceKey(key)));
}

/** Evaluate a formula for a source; a broken formula is an issue and counts as 0. */
export function evalValue(ctx: DeriveContext, formula: Formula, source?: EffectSource): Value {
  try {
    return evaluateFormula(formula, makeScope(ctx.scope, source));
  } catch (err) {
    if (!(err instanceof FormulaError)) throw err;
    ctx.issues.push({
      severity: 'warn',
      code: 'formula',
      message: `${source ? `${source.name}: ` : ''}${err.message}`,
      ...(source ? { ref: source.ref } : {}),
    });
    return 0;
  }
}

/** A formula as a number; dice count as their average. */
export function evalNumber(ctx: DeriveContext, formula: Formula, source?: EffectSource): number {
  const v = evalValue(ctx, formula, source);
  return isDice(v) ? averageOf(v) : v;
}

export function derived(parts: Contribution[]): Derived {
  return { value: parts.reduce((sum, p) => sum + p.value, 0), parts };
}

/** The player's override replaces the computed value and is listed last (plan §4.4). */
export function withOverride(d: Derived, character: Character, key: OverrideKey): Derived {
  const o = character.overrides[key];
  if (typeof o !== 'number') return d;
  return { value: o, parts: [...d.parts, { label: 'Your override', value: o, kind: 'override' }] };
}

export function contribution(label: string, value: number, source?: EffectSource): Contribution {
  return source ? { label, value, source: source.ref } : { label, value };
}
