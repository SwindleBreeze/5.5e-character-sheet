// Helpers the choice components share (plan §9.3, step 4.3).

import type { DerivedFeature, DerivedFeatureChoice } from '../../engine/derive/types.ts';
import { refKey, type EntityKind, type Retrain } from '../../schema/index.ts';

export interface PickSave {
  values: string[];
  labels: string[];
  valueKinds?: EntityKind[];
}

const RETRAIN_TEXT: Record<Retrain | 'never', string> = {
  longRest: 'You can change this whenever you finish a Long Rest.',
  shortRest: 'You can change this whenever you finish a Short or Long Rest.',
  levelUp: 'You can change this when you gain a level; the feature’s text says how much.',
  never:
    'The rules don’t let you change this later. Change it to fix a mistake, or when your DM agrees.',
};

/** When the rules let a pick change (plan §9.4, step 5.7: shown, not enforced). */
export function retrainText(choice: DerivedFeatureChoice): string {
  return RETRAIN_TEXT[choice.offer.retrain ?? 'never'];
}

/** Which of a feature's picks a screen shows (a wizard step's, a level's). */
export type PickFilter = (choice: DerivedFeatureChoice, feature: DerivedFeature) => boolean;

/**
 * The features a screen lists at the top: those with a pick it shows, except one brought in by
 * a pick the screen shows too, which opens under that pick instead. One brought in by a pick
 * made elsewhere stands on its own (Magician, picked for Primal Order on the class features
 * step, has its cantrip on the spells step).
 */
export function topLevelPicks(all: readonly DerivedFeature[], only: PickFilter): DerivedFeature[] {
  const underShownPick = (f: DerivedFeature) => {
    if (!f.pickedIn) return false;
    const by = all.find((x) => refKey(x.ref) === refKey(f.pickedIn!.ref));
    return !!by?.choices.some((c) => c.values.includes(f.ref.id) && only(c, by));
  };
  return all.filter((f) => !underShownPick(f) && f.choices.some((c) => only(c, f)));
}

/** The features a pick brought in that show their own picks under it. */
export function nestedPicks(
  choice: DerivedFeatureChoice,
  feature: DerivedFeature,
  all: readonly DerivedFeature[],
  only: PickFilter | undefined,
  seen: ReadonlySet<string>,
): DerivedFeature[] {
  return pickedFeatures(choice, feature, all).filter(
    (n) => !seen.has(refKey(n.ref)) && n.choices.some((x) => !only || only(x, n)),
  );
}

/**
 * The keys of every pick a list of features shows, with the picks opened under them, as
 * `FeatureChoices` draws them: for checking that no pick is left without a place.
 */
export function shownPickKeys(
  features: readonly DerivedFeature[],
  all: readonly DerivedFeature[],
  only?: PickFilter,
  seen: ReadonlySet<string> = new Set(),
): Set<string> {
  const out = new Set<string>();
  for (const f of features) {
    for (const c of f.choices) {
      if (only && !only(c, f)) continue;
      out.add(c.key);
      const nested = nestedPicks(c, f, all, only, seen);
      const below = new Set([...seen, refKey(f.ref), ...nested.map((n) => refKey(n.ref))]);
      for (const n of nested) for (const k of shownPickKeys([n], all, only, below)) out.add(k);
    }
  }
  return out;
}

/** What an origin (background, species) grants outright, not through one of its picks: a feat. */
export function grantedUnder(
  owner: DerivedFeature,
  all: readonly DerivedFeature[],
): DerivedFeature[] {
  const key = refKey(owner.ref);
  return all.filter(
    (f) =>
      f.pickedIn &&
      refKey(f.pickedIn.ref) === key &&
      !owner.choices.some((c) => c.values.includes(f.ref.id)),
  );
}

/** The entities a pick brought in, as features of the sheet. */
export function pickedFeatures(
  choice: DerivedFeatureChoice,
  feature: DerivedFeature,
  all: readonly DerivedFeature[],
): DerivedFeature[] {
  const owner = refKey(feature.ref);
  return all.filter(
    (f) => f.pickedIn && refKey(f.pickedIn.ref) === owner && choice.values.includes(f.ref.id),
  );
}
