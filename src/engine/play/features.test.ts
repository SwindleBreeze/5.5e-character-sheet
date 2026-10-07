import { beforeAll, describe, expect, it } from 'vitest';
import { encodeChoiceKey, type Character, type ChoiceKey } from '../../schema/index.ts';
import { testCharacter } from '../../test/characters.ts';
import { fixtureContent } from '../../test/fixtureIndex.ts';
import { FIXTURE_FEATURE_EFFECTS } from '../../test/fixtureFeatureEffects.ts';
import { createCatalog, type Catalog } from '../build/catalog.ts';
import { backgroundSpreads, offerOptions, sameSpread, spreadLabel } from '../choices/options.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import { derive } from '../derive/derive.ts';
import type { ContentEntity } from '../../schema/index.ts';
import { addGift, removeGift, setPick } from './features.ts';

let index: ContentIndex;
let catalog: Catalog;
beforeAll(async () => {
  const content = await fixtureContent();
  index = content.index;
  catalog = createCatalog(
    Object.values(content.entities).flat() as ContentEntity[],
    new Set(['TST']),
  );
});

const asi = { kind: 'classFeature', id: 'ability score improvement|brute|tst|4|tst' } as const;
const veteran = { kind: 'feat', id: 'arena veteran|tst' } as const;
const charm = { kind: 'reward', id: 'charm of embers|tst' } as const;

/** Brute 4 with Arena Veteran (and its picks) at level 4. */
function brute(): Character {
  return testCharacter({
    classes: [{ classId: 'brute|tst', levels: 4 }],
    speciesId: 'mossling|tst',
    backgroundId: 'arena hand|tst',
    choices: [
      { owner: asi, slot: 'feat', values: [veteran.id], valueKinds: ['feat'], atLevel: 4 },
      { owner: veteran, slot: 'ability', values: ['str'], atLevel: 4 },
      { owner: veteran, slot: 'skills', values: ['performance'], atLevel: 4 },
    ],
  });
}

const recordOf = (c: Character, key: ChoiceKey) => {
  const encoded = encodeChoiceKey(key);
  for (const [i, e] of c.log.entries()) {
    const r = e.choices.find((x) => encodeChoiceKey(x.key) === encoded);
    if (r) return { entry: i, record: r };
  }
  return undefined;
};

describe('picks from the Features tab', () => {
  it('a first pick goes in the entry it belongs to, as made on that level', () => {
    const c = setPick(
      brute(),
      { owner: { kind: 'class', id: 'brute|tst' }, slot: 'skills' },
      {
        values: ['athletics', 'survival'],
        labels: ['Athletics', 'Survival'],
        entryIndex: 0,
        now: 5,
      },
    );
    expect(recordOf(c, { owner: { kind: 'class', id: 'brute|tst' }, slot: 'skills' })).toEqual({
      entry: 0,
      record: expect.objectContaining({ values: ['athletics', 'survival'], via: 'creation' }),
    });
    const later = setPick(
      brute(),
      { owner: veteran, slot: 'other' },
      {
        values: ['x'],
        labels: ['x'],
        entryIndex: 3,
      },
    );
    expect(recordOf(later, { owner: veteran, slot: 'other' })?.record.via).toBe('levelUp');
  });

  it('changing a pick is a retrain where the record is, and drops what the old pick owned', () => {
    const c = brute();
    c.state.resourcesUsed[`feat:${veteran.id}#x`] = 1;
    const n = setPick(
      c,
      { owner: asi, slot: 'feat' },
      {
        values: ['spark initiate|tst'],
        labels: ['Spark Initiate'],
        valueKinds: ['feat'],
        entryIndex: 3,
      },
    );
    expect(recordOf(n, { owner: asi, slot: 'feat' })).toEqual({
      entry: 3,
      record: expect.objectContaining({ values: ['spark initiate|tst'], via: 'retrain' }),
    });
    expect(recordOf(n, { owner: veteran, slot: 'ability' })).toBeUndefined();
    expect(recordOf(n, { owner: veteran, slot: 'skills' })).toBeUndefined();
    expect(n.state.resourcesUsed).toEqual({});
  });

  it('finishing an unfinished pick keeps how it was made', () => {
    const key = { owner: { kind: 'class', id: 'brute|tst' }, slot: 'skills' } as const;
    const one = setPick(brute(), key, {
      values: ['athletics'],
      labels: ['Athletics'],
      entryIndex: 0,
    });
    const two = setPick(one, key, {
      values: ['athletics', 'survival'],
      labels: ['Athletics', 'Survival'],
      entryIndex: 0,
    });
    expect(recordOf(two, key)?.record.via).toBe('creation');
  });

  it('adds a gift once, as a manual record in the top entry, and removes it with its uses', () => {
    const c = addGift(brute(), charm, 'Charm of Embers', 7);
    expect(recordOf(c, { owner: charm, slot: 'granted' })).toEqual({
      entry: 3,
      record: {
        key: { owner: charm, slot: 'granted' },
        values: [],
        labels: ['Charm of Embers'],
        madeAt: 7,
        via: 'manual',
      },
    });
    expect(addGift(c, charm, 'Charm of Embers')).toBe(c);
    const sheet = derive(c, index, { registry: FIXTURE_FEATURE_EFFECTS });
    expect(
      sheet.resources.find((r) => r.key === 'reward:charm of embers|tst#uses')?.max.value,
    ).toBe(3);

    c.state.resourcesUsed['reward:charm of embers|tst#uses'] = 3;
    const gone = removeGift(c, charm);
    expect(recordOf(gone, { owner: charm, slot: 'granted' })).toBeUndefined();
    expect(gone.state.resourcesUsed).toEqual({});
  });
});

