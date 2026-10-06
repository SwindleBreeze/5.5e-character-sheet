// Character backups (plan §6.9): one JSON file with every character and portrait. Restoring
// merges by id; where both sides have a character, the newer one wins, and replacing a newer
// copy on this device needs the user's explicit choice. Content is never backed up; it can be
// rebuilt from the group's pack.

import { CHARACTER_SCHEMA_VERSION, type Character } from '../schema/index.ts';
import { migrateCharacter } from './characterMigrations.ts';
import { getDb, type AppDb } from './db.ts';

export const BACKUP_FORMAT = '5e-sheet-backup';
export const BACKUP_VERSION = 1;

export interface BackupPortrait {
  id: string;
  type: string;
  /** Base64 image bytes. */
  data: string;
  updatedAt: number;
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: number;
  appVersion: string;
  characters: Character[];
  portraits: BackupPortrait[];
}

export class BackupError extends Error {}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function fromBase64(data: string): Uint8Array<ArrayBuffer> {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function buildBackup(
  db: AppDb = getDb(),
  opts: { now?: number; appVersion?: string } = {},
): Promise<BackupFile> {
  const characters = await db.characters.toArray();
  const ids = characters.map((c) => c.portraitId).filter((id): id is string => !!id);
  const portraits: BackupPortrait[] = [];
  for (const row of await db.portraits.bulkGet(ids)) {
    if (!row) continue;
    portraits.push({
      id: row.id,
      type: row.blob.type,
      data: toBase64(new Uint8Array(await row.blob.arrayBuffer())),
      updatedAt: row.updatedAt,
    });
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: opts.now ?? Date.now(),
    appVersion: opts.appVersion ?? '',
    characters,
    portraits,
  };
}

export function backupFileName(now: number): string {
  return `characters-${new Date(now).toISOString().slice(0, 10)}.backup.json`;
}

function isCharacterLike(value: unknown): value is Character {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.id === 'string' &&
    typeof c.name === 'string' &&
    typeof c.updatedAt === 'number' &&
    typeof c.schemaVersion === 'number' &&
    Array.isArray(c.log)
  );
}

export function parseBackup(text: string): BackupFile {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new BackupError('This file is not a backup (it is not valid JSON).');
  }
  const b = (typeof json === 'object' && json !== null ? json : {}) as Record<string, unknown>;
  if (b.format !== BACKUP_FORMAT) throw new BackupError('This file is not a character backup.');
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) {
    throw new BackupError(
      'This backup was made by a newer version of the app. Update the app first.',
    );
  }
  if (!Array.isArray(b.characters) || !b.characters.every(isCharacterLike)) {
    throw new BackupError('This backup is damaged.');
  }
  const newer = b.characters.find((c) => c.schemaVersion > CHARACTER_SCHEMA_VERSION);
  if (newer) {
    throw new BackupError(
      `“${newer.name}” was saved by a newer version of the app. Update the app first.`,
    );
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: typeof b.exportedAt === 'number' ? b.exportedAt : 0,
    appVersion: typeof b.appVersion === 'string' ? b.appVersion : '',
    characters: b.characters.map(migrateCharacter),
    portraits: Array.isArray(b.portraits) ? (b.portraits as BackupPortrait[]) : [],
  };
}

export interface RestorePlan {
  /** Not on this device. */
  add: Character[];
  /** On this device, but the backup's copy is newer. */
  update: Character[];
  /** On this device and newer here; only replaced if the user asks. */
  olderInBackup: Character[];
  /** Identical timestamps: nothing to do. */
  unchanged: number;
}

export async function planRestore(backup: BackupFile, db: AppDb = getDb()): Promise<RestorePlan> {
  const existing = await db.characters.bulkGet(backup.characters.map((c) => c.id));
  const plan: RestorePlan = { add: [], update: [], olderInBackup: [], unchanged: 0 };
  backup.characters.forEach((incoming, i) => {
    const current = existing[i];
    if (!current) plan.add.push(incoming);
    else if (incoming.updatedAt > current.updatedAt) plan.update.push(incoming);
    else if (incoming.updatedAt < current.updatedAt) plan.olderInBackup.push(incoming);
    else plan.unchanged++;
  });
  return plan;
}

/** Write the plan. Returns how many characters were written. */
export async function applyRestore(
  backup: BackupFile,
  plan: RestorePlan,
  opts: { replaceNewer?: boolean } = {},
  db: AppDb = getDb(),
): Promise<number> {
  const toWrite = [...plan.add, ...plan.update, ...(opts.replaceNewer ? plan.olderInBackup : [])];
  const portraitIds = new Set(toWrite.map((c) => c.portraitId).filter(Boolean));
  const portraits = backup.portraits
    .filter((p) => portraitIds.has(p.id))
    .map((p) => ({
      id: p.id,
      blob: new Blob([fromBase64(p.data)], { type: p.type }),
      updatedAt: p.updatedAt,
    }));
  await db.transaction('rw', db.characters, db.portraits, async () => {
    await db.characters.bulkPut(toWrite);
    await db.portraits.bulkPut(portraits);
  });
  return toWrite.length;
}

export const REMINDER_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Remind when characters changed since the last backup, and that backup (or, if there never
 * was one, the oldest unsaved character) is a week old.
 */
export function needsBackupReminder(
  characters: readonly Pick<Character, 'createdAt' | 'updatedAt'>[],
  lastBackupAt: number | null,
  now: number,
): boolean {
  const changed = characters.filter((c) => c.updatedAt > (lastBackupAt ?? 0));
  if (changed.length === 0) return false;
  const since = lastBackupAt ?? Math.min(...changed.map((c) => c.createdAt));
  return now - since >= REMINDER_AFTER_MS;
}
