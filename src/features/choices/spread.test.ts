import { describe, expect, it } from 'vitest';
import { spreadComplete, toggleSpread } from './spread.ts';

describe('free ability increases', () => {
  it('builds +2/+1 and +1/+1/+1, keeping the shape valid', () => {
    let v = toggleSpread([], 'str', 2);
    expect(v).toEqual(['str', 'str']);
    v = toggleSpread(v, 'dex', 1);
    expect(v).toEqual(['str', 'str', 'dex']);
    expect(spreadComplete(v)).toBe(true);
    // Another +1 beside the +2 replaces the first.
    expect(toggleSpread(v, 'wis', 1)).toEqual(['str', 'str', 'wis']);
    // A +2 elsewhere moves it.
    expect(toggleSpread(v, 'con', 2)).toEqual(['dex', 'con', 'con']);
    // Tapping what is there takes it off.
    expect(toggleSpread(v, 'str', 2)).toEqual(['dex']);
  });

  it('three +1s; a fourth replaces the earliest; a +2 keeps one of them', () => {
    let v = toggleSpread(toggleSpread(toggleSpread([], 'str', 1), 'dex', 1), 'con', 1);
    expect(v).toEqual(['str', 'dex', 'con']);
    expect(spreadComplete(v)).toBe(true);
    expect(toggleSpread(v, 'cha', 1)).toEqual(['dex', 'con', 'cha']);
    v = toggleSpread(v, 'wis', 2);
    expect(v).toEqual(['con', 'wis', 'wis']);
    // A +2 turned into a +1.
    expect(toggleSpread(['str', 'str', 'dex'], 'str', 1)).toEqual(['str', 'dex']);
  });

  it('only +2/+1 and three +1s are complete', () => {
    expect(spreadComplete(['str'])).toBe(false);
    expect(spreadComplete(['str', 'str'])).toBe(false);
    expect(spreadComplete(['str', 'dex'])).toBe(false);
  });
});
