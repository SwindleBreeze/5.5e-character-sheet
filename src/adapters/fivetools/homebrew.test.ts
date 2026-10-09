import { describe, expect, it } from 'vitest';
import {
  refKey,
  type ClassDef,
  type ContentEntity,
  type EntityKind,
  type Item,
  type Species,
  type Spell,
  type Subclass,
} from '../../schema/index.ts';
import { fixtureSource } from '../../test/fivetoolsFixture.ts';
import { homebrewFiles } from '../../test/homebrewFixture.ts';
import { importHomebrew, rawHomebrewUrl, type HomebrewOptions } from './homebrew.ts';
import { importFivetools, type ImportResult } from './index.ts';

/** The official fixture as "the content on this device". */
async function device(): Promise<Required<Pick<HomebrewOptions, 'lookup' | 'existing'>>> {
  const official = await importFivetools(fixtureSource(), { now: 1 });
  const all = Object.values(official.entities).flat() as ContentEntity[];
  const byKey = new Map(all.map((e) => [refKey({ kind: e.kind, id: e.id }), e]));
  return {
    existing: official.sources,
    lookup: async (refs) =>
      new Map(
        refs.flatMap((r) => {
          const e = byKey.get(refKey(r));
          return e ? [[refKey(r), e] as const] : [];
        }),
      ),
  };
}

function get<T extends ContentEntity>(r: ImportResult, kind: EntityKind, id: string): T {
  const found = (r.entities[kind] as ContentEntity[] | undefined)?.find((e) => e.id === id);
  if (!found) throw new Error(`missing ${kind} ${id}`);
  return found as T;
}

const messages = (r: ImportResult, code: string) =>
  r.report.warnings.filter((w) => w.code === code).map((w) => w.message);

describe('importHomebrew (plan step 7.3)', () => {
  it('reads _meta.sources into homebrew sources, with edition from the data', async () => {
    const r = await importHomebrew(homebrewFiles(), { now: 5, ...(await device()) });
    expect(r.sources.map((s) => [s.code, s.origin, s.edition])).toEqual([
      ['BrutePaths', 'homebrew', 'unknown'],
      ['HearthGuide', 'homebrew', '2024'],
    ]);
    const hearth = r.sources[1]!;
    expect(hearth).toMatchObject({
      name: "The Hearthkeeper's Guide",
      group: 'other',
      importedAt: 5,
      homebrew: {
        abbreviation: 'HG',
        authors: ['Tess Example', 'Rowan Sample'],
        version: '1.2.0',
        url: 'https://example.com/hearth-guide',
      },
    });
    expect(hearth.counts).toMatchObject({ class: 1, subclass: 1, spell: 2, item: 2, species: 2 });
    expect(get(r, 'class', 'hearthwarden|hearthguide').origin.adapter).toBe('homebrew');
  });

  it('resolves _copy against content already on the device', async () => {
    const r = await importHomebrew(homebrewFiles(), await device());
    // An item copying an official base item: its stats, its own name and the added text.
    const shiv = get<Item>(r, 'item', 'bright shiv|hearthguide');
    expect(shiv).toMatchObject({ name: 'Bright Shiv', source: 'HearthGuide', itemKind: 'weapon' });
    expect(shiv.weapon?.damage).toBe('1d4');
    expect(shiv.entries.at(-1)).toBe('It glows faintly.');
    // A subrace of an official species: a variant of it, with its own resistance and text.
    const moss = get<Species>(r, 'species', 'mossling (hearth)|hearthguide');
    expect(moss.variantOf).toBe('mossling|tst');
    expect(moss.speed.walk).toBe(30);
    expect(moss.effects).toContainEqual({ type: 'resistance', value: 'fire' });
    expect(moss.effects).not.toContainEqual({ type: 'resistance', value: 'poison' });
    expect(JSON.stringify(moss.entries)).toContain('Warm Moss');
  });

  it('without the official content, a copy is skipped and the report says why', async () => {
    const r = await importHomebrew(homebrewFiles('hearth-guide.json'));
    expect(r.entities.item?.map((i) => i.id)).toEqual(['ember lantern|hearthguide']);
    expect(messages(r, 'copyMissing')).toEqual([
      'Copies Mossling|TST, which is not imported on this device; import it first',
      'Copies Shiv|TST, which is not imported on this device; import it first',
    ]);
  });

  it('reports what it skipped and why', async () => {
    const r = await importHomebrew(homebrewFiles(), await device());
    // A record claiming an official source is not written over it.
    expect(messages(r, 'sourceConflict')).toEqual([
      "Records with source TST were skipped: TST is already imported and isn't homebrew",
    ]);
    expect(r.entities.feat?.map((f) => f.id)).toEqual(['kettle sage|hearthguide']);
    expect(messages(r, 'dependency')).toEqual([
      'brute-paths.json needs KettleCompendium, which is not imported; import it first',
    ]);
    expect(messages(r, 'refMissing')).toEqual([
      'Feature not found: banked coals|hearthwarden|hearthguide|2|hearthguide',
      'Feature not found: boiling point|brute|tst|kettle|brutepaths|6|brutepaths',
    ]);
    expect(messages(r, 'fieldMissing')).toEqual([
      '1 records had no source and were given HearthGuide',
    ]);
    expect(messages(r, 'unknownShape')).toEqual([
      "Text blocks the app can't show as intended (shown plainly): emberChart",
    ]);
    expect(r.report.ignored).toEqual({});
    // Homebrew creatures are kept, even sparse ones, for companions written in a homebrew book.
    expect(r.entities.creature?.map((c) => c.id)).toEqual(['hearth sprite|hearthguide']);
  });

  it('refuses files that are not homebrew, and keeps going', async () => {
    const r = await importHomebrew([
      { name: 'notes.txt', text: 'hello' },
      ...homebrewFiles('brute-paths.json'),
    ]);
    expect(messages(r, 'fileInvalid')).toEqual([
      'Not a homebrew file (not a JSON object): notes.txt',
    ]);
    // With no TST on the device, its record is kept, as a source named by its code.
    expect(r.sources.map((s) => s.code)).toEqual(['BrutePaths', 'TST']);
    expect(messages(r, 'sourceUndeclared')).toEqual([
      'Source TST is not in "_meta.sources"; named by code',
    ]);
  });

  it('a homebrew subclass of an official class points at that class', async () => {
    const r = await importHomebrew(homebrewFiles('brute-paths.json'), await device());
    const kettle = get<Subclass>(r, 'subclass', 'kettle|brute|tst|brutepaths');
    expect(kettle.classId).toBe('brute|tst');
    expect(messages(r, 'refMissing')).not.toContainEqual(expect.stringContaining('Class'));
  });

  it('turns GitHub file pages into raw file links', () => {
    expect(
      rawHomebrewUrl('https://github.com/someone/homebrew/blob/master/class/My Class.json'),
    ).toBe('https://raw.githubusercontent.com/someone/homebrew/master/class/My Class.json');
    expect(rawHomebrewUrl(' https://example.com/brew.json ')).toBe('https://example.com/brew.json');
  });
});

