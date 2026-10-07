// The wizard's step introductions (plan §9.3b, steps 4B.3 and 4B.5): where a step sits in the
// 2024 order of making a character, and in one sentence what it decides. The rest of the
// explaining sits next to what it explains (`choiceHelp`, "What you get"), not in one block.
// Written for this app in its own words.

import type { WizardStep } from '../../engine/build/wizard.ts';

export interface StepIntro {
  /** Where it sits in the 2024 rules: `Step 2 · Origin`. */
  rule: string;
  /** What this step decides, in one sentence. */
  lead: string;
}

export const STEP_INTROS: Readonly<Record<WizardStep, StepIntro>> = {
  class: {
    rule: 'Step 1 of 5 · Choose a class',
    lead: 'Your class is what your character does best. It decides your hit points, the armor and weapons you can use, and most of your abilities.',
  },
  background: {
    rule: 'Step 2 of 5 · Origin: background',
    lead: 'What your character did before adventuring. It raises three ability scores and gives skills, a tool, an Origin feat and equipment.',
  },
  species: {
    rule: 'Step 2 of 5 · Origin: species',
    lead: 'Your species gives your size, speed and special traits. In the 2024 rules it doesn’t change ability scores; your background does.',
  },
  abilities: {
    rule: 'Step 3 of 5 · Ability scores',
    lead: 'Six scores describe your character. Put the highest in your class’s primary ability.',
  },
  choices: {
    rule: 'Step 1 of 5, continued · Class features',
    lead: 'What your class’s level 1 features let you choose.',
  },
  spells: {
    rule: 'Step 1 of 5, continued · Spells',
    lead: 'The spells your class, species or feats give you.',
  },
  levels: {
    rule: 'Your starting level',
    lead: 'Each level above 1, as if you had levelled up: its class, hit points and choices. They are made for you; change any of them.',
  },
  details: {
    rule: 'Steps 4 and 5 of 5 · Alignment and details',
    lead: 'A name, a look, a personality and an alignment: who your character is. None of it changes a number.',
  },
  review: {
    rule: 'Step 5 of 5 · The numbers',
    lead: 'The app works out your hit points, Armor Class, bonuses and attacks. Check them, then create your character.',
  },
};
