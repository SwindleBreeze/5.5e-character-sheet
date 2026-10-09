import { describe, expect, it } from 'vitest';
import type {
  CharOption,
  ClassDef,
  ContentEntity,
  Deity,
  EntityKind,
  Facility,
  Item,
  Reward,
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
    expect(r.report.counts.class).toBe(5);
  });

  it('fails clearly when there is no 5etools data', async () => {
    await expect(importFivetools(memoryFileSource({ 'x.json': '{}' }))).rejects.toBeInstanceOf(
      ImportError,
    );
  });

  it('converts every kind and reports what it skipped', async () => {
    const r = await run();
    expect(r.report.counts).toEqual({
      spell: 8,
      class: 5,
      classFeature: 35,
      subclass: 7,
      subclassFeature: 8,
      background: 1,
      feat: 4,
      species: 6,
      item: 23,
      optionalFeature: 2,
      rule: 17,
      deity: 5,
      reward: 4,
      facility: 3,
      charOption: 1,
      creature: 12,
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
    expect(r.sources[1]?.counts.class).toBe(5);
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
    expect(cls.table[0]?.values).toEqual([0, 2, 2, 3, 3, 3]);
    expect(cls.table[1]?.values).toEqual([2, 2, 3, 3, 3, 4]);
    expect(cls.table[3]?.values).toEqual(['1d6', '1d6', '2d6', '2d6', '2d6', '3d6']);
    expect(cls.slotTable).toEqual([
      [0, 0],
      [2, 0],
      [3, 0],
      [3, 0],
      [4, 2],
      [4, 2],
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
      preparedByLevel: [2, 3, 4, 4, 5, 5],
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
    expect(spell.classIds).toEqual(['gladiator|tst', 'pactbinder|tst']);
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

  it('keeps spellcasting details: change timing, spellbooks and cantrip scaling', async () => {
    const r = await run();
    expect(get<ClassDef>(r, 'class', 'lorekeeper|tst').spellcasting).toMatchObject({
      progression: 'full',
      preparedChange: 'restLong',
      spellbookByLevel: [5, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    });
    expect(get<ClassDef>(r, 'class', 'pactbinder|tst').spellcasting).toMatchObject({
      progression: 'pact',
      preparedChange: 'level',
    });
    expect(get<Spell>(r, 'spell', 'spark bolt|tst').scaling).toEqual([
      { label: 'fire damage', byLevel: { 1: '1d8', 5: '2d8', 11: '3d8', 17: '4d8' } },
    ]);
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
    expect(get<Item>(r, 'item', 'arc bow|tst').weapon).toMatchObject({
      ranged: true,
      range: [60, 240],
      ammoType: 'arrow|tst',
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
    // Base items keep the raw fields variant filters match; packs take no variants.
    expect(get<Item>(r, 'item', 'net blade|tst').variantBase).toMatchObject({
      name: 'Net Blade',
      source: 'TST',
      edition: 'one',
      type: 'M|TST',
      weapon: true,
      weaponCategory: 'martial',
      property: ['V|TST', 'F|TST'],
    });
    expect(get<Item>(r, 'item', "delver's kit|tst").variantBase).toBeUndefined();
    expect(get<Item>(r, 'item', 'cloak of cheers|tst').variantBase).toBeUndefined();
    // A variant: its Attunement, charges as dice, recharge, and its text with the bonus filled.
    expect(get<Item>(r, 'item', 'echo weapon|tst')).toMatchObject({
      attunement: 'by a gladiator',
      attunementTags: [{ class: 'gladiator' }],
      chargesDice: '1d3',
      recharge: 'dawn',
      rechargeAmount: '1d3',
      entries: ['+1 to attack and damage rolls; an item that echoes.'],
    });
    expect(get<Item>(r, 'item', '+1 old weapon|tst').variant?.edition).toBe('classic');
    expect(get<Item>(r, 'item', 'backpack|tst').containerCapacityLb).toBe(30);
    expect(get<Item>(r, 'item', 'quiver|tst')).toMatchObject({
      container: true,
      containerItems: { 'arrow|tst': 20 },
    });
    expect(get<Item>(r, 'item', 'sack of holding|tst')).toMatchObject({
      containerCapacityLb: 500,
      containerWeightless: true,
    });
    expect(get(r, 'species', 'stoneborn|old').effects).toContainEqual({
      type: 'carrySize',
      steps: 1,
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
    // Spells it casts: at will, for its charges, once a day.
    expect(
      get<Item>(r, 'item', 'ring of loud shouting|tst').effects.find(
        (e) => e.type === 'grantSpells',
      ),
    ).toEqual({
      type: 'grantSpells',
      spells: [
        { mode: 'innate', spell: { id: 'glitter burst|tst' }, uses: 'atWill' },
        { mode: 'innate', spell: { id: 'rolling boom|tst' }, uses: { charges: 2 } },
        { mode: 'innate', spell: { id: 'dim lantern|tst' }, uses: { count: 1, recharge: 'dawn' } },
      ],
    });
    // Item groups are items that list their members.
    const group = get<Item>(r, 'item', 'lantern focus|tst');
    expect(group).toMatchObject({
      itemKind: 'focus',
      groupItemIds: ['torch|tst', 'everburning torch|tst'],
    });
    expect(JSON.stringify(group.entries)).toContain('{@item Everburning Torch|TST}');
  });

  it('keys deities by pantheon and links later printings of the same god (plan §6.12)', async () => {
    const r = await run();
    const ids = (r.entities.deity ?? []).map((d) => d.id);
    expect(ids).toEqual([
      'mirela|forgotten realms|old',
      'mirela|faerûnian|tst',
      'mirela|seafolk|old',
      'brask|seafolk|old',
      'brask|seafolk|tst',
    ]);
    // Forgotten Realms and Faerûnian are one pantheon; the Seafolk Mirela is another goddess.
    expect(get<Deity>(r, 'deity', 'mirela|forgotten realms|old').supersededBy).toEqual([
      'mirela|faerûnian|tst',
    ]);
    expect(get<Deity>(r, 'deity', 'mirela|seafolk|old').supersededBy).toBeUndefined();
    expect(get<Deity>(r, 'deity', 'mirela|faerûnian|tst')).toMatchObject({
      pantheon: 'Faerûnian',
      alignment: ['N', 'G'],
      domains: ['Life', 'Light'],
      category: 'The Bright Court',
      altNames: ['The Morning Lady'],
    });
    // A copy found by name, pantheon and source.
    const brask = get<Deity>(r, 'deity', 'brask|seafolk|tst');
    expect(brask).toMatchObject({ domains: ['Knowledge'], province: 'Tides, patience' });
    expect(brask.entries).toEqual([
      'Brask counts the waves.',
      'Sailors leave him a coin at the harbor.',
    ]);
    expect(get<Deity>(r, 'deity', 'brask|seafolk|old').supersededBy).toEqual(['brask|seafolk|tst']);
  });

  it('gives each charm one counter that its spells are paid from', async () => {
    const r = await run();
    const charm = get<Reward>(r, 'reward', 'charm of sparks|tst');
    expect(charm).toMatchObject({ rewardType: 'Charm', facilityIds: ['spark forge|tst'] });
    // "Cast one of these once": one use, from the spell data.
    const once = { resource: 'uses', cost: 1 };
    expect(charm.effects).toEqual([
      { type: 'resource', resourceId: 'uses', name: 'Uses', max: 1, recharge: 'none' },
      {
        type: 'grantSpells',
        spells: [
          { mode: 'innate', uses: once, spell: { id: 'glitter burst|tst' }, castAtLevel: 3 },
          { mode: 'innate', uses: once, spell: { id: 'dim lantern|tst' } },
        ],
      },
    ]);
    // Charges and per-spell costs come from the text.
    expect(get<Reward>(r, 'reward', 'charm of embers|tst').effects).toEqual([
      { type: 'resource', resourceId: 'uses', name: 'Charges', max: 3, recharge: 'none' },
      {
        type: 'grantSpells',
        spells: [
          {
            mode: 'innate',
            uses: { resource: 'uses', cost: 2 },
            spell: { id: 'glitter burst|tst' },
          },
          { mode: 'innate', uses: { resource: 'uses', cost: 1 }, spell: { id: 'dim lantern|tst' } },
        ],
      },
    ]);
    expect(get<Reward>(r, 'reward', 'blessing of the crowd|tst').effects).toEqual([
      {
        type: 'grantSpells',
        spells: [
          {
            mode: 'innate',
            ability: 'cha',
            uses: { count: 'max(1,mod.cha)', recharge: 'long' },
            spell: { id: 'dim lantern|tst' },
          },
        ],
      },
    ]);
    // A reprint as another kind (a feat) is left out.
    expect(get<Reward>(r, 'reward', 'boon of applause|old')).toMatchObject({
      edition: '2014',
      supersededBy: ['blessing of the crowd|tst'],
    });
  });

  it('converts Bastion facilities and character options', async () => {
    const r = await run();
    expect(get<Facility>(r, 'facility', 'spark forge|tst')).toMatchObject({
      facilityType: 'special',
      level: 5,
      space: ['roomy', 'vast'],
      hirelings: [
        { exact: 1, space: 'roomy' },
        { exact: 2, space: 'vast' },
      ],
      orders: ['craft'],
      prerequisites: [
        [
          {
            type: 'other',
            text: 'Ability to use an {@item Arcane Focus|XPHB} or tool as a {@variantrule Spellcasting Focus|XPHB}',
          },
        ],
      ],
    });
    expect(get<Facility>(r, 'facility', 'guild hall|tst')).toMatchObject({
      hirelings: [{ min: 2 }],
      prerequisites: [[{ type: 'other', text: 'Membership in the Lantern Guild or Net Menders' }]],
    });
    const yard = get<Facility>(r, 'facility', 'practice yard|tst');
    expect(yard).toMatchObject({ facilityType: 'basic', hirelings: [], orders: [] });
    expect(yard.level).toBeUndefined();
    expect(get<CharOption>(r, 'charOption', 'gift of echoes|old')).toMatchObject({
      edition: '2014',
      optionTypes: ['SG'],
      prerequisites: [[{ type: 'other', text: 'Stoneborn or Mossling' }]],
    });
  });

  it('keeps flavor text apart from the rules, without images (plan §9.3b)', async () => {
    const r = await run();
    expect(get(r, 'class', 'brute|tst').fluff).toEqual([
      {
        type: 'section',
        entries: ['Brutes settle arguments by lifting the other side over their heads.'],
      },
    ]);
    expect(get(r, 'subclass', 'spark|brute|tst|tst').fluff).toEqual([
      'Sparks crackle around these brutes when they are angry.',
    ]);
    const mossling = ['Mosslings are small folk who grow a coat of soft moss in damp seasons.'];
    expect(get(r, 'species', 'mossling|tst').fluff).toEqual(mossling);
    // A lineage without its own takes its species'; a `_copy` takes its parent's.
    expect(get(r, 'species', 'mossling; deep lineage|tst').fluff).toEqual(mossling);
    expect(get(r, 'species', 'stoneborn|old').fluff).toEqual(mossling);
    expect(get(r, 'background', 'arena hand|tst').fluff).toEqual([
      'You swept the sand between bouts.',
    ]);
    expect(get(r, 'feat', 'arena veteran|tst').fluff).toBeUndefined();
  });

  it('is deterministic, so re-importing keeps every id and slot', async () => {
    const a = await run();
    const b = await run('elsewhere/5etools/data/');
    expect(b.entities).toEqual(a.entities);
  });

  it('can keep only some sources', async () => {
    const r = await importFivetools(fixtureSource(), { now: 1, onlySources: ['OLD'] });
    expect(r.sources.map((s) => s.code)).toEqual(['OLD']);
    expect(r.report.counts).toEqual({
      spell: 1,
      subclass: 2,
      subclassFeature: 1,
      species: 2,
      deity: 3,
      reward: 1,
      charOption: 1,
      creature: 1,
    });
  });
});
