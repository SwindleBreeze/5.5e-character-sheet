import { describe, expect, it } from 'vitest';
import { isPotion, potionHealing } from './potions.ts';

describe('potions', () => {
  it('a potion is marked at import, or named one in older content', () => {
    expect(isPotion({ name: 'Sparkle Draught', consumable: 'potion' })).toBe(true);
    expect(isPotion({ name: 'Potion of Mending' })).toBe(true);
    expect(isPotion({ name: 'Potions of Mending' })).toBe(true);
    expect(isPotion({ name: 'Rope' })).toBe(false);
  });

  it('what drinking one heals: the dice its text gives for regaining Hit Points', () => {
    expect(
      potionHealing({ entries: ['You regain {@dice 2d4 + 2} Hit Points when you drink it.'] }),
    ).toBe('2d4 + 2');
    expect(potionHealing({ entries: ['You can fly for {@dice 1d4} hours.'] })).toBeUndefined();
    expect(potionHealing({ entries: [{ type: 'list', items: ['x'] }] })).toBeUndefined();
  });
});
