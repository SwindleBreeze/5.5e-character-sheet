// What every wizard step gets (plan §9.3 step 4.4, §9.3b step 4B.5).

import type { AllContent } from '../../content/hooks.ts';
import type { AutoContext } from '../../engine/build/autoChoose.ts';
import type { WizardStep } from '../../engine/build/wizard.ts';
import type { DerivedSheet } from '../../engine/derive/types.ts';
import type { Character } from '../../schema/index.ts';
import type { CharacterUpdate } from '../sheet/useCharacterActions.ts';
import type { StepTodo } from './progress.ts';

export { isSpellOffer, rootOf, stepOf } from './progress.ts';

export interface WizardBindings {
  character: Character;
  /** Missing until a class is chosen. */
  sheet: DerivedSheet | undefined;
  /** Everything imported (names), and what the enabled sources offer (pickers). */
  content: AllContent;
  /** A change on the current step; the draft's starting equipment follows it. */
  apply: (update: CharacterUpdate) => void;
  /**
   * A change to the class, background or species: when it would remove picks, they are listed
   * and removed only once the player confirms.
   */
  change: (update: CharacterUpdate) => void;
  /** Go to a step. */
  go: (step: WizardStep) => void;
  /** What is still to do, every step. */
  todos: readonly StepTodo[];
}

export function choiceContext(b: WizardBindings, sheet: DerivedSheet): AutoContext {
  return {
    character: b.character,
    sheet,
    catalog: b.content.catalog,
    index: b.content.index,
  };
}
