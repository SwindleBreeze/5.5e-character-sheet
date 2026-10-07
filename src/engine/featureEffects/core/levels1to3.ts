// Core choice mappings, class levels 1–3 (plan §9.3 step 4.2): the XPHB class features that ask
// for a build-time pick before level 4. Checked against the 2024 Player's Handbook text of each
// feature. Spellcasting picks (cantrips, spells, spellbook) are not mapped: they come from the
// class data (`spellChoiceEffects`).

import type { Effect, Skill } from '../../../schema/index.ts';
import type { FeatureEffectsMap } from '../types.ts';

/** The language tables in chapter 2: Standard and Rare languages. */
const LANGUAGE_TABLES = 'standard|rare';

/** Use the mastery property of `count` kinds of weapons; change one after a Long Rest. */
function weaponMastery(
  count: string | number,
  from: Extract<Effect, { type: 'weaponMasteryChoice' }>['choice']['from'],
  kinds?: Extract<Effect, { type: 'weaponMasteryChoice' }>['kinds'],
): Effect {
  return {
    type: 'weaponMasteryChoice',
    choice: { slot: 'mastery', count, from, retrain: 'longRest' },
    ...(kinds ? { kinds } : {}),
  };
}

/** Expertise in skills the character is proficient in. */
function expertise(count: number, from?: Skill[]): Effect {
  return {
    type: 'expertiseChoice',
    choice: {
      slot: 'expertise',
      count,
      from: from ?? { query: 'proficientSkillsWithoutExpertise' },
    },
    filter: 'proficient',
  };
}

function languages(slot: string, count: number): Effect {
  return {
    type: 'proficiencyChoice',
    category: 'language',
    choice: { slot, count, from: 'any' },
    filter: LANGUAGE_TABLES,
  };
}

export const CORE_LEVELS_1_TO_3: FeatureEffectsMap = {
  // Barbarian 1: two kinds of Simple or Martial Melee weapons (the Weapon Mastery column).
  'classFeature:weapon mastery|barbarian|xphb|1|xphb': {
    level: 'A',
    effects: [
      weaponMastery('table.weapon-mastery', 'any', [
        { category: 'simple' },
        { category: 'martial', melee: true },
      ]),
    ],
  },
  // Barbarian 3: another skill from the Barbarian's level 1 list.
  'classFeature:primal knowledge|barbarian|xphb|3|xphb': {
    level: 'A',
    notes:
      'While raging, checks with Acrobatics, Intimidation, Perception, Stealth or Survival can be made as Strength checks.',
    effects: [
      {
        type: 'proficiencyChoice',
        category: 'skill',
        choice: {
          slot: 'skills',
          count: 1,
          from: [
            'animal handling',
            'athletics',
            'intimidation',
            'nature',
            'perception',
            'survival',
          ],
        },
      },
    ],
  },
  // Bard 2: Expertise in two skill proficiencies (two more at level 9: step 5.8).
  'classFeature:expertise|bard|xphb|2|xphb': { level: 'A', effects: [expertise(2)] },
  // Fighter 1: three kinds of Simple or Martial weapons (the Weapon Mastery column).
  'classFeature:weapon mastery|fighter|xphb|1|xphb': {
    level: 'A',
    effects: [
      weaponMastery('table.weapon-mastery', 'any', [
        { category: 'simple' },
        { category: 'martial' },
      ]),
    ],
  },
  // Paladin, Ranger and Rogue 1: two kinds of weapons they are proficient with.
  'classFeature:weapon mastery|paladin|xphb|1|xphb': {
    level: 'A',
    effects: [weaponMastery(2, { query: 'proficientWeapons' })],
  },
  'classFeature:weapon mastery|ranger|xphb|1|xphb': {
    level: 'A',
    effects: [weaponMastery(2, { query: 'proficientWeapons' })],
  },
  'classFeature:weapon mastery|rogue|xphb|1|xphb': {
    level: 'A',
    effects: [weaponMastery(2, { query: 'proficientWeapons' })],
  },
  // Ranger 2: Expertise in one skill, and two languages.
  'classFeature:deft explorer|ranger|xphb|2|xphb': {
    level: 'A',
    effects: [expertise(1), languages('languages', 2)],
  },
  // Rogue 1: Expertise in two skill proficiencies (two more at level 6: step 5.8).
  'classFeature:expertise|rogue|xphb|1|xphb': { level: 'A', effects: [expertise(2)] },
  // Rogue 1: Thieves' Cant and one other language.
  "classFeature:thieves' cant|rogue|xphb|1|xphb": {
    level: 'A',
    effects: [
      { type: 'proficiency', category: 'language', value: "thieves' cant" },
      languages('language', 1),
    ],
  },
  // Wizard 2: Expertise in one of six skills the Wizard is proficient in.
  'classFeature:scholar|wizard|xphb|2|xphb': {
    level: 'A',
    effects: [
      expertise(1, ['arcana', 'history', 'investigation', 'medicine', 'nature', 'religion']),
    ],
  },
};
