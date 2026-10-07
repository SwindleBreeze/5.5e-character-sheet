// Words for picks on the Features tab (plan §9.2, step 3.20).

import type { DerivedFeatureChoice } from '../../../engine/derive/types.ts';

const PROFICIENCY_TITLES: Record<string, string> = {
  skill: 'Skills',
  tool: 'Tools',
  language: 'Languages',
  weapon: 'Weapons',
  armor: 'Armor',
  save: 'Saving throws',
};

/** What a pick is, in a few words. */
export function choiceTitle(c: DerivedFeatureChoice): string {
  const p = c.progression;
  if (p) return p.level ? `${p.name} (level ${p.level})` : p.name;
  const e = c.offer.effect;
  switch (c.offer.kind) {
    case 'ability':
      return 'Ability Score Increase';
    case 'backgroundAbility':
      return 'Ability Scores';
    case 'spellAbility':
      return 'Spellcasting ability';
    case 'proficiency': {
      const category = e?.type === 'proficiencyChoice' ? e.category : 'skill';
      return Array.isArray(category)
        ? 'Proficiencies'
        : (PROFICIENCY_TITLES[category] ?? 'Proficiencies');
    }
    case 'expertise':
      return 'Expertise';
    case 'resistance':
      return 'Resistance';
    case 'feat':
      return c.count === 1 ? 'Feat' : 'Feats';
    case 'spell':
      return c.count === 1 ? 'Spell' : 'Spells';
    case 'weaponMastery':
      return 'Weapon Mastery';
    case 'equipment':
      return 'Starting equipment';
    default:
      return 'Chosen';
  }
}
