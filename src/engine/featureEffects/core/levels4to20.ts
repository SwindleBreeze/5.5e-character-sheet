// Core choice mappings, class levels 4–20 (plan §9.4 step 5.8): the XPHB class features that ask
// for a build-time pick from level 4 on, checked against the 2024 Player's Handbook text of
// each. Ability Score Improvements, Epic Boons, Fighting Styles, invocations and Metamagic come
// from the class data's progressions; Mystic Arcanum from its fixed spells (`spellChoiceEffects`).

import type { Effect } from '../../../schema/index.ts';
import type { FeatureEffectsMap } from '../types.ts';
import { expertise } from './levels1to3.ts';

/** Wizard spells picked from a list, always prepared, with free casts. */
function wizardSpells(
  slot: string,
  choose: string,
  count: number,
  uses: NonNullable<Extract<Effect, { type: 'grantSpells' }>['spells'][number]['uses']>,
  retrain?: 'longRest',
): Effect {
  return {
    type: 'grantSpells',
    spells: [
      {
        mode: 'alwaysPrepared',
        ability: 'int',
        spell: { choose, count, slot, ...(retrain ? { retrain } : {}) },
        uses,
      },
    ],
  };
}

export const CORE_LEVELS_4_TO_20: FeatureEffectsMap = {
  // Rogue 6, Bard 9, Ranger 9: Expertise in two more skill proficiencies.
  'classFeature:expertise|rogue|xphb|6|xphb': { level: 'A', effects: [expertise(2)] },
  'classFeature:expertise|bard|xphb|9|xphb': { level: 'A', effects: [expertise(2)] },
  'classFeature:expertise|ranger|xphb|9|xphb': { level: 'A', effects: [expertise(2)] },
  // Cleric 7: Divine Strike or Potent Spellcasting, one of the two.
  'classFeature:blessed strikes|cleric|xphb|7|xphb': {
    level: 'A',
    effects: [
      {
        type: 'featureOptions',
        optionKind: 'classFeature',
        choice: {
          slot: 'options.0',
          count: 1,
          from: ['divine strike|cleric|xphb|7|xphb', 'potent spellcasting|cleric|xphb|7|xphb'],
        },
      },
    ],
  },
  // Bard 10: new prepared spells may come from the Cleric, Druid and Wizard lists too.
  'classFeature:magical secrets|bard|xphb|10|xphb': {
    level: 'A',
    effects: [
      {
        type: 'grantSpells',
        spells: ['Cleric', 'Druid', 'Wizard'].map((c) => ({
          mode: 'expanded' as const,
          spell: { all: `class=${c}` },
        })),
      },
    ],
  },
  // Wizard 18: a level 1 and a level 2 spell from the spellbook, always prepared and cast at
  // their lowest level without a slot; swapped after a Long Rest.
  'classFeature:spell mastery|wizard|xphb|18|xphb': {
    level: 'A',
    effects: [
      wizardSpells('mastery.1', 'level=1|class=Wizard', 1, 'atWill', 'longRest'),
      wizardSpells('mastery.2', 'level=2|class=Wizard', 1, 'atWill', 'longRest'),
    ],
  },
  // Wizard 20: two level 3 spells from the spellbook, always prepared, each cast once at level
  // 3 without a slot per Short or Long Rest.
  'classFeature:signature spells|wizard|xphb|20|xphb': {
    level: 'A',
    effects: [
      wizardSpells('signature', 'level=3|class=Wizard', 2, { count: 1, recharge: 'short' }),
    ],
  },
};
