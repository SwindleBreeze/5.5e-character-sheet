// What the sheet's numbers are for, in this app's own words (plan §9.1: help players read and
// understand their character). Shown under how a number adds up when it is tapped. A skill's
// own description comes from the imported rules; these say what a roll with it means. Pure.

import { ABILITY_NAMES, type Ability } from '../../schema/index.ts';

/** What each ability measures, and what it goes into on a sheet. */
export const ABILITY_ABOUT: Record<Ability, string> = {
  str: 'Physical power. It goes into Athletics, Strength saving throws, attacks and damage with most melee weapons, and how much you can carry, push and lift.',
  dex: 'Agility, reflexes and balance. It goes into Acrobatics, Sleight of Hand and Stealth, Dexterity saving throws, Initiative, attacks with ranged and Finesse weapons, and your Armor Class in light armor or none.',
  con: 'Health and stamina. Its modifier is added to your hit points at every level, and it goes into Constitution saving throws, including the ones that keep your Concentration on a spell.',
  int: 'Reasoning, memory and learning. It goes into Arcana, History, Investigation, Nature and Religion, Intelligence saving throws, and the spells of a class that casts with it.',
  wis: 'Awareness, intuition and willpower. It goes into Animal Handling, Insight, Medicine, Perception and Survival, Wisdom saving throws, and the spells of a class that casts with it.',
  cha: 'Force of personality and confidence. It goes into Deception, Intimidation, Performance and Persuasion, Charisma saving throws, and the spells of a class that casts with it.',
};

export const MODIFIER_ABOUT =
  'Rolls use the modifier, not the score: the score minus 10, halved and rounded down (10 or 11 is +0, 14 or 15 is +2, 8 or 9 is −1).';

/** When each saving throw tends to come up. */
export const SAVE_ABOUT: Record<Ability, string> = {
  str: 'Resisting force: being shoved, pulled, pinned or knocked down.',
  dex: 'Getting out of the way: a burst of flame, a collapsing ceiling, a trap springing.',
  con: 'Enduring: poison, disease, heat and cold, and holding your Concentration on a spell when you take damage.',
  int: 'Keeping your mind clear: seeing through an illusion, resisting an attack on your thoughts.',
  wis: 'Keeping your will your own: resisting being charmed, frightened or compelled.',
  cha: 'Holding on to yourself: resisting possession, or being banished or forced elsewhere.',
};

export function saveHow(ability: Ability): string {
  return `When an effect calls for a ${ABILITY_NAMES[ability]} saving throw, roll a d20 and add this bonus. If the total equals or beats the effect’s DC (Difficulty Class: the number set by whoever or whatever caused it), you succeed; the effect says what that saves you from.`;
}

export function checkHow(ability: Ability, skill?: string): string {
  const name = skill ? `${ABILITY_NAMES[ability]} (${skill})` : ABILITY_NAMES[ability];
  return `When the DM asks for a ${name} check, roll a d20 and add this bonus. If the total equals or beats the DC the DM set, you succeed.`;
}

export type Passive = 'perception' | 'insight' | 'investigation';

export const PASSIVE_ABOUT: Record<Passive, string> = {
  perception:
    'What you notice without looking for it: a creature hiding, a tripwire, a sound behind a door. The DM compares it with how hard the thing is to notice; no one rolls.',
  insight:
    'What you sense about people without trying: a lie, a nervous glance, a hidden mood. The DM compares it with how well they hide it; no one rolls.',
  investigation:
    'What you work out without searching: a clue that stands out, a mechanism that looks wrong. The DM compares it with how well hidden it is; no one rolls.',
};

export const OTHER_ABOUT = {
  ac: 'How hard you are to hit. An attack roll against you hits when its total equals or beats your Armor Class.',
  initiative:
    'Rolled when a fight starts: everyone takes their turns in order, from the highest total down.',
  speed: 'How far you can move on your turn, in feet. You can split it up around your action.',
  pb: 'Added to the rolls you are trained in: proficient skills and saving throws, attacks with weapons you are proficient with, and your spell attacks and spell save DC. It goes up as you gain levels.',
  hpMax:
    'The most hit points you can have. Damage takes hit points away; at 0 you fall unconscious and start making death saving throws.',
} as const;
