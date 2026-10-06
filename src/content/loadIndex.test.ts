import { beforeEach, describe, expect, it } from 'vitest';
import { createContentRepo } from '../db/contentRepo.ts';
import { resetDb, type AppDb } from '../db/db.ts';
import { characterRefs } from '../engine/content/refs.ts';
import { refName, resolveRef } from '../engine/content/resolve.ts';
import { refKey, type Ref } from '../schema/index.ts';
import { testCharacter } from '../test/characters.ts';
import { seedFixtureContent } from '../test/seedContent.ts';
import { loadContentIndex, type GetMany } from './loadIndex.ts';

let db: AppDb;

beforeEach(async () => {
  db = await resetDb('test-load-index');
  await seedFixtureContent();
});

const asi4 = { kind: 'classFeature', id: 'ability score improvement|brute|tst|4|tst' } as const;

function brute(levels: number) {
  return testCharacter({
    classes: [{ classId: 'brute|tst', levels, subclassId: 'spark|brute|tst|tst' }],
    speciesId: 'mossling|tst',
    backgroundId: 'arena hand|tst',
    choices:
      levels >= 4
        ? [
            {
              owner: asi4,
              slot: 'feat',
              values: ['arena veteran|tst'],
              valueKinds: ['feat'],
              atLevel: 4,
            },
          ]
        : [],
    inventory: [{ itemRef: { kind: 'item', id: 'net blade|tst' }, equipped: 'mainHand' }],
  });
}

function counting(): { getMany: GetMany; calls: Ref[][] } {
  const repo = createContentRepo(db);
  const calls: Ref[][] = [];
  return {
    calls,
    getMany: (refs) => {
      calls.push(refs);
      return repo.getMany(refs);
    },
  };
}

describe('loadContentIndex', () => {
  it('loads a character’s content and what it leads to, in a few round trips', async () => {
    const { getMany, calls } = counting();
    const index = await loadContentIndex(brute(20), getMany);

    // The build, its features (all levels), the background's origin feat, picked feats, items.
    expect(index.get({ kind: 'class', id: 'brute|tst' })?.name).toBe('Brute');
    expect(index.get({ kind: 'classFeature', id: 'swift feet|brute|tst|5|tst' })).toBeDefined();
    expect(
      index.get({ kind: 'subclassFeature', id: 'path of the spark|brute|tst|spark|tst|3|tst' }),
    ).toBeDefined();
    // A feature written inside another feature's text.
    expect(
      index.get({ kind: 'subclassFeature', id: 'static charge|brute|tst|spark|tst|3|tst' }),
    ).toBeDefined();
    expect(index.get({ kind: 'feat', id: 'spark initiate; gladiator|tst' })).toBeDefined();
    expect(index.get({ kind: 'feat', id: 'arena veteran|tst' })).toBeDefined();
    expect(index.get({ kind: 'item', id: 'net blade|tst' })).toBeDefined();
    expect(index.get({ kind: 'rule', id: 'mastery/snare|tst' })).toBeDefined();
    // Spells named in the species' grants.
    expect(index.get({ kind: 'spell', id: 'glitter burst|tst' })).toBeDefined();

    expect(calls.length).toBeLessThanOrEqual(3);
    // No ref is asked for twice.
    const asked = calls.flat().map(refKey);
    expect(new Set(asked).size).toBe(asked.length);
  });

  it('leaves missing content out, and the character’s snapshot stands in', async () => {
    const character = brute(1);
    const ghost = { kind: 'feat', id: 'vanished feat|gone' } as const;
    character.log[0]!.choices.push({
      key: { owner: ghost, slot: 'skills' },
      values: ['stealth'],
      labels: ['Stealth'],
      madeAt: 0,
      via: 'creation',
    });
    character.snapshots[refKey(ghost)] = {
      ref: ghost,
      name: 'Vanished Feat',
      entries: [],
      effects: [{ type: 'proficiency', category: 'skill', value: 'stealth' }],
      capturedAt: 0,
    };
    const index = await loadContentIndex(character, counting().getMany);

    expect(index.get(ghost)).toBeUndefined();
    expect(resolveRef(index, character.snapshots, ghost)).toMatchObject({ status: 'snapshot' });
    expect(refName(index, character.snapshots, ghost)).toBe('Vanished Feat');
    expect(resolveRef(index, {}, ghost)).toEqual({ status: 'missing' });
    expect(refName(index, {}, ghost)).toBe('vanished feat|gone');
    expect(resolveRef(index, {}, { kind: 'class', id: 'brute|tst' }).status).toBe('loaded');
  });

  it('collects refs from the log, picks, inventory and prepared spells', () => {
    const character = brute(4);
    character.state.prepared['lorekeeper|tst'] = ['ink cloud|tst'];
    character.inventory.push({
      uid: 'x',
      name: '+1 Net Blade',
      quantity: 1,
      attuned: false,
      itemRef: { kind: 'item', id: 'net blade|tst' },
      variantRef: { kind: 'item', id: '+1 arena weapon|tst' },
    });
    const keys = characterRefs(character).map(refKey);
    expect(keys).toEqual(
      expect.arrayContaining([
        'class:brute|tst',
        'subclass:spark|brute|tst|tst',
        'species:mossling|tst',
        'background:arena hand|tst',
        'classFeature:ability score improvement|brute|tst|4|tst',
        'feat:arena veteran|tst',
        'item:net blade|tst',
        'item:+1 arena weapon|tst',
        'spell:ink cloud|tst',
      ]),
    );
  });
});
