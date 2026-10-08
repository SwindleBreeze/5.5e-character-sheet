// Hand-written effects for features whose rules are only prose (plan §8, phase 6). Keyed by
// ref key (`classFeature:<id>`, so a feat and an optional feature with the same id never
// clash); the effects are added to the entity's own data effects.

import type { Effect, RefKey } from '../../schema/index.ts';

/**
 * How much of a feature the mapping automates (plan phase 6): A numbers and counters,
 * B toggles, C text only (plus a counter when the feature has uses).
 */
export type AutomationLevel = 'A' | 'B' | 'C';

export interface FeatureMapping {
  effects: Effect[];
  level: AutomationLevel;
  /** What the mapping leaves to the player, shown with the feature. */
  notes?: string;
  /**
   * Why a choice the feature's text asks for is not offered by the app (made at the table each
   * time it is used, say). The coverage gate accepts an unoffered choice only with a reason.
   */
  unoffered?: string;
  /** A primitive the engine lacks that full automation would need (the coverage report lists them). */
  needs?: string;
}

export type FeatureEffectsMap = Readonly<Record<RefKey, FeatureMapping>>;
