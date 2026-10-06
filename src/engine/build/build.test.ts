import { beforeAll, describe, expect, it } from 'vitest';
import type { ClassDef, ContentEntity } from '../../schema/index.ts';
import { fixtureContent } from '../../test/fixtureIndex.ts';
import { FIXTURE_FEATURE_EFFECTS } from '../../test/fixtureFeatureEffects.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import { derive } from '../derive/derive.ts';
import { autoChoose } from './autoChoose.ts';
import {
  addLevel,
  applyEquipment,
  coins,
  setChoice,
  setOrigin,
  setSubclass,
  standardArrayScores,
  startCharacter,
} from './build.ts';
import { createCatalog, type Catalog } from './catalog.ts';
import { quickBuild } from './quickBuild.ts';

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

const brute = { kind: 'class', id: 'brute|tst' } as const;

describe('build helpers', () => {
  it('start, origin, levels and subclass', () => {
    let c = startCharacter('Ada', brute, 5);
    expect(c.log).toEqual([
      { charLevel: 1, classRef: brute, classLevel: 1, hp: { mode: 'max' }, choices: [] },
    ]);
    c = setOrigin(
      c,
      { kind: 'species', id: 'mossling|tst' },
      { kind: 'background', id: 'arena hand|tst' },
    );
    c = addLevel(c, brute);
    c = addLevel(c, { kind: 'class', id: 'lorekeeper|tst' }, { mode: 'roll', value: 4 });
    c = addLevel(c, brute);
    expect(c.log.map((e) => [e.charLevel, e.classRef.id, e.classLevel, e.hp.mode])).toEqual([
      [1, 'brute|tst', 1, 'max'],
      [2, 'brute|tst', 2, 'avg'],
      [3, 'lorekeeper|tst', 1, 'roll'],
      [4, 'brute|tst', 3, 'avg'],
    ]);
    c = setSubclass(c, index.get(brute) as ClassDef, {
      kind: 'subclass',
      id: 'spark|brute|tst|tst',
    });
    expect(c.log.map((e) => e.subclassRef?.id)).toEqual([
      undefined,
      undefined,
      undefined,
      'spark|brute|tst|tst',
    ]);
  });

  it('setChoice replaces a record where it is, or adds to the last level', () => {
    let c = addLevel(startCharacter('Bo', brute, 0), brute);
    const key = { owner: brute, slot: 'skills' };
    c = setChoice(c, key, ['athletics'], { now: 1 });
    expect(c.log[1]?.choices.map((r) => r.values)).toEqual([['athletics']]);
    c = setChoice(c, key, ['survival', 'perception'], { via: 'retrain', now: 2 });
    expect(c.log[1]?.choices).toEqual([
      {
        key,
        values: ['survival', 'perception'],
        labels: ['survival', 'perception'],
        madeAt: 2,
        via: 'retrain',
      },
    ]);
    c = setChoice(c, { owner: brute, slot: 'equipment' }, ['A'], { entryIndex: 0 });
    expect(c.log[0]?.choices).toHaveLength(1);
    expect(() => setChoice(startCharacter('x', brute), key, [], { entryIndex: 5 })).toThrow();
  });

  it('standard array by primary ability, coins, and equipment', () => {
    expect(standardArrayScores(['int'])).toEqual({
      int: 15,
      con: 14,
      dex: 13,
      str: 12,
      wis: 10,
      cha: 8,
    });
    expect(standardArrayScores(['dex', 'wis'])).toEqual({
      dex: 15,
      wis: 14,
      con: 13,
      str: 12,
      int: 10,
      cha: 8,
    });
    expect(coins(1234)).toEqual({ gp: 12, sp: 3, cp: 4 });

    const cls = index.get(brute) as ClassDef;
    const c = applyEquipment(startCharacter('Cy', brute, 7), cls.startingEquipment[0]!, index, 7);
    expect(c.inventory.map((r) => [r.name, r.quantity, r.equipped])).toEqual([
      ['Net Blade', 1, 'mainHand'],
      ['Shiv', 2, undefined],
    ]);
    expect(c.currency).toMatchObject({ gp: 8, sp: 0, cp: 0 });
  });
});

