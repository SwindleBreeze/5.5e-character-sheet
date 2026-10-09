// 2014 options on a 2024 character (plan step 8.2), as the 2024 rules take them:
// - a 2014 feat has no category: it is offered as a General feat;
// - a 2014 species' ability increases are replaced by the background's (the player can keep
//   them instead, with `Character.legacyAbilities`, and then the background gives none);
// - a 2014 background lists neither ability increases nor an Origin feat, which a 2024
//   character gets from its background: they are picked freely (+2/+1 or +1/+1/+1, any
//   abilities; any Origin feat).
// 2014 subclasses need nothing here: the data re-homes them onto the 2024 classes with their
// features at the 2024 subclass levels.

import { ABILITIES, type Background, type Effect, type Feat } from '../../schema/index.ts';

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
