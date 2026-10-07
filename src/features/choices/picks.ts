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
