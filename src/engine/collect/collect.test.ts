import { beforeAll, describe, expect, it } from 'vitest';
import { importFivetools } from '../../adapters/fivetools/index.ts';
import {
  encodeChoiceKey,
  refKey,
  type Character,
  type ContentEntity,
  type Effect,
  type Feat,
  type Predicate,
} from '../../schema/index.ts';
import { testCharacter, type TestCharacterSpec } from '../../test/characters.ts';
import { fixtureIndex } from '../../test/fixtureIndex.ts';
import { fixtureSource } from '../../test/fivetoolsFixture.ts';
import { FIXTURE_FEATURE_EFFECTS } from '../../test/fixtureFeatureEffects.ts';
import { createContentIndex, type ContentIndex } from '../content/contentIndex.ts';
import { collectEffects, GRANTED_SLOT } from './collect.ts';
import type { Collected } from './types.ts';

let index: ContentIndex;

beforeAll(async () => {
  index = await fixtureIndex();
});

const asi4 = { kind: 'classFeature', id: 'ability score improvement|brute|tst|4|tst' } as const;
const brute = { kind: 'class', id: 'brute|tst' } as const;

function bruteSpec(extra: Partial<TestCharacterSpec> = {}): TestCharacterSpec {
  return {
    classes: [{ classId: 'brute|tst', levels: 5, subclassId: 'spark|brute|tst|tst' }],
    speciesId: 'mossling|tst',
    backgroundId: 'arena hand|tst',
    ...extra,
  };
}

function collect(
  character: Character,
  opts: { holds?: (p: Predicate) => boolean; index?: ContentIndex } = {},
): Collected {
  return collectEffects(character, opts.index ?? index, {
    registry: FIXTURE_FEATURE_EFFECTS,
    holds: opts.holds ?? (() => true),
  });
}

const offerKeys = (c: Collected) => c.offers.map((o) => encodeChoiceKey(o.key));
const effectsOf = (c: Collected, type: Effect['type']) =>
  c.effects.filter((a) => a.effect.type === type);

