import { describe, expect, it } from 'vitest';
import { maxInWords } from './maxInWords.ts';

describe('a counter’s maximum in words', () => {
  it('names what the number is', () => {
    expect(maxInWords('pb')).toBe('your Proficiency Bonus');
    expect(maxInWords('max(1, mod.wis)')).toBe('your Wisdom modifier (at least 1)');
    expect(maxInWords('2 * pb')).toBe('twice your Proficiency Bonus');
    expect(maxInWords('5 * level.paladin')).toBe('5 × your Paladin level');
    expect(maxInWords('1 + level.warlock')).toBe('your Warlock level + 1');
    expect(maxInWords('table.rages')).toBe('the Rages column of your class table');
    expect(maxInWords('table.bard.bardic-die')).toBe('the Bardic Die column of your class table');
    expect(maxInWords('steps(level.wizard, 2, 2, 14, 3)')).toBe('goes up with your Wizard level');
  });

  it('a plain number, or a shape it doesn’t know, needs no words', () => {
    expect(maxInWords(2)).toBeUndefined();
    expect(maxInWords('3')).toBeUndefined();
    expect(maxInWords('mod.str * mod.dex')).toBeUndefined();
  });
});
