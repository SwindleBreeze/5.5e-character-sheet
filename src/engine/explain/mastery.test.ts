import { describe, expect, it } from 'vitest';
import { masteryHasSave, masterySaveNote, masteryWhen } from './mastery.ts';

describe('weapon mastery explanations', () => {
  it('says when each 2024 mastery applies; others are left to their text', () => {
    expect(masteryWhen('Slow')).toBe('On a hit that deals damage, if you choose');
    expect(masteryWhen('Graze')).toBe('When the attack misses; automatic');
    expect(masteryWhen('Vex')).toBe('On a hit that deals damage; automatic');
    expect(masteryWhen('Snare')).toBeUndefined();
  });

  it('a mastery that asks for a save says the target rolls it, against your DC', () => {
    const topple =
      'If you hit a creature with this weapon, you can force the creature to make a Constitution saving throw ({@dc 8} plus the ability modifier used to make the attack roll and your {@variantrule Proficiency|XPHB|Proficiency Bonus}).';
    expect(masteryHasSave(topple)).toBe(true);
    expect(masteryHasSave('If you hit a creature with this weapon, you can push it.')).toBe(false);
    expect(masterySaveNote(13)).toBe(
      'Your DC is 13 (8 + the attack’s ability modifier + your Proficiency Bonus). The target rolls the save, not you: if its total is lower than the DC, the effect happens.',
    );
    expect(masterySaveNote()).toMatch(/^The DC \(Difficulty Class\) is 8 \+/);
  });
});
