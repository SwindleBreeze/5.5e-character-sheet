// Visiting effects, including the ones nested in wrappers.

import type { Effect } from '../../schema/index.ts';

/** Effects nested directly inside one effect (wrappers, toggles and toggle forms). */
export function childEffects(effect: Effect): readonly Effect[] {
  switch (effect.type) {
    case 'ifChoice':
    case 'atLevel':
    case 'when':
      return effect.effects;
    case 'toggle':
      return [...effect.effects, ...(effect.options ?? []).flatMap((o) => o.effects)];
    default:
      return [];
  }
}

/** Every effect in the tree, depth first, wrappers before their children. */
export function* walkEffects(effects: readonly Effect[]): Generator<Effect> {
  for (const effect of effects) {
    yield effect;
    yield* walkEffects(childEffects(effect));
  }
}
