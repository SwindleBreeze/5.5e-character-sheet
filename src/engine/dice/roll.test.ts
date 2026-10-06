import { describe, expect, it } from 'vitest';
import { dice } from '../formula/dice.ts';
import { face, fixedRng, seededRng } from '../../test/rng.ts';
import { cryptoRng, formatRoll, parseRoll, roll, rollExprOf, RollError } from './roll.ts';

describe('parseRoll', () => {
  it.each([
    ['d20', { terms: [{ sign: 1, count: 1, faces: 20 }], flat: 0 }],
    ['2d6+3', { terms: [{ sign: 1, count: 2, faces: 6 }], flat: 3 }],
    [
      '1d8 + 1d6 - 1',
      {
        terms: [
          { sign: 1, count: 1, faces: 8 },
          { sign: 1, count: 1, faces: 6 },
        ],
        flat: -1,
      },
    ],
    ['4d6kh3', { terms: [{ sign: 1, count: 4, faces: 6, keep: { mode: 'h', n: 3 } }], flat: 0 }],
    ['2d20KL1', { terms: [{ sign: 1, count: 2, faces: 20, keep: { mode: 'l', n: 1 } }], flat: 0 }],
    ['5', { terms: [], flat: 5 }],
    ['-1d4', { terms: [{ sign: -1, count: 1, faces: 4 }], flat: 0 }],
  ])('%s', (text, expected) => {
    expect(parseRoll(text)).toEqual(expected);
    expect(parseRoll(formatRoll(parseRoll(text)))).toEqual(expected);
  });

  it.each(['', 'abc', '2d6 3', '0d6', '1d0', '200d6', '2d6kh3', '1d6 +'])(
    'refuses "%s"',
    (text) => {
      expect(() => parseRoll(text)).toThrow(RollError);
    },
  );
});

describe('roll', () => {
  it('adds dice and the flat bonus', () => {
    const r = roll('2d6+3', fixedRng([face(4, 6), face(6, 6)]));
    expect(r.terms[0]?.rolls).toEqual([4, 6]);
    expect(r.total).toBe(13);
  });

  it('keeps the highest or lowest', () => {
    const rng = fixedRng([face(1, 6), face(5, 6), face(3, 6), face(6, 6)]);
    const r = roll('4d6kh3', rng);
    expect(r.terms[0]?.kept).toEqual([1, 2, 3]);
    expect(r.total).toBe(14);
  });

  it('advantage and disadvantage on a lone d20, with the natural roll', () => {
    const rng = () => fixedRng([face(3, 20), face(17, 20)]);
    expect(roll('1d20+5', rng(), 'advantage')).toMatchObject({ total: 22, natural: 17 });
    expect(roll('1d20+5', rng(), 'disadvantage')).toMatchObject({ total: 8, natural: 3 });
    expect(roll('1d20+5', rng())).toMatchObject({ total: 8, natural: 3 });
    // Not a lone d20: no advantage, no natural.
    expect(roll('2d6', fixedRng([0, 0]), 'advantage').natural).toBeUndefined();
  });

  it('subtracts negative terms', () => {
    expect(roll('1d8 - 1d4', fixedRng([face(8, 8), face(3, 4)])).total).toBe(5);
  });

  it('is uniform enough over many seeded rolls', () => {
    const rng = seededRng(42);
    const counts = new Array<number>(7).fill(0);
    for (let i = 0; i < 6000; i++) counts[roll('1d6', rng).total]!++;
    for (let f = 1; f <= 6; f++) expect(counts[f]).toBeGreaterThan(850);
    expect(counts[0]).toBe(0);
  });

  it('the crypto source stays in range', () => {
    for (let i = 0; i < 200; i++) {
      const total = roll('1d20', cryptoRng).total;
      expect(total).toBeGreaterThanOrEqual(1);
      expect(total).toBeLessThanOrEqual(20);
    }
  });

  it('rolls a formula dice value', () => {
    expect(formatRoll(rollExprOf(dice(3, 6, 2)))).toBe('3d6 + 2');
    expect(rollExprOf(4)).toEqual({ terms: [], flat: 4 });
  });
});