describe('collectEffects', () => {
  it('walks classes, features, subclass, species, background and granted feats in order', () => {
    const c = collect(testCharacter(bruteSpec()));
    expect(c.charLevel).toBe(5);
    expect(c.classes).toMatchObject([
      { classId: 'brute|tst', level: 5, isFirst: true, subclassId: 'spark|brute|tst|tst' },
    ]);
    expect(c.owners.map((o) => o.name)).toEqual([
      'Brute',
      'Fury',
      'Hardened Hide',
      'Weapon Mastery',
      'Catch Breath',
      'Brute Path',
      'Ability Score Improvement',
      'Extra Attack',
      'Swift Feet',
      'Path of the Spark',
      'Path of the Spark',
      // Written inside Path of the Spark's text (5etools `refSubclassFeature`).
      'Static Charge',
      'Mossling',
      'Arena Hand',
      'Spark Initiate; Gladiator',
    ]);
    // Class and subclass content carry their class, for tables and levels.
    expect(c.owners.find((o) => o.name === 'Fury')?.classId).toBe('brute|tst');
    expect(c.owners.filter((o) => o.subclassId).map((o) => o.ref.kind)).toEqual([
      'subclass',
      'subclassFeature',
      'subclassFeature',
    ]);
    // A mapping on the nested feature applies.
    expect(c.effects.filter((a) => a.source.name === 'Static Charge').map((a) => a.effect)).toEqual(
      [{ type: 'rollMode', target: 'skill:arcana', mode: 'advantage' }],
    );
    expect(c.missing).toEqual([]);
  });

  it('turns class fields into effects: saves and starting proficiencies of the first class', () => {
    const c = collect(testCharacter(bruteSpec()));
    const profs = effectsOf(c, 'proficiency')
      .filter((a) => a.source.ref.kind === 'class')
      .map(
        (a) => a.effect.type === 'proficiency' && `${a.effect.category}:${String(a.effect.value)}`,
      );
    expect(profs).toEqual([
      'save:str',
      'save:con',
      'armor:light',
      'armor:medium',
      'armor:buckler|tst',
      'weapon:simple',
      'weapon:martial',
    ]);
  });

  it('offers every choice under its owner and slot', () => {
    const c = collect(testCharacter(bruteSpec()));
    expect(offerKeys(c)).toEqual([
      'class:brute|tst#skills',
      'classFeature:weapon mastery|brute|tst|1|tst#mastery',
      'classFeature:ability score improvement|brute|tst|4|tst#feat',
      'class:brute|tst#equipment',
      // Path of the Spark casts: a cantrip at 3, spells at 3 and 4 (level-up casters pick them).
      'subclass:spark|brute|tst|tst#cantrips.3',
      'subclass:spark|brute|tst|tst#spells.3',
      'subclass:spark|brute|tst|tst#spells.4',
      'species:mossling|tst#size',
      'species:mossling|tst#spellsSet',
      'background:arena hand|tst#tools',
      'background:arena hand|tst#languages',
      'feat:spark initiate; gladiator|tst#spells.0.ability',
      'feat:spark initiate; gladiator|tst#spells.0.known.0',
      'background:arena hand|tst#ability',
      'background:arena hand|tst#equipment',
    ]);
    const byKey = new Map(c.offers.map((o) => [encodeChoiceKey(o.key), o]));
    expect(byKey.get('classFeature:weapon mastery|brute|tst|1|tst#mastery')).toMatchObject({
      kind: 'weaponMastery',
      count: 'table.weapon-mastery',
      from: { query: 'proficientWeapons' },
      retrain: 'longRest',
    });
    expect(byKey.get('background:arena hand|tst#ability')).toMatchObject({
      kind: 'backgroundAbility',
      count: 3,
      from: ['str', 'con', 'cha'],
    });
    expect(byKey.get('class:brute|tst#equipment')).toMatchObject({ from: ['A', 'B'], count: 1 });
    expect(byKey.get('species:mossling|tst#size')).toMatchObject({
      kind: 'option',
      labels: ['S', 'M'],
    });
  });

  it('gates by level: class content by class level, the rest by character level', () => {
    const c = collect(
      testCharacter({ ...bruteSpec(), classes: [{ classId: 'brute|tst', levels: 3 }] }),
    );
    expect(c.owners.map((o) => o.name)).not.toContain('Extra Attack');
    expect(offerKeys(c)).not.toContain(
      'classFeature:ability score improvement|brute|tst|4|tst#feat',
    );
  });

  it('follows picks: a feat chosen at an ASI becomes an owner with its own offers', () => {
    const c = collect(
      testCharacter(
        bruteSpec({
          choices: [
            {
              owner: asi4,
              slot: 'feat',
              values: ['arena veteran|tst'],
              valueKinds: ['feat'],
              atLevel: 4,
            },
          ],
        }),
      ),
    );
    expect(c.owners.map((o) => o.ref.id)).toContain('arena veteran|tst');
    expect(offerKeys(c)).toEqual(
      expect.arrayContaining(['feat:arena veteran|tst#ability', 'feat:arena veteran|tst#skills']),
    );
  });

  it('applies effects that depend on a pick (Mossling lineage spells)', () => {
    const grey = collect(
      testCharacter(
        bruteSpec({
          choices: [
            { owner: { kind: 'species', id: 'mossling|tst' }, slot: 'spellsSet', values: ['1'] },
          ],
        }),
      ),
    );
    const grants = effectsOf(grey, 'grantSpells').filter((a) => a.source.ref.kind === 'species');
    expect(grants).toHaveLength(1);
    expect(JSON.stringify(grants[0]?.effect)).toContain('dim lantern|tst');
    // The other lineage's spell choice is not offered.
    expect(offerKeys(grey).some((k) => k.startsWith('species:mossling|tst#spells.0'))).toBe(false);
  });

  it('applies `when` effects only while the predicate holds', () => {
    const speedBonus = (holds: boolean) =>
      effectsOf(collect(testCharacter(bruteSpec()), { holds: () => holds }), 'speedBonus');
    expect(speedBonus(true)).toHaveLength(1);
    expect(speedBonus(false)).toHaveLength(0);
  });

  it('lists every toggle, and applies an active one', () => {
    const character = testCharacter(bruteSpec());
    const off = collect(character);
    expect(
      effectsOf(off, 'toggle').map((a) => a.effect.type === 'toggle' && a.effect.toggleId),
    ).toEqual(['fury']);
    expect(effectsOf(off, 'resistance').map((a) => a.source.name)).toEqual(['Mossling']);

    character.state.activeToggles.fury = {};
    const on = collect(character);
    expect(effectsOf(on, 'resistance').map((a) => a.source.name)).toEqual([
      'Fury',
      'Fury',
      'Fury',
      'Mossling',
    ]);
  });

  it('a second class gives its multiclass proficiencies, no saves and no equipment', () => {
    const c = collect(
      testCharacter({
        classes: [
          { classId: 'brute|tst', levels: 2 },
          { classId: 'pactbinder|tst', levels: 1 },
        ],
      }),
    );
    expect(c.classes.map((x) => [x.classId, x.level, x.isFirst])).toEqual([
      ['brute|tst', 2, true],
      ['pactbinder|tst', 1, false],
    ]);
    const pact = effectsOf(c, 'proficiency')
      .filter((a) => a.source.ref.id === 'pactbinder|tst')
      .map(
        (a) => a.effect.type === 'proficiency' && `${a.effect.category}:${String(a.effect.value)}`,
      );
    expect(pact).toEqual(['armor:light']);
    expect(offerKeys(c)).not.toContain('class:pactbinder|tst#equipment');
    expect(c.owners.map((o) => o.name)).toContain('Hex Strike');
  });

  it('uses a snapshot for missing content, and reports what has neither', () => {
    const character = testCharacter(bruteSpec());
    const gone = { kind: 'feat', id: 'gone feat|old' } as const;
    const lost = { kind: 'feat', id: 'lost feat|old' } as const;
    character.log[0]!.choices.push(
      {
        key: { owner: gone, slot: GRANTED_SLOT },
        values: [],
        labels: [],
        madeAt: 0,
        via: 'manual',
      },
      {
        key: { owner: lost, slot: GRANTED_SLOT },
        values: [],
        labels: [],
        madeAt: 0,
        via: 'manual',
      },
    );
    character.snapshots[refKey(gone)] = {
      ref: gone,
      name: 'Gone Feat',
      entries: [],
      effects: [{ type: 'sense', sense: 'tremorsense', range: 10 }],
      capturedAt: 0,
    };
    const c = collect(character);
    expect(c.owners.find((o) => o.name === 'Gone Feat')).toMatchObject({ fromSnapshot: true });
    expect(effectsOf(c, 'sense').map((a) => a.source.name)).toContain('Gone Feat');
    expect(c.missing).toEqual([lost]);
  });

  it('grants a gift outright, with its uses', () => {
    const character = testCharacter(bruteSpec());
    character.log[4]!.choices.push({
      key: { owner: { kind: 'reward', id: 'charm of sparks|tst' }, slot: GRANTED_SLOT },
      values: [],
      labels: [],
      madeAt: 0,
      via: 'manual',
    });
    const c = collect(character);
    expect(effectsOf(c, 'resource').map((a) => a.source.name)).toContain('Charm of Sparks');
  });

  it('applies items in use, and attunement items only when attuned', () => {
    const cloak = { kind: 'item', id: 'cloak of cheers|tst' } as const;
    const worn = testCharacter(bruteSpec({ inventory: [{ itemRef: cloak, equipped: 'worn' }] }));
    expect(effectsOf(collect(worn), 'resistance').map((a) => a.source.name)).toEqual(['Mossling']);
    worn.inventory[0]!.attuned = true;
    expect(effectsOf(collect(worn), 'resistance').map((a) => a.source.name)).toEqual([
      'Mossling',
      'Cloak of Cheers',
    ]);
    const carried = testCharacter(bruteSpec({ inventory: [{ itemRef: cloak, attuned: true }] }));
    expect(effectsOf(collect(carried), 'resistance').map((a) => a.source.name)).toEqual([
      'Mossling',
    ]);
  });

  it('numbers each instance of a repeatable feat', () => {
    const veteran = index.get({ kind: 'feat', id: 'arena veteran|tst' })!;
    const repeatable: Feat = { ...veteran, repeatable: true };
    const all = index
      .all()
      .map((e): ContentEntity => (e.id === veteran.id && e.kind === 'feat' ? repeatable : e));
    const custom = createContentIndex(all);
    const character = testCharacter({
      classes: [{ classId: 'brute|tst', levels: 8 }],
      choices: [
        {
          owner: asi4,
          slot: 'feat',
          values: ['arena veteran|tst'],
          valueKinds: ['feat'],
          atLevel: 4,
        },
        {
          owner: { ...asi4, id: 'ability score improvement|brute|tst|8|tst' },
          slot: 'feat',
          values: ['arena veteran|tst'],
          valueKinds: ['feat'],
          atLevel: 8,
        },
      ],
    });
    const c = collect(character, { index: custom });
    expect(c.owners.filter((o) => o.ref.id === 'arena veteran|tst').map((o) => o.n)).toEqual([
      undefined,
      2,
    ]);
    expect(offerKeys(c)).toEqual(
      expect.arrayContaining(['feat:arena veteran|tst#skills', 'feat:arena veteran|tst#skills@2']),
    );
  });

  it('gives the same offer keys after a re-import', async () => {
    const again = await importFivetools(fixtureSource(), { now: 2 });
    const index2 = createContentIndex(Object.values(again.entities).flat() as ContentEntity[]);
    const character = testCharacter(bruteSpec());
    expect(offerKeys(collect(character, { index: index2 }))).toEqual(offerKeys(collect(character)));
  });

  it('starts from nothing for an empty character', () => {
    const c = collect(testCharacter({ classes: [] }));
    expect(c).toMatchObject({ charLevel: 0, classes: [], offers: [], effects: [] });
    expect(brute.kind).toBe('class');
  });
});
