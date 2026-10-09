// Every pick the creation wizard asks for has a place on one of its steps (plan step 7.10):
// the steps' own rules for what they show, gathered, so a test can check none is left out
// (Magician's cantrip once was: picked for Primal Order, shown on no step).

import type {
  DerivedFeature,
  DerivedFeatureChoice,
  DerivedSheet,
} from '../../engine/derive/types.ts';
import { grantedUnder, shownPickKeys, topLevelPicks } from '../choices/picks.ts';
import { picksOnStep, stepOf } from './progress.ts';

/** The picks no wizard step shows. */
export function hiddenWizardPicks(sheet: DerivedSheet): DerivedFeatureChoice[] {
  const all = sheet.features;
  const shown = new Set<string>();
  const add = (keys: Iterable<string>) => {
    for (const k of keys) shown.add(k);
  };
  const origin = (owner: DerivedFeature | undefined) => {
    if (!owner) return;
    add(shownPickKeys([owner], all));
    add(shownPickKeys(grantedUnder(owner, all), all));
  };

  // Class: the class's own picks for this step (skills, equipment).
  const cls = all.find((f) => f.ref.kind === 'class' && f.entryIndex === 0);
  if (cls) add(shownPickKeys([cls], all, (c) => stepOf(c.offer, sheet) === 'class'));
  // Background and species: theirs, and what they grant (an Origin feat).
  origin(all.find((f) => f.ref.kind === 'background'));
  const species = all.find((f) => f.ref.kind === 'species');
  if (species && species.choices.length) origin(species);
  // Class features and spells.
  for (const step of ['choices', 'spells'] as const) {
    const { features, only } = picksOnStep(sheet, step);
    add(shownPickKeys(features, all, only));
  }
  // Levels above 1, each on its own card.
  const entries = new Set(all.flatMap((f) => f.choices.map((c) => c.entryIndex)));
  for (const i of entries) {
    if (i < 1) continue;
    const only = (c: { entryIndex: number }) => c.entryIndex === i;
    add(shownPickKeys(topLevelPicks(all, only), all, only));
  }
  return all.flatMap((f) => f.choices).filter((c) => !shown.has(c.key));
}
