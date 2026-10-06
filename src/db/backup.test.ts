import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CHARACTER_SCHEMA_VERSION } from '../schema/index.ts';
import type { PortraitRow } from './db.ts';
import {
  applyRestore,
  backupFileName,
  BackupError,
  buildBackup,
  needsBackupReminder,
  parseBackup,
  planRestore,
  REMINDER_AFTER_MS,
} from './backup.ts';
import { createCharacterRepo, newCharacter } from './characterRepo.ts';
import { resetDb, type AppDb } from './db.ts';

let db: AppDb;

beforeEach(async () => {
  db = await resetDb('test-backup');
});

describe('backup', () => {
  it('export → restore into an empty device round-trips characters and portraits', async () => {
    const repo = createCharacterRepo(db);
    const ada = { ...newCharacter('Ada', 1), portraitId: 'p1' };
    await repo.save(ada, 10);
    await repo.save(newCharacter('Brin', 2), 20);
    // fake-indexeddb cannot store jsdom Blobs, so portrait rows are served and captured directly.
    const portrait: PortraitRow = {
      id: 'p1',
      blob: new Blob(['picture'], { type: 'image/png' }),
      updatedAt: 5,
    };
    vi.spyOn(db.portraits, 'bulkGet').mockResolvedValue([portrait]);

    const text = JSON.stringify(await buildBackup(db, { now: 0, appVersion: '1.2.3' }));
    const before = await db.characters.toArray();

    db = await resetDb('test-backup-2');
    const written: PortraitRow[] = [];
    vi.spyOn(db.portraits, 'bulkPut').mockImplementation(((rows: readonly PortraitRow[]) => {
      written.push(...rows);
      return Promise.resolve('p1');
    }) as never);
    const backup = parseBackup(text);
    expect(backup.appVersion).toBe('1.2.3');
    const plan = await planRestore(backup, db);
    expect(plan.add.map((c) => c.name).sort()).toEqual(['Ada', 'Brin']);
    expect(await applyRestore(backup, plan, {}, db)).toBe(2);

    expect(await db.characters.toArray()).toEqual(before);
    expect(written.map((p) => [p.id, p.blob.type, p.updatedAt])).toEqual([['p1', 'image/png', 5]]);
    expect(await written[0]?.blob.text()).toBe('picture');
  });

  it('newer wins: updates older device copies, keeps newer ones unless asked', async () => {
    const repo = createCharacterRepo(db);
    const a = await repo.save(newCharacter('A', 1), 100);
    const b = await repo.save(newCharacter('B', 1), 100);
    const c = await repo.save(newCharacter('C', 1), 100);
    const backup = parseBackup(JSON.stringify(await buildBackup(db)));
    backup.characters = [
      { ...a, name: 'A (newer in backup)', updatedAt: 200 },
      { ...b, name: 'B (older in backup)', updatedAt: 50 },
      c,
    ];

    const plan = await planRestore(backup, db);
    expect(plan.update.map((x) => x.name)).toEqual(['A (newer in backup)']);
    expect(plan.olderInBackup.map((x) => x.name)).toEqual(['B (older in backup)']);
    expect(plan.unchanged).toBe(1);

    await applyRestore(backup, plan, {}, db);
    expect((await repo.get(a.id))?.name).toBe('A (newer in backup)');
    expect((await repo.get(b.id))?.name).toBe('B');

    await applyRestore(backup, plan, { replaceNewer: true }, db);
    expect((await repo.get(b.id))?.name).toBe('B (older in backup)');
  });

  it.each([
    ['not JSON', 'nope', 'not valid JSON'],
    ['another file', '{"format":"other"}', 'not a character backup'],
    ['a newer backup', '{"format":"5e-sheet-backup","version":9}', 'newer version'],
    [
      'a damaged backup',
      '{"format":"5e-sheet-backup","version":1,"characters":[{"id":1}]}',
      'damaged',
    ],
  ])('rejects %s', (_, text, message) => {
    expect(() => parseBackup(text)).toThrow(BackupError);
    expect(() => parseBackup(text)).toThrow(message);
  });

  it('upgrades characters from an older app', () => {
    const c = { ...newCharacter('Old'), schemaVersion: 1 };
    const text = JSON.stringify({ format: '5e-sheet-backup', version: 1, characters: [c] });
    const [restored] = parseBackup(text).characters;
    expect(restored?.schemaVersion).toBe(CHARACTER_SCHEMA_VERSION);
    expect(restored?.state.turn).toEqual({ ridersUsed: [] });
  });

  it('rejects characters saved by a newer app', () => {
    const c = { ...newCharacter('Future'), schemaVersion: 99 };
    const text = JSON.stringify({ format: '5e-sheet-backup', version: 1, characters: [c] });
    expect(() => parseBackup(text)).toThrow('“Future” was saved by a newer version');
  });

  it('names files by date', () => {
    expect(backupFileName(0)).toBe('characters-1970-01-01.backup.json');
  });
});

describe('needsBackupReminder', () => {
  const week = REMINDER_AFTER_MS;

  it('only with unsaved changes', () => {
    expect(needsBackupReminder([], null, 10 * week)).toBe(false);
    expect(needsBackupReminder([{ createdAt: 0, updatedAt: 5 }], 10, 10 * week)).toBe(false);
  });

  it('after a week since the last backup', () => {
    const chars = [{ createdAt: 0, updatedAt: 2 * week }];
    expect(needsBackupReminder(chars, week, week + week - 1)).toBe(false);
    expect(needsBackupReminder(chars, week, 2 * week + 1)).toBe(true);
  });

  it('never backed up: a week after the oldest unsaved character', () => {
    expect(needsBackupReminder([{ createdAt: 100, updatedAt: 200 }], null, 100 + week - 1)).toBe(
      false,
    );
    expect(needsBackupReminder([{ createdAt: 100, updatedAt: 200 }], null, 100 + week)).toBe(true);
  });
});
