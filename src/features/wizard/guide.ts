// The wizard's guide (plan §9.3b, step 4B.3): for each step, where it is in the 2024 order of
// making a character, what to decide, and what it means for the character. Written for this
// app in its own words: it explains the rules, it doesn't quote them.

import type { WizardStep } from '../../engine/build/wizard.ts';

export interface StepGuide {
  /** Where the step sits in the 2024 order: `Step 1 of 5: Choose a class`. */
  where: string;
  /** What to decide here, and why it matters. */
  points: string[];
}

export const STEP_GUIDES: Readonly<Record<WizardStep, StepGuide>> = {
  class: {
    where: 'Step 1 of 5 in the 2024 rules: choose a class.',
    points: [
      'Your class is what your character does best: fighting up close, sneaking, healing, casting spells. It decides most of your abilities.',
      'It sets your hit points (a bigger hit die means more), your saving throws, the armor and weapons you can use, the skills you can choose, and the features you gain as you level up.',
      'Each class has a primary ability: the score you will want highest. The next steps help you raise it.',
      'Any class works with any species and background, so pick the way you want to play.',
    ],
  },
  background: {
    where: 'Step 2 of 5: your origin, part 1 — choose a background.',
    points: [
      'Your background is what your character did before adventuring: a soldier, a sage, a farmer.',
      'In the 2024 rules your ability score increases come from your background, not your species: +2 to one of its three abilities and +1 to another, or +1 to all three. Put them in your class’s primary ability if you can.',
      'It also gives two skill proficiencies, a tool proficiency, an Origin feat (a special talent, some with choices of their own) and starting equipment, or gold instead.',
      'Every character also knows Common and two more languages from the Standard languages; you choose them here.',
    ],
  },
  species: {
    where: 'Step 2 of 5: your origin, part 2 — choose a species.',
    points: [
      'Your species gives your size, your speed and special traits: seeing in the dark, resisting a kind of damage, a breath weapon, a few spells.',
      'Some species come in lineages or ancestries (a Drow or a Wood Elf, a Fire Giant Goliath): each adds its own traits. Pick one here, or the species itself and choose inside it.',
      'Species don’t change ability scores in the 2024 rules; that was the background.',
    ],
  },
  abilities: {
    where: 'Step 3 of 5: determine your ability scores.',
    points: [
      'Six scores describe your character: Strength, Dexterity, Constitution, Intelligence, Wisdom and Charisma.',
      'Use the standard array (15, 14, 13, 12, 10, 8), buy scores with 27 points, or roll four dice for each and keep the highest three. Ask your DM which.',
      'Each score gives a modifier: 10–11 is +0, 12–13 is +1, 14–15 is +2, 16–17 is +3, 8–9 is −1. The modifier is what you add to rolls; the score itself rarely matters.',
      'Your background’s increases are added on top. Constitution adds to your hit points at every level.',
    ],
  },
  equipment: {
    where: 'Part of step 1 and 2: your class’s and background’s starting equipment.',
    points: [
      'Each offers a set of gear (option A) or gold to buy your own (option B). New players: take the gear.',
      'Armor, a Shield and a weapon are put on for you. Your Armor Class (how hard you are to hit) comes from your armor and your Dexterity.',
      'Some entries let you pick the item: a musical instrument, a gaming set, a simple weapon.',
    ],
  },
  spells: {
    where: 'Part of step 1: spells, for a class, species or feat that gives them.',
    points: [
      'Cantrips can be cast as often as you like. Spells of level 1 and higher each use a spell slot, and slots come back after a Long Rest.',
      'Bards, Sorcerers and Warlocks pick their spells and change them only when they gain a level. Clerics and Druids prepare spells from their whole class list and can change them after a Long Rest; Paladins and Rangers too, one spell at a time. Wizards copy spells into a spellbook and prepare from it.',
      'Spells from a species or feat use the ability you choose for them, and some can be cast once per Long Rest without a slot.',
    ],
  },
  choices: {
    where: 'Part of step 1: what your class lets you choose.',
    points: [
      'Skills you are proficient in add your proficiency bonus (+2 at level 1) to checks. Expertise doubles it.',
      'Weapon Mastery lets you use a weapon’s mastery property (an extra effect on a hit or miss) with the kinds you pick.',
      'A Fighting Style or similar pick is a feat; some feats have choices of their own, shown under them.',
    ],
  },
  details: {
    where: 'Steps 4 and 5 of 5: choose an alignment, then fill in your details.',
    points: [
      'Give your character a name and, if you like, a portrait, a look and a personality.',
      'Alignment is a short description of your character’s moral outlook (good or evil, lawful or chaotic). It is a guide for roleplay, not a rule.',
      'A god is optional; Clerics and Paladins often have one.',
    ],
  },
  review: {
    where: 'Step 5 of 5, finished: the numbers.',
    points: [
      'The app works the numbers out: hit points, Armor Class, initiative, saving throws, skill bonuses, attacks and spells. Tap any number on the sheet to see where it comes from.',
      'Anything still to choose is listed below; you can also create the character now and finish it on the sheet.',
    ],
  },
};

/** Whether the guide is open, remembered on this device (open until closed once). */
const KEY = 'wizard.guide.open';

export function guideOpen(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'false';
  } catch {
    return true;
  }
}

export function setGuideOpen(open: boolean): void {
  try {
    localStorage.setItem(KEY, String(open));
  } catch {
    // Not remembered; it opens again next time.
  }
}
