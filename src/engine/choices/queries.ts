// P10: option lists computed from the character (plan §8.2 rule 1): read from the previous
// derived sheet when a choice is shown, never inside derive.

import { ABILITIES, SKILLS, type Id, type Item, type OptionQuery } from '../../schema/index.ts';
import type { Catalog } from '../build/catalog.ts';
import type { DerivedSheet } from '../derive/types.ts';

/** Mundane weapons, the ones weapon mastery and proficiency picks are about. */
export function baseWeapons(catalog: Catalog): Item[] {
  return catalog
    .of('item')
    .filter((i) => i.itemKind === 'weapon' && i.weapon && !i.baseItemId && !i.rarity);
}

/** Proficient by category (`simple`, `martial`) or by the weapon itself. */
export function sheetProficientWith(sheet: DerivedSheet, item: Item): boolean {
  const values = new Set(sheet.proficiencies.weapons.map((w) => w.value));
  return !!item.weapon && (values.has(item.weapon.category) || values.has(item.id));
}

function knownCantrips(sheet: DerivedSheet, catalog: Catalog): Id[] {
  const levels = new Map(catalog.of('spell').map((s) => [s.id, s.level]));
  const ids = [
    ...sheet.spellcasting.casters.flatMap((c) => c.cantrips),
    ...sheet.spellcasting.granted.map((g) => g.spellId).filter((id) => levels.get(id) === 0),
  ];
  return [...new Set(ids)];
}

export function queryOptions(query: OptionQuery, sheet: DerivedSheet, catalog: Catalog): string[] {
  switch (query) {
    case 'proficientSkills':
      return SKILLS.filter(
        (s) => sheet.skills[s].proficiency !== 'none' && sheet.skills[s].proficiency !== 'half',
      );
    case 'proficientSkillsWithoutExpertise':
      return SKILLS.filter((s) => sheet.skills[s].proficiency === 'proficient');
    case 'savesNotProficient':
      return ABILITIES.filter((a) => sheet.saves[a].proficiency === 'none');
    case 'proficientWeapons':
      return baseWeapons(catalog)
        .filter((w) => sheetProficientWith(sheet, w))
        .map((w) => w.id);
    case 'knownCantrips':
      return knownCantrips(sheet, catalog);
    case 'knownDamageCantrips': {
      const damaging = new Set(
        catalog
          .of('spell')
          .filter((s) => s.damageTypes?.length)
          .map((s) => s.id),
      );
      return knownCantrips(sheet, catalog).filter((id) => damaging.has(id));
    }
  }
}
