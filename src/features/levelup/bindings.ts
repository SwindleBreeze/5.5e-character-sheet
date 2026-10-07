// What the level-up flow's steps share (plan §9.4, step 5.2).

import type { LevelUpPlan } from '../../engine/build/levelUp.ts';
import type { DerivedFeature, DerivedSheet } from '../../engine/derive/types.ts';
import { refKey, type Character, type Ref } from '../../schema/index.ts';
import type { CharacterUpdate } from '../sheet/useCharacterActions.ts';
import { isSpellOffer } from '../wizard/progress.ts';

export interface LevelUpBindings {
  base: Character;
  before: DerivedSheet;
  plan: LevelUpPlan | undefined;
  /** Start the level in a class (again, from the character as it was). */
  chooseClass: (ref: Ref) => void;
  /** A change to the level being taken. */
  change: (update: CharacterUpdate) => void;
}

/** The features with this level's picks of one kind, top-level ones only. */
export function levelPicks(plan: LevelUpPlan, spells: boolean) {
  const only = (c: { key: string; offer: { kind: string } }) =>
    plan.choiceKeys.has(c.key) && isSpellOffer(c.offer as never) === spells;
  const all = plan.sheet.features;
  const underPick = (f: DerivedFeature) => {
    if (!f.pickedIn) return false;
    const by = all.find((x) => refKey(x.ref) === refKey(f.pickedIn!.ref));
    return !!by?.choices.some((c) => c.values.includes(f.ref.id));
  };
  return { features: all.filter((f) => !underPick(f) && f.choices.some(only)), only };
}
