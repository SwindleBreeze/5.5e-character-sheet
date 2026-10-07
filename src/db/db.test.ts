import { Dexie } from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CHARACTER_SCHEMA_VERSION,
  type ContentOrigin,
  type SourceInfo,
  type Spell,
} from '../schema/index.ts';
import { createCharacterRepo, newCharacter } from './characterRepo.ts';
import { createContentRepo } from './contentRepo.ts';
import { AppDb, resetDb } from './db.ts';
import { DEFAULT_SETTINGS, createSettingsRepo } from './settingsRepo.ts';

const origin: ContentOrigin = { adapter: 'homebrew', adapterVersion: 1, importedAt: 0 };

function spell(name: string, source: string, level: Spell['level'] = 1): Spell {
  return {
    kind: 'spell',
    id: `${name}|${source}`.toLowerCase(),
    name,
    source,
    edition: '2024',
    entries: [`${name} does a test thing.`],
    effects: [],
    origin,
    level,
    school: 'V',
    time: [{ amount: 1, unit: 'action' }],
    range: { type: 'self' },
    components: { v: true },
    duration: [{ type: 'instant' }],
    ritual: false,
    classIds: ['testificate|test'],
    subclassIds: [],
  };
}

function source(code: string): SourceInfo {
  return {
    code,
    name: `Source ${code}`,
    edition: '2024',
    counts: {},
    importedAt: 0,
    adapterVersion: 1,
    origin: 'homebrew',
  };
}

let db: AppDb;

beforeEach(async () => {
  db = await resetDb('test-db');
});

describe('contentRepo', () => {
  it('replaces entities by source, deleting stale ones and leaving other sources alone', async () => {
    const repo = createContentRepo(db);
    await repo.replaceSources([source('AAA'), source('BBB')], {
      spell: [spell('Zap', 'AAA'), spell('Fizz', 'AAA'), spell('Bonk', 'BBB')],
    });
    expect(await repo.countByKind('spell')).toBe(3);

    // Re-import AAA with Fizz removed and Zap changed (errata).
    const errata = { ...spell('Zap', 'AAA'), entries: ['Zap, corrected.'] };
    await repo.replaceSources([source('AAA')], { spell: [errata] });

    const all = await repo.listByKind('spell');
    expect(all.map((s) => s.id).sort()).toEqual(['bonk|bbb', 'zap|aaa']);
    expect((await repo.get('spell', 'zap|aaa'))?.entries).toEqual(['Zap, corrected.']);
  });

  it('resolves many refs and skips missing ones', async () => {
    const repo = createContentRepo(db);
    await repo.replaceSources([source('AAA')], { spell: [spell('Zap', 'AAA')] });
    const found = await repo.getMany([
      { kind: 'spell', id: 'zap|aaa' },
      { kind: 'spell', id: 'missing|aaa' },
      { kind: 'feat', id: 'nope|aaa' },
    ]);
    expect([...found.keys()]).toEqual(['spell:zap|aaa']);
  });

  it('deletes a whole source', async () => {
    const repo = createContentRepo(db);
    await repo.replaceSources([source('AAA'), source('BBB')], {
      spell: [spell('Zap', 'AAA'), spell('Bonk', 'BBB')],
    });
    await repo.deleteSource('AAA');
    expect((await repo.listByKind('spell')).map((s) => s.id)).toEqual(['bonk|bbb']);
    expect((await repo.listSources()).map((s) => s.code)).toEqual(['BBB']);
  });
});

