import { beforeEach, describe, expect, it } from 'vitest';
import { createContentRepo } from '../db/contentRepo.ts';
import { resetDb, type AppDb } from '../db/db.ts';
import { createSettingsRepo } from '../db/settingsRepo.ts';
import { ENTITY_KINDS, PACK_FORMAT, type EntitiesByKind } from '../schema/index.ts';
import { fixtureFiles } from '../test/fivetoolsFixture.ts';
import { runImportJob, type ImportJob } from './importJob.ts';
import { exportPack } from './pack/exportPack.ts';
import { buildPack, decodePack, encodePack, gzip, PackError } from './pack/packFile.ts';

let db: AppDb;
const deps = () => ({
  content: createContentRepo(db),
  settings: createSettingsRepo(db),
  now: () => 1,
});

function filesJob(files: Record<string, string>, onlySources?: string[]): ImportJob {
  const list = Object.entries(files).map(([path, text]) => {
    const file = new File([text], path.split('/').pop() ?? path);
    Object.defineProperty(file, 'webkitRelativePath', { value: path });
    return file;
  });
  return {
    kind: 'fivetools',
    input: { type: 'files', files: list },
    ...(onlySources ? { onlySources } : {}),
  };
}

async function allEntities(): Promise<EntitiesByKind> {
  const repo = createContentRepo(db);
  const out: EntitiesByKind = {};
  for (const kind of ENTITY_KINDS) {
    const list = await repo.listByKind(kind);
    if (list.length)
      (out as Record<string, unknown>)[kind] = list.sort((a, b) => a.id.localeCompare(b.id));
  }
  return out;
}

beforeEach(async () => {
  db = await resetDb('test-import-job');
});

describe('runImportJob', () => {
  it('imports a 5etools folder into the database and remembers the summary', async () => {
    const stages: string[] = [];
    const summary = await runImportJob(filesJob(fixtureFiles('picked/data/')), deps(), (s) =>
      stages.push(s),
    );
    expect(stages).toEqual(['locate', 'read', 'resolve', 'convert', 'finish', 'write']);
    expect(summary.sources.map((s) => s.code)).toEqual(['OLD', 'TST']);
    expect(await createContentRepo(db).countByKind('spell')).toBe(3);
    expect(await createSettingsRepo(db).get('lastImport')).toEqual(summary);
  });

  it('re-importing replaces a source and deletes what it no longer has', async () => {
    await runImportJob(filesJob(fixtureFiles()), deps());
    const files = fixtureFiles();
    const spells = JSON.parse(files['data/spells/spells-tst.json']!) as {
      spell: { name: string }[];
    };
    spells.spell = spells.spell.filter((s) => s.name !== 'Dim Lantern');
    files['data/spells/spells-tst.json'] = JSON.stringify(spells);

    await runImportJob(filesJob(files), deps());
    const repo = createContentRepo(db);
    expect(await repo.get('spell', 'dim lantern|tst')).toBeUndefined();
    expect(await repo.get('spell', 'glitter burst|tst')).toBeDefined();
  });

  it('importing one source leaves the others alone', async () => {
    await runImportJob(filesJob(fixtureFiles()), deps());
    await runImportJob(filesJob(fixtureFiles(), ['OLD']), deps());
    expect(await createContentRepo(db).get('spell', 'dim lantern|tst')).toBeDefined();
  });
});

describe('packs', () => {
  it('export → import into a fresh database is lossless', async () => {
    await runImportJob(filesJob(fixtureFiles()), deps());
    const before = await allEntities();
    const { bytes, fileName, entityCount } = await exportPack(createContentRepo(db), { now: 0 });
    expect(fileName).toBe('content-1970-01-01.pack.json.gz');
    expect(entityCount).toBe(Object.values(before).flat().length);

    db = await resetDb('test-import-job-2');
    const summary = await runImportJob(
      { kind: 'pack', file: new Blob([new Uint8Array(bytes)]) },
      deps(),
    );
    expect(summary.origin).toBe('pack');
    expect(summary.sources.every((s) => s.origin === 'pack')).toBe(true);
    expect(await allEntities()).toEqual(before);
  });

  it('can export only some sources', async () => {
    await runImportJob(filesJob(fixtureFiles()), deps());
    const { bytes } = await exportPack(createContentRepo(db), { sources: ['OLD'] });
    const pack = await decodePack(bytes);
    expect(pack.sources.map((s) => s.code)).toEqual(['OLD']);
    expect(
      Object.values(pack.entities)
        .flat()
        .every((e) => e.source === 'OLD'),
    ).toBe(true);
  });

  it('reads plain (not gzipped) pack JSON too', async () => {
    const pack = buildPack({}, [], 1, 5);
    const plain = new TextEncoder().encode(JSON.stringify(pack));
    expect(await decodePack(plain)).toEqual(pack);
    expect(await decodePack(await encodePack(pack))).toEqual(pack);
  });

  it.each([
    ['not JSON', new TextEncoder().encode('hello'), 'not valid JSON'],
    ['another JSON file', new TextEncoder().encode('{"spell": []}'), 'not a content pack'],
    [
      'a newer pack',
      new TextEncoder().encode(JSON.stringify({ format: PACK_FORMAT, version: 99 })),
      'newer version',
    ],
    [
      'a damaged pack',
      new TextEncoder().encode(
        JSON.stringify({ ...buildPack({}, [], 1, 5), entities: { spell: [{ id: 'x' }] } }),
      ),
      'damaged (entities.spell.0.kind',
    ],
  ])('rejects %s', async (_, bytes, message) => {
    await expect(decodePack(bytes)).rejects.toThrow(PackError);
    await expect(decodePack(bytes)).rejects.toThrow(message);
  });

  it('rejects a gzip file that is not a pack', async () => {
    const bytes = await gzip(new TextEncoder().encode('[1,2]'));
    await expect(decodePack(bytes)).rejects.toThrow('not a content pack');
  });
});