describe('automatic picks and the quick-builder', () => {
  it('picks for each kind of offer', () => {
    let c = setOrigin(
      startCharacter('Dee', brute, 0),
      { kind: 'species', id: 'mossling|tst' },
      {
        kind: 'background',
        id: 'arena hand|tst',
      },
    );
    c.baseScores = standardArrayScores(['str']);
    const sheet = derive(c, index, { registry: FIXTURE_FEATURE_EFFECTS });
    const pick = (slot: string) => {
      const p = sheet.choices.pending.find((x) => x.offer.key.slot === slot)!;
      return autoChoose(p.offer, p.count, { character: c, sheet, catalog, index });
    };
    // Athletics already comes from the background.
    expect(pick('skills').values).toEqual(['intimidation', 'survival']);
    expect(pick('mastery')).toMatchObject({
      values: ['arc bow|tst', 'net blade|tst'],
      valueKinds: ['item'],
    });
    expect(pick('equipment').values).toEqual(['A']);
    expect(pick('size')).toEqual({ values: ['S'], labels: ['S'] });
    // +2/+1 to the best scores of the background's three.
    expect(pick('ability').values).toEqual(['str', 'str', 'con']);
    expect(pick('spells.0.ability').values).toEqual(['int']);
    expect(pick('spells.0.known.0')).toMatchObject({
      values: ['glitter burst|tst'],
      valueKinds: ['spell'],
    });
    c = setChoice(c, { owner: brute, slot: 'skills' }, ['athletics', 'intimidation']);
    expect(c.log[0]?.choices).toHaveLength(1);
  });

  it('builds a whole character; only picks the content cannot fill stay pending', () => {
    const c = quickBuild(
      {
        name: 'Quick',
        classes: [{ classId: 'brute|tst', levels: 5 }],
        speciesId: 'mossling|tst',
        backgroundId: 'arena hand|tst',
      },
      { index, catalog, registry: FIXTURE_FEATURE_EFFECTS, now: 0 },
    );
    expect(c.log).toHaveLength(5);
    expect(c.log[2]?.subclassRef?.id).toBe('spark|brute|tst|tst');
    expect(c.inventory.map((r) => r.name)).toEqual(['Net Blade', 'Shiv', 'Torch']);
    const sheet = derive(c, index, { registry: FIXTURE_FEATURE_EFFECTS });
    // What the fixture can't fill: no artisan's tools; the Spark list has only two level 1
    // spells, both taken at level 3; the Gladiator list has one cantrip for Spark Initiate's two.
    expect(sheet.choices.pending.map((p) => p.offer.key.slot)).toEqual([
      'spells.4',
      'tools',
      'spells.0.known.0',
    ]);
    expect(sheet.choices.attention).toEqual([]);
    expect(sheet.issues).toEqual([]);
    expect(sheet.abilities.str.score.value).toBe(18);
  });

  it('builds a multiclass caster', () => {
    const c = quickBuild(
      {
        name: 'Duo',
        classes: [
          { classId: 'lorekeeper|tst', levels: 3 },
          { classId: 'pactbinder|tst', levels: 2 },
        ],
      },
      { index, catalog, registry: FIXTURE_FEATURE_EFFECTS, now: 0 },
    );
    const sheet = derive(c, index, { registry: FIXTURE_FEATURE_EFFECTS });
    // A spell known once is not picked again: the Lorekeeper list has one cantrip (Spark Bolt),
    // so the Pactbinder gets Glitter Burst and both cantrip choices stay one short.
    expect(sheet.spellcasting.casters.map((x) => [x.key, x.cantrips, x.spellbook?.length])).toEqual(
      [
        ['lorekeeper|tst', ['spark bolt|tst'], 3],
        ['pactbinder|tst', ['glitter burst|tst'], undefined],
      ],
    );
    // The fixture lists are short: the Lorekeeper has two level 1 spells for a spellbook of 5,
    // nothing new at level 2 (still level 1 spells only) and Mind Ward at level 3; the
    // Pactbinder's level 1 list is Ink Cloud (already in the spellbook) and Hex Mark.
    expect(
      sheet.choices.pending.map((p) => [p.offer.key.owner.id, p.offer.key.slot, p.have, p.count]),
    ).toEqual([
      ['lorekeeper|tst', 'cantrips.1', 1, 2],
      ['lorekeeper|tst', 'spellbook.1', 2, 5],
      ['lorekeeper|tst', 'spellbook.2', 0, 2],
      ['lorekeeper|tst', 'spellbook.3', 1, 2],
      ['pactbinder|tst', 'cantrips.1', 1, 2],
      ['pactbinder|tst', 'spells.1', 1, 2],
      ['pactbinder|tst', 'spells.2', 0, 1],
    ]);
    expect(sheet.choices.attention).toEqual([]);
  });
});