describe('choice options', () => {
  it('a background’s increases: +2/+1 to two of its abilities, or +1 to all three', () => {
    const spreads = backgroundSpreads([
      { from: ['str', 'con', 'cha'], weights: [2, 1] },
      { from: ['str', 'con', 'cha'], weights: [1, 1, 1] },
    ]);
    expect(spreads.map(spreadLabel)).toEqual([
      '+2 Strength, +1 Constitution',
      '+2 Strength, +1 Charisma',
      '+2 Constitution, +1 Strength',
      '+2 Constitution, +1 Charisma',
      '+2 Charisma, +1 Strength',
      '+2 Charisma, +1 Constitution',
      '+1 Strength, +1 Constitution, +1 Charisma',
    ]);
    expect(sameSpread(['con', 'str', 'str'], ['str', 'str', 'con'])).toBe(true);
  });

  it('lists every value an offer allows and marks what the character has from elsewhere', () => {
    const c = brute();
    c.baseScores = { ...c.baseScores, str: 13 };
    const sheet = derive(c, index, { registry: FIXTURE_FEATURE_EFFECTS });
    const ctx = { character: c, sheet, catalog, index };
    const skills = sheet.features
      .find((f) => f.name === 'Arena Veteran')!
      .choices.find((x) => x.offer.key.slot === 'skills')!;
    // Arena Hand gives Athletics already; Performance is this pick's own, so not marked.
    expect(offerOptions(skills.offer, ctx, ['performance']).options).toEqual([
      { value: 'athletics', label: 'Athletics', taken: true, group: 'Skills', detail: 'Strength' },
      { value: 'performance', label: 'Performance', group: 'Skills', detail: 'Charisma' },
    ]);
    // Ignore rules: every skill.
    expect(offerOptions(skills.offer, ctx, [], { ignoreRules: true }).options).toHaveLength(18);

    const feat = sheet.features
      .find((f) => f.name === 'Ability Score Improvement')!
      .choices.find((x) => x.offer.key.slot === 'feat')!;
    const feats = offerOptions(feat.offer, ctx, [veteran.id]);
    expect(feats.valueKind).toBe('feat');
    // Level 4, Strength 13: Arena Veteran's prerequisites are met.
    expect(feats.options.find((o) => o.value === veteran.id)).toEqual({
      value: veteran.id,
      label: 'Arena Veteran',
      group: 'General feats',
      detail: 'Prerequisite: Level 4+, Strength 13+ or Charisma 13+',
    });
  });

  it('marks feats whose prerequisites aren’t met; Ignore rules lists every feat', () => {
    const c = brute();
    c.baseScores = { ...c.baseScores, str: 10, cha: 10 };
    const sheet = derive(c, index, { registry: FIXTURE_FEATURE_EFFECTS });
    const ctx = { character: c, sheet, catalog, index };
    const feat = sheet.features
      .find((f) => f.name === 'Ability Score Improvement')!
      .choices.find((x) => x.offer.key.slot === 'feat')!;
    const veteranOption = offerOptions(feat.offer, ctx).options.find((o) => o.value === veteran.id);
    expect(veteranOption?.unmet).toEqual(['Strength 13+ or Charisma 13+']);
    const all = offerOptions(feat.offer, ctx, [], { ignoreRules: true }).options;
    expect(all.map((o) => o.group)).toContain('Origin feats');
  });

  it('a feat given outright counts as had: the same version of a repeatable feat is taken', () => {
    const c = brute();
    const sheet = derive(c, index, { registry: FIXTURE_FEATURE_EFFECTS });
    const ctx = { character: c, sheet, catalog, index };
    const feat = sheet.features
      .find((f) => f.name === 'Ability Score Improvement')!
      .choices.find((x) => x.offer.key.slot === 'feat')!;
    const all = offerOptions(feat.offer, ctx, [], { ignoreRules: true }).options;
    // Arena Hand gives Spark Initiate; Gladiator: repeatable, but with another version.
    expect(all.find((o) => o.value === 'spark initiate; gladiator|tst')?.taken).toBe(true);
    // Arena Veteran, picked by this very choice, stays pickable here.
    expect(
      offerOptions(feat.offer, ctx, [veteran.id]).options.find((o) => o.value === veteran.id)
        ?.taken,
    ).toBeUndefined();
  });
});