describe('characterRepo', () => {
  it('saves, lists newest first, and removes', async () => {
    const repo = createCharacterRepo(db);
    const a = await repo.save(newCharacter('Ada', 1), 100);
    const b = await repo.save(newCharacter('Bo', 1), 200);
    expect((await repo.list()).map((c) => c.name)).toEqual(['Bo', 'Ada']);

    await repo.save({ ...a, name: 'Ada II' }, 300);
    expect((await repo.list()).map((c) => c.name)).toEqual(['Ada II', 'Bo']);

    await repo.remove(b.id);
    expect(await repo.get(b.id)).toBeUndefined();
  });

  it('upgrades characters stored by an older app when reading them', async () => {
    const old = { ...newCharacter('Old', 1), schemaVersion: 1 };
    await db.characters.put(old);
    const repo = createCharacterRepo(db);
    expect((await repo.get(old.id))?.schemaVersion).toBe(CHARACTER_SCHEMA_VERSION);
    expect((await repo.list())[0]?.state.wardHp).toBe(0);
  });

  it('duplicates a character with its portrait under new ids', async () => {
    const repo = createCharacterRepo(db);
    const original = newCharacter('Ada', 1);
    original.portraitId = 'p1';
    await db.portraits.put({ id: 'p1', blob: new Blob(['img']), updatedAt: 1 });
    await repo.save(original, 1);

    const copy = await repo.duplicate(original.id, 50);
    expect(copy).toBeDefined();
    expect(copy?.id).not.toBe(original.id);
    expect(copy?.name).toBe('Ada (copy)');
    expect(copy?.portraitId).toBeDefined();
    expect(copy?.portraitId).not.toBe('p1');
    expect(await db.portraits.count()).toBe(2);

    await repo.remove(original.id);
    expect(await db.portraits.get('p1')).toBeUndefined();
    expect(await db.portraits.count()).toBe(1);
  });

  it('stores a portrait under a new id, replacing the old one, and removes it', async () => {
    const repo = createCharacterRepo(db);
    const first = await repo.putPortrait(new Blob(['a']), undefined, 1);
    const second = await repo.putPortrait(new Blob(['bb']), first, 2);
    expect(second).not.toBe(first);
    expect(await repo.portrait(first)).toBeUndefined();
    expect(await repo.portrait(second)).toBeDefined();
    await repo.removePortrait(second);
    expect(await db.portraits.count()).toBe(0);
  });
});

describe('settingsRepo', () => {
  it('returns defaults until a value is set', async () => {
    const repo = createSettingsRepo(db);
    expect(await repo.get('enabledSources')).toEqual(DEFAULT_SETTINGS.enabledSources);
    await repo.set('enabledSources', ['XPHB']);
    expect(await repo.get('enabledSources')).toEqual(['XPHB']);
    expect(await repo.get('lastBackupAt')).toBeNull();
  });
});

describe('schema upgrades', () => {
  it('version 2 opens a version 1 database, keeping content and adding the extras tables', async () => {
    const name = 'test-upgrade';
    await Dexie.delete(name);
    // The version 1 schema as it shipped in phase 2.
    const v1 = new Dexie(name);
    v1.version(1).stores({
      spells: 'id, source, level, *classIds, *subclassIds, name',
      classes: 'id, source',
      classFeatures: 'id, classId, level, source',
      subclasses: 'id, classId, source',
      subclassFeatures: 'id, subclassId, level, source',
      backgrounds: 'id, source',
      feats: 'id, source, category',
      species: 'id, source, variantOf',
      items: 'id, source, itemKind',
      optionalFeatures: 'id, source, *featureTypes',
      rules: 'id, ruleKind, source',
      sources: 'code',
      characters: 'id, updatedAt',
      portraits: 'id',
      settings: 'key',
    });
    await v1.table('spells').put(spell('Glow', 'TST'));
    v1.close();

    const upgraded = new AppDb(name);
    expect(await upgraded.spells.get('glow|tst')).toMatchObject({ name: 'Glow' });
    expect(await upgraded.deities.count()).toBe(0);
    const repo = createContentRepo(upgraded);
    await repo.replaceSources([source('TST')], {
      deity: [
        {
          ...spell('Mirela', 'TST'),
          kind: 'deity',
          id: 'mirela|seafolk|tst',
          pantheon: 'Seafolk',
          alignment: ['N'],
          domains: ['Tempest'],
        } as never,
      ],
    });
    expect(await upgraded.deities.where('pantheon').equals('Seafolk').count()).toBe(1);
    upgraded.close();
    await Dexie.delete(name);
  });
});
