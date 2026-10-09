// What the level-up flow's steps share (plan §9.4, step 5.2).

import type { LevelUpPlan } from '../../engine/build/levelUp.ts';
import type { DerivedSheet } from '../../engine/derive/types.ts';
import type { Character, Ref } from '../../schema/index.ts';
import { shownPickKeys, topLevelPicks } from '../choices/picks.ts';
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
  return { features: topLevelPicks(plan.sheet.features, only), only };
}

/** The picks a level-up asks for that neither of its pick steps shows (plan step 7.10). */
export function hiddenLevelPicks(plan: LevelUpPlan): string[] {
  const shown = new Set<string>();
  for (const spells of [false, true]) {
    const { features, only } = levelPicks(plan, spells);
    for (const k of shownPickKeys(features, plan.sheet.features, only)) shown.add(k);
  }
  return [...plan.choiceKeys].filter((k) => !shown.has(k));
}
