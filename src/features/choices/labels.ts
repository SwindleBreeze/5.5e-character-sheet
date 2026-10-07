// Words for picks (plan §9.2 step 3.20, §9.3 step 4.3): what a pick is, and what was picked,
// readable. Shared by the Features tab, the "Needs attention" list and the creation wizard.

import { optionLabel, readable, spreadLabel } from '../../engine/choices/options.ts';
import type { ContentIndex } from '../../engine/content/contentIndex.ts';
import { valueKind } from '../../engine/content/refs.ts';
import type { DerivedFeatureChoice } from '../../engine/derive/types.ts';
import { ABILITY_NAMES, type Ability } from '../../schema/index.ts';
import { nameOf } from '../sheet/sheetBindings.ts';

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
    case 'spell': {
      const slot = c.offer.key.slot;
      if (slot.startsWith('cantrips.')) return 'Cantrips';
      if (slot.startsWith('spellbook.')) return 'Spellbook';
      return c.count === 1 ? 'Spell' : 'Spells';
    }
    case 'weaponMastery':
      return 'Weapon Mastery';
    case 'equipment':
      return 'Starting equipment';
    case 'option':
      return c.offer.key.owner.kind === 'species' && c.offer.key.slot === 'size'
        ? 'Size'
        : 'Option';
    default:
      return 'Chosen';
  }
}

/** The picks, readable. */
export function choiceValues(c: DerivedFeatureChoice, index: ContentIndex): string[] {
  if (c.offer.kind === 'backgroundAbility') return c.values.length ? [spreadLabel(c.values)] : [];
  return c.values.map((v, i) => {
    if (c.offer.kind === 'ability' || c.offer.kind === 'spellAbility')
      return ABILITY_NAMES[v as Ability] ?? v;
    const kind = valueKind(c.valueKinds, i);
    if (kind) return nameOf(index, kind, v);
    if (c.offer.kind === 'option') return optionLabel(c.offer, v);
    const label = c.labels[i];
    return label && label !== v ? label : readable(v);
  });
}
