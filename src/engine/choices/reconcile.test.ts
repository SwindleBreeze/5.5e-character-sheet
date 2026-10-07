import { beforeAll, describe, expect, it } from 'vitest';
import { refKey, type Character } from '../../schema/index.ts';
import { testCharacter, type TestChoice } from '../../test/characters.ts';
import { fixtureIndex } from '../../test/fixtureIndex.ts';
import { FIXTURE_FEATURE_EFFECTS } from '../../test/fixtureFeatureEffects.ts';
import { collectEffects, GRANTED_SLOT } from '../collect/collect.ts';
import type { Offer } from '../collect/types.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import { reconcile, usableValues, type Reconciliation } from './reconcile.ts';

let index: ContentIndex;

beforeAll(async () => {
  index = await fixtureIndex();
});

const brute = { kind: 'class', id: 'brute|tst' } as const;
const veteran = { kind: 'feat', id: 'arena veteran|tst' } as const;

/** Counts as the engine will evaluate them; table counts are 2 at these levels. */
const countOf = (o: Offer) => (typeof o.count === 'number' ? o.count : 2);

function run(choices: TestChoice[], edit?: (c: Character) => void): Reconciliation {
  const character = testCharacter({
    classes: [{ classId: 'brute|tst', levels: 1 }],
    speciesId: 'mossling|tst',
    backgroundId: 'arena hand|tst',
    choices,
  });
  edit?.(character);
  const collected = collectEffects(character, index, {
    registry: FIXTURE_FEATURE_EFFECTS,
    holds: () => true,
  });
  return reconcile(collected, character, index, countOf);
}

const statusOf = (r: Reconciliation, key: string) => r.byKey.get(key)?.status;

describe('reconcile', () => {
  it('ok: a valid pick for an offered slot', () => {
    const r = run([{ owner: brute, slot: 'skills', values: ['athletics', 'survival'] }]);
    expect(statusOf(r, 'class:brute|tst#skills')).toBe('ok');
    expect(usableValues(r.byKey.get('class:brute|tst#skills'))).toEqual(['athletics', 'survival']);
    expect(r.pending.map((p) => p.offer.key.slot)).not.toContain('skills');
  });

  it('countMismatch: too few picks stay pending, too many are cut to the count', () => {
    const few = run([{ owner: brute, slot: 'skills', values: ['athletics'] }]);
    expect(few.byKey.get('class:brute|tst#skills')).toMatchObject({
      status: 'countMismatch',
      expected: 2,
    });
    expect(few.pending.find((p) => p.offer.key.slot === 'skills')).toMatchObject({
      count: 2,
      have: 1,
    });

    const many = run([
      { owner: brute, slot: 'skills', values: ['athletics', 'survival', 'perception'] },
    ]);
    const r = many.byKey.get('class:brute|tst#skills');
    expect(r?.status).toBe('countMismatch');
    expect(usableValues(r)).toEqual(['athletics', 'survival']);
    expect(many.pending.map((p) => p.offer.key.slot)).not.toContain('skills');
  });

  it('valueInvalid: a value that is not an option is left out', () => {
    const r = run([{ owner: brute, slot: 'skills', values: ['athletics', 'stealth'] }]);
    const rec = r.byKey.get('class:brute|tst#skills');
    expect(rec).toMatchObject({ status: 'valueInvalid', invalid: ['stealth'] });
    expect(usableValues(rec)).toEqual(['athletics']);
  });

  it('valueInvalid: a picked entity that no longer exists', () => {
    const r = run([
      {
        owner: { kind: 'species', id: 'mossling|tst' },
        slot: 'spellsSet',
        values: ['0'],
      },
      {
        owner: { kind: 'feat', id: 'spark initiate; gladiator|tst' },
        slot: 'spells.0.known.0',
        values: ['glitter burst|tst', 'vanished spell|tst'],
        valueKinds: ['spell'],
      },
    ]);
    expect(r.byKey.get('feat:spark initiate; gladiator|tst#spells.0.known.0')).toMatchObject({
      status: 'valueInvalid',
      invalid: ['vanished spell|tst'],
    });
  });

  it('slotMissing: the owner no longer offers the slot', () => {
    const r = run([{ owner: brute, slot: 'tactics', values: ['x'] }]);
    expect(statusOf(r, 'class:brute|tst#tactics')).toBe('slotMissing');
    expect(usableValues(r.byKey.get('class:brute|tst#tactics'))).toEqual([]);
  });

  it('ownerMissing: content gone, picks kept from the record', () => {
    const gone = { kind: 'feat', id: 'gone feat|old' } as const;
    const r = run([{ owner: gone, slot: 'skills', values: ['history'] }], (c) => {
      c.snapshots[refKey(gone)] = {
        ref: gone,
        name: 'Gone Feat',
        entries: [],
        effects: [],
        capturedAt: 0,
      };
    });
    const rec = r.byKey.get('feat:gone feat|old#skills');
    expect(rec?.status).toBe('ownerMissing');
    expect(usableValues(rec)).toEqual(['history']);
  });

  it('aliased: content gone, but its reprint offers the same slot', () => {
    const old = { kind: 'feat', id: 'arena regular|old' } as const;
    const r = run([{ owner: old, slot: 'skills', values: ['athletics'] }], (c) => {
      c.snapshots[refKey(old)] = {
        ref: old,
        name: 'Arena Regular',
        entries: [],
        effects: [],
        supersededBy: [veteran.id],
        capturedAt: 0,
      };
    });
    expect(r.byKey.get('feat:arena regular|old#skills')).toMatchObject({
      status: 'aliased',
      alias: veteran,
    });
  });

  it('a gift granted outright is ok while its content exists', () => {
    const r = run([
      {
        owner: { kind: 'reward', id: 'charm of sparks|tst' },
        slot: GRANTED_SLOT,
        values: [],
        via: 'manual',
      },
      {
        owner: { kind: 'reward', id: 'old charm|old' },
        slot: GRANTED_SLOT,
        values: [],
        via: 'manual',
      },
    ]);
    expect(statusOf(r, 'reward:charm of sparks|tst#granted')).toBe('ok');
    expect(statusOf(r, 'reward:old charm|old#granted')).toBe('ownerMissing');
  });

  it('pending: every offer with a count and no record', () => {
    const r = run([]);
    expect(r.pending.map((p) => [p.offer.key.slot, p.count])).toEqual([
      ['skills', 2],
      ['mastery', 2],
      ['equipment', 1],
      ['size', 1],
      ['spellsSet', 1],
      // 2024: Common and two Standard languages, with the background.
      ['creationLanguages', 2],
      ['tools', 1],
      ['languages', 1],
      ['spells.0.ability', 1],
      ['spells.0.known.0', 2],
      ['ability', 3],
      ['equipment', 1],
    ]);
    // A zero count is not pending.
    const none = reconcile(
      collectEffects(testCharacter({ classes: [{ classId: 'brute|tst', levels: 1 }] }), index, {
        holds: () => true,
      }),
      testCharacter({ classes: [] }),
      index,
      () => 0,
    );
    expect(none.pending).toEqual([]);
  });
});
