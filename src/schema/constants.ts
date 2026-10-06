import type { Ability, MoveMode, Skill } from './common.ts';

export const ABILITIES: readonly Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export const ABILITY_NAMES: Readonly<Record<Ability, string>> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
};

export const SKILL_ABILITY: Readonly<Record<Skill, Ability>> = {
  acrobatics: 'dex',
  'animal handling': 'wis',
  arcana: 'int',
  athletics: 'str',
  deception: 'cha',
  history: 'int',
  insight: 'wis',
  intimidation: 'cha',
  investigation: 'int',
  medicine: 'wis',
  nature: 'int',
  perception: 'wis',
  performance: 'cha',
  persuasion: 'cha',
  religion: 'int',
  'sleight of hand': 'dex',
  stealth: 'dex',
  survival: 'wis',
};

export const SKILLS = Object.keys(SKILL_ABILITY) as Skill[];

/** 5etools spell school codes and the names spells store. */
export const SPELL_SCHOOLS: Readonly<Record<string, string>> = {
  A: 'abjuration',
  C: 'conjuration',
  D: 'divination',
  E: 'enchantment',
  V: 'evocation',
  I: 'illusion',
  N: 'necromancy',
  T: 'transmutation',
  P: 'psionic',
};

export const MOVE_MODES: readonly MoveMode[] = ['walk', 'fly', 'swim', 'climb', 'burrow'];

/** Proficiency bonus by character level (index 0 = level 1). */
export const PROFICIENCY_BY_LEVEL: readonly number[] = [
  2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6,
];

export const MAX_LEVEL = 20;

export function proficiencyBonus(level: number): number {
  const clamped = Math.min(Math.max(Math.trunc(level), 1), MAX_LEVEL);
  return PROFICIENCY_BY_LEVEL[clamped - 1] ?? 2;
}

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}
