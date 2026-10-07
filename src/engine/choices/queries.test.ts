import { beforeAll, describe, expect, it } from 'vitest';
import type { ContentEntity, Effect, Item, Skill } from '../../schema/index.ts';
import { fixtureContent } from '../../test/fixtureIndex.ts';
import { createCatalog, type Catalog } from '../build/catalog.ts';
import type { Offer } from '../collect/types.ts';
import type { DerivedSheet } from '../derive/types.ts';
import { classToolEffects } from '../collect/collect.ts';
import {
  baseWeapons,
  expertiseOptions,
  isWeaponKind,
  sheetProficientWith,
  weaponMasteryOptions,
} from './queries.ts';

let catalog: Catalog;
let items: Item[];

/** Weapons the fixture lacks: a focus that is also a weapon, a feature's weapon, a firearm. */
const extra: Item[] = [
  {
    ...base('focus staff|tst', 'Focus Staff'),
    weapon: { category: 'simple', damage: '1d6', damageType: 'bludgeoning', properties: [] },
    weightLb: 4,
    variantBase: { type: 'SCF|TST' },
  },
  {
    ...base('mind blade|tst', 'Mind Blade'),
    weapon: {
      category: 'simple',
      damage: '1d6',
      damageType: 'psychic',
      properties: [],
      masteryId: 'mastery/vex|tst',
    },
  },
  {
    ...base('ray gun|tst', 'Ray Gun'),
    weapon: {
      category: 'martial',
      damage: '2d8',
      damageType: 'radiant',
      properties: [],
      masteryId: 'mastery/sap|tst',
      ranged: true,
    },
    weightLb: 2,
    variantBase: { type: 'R|TST', firearm: true },
  },
];

function base(id: string, name: string): Item {
  return {
    id,
    kind: 'item',
    name,
    source: 'TST',
    edition: '2024',
    entries: [],
    effects: [],
    origin: { adapter: '5etools', adapterVersion: 4, importedAt: 0 },
    itemKind: 'weapon',
  };
}

beforeAll(async () => {
  const content = await fixtureContent();
  const all = [...(Object.values(content.entities).flat() as ContentEntity[]), ...extra];
  catalog = createCatalog(all, new Set(['TST']));
  items = catalog.of('item') as Item[];
});

const item = (id: string) => items.find((i) => i.id === id)!;

/** A sheet with only what the queries read. */
function sheet(weapons: string[], proficient: string[] = [], expert: string[] = []): DerivedSheet {
  const skills = Object.fromEntries(
    ['arcana', 'history', 'stealth', 'athletics'].map((s) => [
      s,
      {
        proficiency: expert.includes(s)
          ? 'expertise'
          : proficient.includes(s)
            ? 'proficient'
            : 'none',
      },
    ]),
  );
  return {
    proficiencies: { weapons: weapons.map((value) => ({ value, sources: [] })) },
    skills: new Proxy(skills, { get: (t, k) => t[k as string] ?? { proficiency: 'none' } }),
  } as unknown as DerivedSheet;
}

function masteryOffer(
  from: Offer['from'],
  kinds?: Effect & { type: 'weaponMasteryChoice' },
): Offer {
  return {
    key: { owner: { kind: 'classFeature', id: 'x' }, slot: 'mastery' },
    kind: 'weaponMastery',
    count: 2,
    from,
    source: { ref: { kind: 'classFeature', id: 'x' }, name: 'X' },
    ...(kinds ? { effect: kinds } : {}),
  };
}

