import { describe, expect, it } from 'vitest';
import { averageOf, dice, formatValue, largestFaces, type Value } from './dice.ts';
import { cellToValue, evaluateFormula, evaluateNumber, mapScope } from './evaluate.ts';
import { FormulaError, formulaRefs, parseFormula } from './parse.ts';

const scope = mapScope({
  pb: 3,
  level: 7,
  'level.rogue': 5,
  'level.fighter': 2,
  'mod.wis': 2,
  'mod.cha': -1,
  'score.str': 16,
  'table.second-wind': 3,
  'table.sneak-attack': dice(3, 6),
  'table.bravado-2': 4,
  'table.fighter.weapon-mastery': 3,
  'choice.element': 0,
});

const ev = (f: string | number): Value => evaluateFormula(f, scope);

describe('formula: numbers and refs', () => {
  it.each([
    [7, 7],
    ['7', 7],
    ['1 + 2 * 3', 7],
    ['(1 + 2) * 3', 9],
    ['10 - 4 - 3', 3],
    ['8 / 4 / 2', 1],
    ['7 / 2', 3.5],
    ['-pb', -3],
    ['- - 2', 2],
    ['+4', 4],
    ['pb', 3],
    ['PB + 1', 4],
    ['8 + pb + mod.wis', 13],
    ['mod.cha', -1],
    ['level', 7],
    ['level.rogue', 5],
    ['score.str', 16],
    ['table.second-wind', 3],
    ['table.second-wind - 1', 2],
    ['table.bravado-2', 4],
    ['table.fighter.weapon-mastery', 3],
    ['0.5 * level', 3.5],
  ])('%s = %s', (f, expected) => {
    expect(ev(f)).toBe(expected);
  });
});

describe('formula: functions', () => {
  it.each([
    ['max(1, mod.cha)', 1],
    ['max(1, mod.wis)', 2],
    ['min(pb, 2)', 2],
    ['max(1, 2, 5, 3)', 5],
    ['floor(level.rogue / 2)', 2],
    ['ceil(level.rogue / 2)', 3],
    ['floor(7 / 2) + ceil(7 / 2)', 7],
    ['steps(level, 1, 2, 5, 3, 11, 4)', 3],
    ['steps(level.fighter, 1, 2, 5, 3)', 2],
    ['steps(0, 1, 2)', 0],
    ['steps(20, 1, 2, 5, 3, 11, 4)', 4],
  ])('%s = %s', (f, expected) => {
    expect(ev(f)).toBe(expected);
  });
});

describe('formula: dice', () => {
  it('reads dice literals', () => {
    expect(ev('2d6')).toEqual(dice(2, 6));
    expect(ev('d8')).toEqual(dice(1, 8));
    expect(ev('1d10 + level.fighter')).toEqual(dice(1, 10, 2));
    expect(ev('1d8 + 1d6 + 1d8 - 1')).toEqual({
      terms: [
        { count: 2, faces: 8 },
        { count: 1, faces: 6 },
      ],
      flat: -1,
    });
  });

  it('dice from tables and from counts', () => {
    expect(ev('table.sneak-attack')).toEqual(dice(3, 6));
    expect(ev('table.sneak-attack + mod.wis')).toEqual(dice(3, 6, 2));
    expect(ev('dice(ceil(level.rogue / 2), 6)')).toEqual(dice(3, 6));
    expect(ev('2 * 1d6')).toEqual(dice(2, 6));
    expect(ev('1d6 * 2')).toEqual(dice(2, 6));
  });

  it('steps can choose dice (Divine Spark 1d8 → 2d8)', () => {
    expect(ev('steps(level, 1, 1d8, 7, 2d8, 13, 3d8)')).toEqual(dice(2, 8));
  });

  it('max of dice compares their averages', () => {
    expect(ev('max(1d6, 1d8)')).toEqual(dice(1, 8));
    expect(ev('min(1d6, 1d8)')).toEqual(dice(1, 6));
  });

  it('averages, largest die and display', () => {
    expect(averageOf(dice(2, 6, 1))).toBe(8);
    expect(evaluateNumber('1d8 + 2', scope)).toBe(6.5);
    expect(largestFaces(dice(1, 6))).toBe(6);
    expect(largestFaces(4)).toBe(0);
    expect(formatValue(ev('1d8 + 1d6 + 3'))).toBe('1d8 + 1d6 + 3');
    expect(formatValue(ev('2d6 - 1'))).toBe('2d6 - 1');
    expect(formatValue(ev('-1d4'))).toBe('-1d4');
    expect(formatValue(-2)).toBe('-2');
    expect(formatValue({ terms: [], flat: 0 })).toBe('0');
  });
});

describe('formula: errors', () => {
  it.each([
    ['1 +', 'Unexpected end'],
    ['(1 + 2', 'Expected ")"'],
    ['1 2', 'Unexpected text'],
    ['2 $ 3', 'Unexpected "$"'],
    ['nope', 'Unknown value "nope"'],
    ['table.missing', 'Unknown value "table.missing"'],
    ['frob(1)', 'Unknown function "frob"'],
    ['1d6 * 1d6', 'Dice times dice'],
    ['1d6 / 2', 'Division needs a number'],
    ['4 / 0', 'Division by zero'],
    ['floor(1d6)', 'floor needs a number'],
    ['steps(1, 2)', 'steps needs x and level/value pairs'],
    ['dice(2)', 'dice needs a count and faces'],
  ])('%s → %s', (f, message) => {
    expect(() => ev(f)).toThrow(FormulaError);
    expect(() => ev(f)).toThrow(message);
  });

  it('caches parses, including failures', () => {
    expect(parseFormula('pb + 1')).toBe(parseFormula('pb + 1'));
    expect(() => parseFormula('1 +')).toThrow(FormulaError);
    expect(() => parseFormula('1 +')).toThrow(FormulaError);
  });
});

describe('formula helpers', () => {
  it('lists the refs a formula reads', () => {
    expect(formulaRefs('max(1, mod.wis) + table.second-wind - pb')).toEqual([
      'mod.wis',
      'table.second-wind',
      'pb',
    ]);
  });

  it.each([
    [3, 3],
    ['3', 3],
    ['1d6', dice(1, 6)],
    [
      '2d6+1d4',
      {
        terms: [
          { count: 2, faces: 6 },
          { count: 1, faces: 4 },
        ],
        flat: 0,
      },
    ],
    ['1d8 + 2', dice(1, 8, 2)],
    ['{@dice D6}', dice(1, 6)],
    ['+10 ft.', 10],
    ['1st', 1],
    ['5th', 5],
    ['—', 0],
    ['', 0],
    [undefined, 0],
  ])('table cell %s', (cell, expected) => {
    expect(cellToValue(cell)).toEqual(expected);
  });
});
