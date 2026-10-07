// P10: option lists computed from the character (plan §8.2 rule 1): read from the previous
// derived sheet when a choice is shown, never inside derive.

import {
  ABILITIES,
  SKILLS,
  type Id,
  type Item,
  type OptionQuery,
  type WeaponKind,
} from '../../schema/index.ts';
import type { Catalog } from '../build/catalog.ts';
import type { Offer } from '../collect/types.ts';
import { weaponProficient } from '../derive/attacks.ts';
import type { DerivedSheet } from '../derive/types.ts';

/**
 * Mundane weapons, the kinds weapon mastery and proficiency picks are about. Not spellcasting
 * focuses that are also weapons (a Staff is a Quarterstaff), nor weapons a feature makes (a
 * Soulknife's Psychic Blade: no weight or price).
 */
export function baseWeapons(catalog: Catalog): Item[] {
  return catalog
    .of('item')
    .filter(
      (i) =>
        i.itemKind === 'weapon' &&
        i.weapon &&
        !i.baseItemId &&
        !i.rarity &&
        !String(i.variantBase?.type ?? '').startsWith('SCF') &&
        (i.weightLb !== undefined || i.valueCp !== undefined),
    );
}

/**
 * Proficient by category (`simple`, `martial`), by the weapon itself, or by 2024 text (Rogue:
 * Martial weapons that have the Finesse or Light property).
 */
export function sheetProficientWith(sheet: DerivedSheet, item: Item): boolean {
  return weaponProficient(
    item,
    new Set(sheet.proficiencies.weapons.map((w) => w.value.toLowerCase())),
  );
}

/** Whether a weapon is one of these kinds (Barbarian: Simple, or Martial Melee). */
export function isWeaponKind(item: Item, kinds: readonly WeaponKind[]): boolean {
  const w = item.weapon;
  if (!w) return false;
  return kinds.some(
    (k) =>
      (!k.category || k.category === w.category) &&
      (k.melee === undefined || k.melee === !w.ranged),
  );
}

/**
 * The skills an Expertise pick can be: skills the character is proficient in and lacks
 * Expertise in, from the offer's list when it has one (Scholar: Arcana, History…).
 */
export function expertiseOptions(offer: Offer, sheet: DerivedSheet, catalog: Catalog): string[] {
  const proficient = queryOptions('proficientSkillsWithoutExpertise', sheet, catalog);
  if (!Array.isArray(offer.from)) return proficient;
  const filtered = offer.effect?.type === 'expertiseChoice' && offer.effect.filter === 'proficient';
  return filtered ? offer.from.filter((s) => proficient.includes(s)) : offer.from;
}

/**
 * The weapons a Weapon Mastery pick can be: its fixed list, its query, or any mundane weapon
 * (`any`), narrowed to the effect's kinds, and only weapons that have a mastery property.
 * Weapons the character carries come first.
 */
export function weaponMasteryOptions(
  offer: Offer,
  sheet: DerivedSheet,
  catalog: Catalog,
  carried: ReadonlySet<Id> = new Set(),
): Id[] {
  const effect = offer.effect?.type === 'weaponMasteryChoice' ? offer.effect : undefined;
  // Firearms (2024 DMG) are weapons only where the DM brings them in: with Ignore rules.
  const weapons = baseWeapons(catalog).filter(
    (w) =>
      w.weapon?.masteryId &&
      !w.variantBase?.firearm &&
      (!effect?.kinds || isWeaponKind(w, effect.kinds)),
  );
  const allowed = new Set(weapons.map((w) => w.id));
  const ids = Array.isArray(offer.from)
    ? offer.from.filter((id) => allowed.has(id))
    : offer.from === 'any'
      ? [...allowed]
      : queryOptions(offer.from.query, sheet, catalog).filter((id) => allowed.has(id));
  return [...ids.filter((id) => carried.has(id)), ...ids.filter((id) => !carried.has(id))];
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
