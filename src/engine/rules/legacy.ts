// 2014 options on a 2024 character (plan step 8.2), as the 2024 rules take them:
// - a 2014 feat has no category: it is offered as a General feat;
// - a 2014 species' ability increases are replaced by the background's (the player can keep
//   them instead, with `Character.legacyAbilities`, and then the background gives none);
// - a 2014 background lists neither ability increases nor an Origin feat, which a 2024
//   character gets from its background: they are picked freely (+2/+1 or +1/+1/+1, any
//   abilities; any Origin feat).
// 2014 subclasses need nothing here: the data re-homes them onto the 2024 classes with their
// features at the 2024 subclass levels.
//
// Characters on 2014 rules (plan step 8.5, `Character.ruleset`): ability increases from the
// species and none from the background; an Ability Score Improvement at the class's levels
// (+2 to one score, +1 to two, or a feat); prepared casters prepare their level plus their
// modifier, and known casters learn spells on level-up; 2014 exhaustion.

import {
  ABILITIES,
  type Background,
  type Character,
  type ClassSpellcasting,
  type ContentEntity,
  type Effect,
  type Feat,
} from '../../schema/index.ts';

/** A character played by the 2014 rules (step 8.5). */
export function isRules2014(character: Pick<Character, 'ruleset'>): boolean {
  return character.ruleset === '2014';
}

/** A feat's category for choosing: a 2014 feat without one is General. */
export function featCategoryOf(feat: Pick<Feat, 'category' | 'edition'>): string {
  return feat.category || (feat.edition === '2014' ? 'general' : '');
}

/** The ability increases a background offers; a 2014 background's are free. */
export function backgroundAbilityOptions(
  bg: Pick<Background, 'abilityOptions' | 'edition'>,
): Background['abilityOptions'] {
  if (bg.abilityOptions.length || bg.edition !== '2014') return bg.abilityOptions;
  return [
    { from: [...ABILITIES], weights: [2, 1] },
    { from: [...ABILITIES], weights: [1, 1, 1] },
  ];
}

/** The choice slot of a 2014 background's Origin feat. */
export const LEGACY_ORIGIN_FEAT_SLOT = 'originFeat';

/** What a 2014 background adds for a 2024 character: an Origin feat of the player's choice. */
export function legacyBackgroundEffects(bg: Pick<Background, 'edition' | 'featId'>): Effect[] {
  if (bg.edition !== '2014' || bg.featId) return [];
  return [{ type: 'featChoice', slot: LEGACY_ORIGIN_FEAT_SLOT, categories: ['origin'] }];
}

/**
 * Whether an effect is one of a species' ability increases, or the choice between sets of
 * them (the importer's `abilitySet` alternatives).
 */
export function isAbilityIncrease(effect: Effect): boolean {
  if (effect.type === 'abilityBonus' || effect.type === 'abilityChoice') return true;
  if (effect.type === 'optionChoice') return effect.choice.slot === 'abilitySet';
  if (effect.type === 'ifChoice') return effect.slot === 'abilitySet';
  return false;
}

/** The choice between the 2014 Ability Score Improvement's options. */
export const LEGACY_ASI_SLOT = 'asiSet';

/**
 * Effects a 2014 entity needs that its data doesn't carry: a 2014 class's Ability Score
 * Improvement, which the data leaves as text (+2 to one score, +1 to two, or a feat).
 */
export function legacyEntityEffects(entity: ContentEntity): Effect[] {
  if (
    entity.kind !== 'classFeature' ||
    entity.edition !== '2014' ||
    entity.effects.length ||
    entity.name.toLowerCase() !== 'ability score improvement'
  )
    return [];
  return [
    {
      type: 'optionChoice',
      choice: { slot: LEGACY_ASI_SLOT, count: 1, from: ['two', 'one', 'feat'] },
      labels: ['+2 to one score', '+1 to two scores', 'A feat'],
    },
    {
      type: 'ifChoice',
      slot: LEGACY_ASI_SLOT,
      value: 'two',
      effects: [
        {
          type: 'abilityChoice',
          choice: { slot: 'ability', count: 1, from: [...ABILITIES] },
          value: 2,
          max: 20,
        },
      ],
    },
    {
      type: 'ifChoice',
      slot: LEGACY_ASI_SLOT,
      value: 'one',
      effects: [
        {
          type: 'abilityChoice',
          choice: { slot: 'ability.1', count: 2, from: [...ABILITIES] },
          value: 1,
          max: 20,
        },
      ],
    },
    {
      type: 'ifChoice',
      slot: LEGACY_ASI_SLOT,
      value: 'feat',
      effects: [{ type: 'featChoice', slot: 'feat', categories: ['general'] }],
    },
  ];
}

/**
 * A 2014 caster with a spells-known table learns its spells on level-up; the data doesn't say
 * so (2014 Bard, Ranger, Sorcerer and Warlock).
 */
export function casterSpellcasting(
  sc: ClassSpellcasting,
  owner: Pick<ContentEntity, 'edition'>,
): ClassSpellcasting {
  if (owner.edition !== '2014' || sc.preparedChange || !sc.preparedByLevel?.length) return sc;
  return { ...sc, preparedChange: 'level' };
}

/**
 * How many spells a caster without a prepared-spells table prepares: its level (half for half
 * casters, rounded up for the Artificer, a third for third casters) plus its spellcasting
 * modifier, at least 1. The 2014 Cleric, Druid, Paladin and Wizard (and a homebrew class
 * without a table).
 */
export function preparedByFormula(sc: ClassSpellcasting, level: number, mod: number): number {
  if (level < 1) return 0;
  const share =
    sc.progression === 'half'
      ? Math.floor(level / 2)
      : sc.progression === 'artificer'
        ? Math.ceil(level / 2)
        : sc.progression === 'third'
          ? Math.floor(level / 3)
          : level;
  return Math.max(1, share + mod);
}

/** 2014 exhaustion, by level: what each level adds (they add up). */
export const EXHAUSTION_2014 = {
  checksDisadvantage: 1,
  speedHalved: 2,
  attacksSavesDisadvantage: 3,
  hpMaxHalved: 4,
  speedZero: 5,
} as const;
