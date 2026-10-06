import { describe, expect, it } from 'vitest';
import { assignKeys, cellValue, normalizeKey, parseTableGroups } from './tableKeys.ts';

describe('normalizeKey', () => {
  it.each([
    ['Second Wind', 'second-wind'],
    ['{@filter Cantrips|spells|level=0|class=Wizard}', 'cantrips'],
    ['{@filter Prepared Spells|spells|level=!0}', 'prepared-spells'],
    ['Brávado Points', 'bravado-points'],
    ['  Rage  Damage! ', 'rage-damage'],
    ['Ki/Focus (Points)', 'ki-focus-points'],
    ['{@filter 1st|spells|level=1}', '1st'],
  ])('%s → %s', (label, key) => {
    expect(normalizeKey(label)).toBe(key);
  });
});

describe('assignKeys', () => {
  it('suffixes collisions in order and reports them', () => {
    const renamed: string[] = [];
    expect(assignKeys(['Dice', 'Díce', 'DICE', 'Other'], (k) => renamed.push(k))).toEqual([
      'dice',
      'dice-2',
      'dice-3',
      'other',
    ]);
    expect(renamed).toEqual(['dice-2', 'dice-3']);
  });

  it('gives empty labels a placeholder key', () => {
    expect(assignKeys(['', '!!!'])).toEqual(['column', 'column-2']);
  });

  it('is stable: the same labels always give the same keys', () => {
    const labels = ['A', 'a', 'B'];
    expect(assignKeys(labels)).toEqual(assignKeys([...labels]));
  });
});

describe('cellValue', () => {
  it.each([
    [3, 3],
    ['3', 3],
    ['+2', 2],
    ['—', 0],
    ['', 0],
    ['1d8', '1d8'],
    ['+10 ft.', '+10 ft.'],
    [{ type: 'bonus', value: 2 }, 2],
    [{ type: 'bonusSpeed', value: 10 }, 10],
    [{ type: 'dice', toRoll: [{ number: 2, faces: 6 }] }, '2d6'],
  ])('%j → %j', (raw, value) => {
    expect(cellValue(raw)).toEqual(value);
  });
});

describe('parseTableGroups', () => {
  it('splits columns from the spell slot table', () => {
    const parsed = parseTableGroups([
      { colLabels: ['Rages', 'Rage Damage'], rows: [['2', { type: 'bonus', value: 2 }]] },
      { title: 'Spell Slots per Spell Level', colLabels: ['1st'], rowsSpellProgression: [[2]] },
    ]);
    expect(parsed).toEqual({
      columns: [
        { key: 'rages', label: 'Rages', values: [2] },
        { key: 'rage-damage', label: 'Rage Damage', values: [2] },
      ],
      slotTable: [[2]],
    });
  });
});
