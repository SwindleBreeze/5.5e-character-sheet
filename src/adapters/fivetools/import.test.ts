import { describe, expect, it } from 'vitest';
import type {
  ClassDef,
  ContentEntity,
  EntityKind,
  Item,
  Species,
  Spell,
} from '../../schema/index.ts';
import { fixtureSource } from '../../test/fivetoolsFixture.ts';
import { memoryFileSource } from './fs/memory.ts';
import { ImportError, importFivetools, type ImportResult } from './index.ts';

async function run(prefix = 'data/', extra: Record<string, string> = {}) {
  return importFivetools(fixtureSource(prefix, extra), { now: 1 });
}

function get<T extends ContentEntity>(r: ImportResult, kind: EntityKind, id: string): T {
  const found = (r.entities[kind] as ContentEntity[] | undefined)?.find((e) => e.id === id);
  if (!found) throw new Error(`missing ${kind} ${id}`);
  return found as T;
}

describe('importFivetools (fixture tree)', () => {
  it('finds the data folder wherever it is nested and reads the version', async () => {
    const r = await run('5etools-src-9/data/', {
      '5etools-src-9/package.json': '{"version":"9.9.9"}',
    });
    expect(r.report.dataVersion).toBe('9.9.9');
    expect(r.report.counts.class).toBe(1);
  });

  it('fails clearly when there is no 5etools data', async () => {
    await expect(importFivetools(memoryFileSource({ 'x.json': '{}' }))).rejects.toBeInstanceOf(
      ImportError,
    );
  });

  it('converts every kind and reports what it skipped', async () => {
    const r = await run();
    expect(r.report.counts).toEqual({
      spell: 3,
      class: 1,
      classFeature: 6,
      subclass: 3,
      subclassFeature: 3,
      background: 1,
      feat: 4,
      species: 6,
      item: 7,
      optionalFeature: 2,
      rule: 11,
    });
    expect(r.report.ignored).toEqual({ itemType: 1, languageScript: 1 });
    expect(r.report.warnings.map((w) => w.code)).toEqual(['tableKeyCollision']);
  });

  it('builds the source registry with editions from entities and book dates', async () => {
    const r = await run();
    expect(r.sources.map((s) => [s.code, s.name, s.edition])).toEqual([
      ['OLD', 'Old Almanac', '2014'],
      ['TST', 'Test Handbook', '2024'],
    ]);
    expect(r.sources[1]?.counts.class).toBe(1);
    // A spell without its own edition takes its source's.
    expect(get<Spell>(r, 'spell', 'glitter burst|old').edition).toBe('2014');
  });

  it('converts a class: table keys, slots, features, progressions and equipment', async () => {
    const r = await run();
    const cls = get<ClassDef>(r, 'class', 'gladiator|tst');
    expect(cls.table.map((c) => c.key)).toEqual([
      'crowd-tricks',
      'bravado',
      'bravado-2',
      'roar-dice',
    ]);
    expect(cls.table[0]?.values).toEqual([0, 2, 2]);
    expect(cls.table[1]?.values).toEqual([2, 2, 3]);
    expect(cls.table[3]?.values).toEqual(['1d6', '1d6', '2d6']);
    expect(cls.slotTable).toEqual([
      [0, 0],
      [2, 0],
      [3, 0],
    ]);
    expect(cls.subclassLevel).toBe(3);
    expect(cls.multiclass.prereq).toEqual([['str'], ['cha']]);
    expect(cls.startingProficiencies.armor).toEqual(['light', 'shield|tst']);
    expect(cls.startingEquipment[0]).toEqual({
      key: 'A',
      items: [
        { itemId: 'net blade|tst', quantity: 1 },
        { itemId: 'torch|tst', quantity: 3 },
      ],
      valueCp: 500,
    });
    expect(cls.spellcasting).toEqual({
      ability: 'cha',
      progression: 'half',
      preparedByLevel: [2, 3, 4],
    });
    expect(cls.features.find((f) => f.gainSubclassFeature)?.featureId).toBe(
      'gladiator school|gladiator|tst|3|tst',
    );
    expect(cls.effects).toEqual([
      {
        type: 'atLevel',
        level: 1,
        effects: [
          {
            type: 'featChoice',
            slot: 'featProgression.arena-style.1',
            categories: ['fightingStyle'],
            count: 1,
          },
        ],
      },
      {
        type: 'atLevel',
        level: 6,
        effects: [
          {
            type: 'featChoice',
            slot: 'featProgression.arena-style.6',
            categories: ['fightingStyle'],
            count: 1,
          },
        ],
      },
      {
        type: 'atLevel',
        level: 2,
        effects: [
          {
            type: 'optionalFeatureChoice',
            slot: 'optfeat.crowd-tricks.2',
            featureTypes: ['CT'],
            count: 2,
          },
        ],
      },
      {
        type: 'atLevel',
        level: 4,
        effects: [
          {
            type: 'optionalFeatureChoice',
            slot: 'optfeat.crowd-tricks.4',
            featureTypes: ['CT'],
            count: 1,
          },
        ],
      },
    ]);
  });

  it('turns option blocks and the ASI feature into choices (P14)', async () => {
    const r = await run();
    expect(get(r, 'classFeature', 'showmanship|gladiator|tst|1|tst').effects).toEqual([
      {
        type: 'featureOptions',
        optionKind: 'classFeature',
        choice: {
          slot: 'options.0',
          count: 1,
          from: ['crowd pleaser|gladiator|tst|1|tst', 'intimidator|gladiator|tst|1|tst'],
        },
      },
    ]);
    expect(get(r, 'classFeature', 'ability score improvement|gladiator|tst|4|tst').effects).toEqual(
      [{ type: 'featChoice', slot: 'feat', categories: ['general'] }],
    );
    expect(get(r, 'classFeature', 'arena training|gladiator|tst|1|tst')).toMatchObject({
      consumes: { name: 'Bravado' },
    });
  });

  it('re-homes a copied subclass onto the new class and keeps it 2014', async () => {
    const r = await run();
    expect(get(r, 'subclass', 'trident|gladiator|tst|old')).toMatchObject({
      classId: 'gladiator|tst',
      edition: '2014',
      page: 9,
    });
    expect(get(r, 'subclass', 'trident|gladiator|old|old').supersededBy).toEqual([
      'trident|gladiator|tst|tst',
    ]);
  });

  it('joins spell lists and reprints', async () => {
    const r = await run();
    const spell = get<Spell>(r, 'spell', 'glitter burst|tst');
    expect(spell.classIds).toEqual(['gladiator|tst']);
    expect(spell.subclassIds).toEqual(['net|gladiator|tst|tst']);
    expect(get(r, 'spell', 'glitter burst|old').supersededBy).toEqual(['glitter burst|tst']);
    expect(get<Spell>(r, 'spell', 'dim lantern|tst')).toMatchObject({
      ritual: true,
      attack: 'ranged',
      components: { v: true, m: { text: 'a candle worth 5 GP', costCp: 500, consumed: true } },
      duration: [{ type: 'timed', amount: 10, unit: 'minute', concentration: true }],
    });
  });

  it('expands species versions, abstract templates and subraces', async () => {
    const r = await run();
    const deep = get<Species>(r, 'species', 'mossling; deep lineage|tst');
    expect(deep.variantOf).toBe('mossling|tst');
    expect(deep.effects).toContainEqual({ type: 'sense', sense: 'darkvision', range: 120 });
    expect(
      deep.effects.some((e) => e.type === 'optionChoice' && e.choice.slot === 'spellsSet'),
    ).toBe(false);

    const red = get<Species>(r, 'species', 'mossling (red)|tst');
    expect(red.effects).toContainEqual({ type: 'resistance', value: 'fire' });
    expect(JSON.stringify(red.entries)).toContain(
      'You release red spores at {@spell Glitter Burst|TST|spores}.',
    );

    const quarry = get<Species>(r, 'species', 'stoneborn (quarry)|old');
    expect(quarry.variantOf).toBe('stoneborn|old');
    expect(quarry.effects).toContainEqual({ type: 'abilityBonus', ability: 'str', value: 1 });
    expect(quarry.effects).toContainEqual({ type: 'abilityBonus', ability: 'con', value: 2 });
  });

  it('converts origins with deterministic choice slots', async () => {
    const r = await run();
    expect(get(r, 'background', 'arena hand|tst')).toMatchObject({
      featId: 'spark initiate; gladiator|tst',
      abilityOptions: [
        { from: ['str', 'con', 'cha'], weights: [2, 1] },
        { from: ['str', 'con', 'cha'], weights: [1, 1, 1] },
      ],
    });
    expect(get(r, 'feat', 'arena veteran|tst')).toMatchObject({
      category: 'general',
      prerequisites: [
        [
          { type: 'level', level: 4 },
          { type: 'ability', anyOf: [{ str: 13 }, { cha: 13 }] },
        ],
      ],
    });
    expect(get(r, 'feat', 'spark initiate; gladiator|tst')).toMatchObject({
      variantOf: 'spark initiate|tst',
      repeatable: true,
    });
    const mossling = get<Species>(r, 'species', 'mossling|tst');
    expect(mossling.effects[0]).toEqual({
      type: 'optionChoice',
      choice: { slot: 'size', count: 1, from: ['S', 'M'] },
      labels: ['S', 'M'],
    });
  });

  it('converts items, magic variants and rules', async () => {
    const r = await run();
    expect(get<Item>(r, 'item', 'net blade|tst').weapon).toEqual({
      category: 'martial',
      damage: '1d8',
      versatile: '1d10',
      damageType: 'slashing',
      properties: ['itemProperty/v|tst', 'itemProperty/f|tst'],
      masteryId: 'mastery/snare|tst',
    });
    expect(get<Item>(r, 'item', 'arena mail|tst').armor).toEqual({
      category: 'heavy',
      ac: 17,
      strReq: 15,
      stealthDis: true,
    });
    expect(get<Item>(r, 'item', 'everburning torch|tst').entries).toEqual([
      'A torch burns for 1 hour.',
      'It never goes out.',
    ]);
    expect(get<Item>(r, 'item', '+1 arena weapon|tst')).toMatchObject({
      itemKind: 'variant',
      bonuses: { weapon: 1 },
      variant: { requires: [{ weapon: true }], excludes: { net: true }, namePrefix: '+1 ' },
    });
    expect(get(r, 'rule', 'itemProperty/v|tst')).toMatchObject({
      name: 'Versatile',
      abbreviation: 'V',
    });
    expect(get(r, 'rule', 'skill/performance|tst')).toMatchObject({ ability: 'cha' });
    // Shared item text is filled in from the item's own fields.
    expect(get<Item>(r, 'item', 'ring of loud shouting|tst').entries).toEqual([
      'You resist thunder and psychic damage. The ring is set with a tiny bell.',
    ]);
  });

  it('is deterministic, so re-importing keeps every id and slot', async () => {
    const a = await run();
    const b = await run('elsewhere/5etools/data/');
    expect(b.entities).toEqual(a.entities);
  });

  it('can keep only some sources', async () => {
    const r = await importFivetools(fixtureSource(), { now: 1, onlySources: ['OLD'] });
    expect(r.sources.map((s) => s.code)).toEqual(['OLD']);
    expect(r.report.counts).toEqual({ spell: 1, subclass: 2, subclassFeature: 1, species: 2 });
  });
});
