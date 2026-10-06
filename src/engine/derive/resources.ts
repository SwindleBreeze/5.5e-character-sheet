// Resources (plan §9.2, step 3.8; P6): counters with a maximum and a recharge, changed by
// later features, plus other ways to restore them.

import { refKey, type Cost, type Ref } from '../../schema/index.ts';
import type { EffectSource } from '../collect/types.ts';
import { formatValue } from '../formula/dice.ts';
import {
  contribution,
  effectsOfType,
  evalNumber,
  evalValue,
  type DeriveContext,
} from './context.ts';
import type { DerivedCost, DerivedResource } from './types.ts';

/** Where a resource's spent uses are stored: unique per owner (every gift has `uses`). */
export function resourceKey(source: EffectSource, resourceId: string): string {
  return `${refKey(source.ref)}${source.n === undefined ? '' : `@${source.n}`}#${resourceId}`;
}

/** A resource by id, preferring the one the same entity defines. */
export function findResource(
  resources: readonly DerivedResource[],
  resourceId: string,
  owner?: Ref,
): DerivedResource | undefined {
  const matches = resources.filter((r) => r.resourceId === resourceId);
  return (
    (owner && matches.find((r) => r.source.kind === owner.kind && r.source.id === owner.id)) ??
    matches[0]
  );
}

/** A resource by its display name (5etools `consumes`, `resourceName`). */
export function findResourceByName(resources: readonly DerivedResource[], name: string) {
  const want = name.toLowerCase().replace(/s$/, '');
  return resources.find((r) => r.name.toLowerCase().replace(/s$/, '') === want);
}

export function costOf(
  ctx: DeriveContext,
  cost: Cost,
  resources: readonly DerivedResource[],
  source?: EffectSource,
): DerivedCost {
  if ('resource' in cost) {
    const r = findResource(resources, cost.resource, source?.ref);
    const amount = Math.max(0, Math.floor(evalNumber(ctx, cost.amount, source)));
    const out: DerivedCost = { label: `${amount} ${r?.name ?? cost.resource}`, amount };
    if (r) out.resourceKey = r.key;
    return out;
  }
  if ('slot' in cost) return { label: `a level ${cost.slot.minLevel}+ spell slot` };
  if ('hitDice' in cost) {
    const n = Math.max(0, Math.floor(evalNumber(ctx, cost.hitDice, source)));
    return { label: `${n} Hit ${n === 1 ? 'Die' : 'Dice'}`, amount: n };
  }
  const names = {
    action: 'an action',
    bonus: 'a Bonus Action',
    reaction: 'your Reaction',
    other: '',
  };
  return { label: names[cost.action] };
}

export function deriveResources(ctx: DeriveContext): DerivedResource[] {
  const defs = effectsOfType(ctx.collected, 'resource');
  const modifies = effectsOfType(ctx.collected, 'resourceModify');
  const out: DerivedResource[] = defs.map(({ effect, source }) => ({
    key: resourceKey(source, effect.resourceId),
    resourceId: effect.resourceId,
    name: effect.name,
    source: source.ref,
    sourceName: source.name,
    max: { value: 0, parts: [] },
    used: 0,
    recharge: effect.recharge,
    pool: !!effect.pool,
    restoreWith: [],
  }));

  defs.forEach(({ effect, source }, i) => {
    const r = out[i]!;
    let max = { formula: effect.max, source };
    let die = effect.die === undefined ? undefined : { formula: effect.die, source };
    // A later feature may change the maximum, recharge or die (Font of Inspiration).
    for (const m of modifies) {
      if (findResource(out, m.effect.resourceId, m.source.ref) !== r) continue;
      if (m.effect.max !== undefined) max = { formula: m.effect.max, source: m.source };
      if (m.effect.recharge !== undefined) r.recharge = m.effect.recharge;
      if (m.effect.die !== undefined) die = { formula: m.effect.die, source: m.source };
    }
    const value = Math.max(0, Math.floor(evalNumber(ctx, max.formula, max.source)));
    r.max = { value, parts: [contribution(max.source.name, value, max.source)] };
    r.used = Math.min(value, Math.max(0, ctx.character.state.resourcesUsed[r.key] ?? 0));
    if (die) r.die = formatValue(evalValue(ctx, die.formula, die.source));
  });

  for (const { effect, source } of effectsOfType(ctx.collected, 'restoreWith')) {
    const r = findResource(out, effect.resourceId, source.ref);
    if (!r) continue;
    r.restoreWith.push({
      amount: formatValue(evalValue(ctx, effect.amount, source)),
      costs: effect.costs.map((c) => costOf(ctx, c, out, source).label),
    });
  }
  return out;
}
