// Seeded random numbers for repeatable dice tests (mulberry32).

import type { Rng } from '../engine/dice/roll.ts';

export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Returns the given values in turn (each in [0, 1)), then repeats the last. */
export function fixedRng(values: number[]): Rng {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)] ?? 0;
}

/** The [0, 1) value that makes a die of `faces` land on `result`. */
export function face(result: number, faces: number): number {
  return (result - 0.5) / faces;
}
