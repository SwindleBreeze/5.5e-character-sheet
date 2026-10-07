import { beforeAll, describe, expect, it } from 'vitest';
import type { Character } from '../../schema/index.ts';
import { testCharacter } from '../../test/characters.ts';
import { FIXTURE_FEATURE_EFFECTS } from '../../test/fixtureFeatureEffects.ts';
import { fixtureIndex } from '../../test/fixtureIndex.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import { derive } from '../derive/derive.ts';
import {
  attentionCount,
  attentionItems,
  removeRecord,
  setIgnored,
  updateToReprint,
} from './attention.ts';

let index: ContentIndex;
beforeAll(async () => {
  index = await fixtureIndex();
});

const without = (...ids: string[]): ContentIndex => ({
  get: (ref) => (ids.includes(ref.id) ? undefined : index.get(ref)),
  all: () => index.all().filter((e) => !ids.includes(e.id)),
});

const boon = { kind: 'reward', id: 'boon of applause|old' } as const;
const blessing = { kind: 'reward', id: 'blessing of the crowd|tst' } as const;

/** Brute 1 with the Boon of Applause (an old printing), from a snapshot naming its reprint. */
function withBoon(): Character {
  const c = testCharacter({ classes: [{ classId: 'brute|tst', levels: 1 }] });
  c.log[0]!.choices.push({
    key: { owner: boon, slot: 'granted' },
    values: [],
    labels: ['Boon of Applause'],
    madeAt: 0,
    via: 'manual',
  });
  c.snapshots['reward:boon of applause|old'] = {
    ref: boon,
    name: 'Boon of Applause',
    entries: [],
    effects: [],
    supersededBy: [blessing.id],
    capturedAt: 0,
  };
  c.state.resourcesUsed['reward:boon of applause|old#uses'] = 1;
  return c;
}

const itemsOf = (c: Character, idx = index) =>
  attentionItems(derive(c, idx, { registry: FIXTURE_FEATURE_EFFECTS }), c, idx);

describe('needs attention', () => {
  it('lists choices to make and broken rules, with stable keys', () => {
    const c = testCharacter({ classes: [{ classId: 'brute|tst', levels: 1 }] });
    const items = itemsOf(c);
    expect(items.map((i) => i.key)).toContain('pending:class:brute|tst#skills');
    expect(items.every((i) => i.pending || i.record || i.issue || i.reprint)).toBe(true);
  });

  it('a gift that isn’t loaded, with a loaded reprint, can be updated to it', () => {
    const c = withBoon();
    const item = itemsOf(c, without(boon.id)).find((i) => i.reprint);
    expect(item).toMatchObject({
      key: 'reprint:reward:boon of applause|old',
      reprint: { from: boon, to: blessing, name: 'Blessing of the Crowd' },
    });
    const n = updateToReprint(c, boon, blessing);
    expect(n.log[0]!.choices[0]!.key.owner).toEqual(blessing);
    expect(n.state.resourcesUsed).toEqual({ 'reward:blessing of the crowd|tst#uses': 1 });
    expect(itemsOf(n, without(boon.id)).some((i) => i.reprint)).toBe(false);
  });

  it('updating to a reprint changes every place the character names it', () => {
    const c = testCharacter({
      classes: [{ classId: 'brute|tst', levels: 1 }],
      speciesId: 'mossling|tst',
      backgroundId: 'arena hand|tst',
      choices: [
        { owner: { kind: 'species', id: 'mossling|tst' }, slot: 'size', values: ['M'] },
        {
          owner: { kind: 'class', id: 'brute|tst' },
          slot: 'x',
          values: ['mossling|tst'],
          valueKinds: ['species'],
        },
      ],
    });
    const to = { kind: 'species', id: 'mossling|new' } as const;
    const n = updateToReprint(c, { kind: 'species', id: 'mossling|tst' }, to);
    expect(n.log[0]!.origin?.speciesRef).toEqual(to);
    expect(n.log[0]!.choices.map((r) => [r.key.owner.id, r.values])).toEqual([
      ['mossling|new', ['M']],
      ['brute|tst', ['mossling|new']],
    ]);
  });

  it('ignored items stop counting until they change; a pick can be removed', () => {
    const c = testCharacter({ classes: [{ classId: 'brute|tst', levels: 1 }] });
    const items = itemsOf(c);
    const n = attentionCount(items, c);
    expect(n).toBeGreaterThan(0);
    const ignoring = setIgnored(c, items[0]!.key, true);
    expect(attentionCount(items, ignoring)).toBe(n - 1);
    expect(setIgnored(ignoring, items[0]!.key, false).ui).toEqual({});

    const picked = testCharacter({
      classes: [{ classId: 'brute|tst', levels: 1 }],
      choices: [{ owner: { kind: 'class', id: 'brute|tst' }, slot: 'gone', values: ['x'] }],
    });
    const stale = itemsOf(picked).find((i) => i.record?.status === 'slotMissing');
    expect(stale?.key).toBe('record:class:brute|tst#gone:slotMissing');
    expect(removeRecord(picked, 'class:brute|tst#gone').log[0]!.choices).toEqual([]);
  });
});
