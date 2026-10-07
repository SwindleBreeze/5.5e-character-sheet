import { describe, expect, it } from 'vitest';
import { damageRoll } from './damage.ts';

describe('damageRoll', () => {
  it('joins dice and the bonus', () => {
    expect(damageRoll(['1d12'], 2)).toBe('1d12 + 2');
    expect(damageRoll(['1d4', '1d6'], -1)).toBe('1d4 + 1d6 - 1');
    expect(damageRoll(['', '2'], 3)).toBe('5');
  });

  it('a flat amount with no dice (Unarmed Strike)', () => {
    expect(damageRoll([''], 3)).toBe('3');
    expect(damageRoll([], 0)).toBe('0');
  });

  it('a Critical Hit doubles every die, not the modifiers', () => {
    expect(damageRoll(['1d12', '1d6'], 2, true)).toBe('2d12 + 2d6 + 2');
    expect(damageRoll(['2d6 + 1'], 3, true)).toBe('4d6 + 4');
    expect(damageRoll([''], 3, true)).toBe('3');
  });
});
