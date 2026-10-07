import { beforeAll, describe, expect, it } from 'vitest';
import { refKey, type Character, type Ref } from '../../schema/index.ts';
import { testCharacter } from '../../test/characters.ts';
import { FIXTURE_FEATURE_EFFECTS } from '../../test/fixtureFeatureEffects.ts';
import { fixtureIndex } from '../../test/fixtureIndex.ts';
import { derive } from '../derive/derive.ts';
import type { ContentIndex } from './contentIndex.ts';
import { refreshSnapshots, usedRefs } from './snapshots.ts';

let index: ContentIndex;
beforeAll(async () => {
  index = await fixtureIndex();
});

/** The fixture content, less some entities (content that isn't imported). */
const without = (...ids: string[]): ContentIndex => ({
  get: (ref) => (ids.includes(ref.id) ? undefined : index.get(ref)),
  all: () => index.all().filter((e) => !ids.includes(e.id)),
});

const refresh = (c: Character, idx = index, now = 5) =>
  refreshSnapshots(c, idx, derive(c, idx, { registry: FIXTURE_FEATURE_EFFECTS }), now);

const brute = () =>
  testCharacter({
    classes: [{ classId: 'brute|tst', levels: 2 }],
    speciesId: 'mossling|tst',
    backgroundId: 'arena hand|tst',
    inventory: [{ itemRef: { kind: 'item', id: 'net blade|tst' } }],
  });

const key = (kind: Ref['kind'], id: string) => refKey({ kind, id });

describe('snapshots', () => {
  it('copies name, text and effects of everything the character uses', () => {
    const c = refresh(brute());
    expect(c.snapshots[key('classFeature', 'fury|brute|tst|1|tst')]).toMatchObject({
      name: 'Fury',
      capturedAt: 5,
    });
    // The content's own effects (hand-mapped ones come from the app, not the snapshot).
    expect(c.snapshots[key('species', 'mossling|tst')]?.effects).toEqual(
      index.get({ kind: 'species', id: 'mossling|tst' })?.effects,
    );
    for (const k of [
      key('class', 'brute|tst'),
      key('species', 'mossling|tst'),
      key('background', 'arena hand|tst'),
      key('item', 'net blade|tst'),
      key('classFeature', 'catch breath|brute|tst|2|tst'),
    ]) {
      expect(c.snapshots[k], k).toBeDefined();
    }
    // Features of levels not reached yet aren't the character's.
    expect(c.snapshots[key('classFeature', 'extra attack|brute|tst|5|tst')]).toBeUndefined();
  });

  it('writes nothing when nothing changed; a changed entity is taken again', () => {
    const c = refresh(brute());
    expect(refresh(c, index, 9)).toBe(c);
    const changed: ContentIndex = {
      get: (ref) => {
        const e = index.get(ref);
        return e && ref.id === 'fury|brute|tst|1|tst' ? { ...e, name: 'Fury (errata)' } : e;
      },
      all: index.all,
    };
    const again = refresh(c, changed, 9);
    expect(again.snapshots[key('classFeature', 'fury|brute|tst|1|tst')]).toMatchObject({
      name: 'Fury (errata)',
      capturedAt: 9,
    });
    // The others keep their capture time.
    expect(again.snapshots[key('class', 'brute|tst')]?.capturedAt).toBe(5);
  });

  it('keeps the snapshot of content that is no longer loaded, and all others meanwhile', () => {
    const c = refresh(brute());
    c.inventory = [];
    // The species is gone: nothing is dropped while content is missing.
    const missing = refresh(c, without('mossling|tst'), 9);
    expect(missing.snapshots[key('species', 'mossling|tst')]?.capturedAt).toBe(5);
    expect(missing.snapshots[key('item', 'net blade|tst')]).toBeDefined();
    // With everything loaded, what isn't used any more goes.
    expect(refresh(c, index, 9).snapshots[key('item', 'net blade|tst')]).toBeUndefined();
  });

  it('a pick names what it picked', () => {
    const c = testCharacter({
      classes: [{ classId: 'brute|tst', levels: 4 }],
      choices: [
        {
          owner: { kind: 'classFeature', id: 'ability score improvement|brute|tst|4|tst' },
          slot: 'feat',
          values: ['arena veteran|tst'],
          valueKinds: ['feat'],
          atLevel: 4,
        },
      ],
    });
    const refs = usedRefs(c, derive(c, index, { registry: FIXTURE_FEATURE_EFFECTS })).map(refKey);
    expect(refs).toContain(key('feat', 'arena veteran|tst'));
  });
});
