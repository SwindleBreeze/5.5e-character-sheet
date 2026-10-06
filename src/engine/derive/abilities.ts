// Ability scores (plan §9.2, step 3.5): base scores, background increases, bonuses and picks
// (capped at 20 unless an effect allows more), then items that set a score, then overrides.

import { ABILITIES, abilityModifier, type Ability } from '../../schema/index.ts';
import { choiceKey } from '../collect/collect.ts';
import type { EffectSource } from '../collect/types.ts';
import { resolveBound } from '../static/bound.ts';
import {
  contribution,
  effectsOfType,
  valuesOf,
  withOverride,
  type DeriveContext,
} from './context.ts';
import type { Contribution, Derived } from './types.ts';

export const SCORE_CAP = 20;

interface Increase {
  ability: Ability;
  value: number;
  max: number;
  label: string;
  source: EffectSource;
}

/** The background's +2/+1 or +1/+1/+1 must match one of its options (plan §9.1). */
function checkBackgroundPattern(
  ctx: DeriveContext,
  picks: readonly string[],
  source: EffectSource,
) {
  const bg = ctx.index.get({ kind: 'background', id: source.ref.id });
  if (!bg || !picks.length) return;
  const counts = [...new Set(picks)]
    .map((a) => picks.filter((p) => p === a).length)
    .sort((a, b) => b - a);
  const fits = bg.abilityOptions.some((o) => {
    const weights = [...o.weights].sort((a, b) => b - a);
    return (
      picks.every((p) => o.from.includes(p as Ability)) &&
      weights.length === counts.length &&
      weights.every((w, i) => w === counts[i])
    );
  });
  if (!fits) {
    ctx.issues.push({
      severity: 'warn',
      code: 'backgroundAbility',
      message: `${bg.name}: ability increases should be +2 and +1, or +1 to three of its abilities.`,
      ref: source.ref,
    });
  }
}

export function deriveAbilities(
  ctx: DeriveContext,
): Record<Ability, { score: Derived; mod: number }> {
  const increases: Increase[] = [];
  const valuesFor = (source: EffectSource, slot: string) =>
    valuesOf(ctx.recon, choiceKey(source.ref, slot, source.n));

  const origin = ctx.character.log[0]?.origin;
  const background = origin
    ? ctx.collected.owners.find(
        (o) => o.ref.kind === 'background' && o.ref.id === origin.backgroundRef.id,
      )
    : undefined;
  if (background) {
    const picks = valuesFor(background, 'ability');
    checkBackgroundPattern(ctx, picks, background);
    for (const ability of picks) {
      increases.push({
        ability: ability as Ability,
        value: 1,
        max: SCORE_CAP,
        label: background.name,
        source: background,
      });
    }
  }

  for (const { effect, source } of ctx.collected.effects) {
    if (effect.type === 'abilityBonus') {
      const ability = resolveBound(effect.ability, source, (k) => valuesOf(ctx.recon, k));
      if (ability) {
        increases.push({
          ability,
          value: effect.value,
          max: effect.max ?? SCORE_CAP,
          label: source.name,
          source,
        });
      }
    } else if (effect.type === 'abilityChoice') {
      for (const ability of valuesFor(source, effect.choice.slot)) {
        increases.push({
          ability: ability as Ability,
          value: effect.value,
          max: effect.max ?? SCORE_CAP,
          label: source.name,
          source,
        });
      }
    }
  }

  const sets = effectsOfType(ctx.collected, 'abilitySet');
  const out = {} as Record<Ability, { score: Derived; mod: number }>;
  for (const ability of ABILITIES) {
    let score = ctx.character.baseScores[ability];
    const parts: Contribution[] = [{ label: 'Base score', value: score, kind: 'base' }];
    for (const inc of increases) {
      if (inc.ability !== ability) continue;
      const before = score;
      score =
        inc.value >= 0
          ? Math.max(before, Math.min(before + inc.value, inc.max))
          : before + inc.value;
      const label = score - before < inc.value ? `${inc.label} (max ${inc.max})` : inc.label;
      parts.push(contribution(label, score - before, inc.source));
    }
    for (const { effect, source } of sets) {
      if (effect.ability === ability && effect.value > score) {
        parts.push({ ...contribution(source.name, effect.value - score, source), kind: 'set' });
        score = effect.value;
      }
    }
    const value = withOverride({ value: score, parts }, ctx.character, `score.${ability}`);
    out[ability] = { score: value, mod: abilityModifier(value.value) };
  }
  return out;
}
