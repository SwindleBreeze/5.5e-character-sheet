import { beforeEach, describe, expect, it } from 'vitest';
import { createContentRepo } from '../db/contentRepo.ts';
import { resetDb, type AppDb } from '../db/db.ts';
import { createSettingsRepo } from '../db/settingsRepo.ts';
import type { ContentOrigin, SourceInfo, Spell } from '../schema/index.ts';
import { buildPack, encodePack } from './pack/packFile.ts';
import { storeSrdPack } from './srdPack.ts';

const origin: ContentOrigin = { adapter: 'homebrew', adapterVersion: 1, importedAt: 0 };

/** A spell filed under its twin's id (`zap|xphb`), from `source`. */
function spell(name: string, source: string): Spell {
  return {
    kind: 'spell',
    id: `${name}|xphb`.toLowerCase(),
    name,
    source,
    edition: '2024',
    entries: [`${name} as ${source} has it.`],
    effects: [],
    origin,
    level: 1,
    school: 'V',
    time: [{ amount: 1, unit: 'action' }],
    range: { type: 'self' },
    components: { v: true },
    duration: [{ type: 'instant' }],
    ritual: false,
    classIds: [],
    subclassIds: [],
  };
}

function source(code: string): SourceInfo {
  return {
    code,
    name: code,
    edition: '2024',
    counts: {},
    importedAt: 0,
    adapterVersion: 1,
    origin: 'pack',
  };
}

const srdPack = () =>
  encodePack(
    buildPack({ spell: [spell('Zap', 'SRD52'), spell('Fizz', 'SRD52')] }, [source('SRD52')], 1, 0),
  );

let db: AppDb;
beforeEach(async () => {
  db = await resetDb('srd-test');
});

describe('storeSrdPack', () => {
  it('stores the free rules and switches them on', async () => {
    const deps = { content: createContentRepo(db), settings: createSettingsRepo(db) };
    await deps.settings.set('enabledSources', ['XPHB']);
    const info = await storeSrdPack(await srdPack(), deps, 5);
    expect(info).toMatchObject({ code: 'SRD52', counts: { spell: 2 }, importedAt: 5 });
    expect((await deps.content.listByKind('spell')).map((s) => s.source)).toEqual([
      'SRD52',
      'SRD52',
    ]);
    expect(await deps.settings.get('enabledSources')).toEqual(['SRD52', 'XPHB']);
  });

  it('leaves an entry a book already holds to the book, and keeps the rest', async () => {
    const deps = { content: createContentRepo(db), settings: createSettingsRepo(db) };
    await deps.content.replaceSources([source('XPHB')], { spell: [spell('Zap', 'XPHB')] });
    const info = await storeSrdPack(await srdPack(), deps, 5);
    expect(info.counts).toEqual({ spell: 1 });
    expect((await deps.content.get('spell', 'zap|xphb'))?.source).toBe('XPHB');
    expect((await deps.content.get('spell', 'fizz|xphb'))?.source).toBe('SRD52');
  });

  it('gives an entry back once the book holding it is gone', async () => {
    const deps = { content: createContentRepo(db), settings: createSettingsRepo(db) };
    await deps.content.replaceSources([source('XPHB')], { spell: [spell('Zap', 'XPHB')] });
    await storeSrdPack(await srdPack(), deps, 5);
    await deps.content.deleteSource('XPHB');
    await storeSrdPack(await srdPack(), deps, 6);
    expect((await deps.content.get('spell', 'zap|xphb'))?.source).toBe('SRD52');
  });
});