describe('weapon picks (plan §9.3 step 4.2)', () => {
  it('base weapons leave out focuses and weapons a feature makes', () => {
    const ids = baseWeapons(catalog).map((w) => w.id);
    expect(ids).toContain('shiv|tst');
    expect(ids).toContain('ray gun|tst');
    expect(ids).not.toContain('focus staff|tst');
    expect(ids).not.toContain('mind blade|tst');
  });

  it('proficiency by category, by item, or by 2024 text (Rogue)', () => {
    expect(sheetProficientWith(sheet(['simple']), item('shiv|tst'))).toBe(true);
    expect(sheetProficientWith(sheet(['simple']), item('net blade|tst'))).toBe(false);
    const rogue = sheet(['simple', 'martial weapons that have the finesse or light property']);
    expect(sheetProficientWith(rogue, item('net blade|tst'))).toBe(true); // Finesse
    expect(sheetProficientWith(rogue, item('arc bow|tst'))).toBe(false);
    expect(sheetProficientWith(sheet(['arc bow|tst']), item('arc bow|tst'))).toBe(true);
  });

  it('weapon kinds: category and melee or ranged', () => {
    const kinds = [{ category: 'simple' as const }, { category: 'martial' as const, melee: true }];
    expect(isWeaponKind(item('shiv|tst'), kinds)).toBe(true);
    expect(isWeaponKind(item('net blade|tst'), kinds)).toBe(true);
    expect(isWeaponKind(item('arc bow|tst'), kinds)).toBe(false);
  });

  it('mastery options: kinds, a query, weapons with a mastery, no firearms, carried first', () => {
    const barbarian = masteryOffer('any', {
      type: 'weaponMasteryChoice',
      choice: { slot: 'mastery', count: 2, from: 'any' },
      kinds: [
        { category: 'simple', melee: true },
        { category: 'martial', melee: true },
      ],
    });
    expect(weaponMasteryOptions(barbarian, sheet([]), catalog)).toEqual([
      'net blade|tst',
      'shiv|tst',
      'walking staff|tst',
    ]);
    // Any weapon with a mastery: the Ray Gun is a firearm, the Wrist Bow has none.
    expect(weaponMasteryOptions(masteryOffer('any'), sheet([]), catalog)).toEqual([
      'arc bow|tst',
      'net blade|tst',
      'shiv|tst',
      'walking staff|tst',
    ]);
    const proficient = masteryOffer({ query: 'proficientWeapons' });
    expect(
      weaponMasteryOptions(proficient, sheet(['simple']), catalog, new Set(['walking staff|tst'])),
    ).toEqual(['walking staff|tst', 'shiv|tst']);
  });
});

describe('expertise picks', () => {
  const offer = (from: Offer['from'], filtered: boolean): Offer => ({
    key: { owner: { kind: 'classFeature', id: 'x' }, slot: 'expertise' },
    kind: 'expertise',
    count: 1,
    from,
    source: { ref: { kind: 'classFeature', id: 'x' }, name: 'X' },
    effect: {
      type: 'expertiseChoice',
      choice: { slot: 'expertise', count: 1, from: from as Skill[] },
      ...(filtered ? { filter: 'proficient' as const } : {}),
    },
  });

  it('proficient skills without Expertise, from the offer’s list when it has one (Scholar)', () => {
    const s = sheet([], ['arcana', 'stealth'], ['athletics']);
    expect(
      expertiseOptions(offer({ query: 'proficientSkillsWithoutExpertise' }, true), s, catalog),
    ).toEqual(['arcana', 'stealth']);
    expect(expertiseOptions(offer(['arcana', 'history'], true), s, catalog)).toEqual(['arcana']);
    expect(expertiseOptions(offer(['arcana', 'history'], false), s, catalog)).toEqual([
      'arcana',
      'history',
    ]);
  });
});

describe('class tool text (2024 Bard and Monk)', () => {
  it('becomes a tool choice; tool ids stay proficiencies', () => {
    expect(
      classToolEffects(
        [
          "thieves' tools|xphb",
          'choose three musical instruments',
          "choose one type of artisan's tools or musical instrument",
        ],
        'tools',
      ),
    ).toEqual([
      { type: 'proficiency', category: 'tool', value: "thieves' tools|xphb" },
      {
        type: 'proficiencyChoice',
        category: 'tool',
        choice: { slot: 'tools', count: 3, from: 'any' },
        filter: 'instrument',
      },
      {
        type: 'proficiencyChoice',
        category: 'tool',
        choice: { slot: 'tools.2', count: 1, from: 'any' },
        filter: 'artisan|instrument',
      },
    ]);
    expect(classToolEffects(['three musical instruments of your choice'], 't')).toMatchObject([
      { choice: { count: 3 }, filter: 'instrument' },
    ]);
  });
});
