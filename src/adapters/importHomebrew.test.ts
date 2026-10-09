// Homebrew import end to end (plan steps 7.3 and 7.11): files and links into the database on
// top of the official fixture, shared as a pack, removed while characters keep their copies.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadContentIndex } from '../content/loadIndex.ts';
import { createCharacterRepo } from '../db/characterRepo.ts';
import { createContentRepo } from '../db/contentRepo.ts';
import { resetDb, type AppDb } from '../db/db.ts';
import { createSettingsRepo } from '../db/settingsRepo.ts';
import { createCatalog } from '../engine/build/catalog.ts';
import { quickBuild } from '../engine/build/quickBuild.ts';
import { refreshSnapshots } from '../engine/content/snapshots.ts';
import { refName, resolveRef } from '../engine/content/resolve.ts';
import { derive } from '../engine/derive/derive.ts';
import { createContentIndex } from '../engine/content/contentIndex.ts';
import { ENTITY_KINDS, type ContentEntity, type Ref } from '../schema/index.ts';
import { fixtureFiles } from '../test/fivetoolsFixture.ts';
import { homebrewFiles, homebrewUploads } from '../test/homebrewFixture.ts';
import { runImportJob, type ImportJob } from './importJob.ts';
import { exportPack } from './pack/exportPack.ts';

let db: AppDb;
const deps = () => ({
  content: createContentRepo(db),
  settings: createSettingsRepo(db),
  now: () => 7,
});

/** The official fixture, as a 5etools folder import. */
async function importOfficial() {
  const files = Object.entries(fixtureFiles()).map(([path, text]) => {
    const file = new File([text], path.split('/').pop() ?? path);
    Object.defineProperty(file, 'webkitRelativePath', { value: path });
    return file;
  });
  await runImportJob({ kind: 'fivetools', input: { type: 'files', files } }, deps());
}

const homebrewJob: ImportJob = { kind: 'homebrew', files: homebrewUploads() };

