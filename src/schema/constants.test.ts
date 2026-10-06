import { describe, expect, it } from 'vitest';
import { SKILLS, SKILL_ABILITY, abilityModifier, proficiencyBonus } from './constants.ts';

describe('constants', () => {
  it('computes proficiency bonus by level and clamps out-of-range levels', () => {
    expect([1, 4, 5, 8, 9, 12, 13, 16, 17, 20].map(proficiencyBonus)).toEqual([
      2, 2, 3, 3, 4, 4, 5, 5, 6, 6,
    ]);
    expect(proficiencyBonus(0)).toBe(2);
    expect(proficiencyBonus(25)).toBe(6);
  });

  it('computes ability modifiers', () => {
    expect([1, 8, 9, 10, 11, 12, 15, 20, 30].map(abilityModifier)).toEqual([
      -5, -1, -1, 0, 0, 1, 2, 5, 10,
    ]);
  });

  it('maps all 18 skills to an ability', () => {
    expect(SKILLS).toHaveLength(18);
    expect(SKILL_ABILITY.stealth).toBe('dex');
  });
});
