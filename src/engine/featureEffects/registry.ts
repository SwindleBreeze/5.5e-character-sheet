// The featureEffects registry (plan §9.2, step 3.11): hand-written mappings are registered
// here, checked for what can be checked without content (keys, formulas, slots), and handed to
// `derive` as one map. Checks that need content live in `validate.ts`.

import { parseRefKey, type RefKey } from '../../schema/index.ts';
import { effectSlots } from '../collect/collect.ts';
import { walkEffects } from '../effects/walk.ts';
import { FormulaError, parseFormula } from '../formula/parse.ts';
import { effectFormulas } from './inspect.ts';
import type { FeatureEffectsMap, FeatureMapping } from './types.ts';

export class MappingError extends Error {
  readonly key: string;
  constructor(key: string, message: string) {
    super(`${key}: ${message}`);
    this.name = 'MappingError';
    this.key = key;
  }
}

/** Problems in one mapping that need no content to find. */
export function checkMapping(key: string, mapping: FeatureMapping): string[] {
  const problems: string[] = [];
  try {
    parseRefKey(key as RefKey);
  } catch {
    problems.push('the key is not a ref key (`<kind>:<id>`)');
  }
  for (const effect of walkEffects(mapping.effects)) {
    for (const formula of effectFormulas(effect)) {
      if (typeof formula !== 'string') continue;
      try {
        parseFormula(formula);
      } catch (err) {
        if (!(err instanceof FormulaError)) throw err;
        problems.push(`formula "${formula}": ${err.message}`);
      }
    }
  }
  const seen = new Set<string>();
  for (const slot of effectSlots(mapping.effects)) {
    if (seen.has(slot)) problems.push(`slot "${slot}" is declared twice`);
    seen.add(slot);
  }
  return problems;
}

export interface FeatureEffectsRegistry {
  /** Add mappings; throws a MappingError on a repeated key or a broken mapping. */
  register(map: FeatureEffectsMap): void;
  /** Everything registered so far. */
  map(): FeatureEffectsMap;
}

export function createFeatureEffectsRegistry(): FeatureEffectsRegistry {
  const entries: Record<RefKey, FeatureMapping> = {};
  return {
    register(map) {
      for (const [key, mapping] of Object.entries(map) as [RefKey, FeatureMapping][]) {
        if (key in entries) throw new MappingError(key, 'already registered');
        const problems = checkMapping(key, mapping);
        if (problems.length) throw new MappingError(key, problems.join('; '));
      }
      Object.assign(entries, map);
    },
    map: () => entries,
  };
}

/** The app's registry. Core mappings (phases 4–6) register into it from `index.ts`. */
const app = createFeatureEffectsRegistry();

export function registerFeatureEffects(map: FeatureEffectsMap): void {
  app.register(map);
}

/** The app's mappings, to pass to `derive` as `registry`. */
export function featureEffects(): FeatureEffectsMap {
  return app.map();
}