beforeEach(async () => {
  db = await resetDb('test-import-homebrew');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('homebrew import', () => {
  it('writes homebrew next to the official content and switches it on', async () => {
    await importOfficial();
    const settings = createSettingsRepo(db);
    await settings.set('enabledSources', ['TST']);
    const stages: string[] = [];

    const summary = await runImportJob(homebrewJob, deps(), (s) => stages.push(s));
    expect(stages).toEqual(['read', 'convert', 'write']);
    expect(summary.origin).toBe('homebrew');
    expect(summary.sources.map((s) => [s.code, s.origin])).toEqual([
      ['BrutePaths', 'homebrew'],
      ['HearthGuide', 'homebrew'],
    ]);
    const repo = createContentRepo(db);
    expect((await repo.listSources()).map((s) => s.code)).toEqual([
      'BrutePaths',
      'HearthGuide',
      'OLD',
      'TST',
    ]);
    // The copy of an official item was made from the official content in the database.
    expect(await repo.get('item', 'bright shiv|hearthguide')).toMatchObject({ itemKind: 'weapon' });
    // The official record in a homebrew file did not overwrite the official one.
    expect((await repo.get('feat', 'arena veteran|tst'))?.origin.adapter).toBe('5etools');
    expect(await settings.get('enabledSources')).toEqual(['BrutePaths', 'HearthGuide', 'TST']);
    expect(await settings.get('lastImport')).toEqual(summary);
  });

  it('re-importing homebrew keeps a source switched off when the player switched it off', async () => {
    await importOfficial();
    await runImportJob(homebrewJob, deps());
    const settings = createSettingsRepo(db);
    await settings.set('enabledSources', ['TST']);
    await runImportJob(homebrewJob, deps());
    expect(await settings.get('enabledSources')).toEqual(['TST']);
  });

  it('downloads links, GitHub pages as raw files, and reports a link that fails', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes('hearth')
        ? new Response(homebrewFiles('hearth-guide.json')[0]!.text)
        : new Response('nope', { status: 404 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const summary = await runImportJob(
      {
        kind: 'homebrew',
        urls: [
          'https://github.com/someone/homebrew/blob/master/collection/hearth.json',
          'https://example.com/missing.json',
        ],
      },
      deps(),
    );
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      'https://raw.githubusercontent.com/someone/homebrew/master/collection/hearth.json',
      'https://example.com/missing.json',
    ]);
    expect(summary.sources.map((s) => s.code)).toEqual(['HearthGuide']);
    expect(summary.sources[0]?.homebrew?.url).toBe(
      'https://github.com/someone/homebrew/blob/master/collection/hearth.json',
    );
    expect(summary.report.warnings[0]).toEqual({
      code: 'fileMissing',
      message: 'Could not download https://example.com/missing.json: the server answered 404',
    });
  });

  it('fails clearly when nothing could be read', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('offline'))),
    );
    await expect(
      runImportJob({ kind: 'homebrew', urls: ['https://example.com/a.json'] }, deps()),
    ).rejects.toThrow('Could not download https://example.com/a.json: offline');
  });

  it('a pack of the homebrew carries it to another device as homebrew', async () => {
    await importOfficial();
    await runImportJob(homebrewJob, deps());
    const { bytes, fileName } = await exportPack(createContentRepo(db), {
      sources: ['BrutePaths', 'HearthGuide'],
      fileName: 'homebrew',
      now: Date.UTC(2026, 9, 8),
    });
    expect(fileName).toBe('homebrew-2026-10-08.pack.json.gz');

    // Another phone, with the official pack already on it.
    db = await resetDb('test-import-homebrew-2');
    await importOfficial();
    const summary = await runImportJob(
      { kind: 'pack', file: new Blob([new Uint8Array(bytes)]) },
      deps(),
    );
    expect(summary.sources.map((s) => [s.code, s.origin])).toEqual([
      ['BrutePaths', 'homebrew'],
      ['HearthGuide', 'homebrew'],
    ]);
    expect(summary.sources[1]?.homebrew).toMatchObject({ abbreviation: 'HG', version: '1.2.0' });
    const repo = createContentRepo(db);
    expect(await repo.get('class', 'hearthwarden|hearthguide')).toBeDefined();
    expect((await repo.listSources()).find((s) => s.code === 'TST')?.origin).toBe('5etools');
  });

  it('removing a homebrew source leaves characters with their snapshots', async () => {
    await importOfficial();
    await runImportJob(homebrewJob, deps());
    const content = createContentRepo(db);
    const all: ContentEntity[] = [];
    for (const kind of ENTITY_KINDS) all.push(...(await content.listByKind(kind)));
    const getMany = (refs: Ref[]) => content.getMany(refs);

    const built = quickBuild(
      {
        name: 'Wren',
        classes: [{ classId: 'hearthwarden|hearthguide', levels: 1 }],
        speciesId: 'fernling|hearthguide',
        backgroundId: 'lamplighter|hearthguide',
      },
      {
        index: createContentIndex(all),
        catalog: createCatalog(all, new Set(['TST', 'HearthGuide'])),
        now: 1,
      },
    );
    const index = await loadContentIndex(built, getMany);
    const withSnapshots = refreshSnapshots(built, index, derive(built, index), 1);
    const characters = createCharacterRepo(db);
    const saved = await characters.save(withSnapshots, 1);
    expect(saved.snapshots['class:hearthwarden|hearthguide']?.name).toBe('Hearthwarden');

    await content.deleteSource('HearthGuide');
    expect(await content.get('class', 'hearthwarden|hearthguide')).toBeUndefined();
    const after = (await characters.get(saved.id))!;
    const afterIndex = await loadContentIndex(after, getMany);
    const ref = { kind: 'class', id: 'hearthwarden|hearthguide' } as const;
    expect(resolveRef(afterIndex, after.snapshots, ref).status).toBe('snapshot');
    expect(refName(afterIndex, after.snapshots, ref)).toBe('Hearthwarden');
  });
});