describe('homebrew robustness (plan step 7.4)', () => {
  it('a class without a caster policy prepares spells; sloppy fields are read', async () => {
    const r = await importHomebrew(homebrewFiles('hearth-guide.json'), await device());
    const cls = get<ClassDef>(r, 'class', 'hearthwarden|hearthguide');
    // "WIS" in capitals; no preparedSpellsChange: prepared casting (plan §9.1).
    expect(cls.spellcasting).toMatchObject({ ability: 'wis', progression: 'full' });
    expect(cls.spellcasting?.preparedChange).toBeUndefined();
    // The class borrows the Lorekeeper's list and one more spell.
    expect(cls.spellcasting?.listAlso).toEqual({
      classes: ['Lorekeeper'],
      spellIds: ['spark bolt|tst'],
    });
    // An odd table: a dash and a missing cell both read as 0.
    const embers = cls.table.find((c) => c.key === 'embers');
    expect(embers?.values.slice(0, 4)).toEqual([1, 0, 0, 2]);
    expect(cls.table.find((c) => c.key === 'spells-known')?.values.slice(0, 3)).toEqual([3, 4, 5]);
    // A spell that named its classes itself, and one with an unknown school.
    expect(get<Spell>(r, 'spell', 'cinder flick|hearthguide').classIds).toEqual([
      'hearthwarden|hearthguide',
    ]);
    expect(get<Spell>(r, 'spell', 'warm hearth|hearthguide').school).toBe('Q');
    // A subclass adding a spell to its class's list.
    expect(
      get<Subclass>(r, 'subclass', 'embers|hearthwarden|hearthguide|hearthguide').effects,
    ).toEqual([
      {
        type: 'grantSpells',
        spells: [{ mode: 'expanded', spell: { id: 'warm hearth|hearthguide' } }],
      },
    ]);
  });

  it('a caster with no prepared-spell counts is reported', async () => {
    const brew = {
      _meta: { sources: [{ json: 'Bare', full: 'Bare Brew' }] },
      class: [
        {
          name: 'Candle',
          hd: { faces: 6 },
          spellcastingAbility: 'int',
          casterProgression: '1/2',
          classFeatures: [],
        },
      ],
    };
    const r = await importHomebrew([{ name: 'bare.json', text: JSON.stringify(brew) }]);
    expect(get<ClassDef>(r, 'class', 'candle|bare').hitDie).toBe(6);
    expect(messages(r, 'spellCounts')).toEqual([
      'Candle casts spells but gives no number of prepared spells; prepare them with Ignore rules',
    ]);
  });

  it('a record that breaks a converter is reported and the rest still import', async () => {
    const brew = {
      _meta: { sources: [{ json: 'Odd' }] },
      feat: [
        { name: 'Fine Feat', entries: ['ok'] },
        { source: 'Odd', entries: ['no name'] },
      ],
      spell: [{ name: 'Weird', level: 'high', school: 7, time: 'soon', entries: 'one line' }],
    };
    const r = await importHomebrew([{ name: 'odd.json', text: JSON.stringify(brew) }]);
    expect(r.entities.feat?.map((f) => f.name)).toEqual(['Fine Feat']);
    expect(messages(r, 'fieldMissing')).toContain('feat without a name; skipped');
    const weird = get<Spell>(r, 'spell', 'weird|odd');
    expect(weird.level).toBe(0);
    expect(weird.entries).toEqual(['one line']);
  });
});
