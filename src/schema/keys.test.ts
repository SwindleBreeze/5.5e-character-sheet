import { describe, expect, it } from 'vitest';
import { decodeChoiceKey, encodeChoiceKey, parseRefKey, refKey } from './keys.ts';
import type { ChoiceKey } from './character.ts';

describe('refKey', () => {
  it('round-trips ids with separators and spaces', () => {
    const ref = { kind: 'species', id: 'elf; high elf lineage|xphb' } as const;
    expect(refKey(ref)).toBe('species:elf; high elf lineage|xphb');
    expect(parseRefKey(refKey(ref))).toEqual(ref);
  });

  it('escapes reserved characters in ids', () => {
    const ref = { kind: 'item', id: 'odd:name#1@50%|test' } as const;
    const key = refKey(ref);
    expect(key).toBe('item:odd%3Aname%231%4050%25|test');
    expect(parseRefKey(key)).toEqual(ref);
  });

  it('rejects unknown kinds', () => {
    expect(() => parseRefKey('monster:goblin|test')).toThrow();
    expect(() => parseRefKey('no-colon')).toThrow();
  });
});

describe('ChoiceKey', () => {
  const cases: [ChoiceKey, string][] = [
    [
      { owner: { kind: 'background', id: 'sage|xphb' }, slot: 'ability' },
      'background:sage|xphb#ability',
    ],
    [
      { owner: { kind: 'species', id: 'elf; high elf lineage|xphb' }, slot: 'spells.0.known.0' },
      'species:elf; high elf lineage|xphb#spells.0.known.0',
    ],
    [
      {
        owner: { kind: 'classFeature', id: 'weapon mastery|fighter|xphb|1|xphb' },
        slot: 'mastery',
      },
      'classFeature:weapon mastery|fighter|xphb|1|xphb#mastery',
    ],
    [
      {
        owner: { kind: 'feat', id: 'magic initiate; wizard|xphb' },
        slot: 'spells.0.known.0',
        n: 2,
      },
      'feat:magic initiate; wizard|xphb#spells.0.known.0@2',
    ],
    [
      {
        owner: { kind: 'feat', id: 'tricky#feat@x|test' },
        slot: 'featProgression.fighting-style.1',
      },
      'feat:tricky%23feat%40x|test#featProgression.fighting-style.1',
    ],
  ];

  it.each(cases)('encodes and decodes %#', (key, encoded) => {
    expect(encodeChoiceKey(key)).toBe(encoded);
    expect(decodeChoiceKey(encoded)).toEqual(key);
  });

  it('rejects slots containing reserved characters', () => {
    const owner = { kind: 'class', id: 'fighter|xphb' } as const;
    expect(() => encodeChoiceKey({ owner, slot: 'a#b' })).toThrow();
    expect(() => encodeChoiceKey({ owner, slot: 'a@b' })).toThrow();
    expect(() => encodeChoiceKey({ owner, slot: '' })).toThrow();
  });

  it('rejects malformed strings', () => {
    expect(() => decodeChoiceKey('class:fighter|xphb')).toThrow();
    expect(() => decodeChoiceKey('class:fighter|xphb#')).toThrow();
    expect(() => decodeChoiceKey('class:fighter|xphb#skills@x')).toThrow();
  });
});
