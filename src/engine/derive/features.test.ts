import { beforeAll, describe, expect, it } from 'vitest';
import type { Character } from '../../schema/index.ts';
import { testCharacter, type TestChoice } from '../../test/characters.ts';
import { fixtureIndex } from '../../test/fixtureIndex.ts';
import { FIXTURE_FEATURE_EFFECTS } from '../../test/fixtureFeatureEffects.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import { derive } from './derive.ts';

let index: ContentIndex;
beforeAll(async () => {
  index = await fixtureIndex();
});

const run = (c: Character) => derive(c, index, { registry: FIXTURE_FEATURE_EFFECTS });
const gladiator = { kind: 'class', id: 'gladiator|tst' } as const;

/** Gladiator 4 (School of the Net) with a fighting style, two tricks and Arena Veteran. */
function character(extra: TestChoice[] = []): Character {
  return testCharacter({
    classes: [{ classId: 'gladiator|tst', levels: 4, subclassId: 'net|gladiator|tst|tst' }],
    speciesId: 'mossling|tst',
    backgroundId: 'arena hand|tst',
    choices: [
      { owner: gladiator, slot: 'skills', values: ['athletics', 'performance'] },
      {
        owner: gladiator,
        slot: 'featProgression.arena-style.1',
        values: ['net style|tst'],
        valueKinds: ['feat'],
      },
      {
        owner: gladiator,
        slot: 'optfeat.crowd-tricks.2',
        values: ['taunt|tst', 'encore|tst'],
        valueKinds: ['optionalFeature'],
        atLevel: 2,
      },
      {
        owner: { kind: 'classFeature', id: 'ability score improvement|gladiator|tst|4|tst' },
        slot: 'feat',
        values: ['arena veteran|tst'],
        valueKinds: ['feat'],
        atLevel: 4,
      },
      ...extra,
    ],
  });
}

const named = (c: Character, name: string) => run(c).features.find((f) => f.name === name)!;

describe('derive: features (step 3.20)', () => {
  it('lists what applies by where it comes from, with the level it comes at', () => {
    const d = run(character());
    const groups = d.features.map((f) => `${f.group}: ${f.name}`);
    expect(groups).toEqual(
      expect.arrayContaining([
        'class: Gladiator',
        'class: Showmanship',
        'class: Ability Score Improvement',
        'subclass: School of the Net',
        'subclass: Tangle',
        'species: Mossling',
        'background: Arena Hand',
        'feat: Net Style',
        'feat: Arena Veteran',
        'optionalFeature: Taunt',
        'optionalFeature: Encore',
      ]),
    );
    expect(named(character(), 'Ability Score Improvement').level).toBe(4);
    // Items are on the Inventory tab, not here.
    expect(d.features.some((f) => f.ref.kind === 'item')).toBe(false);
  });

  it('says what brought a feat or an option in, and the progression it belongs to', () => {
    const c = character();
    expect(named(c, 'Arena Veteran').pickedIn?.name).toBe('Ability Score Improvement');
    expect(named(c, 'Net Style').pickedIn).toMatchObject({
      name: 'Gladiator',
      progression: 'Arena Style',
    });
    expect(named(c, 'Taunt').pickedIn?.progression).toBe('Crowd Tricks');
    const tricks = named(c, 'Gladiator').choices.find(
      (x) => x.offer.key.slot === 'optfeat.crowd-tricks.4',
    );
    expect(tricks).toMatchObject({
      count: 1,
      values: [],
      progression: { name: 'Crowd Tricks', level: 4 },
    });
  });

  it('puts a feature written inside another one under it', () => {
    const tangle = named(character(), 'Tangle');
    expect(tangle.parent).toBe('subclassFeature:school of the net|gladiator|tst|net|tst|3|tst');
  });

  it('gives each feature the log entry its picks belong in', () => {
    const c = character();
    expect(named(c, 'Mossling').entryIndex).toBe(0);
    expect(named(c, 'Ability Score Improvement').entryIndex).toBe(3);
    // A feat picked at level 4: its own picks go there too.
    expect(named(c, 'Arena Veteran').entryIndex).toBe(3);
    expect(named(c, 'Taunt').entryIndex).toBe(1);
    expect(named(c, 'School of the Net').entryIndex).toBe(2);
  });

  it('shows picks made and still to make, with their counts', () => {
    const veteran = named(character(), 'Arena Veteran');
    expect(veteran.choices.map((x) => [x.offer.key.slot, x.values.length, x.count])).toEqual([
      ['ability', 0, 1],
      ['skills', 0, 1],
    ]);
    const skills = named(character(), 'Gladiator').choices.find(
      (x) => x.offer.key.slot === 'skills',
    );
    expect(skills).toMatchObject({ values: ['athletics', 'performance'], count: 2, status: 'ok' });
  });

  it('a gift granted by the DM, with its counter', () => {
    const c = character();
    c.log[3]!.choices.push({
      key: { owner: { kind: 'reward', id: 'charm of embers|tst' }, slot: 'granted' },
      values: [],
      labels: ['Charm of Embers'],
      madeAt: 0,
      via: 'manual',
    });
    const gift = named(c, 'Charm of Embers');
    expect(gift).toMatchObject({
      group: 'gift',
      grantKey: 'reward:charm of embers|tst#granted',
      resourceKeys: ['reward:charm of embers|tst#uses'],
      entryIndex: 3,
    });
  });

  it('the counters of a feature', () => {
    expect(named(character(), 'Arena Training').resourceKeys).toEqual([
      'classFeature:arena training|gladiator|tst|1|tst#bravado',
    ]);
  });
});
