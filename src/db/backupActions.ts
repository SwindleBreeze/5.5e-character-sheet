// Backup actions used by the UI: back up now (share sheet or download), and, on desktop
// Chromium, saving backups to a user-picked file automatically (plan §6.9).

import { shareOrDownload, type ShareOutcome } from '../app/shareFile.ts';
import { backupFileName, buildBackup } from './backup.ts';
import { getDb, type AppDb } from './db.ts';
import { createSettingsRepo } from './settingsRepo.ts';

type Permission = 'granted' | 'denied' | 'prompt';

interface PermissionedHandle {
  queryPermission?: (opts: { mode: 'readwrite' }) => Promise<Permission>;
  requestPermission?: (opts: { mode: 'readwrite' }) => Promise<Permission>;
}

interface SavePickerWindow {
  showSaveFilePicker?: (opts: {
    suggestedName: string;
    types: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<FileSystemFileHandle>;
}

export async function backupNow(db: AppDb = getDb(), now = Date.now()): Promise<ShareOutcome> {
  const backup = await buildBackup(db, { now, appVersion: __APP_VERSION__ });
  const outcome = await shareOrDownload(
    JSON.stringify(backup),
    backupFileName(now),
    'application/json',
  );
  if (outcome !== 'cancelled') await createSettingsRepo(db).set('lastBackupAt', now);
  return outcome;
}

export function canAutoBackup(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as SavePickerWindow).showSaveFilePicker === 'function'
  );
}

export async function chooseAutoBackupFile(): Promise<FileSystemFileHandle> {
  const picker = (window as SavePickerWindow).showSaveFilePicker;
  if (!picker) throw new Error('This browser cannot save to a chosen file.');
  return picker.call(window, {
    suggestedName: 'characters.backup.json',
    types: [{ description: 'Character backup', accept: { 'application/json': ['.json'] } }],
  });
}

/** Whether the app may write to the file now; `request` asks the user (needs a tap). */
export async function filePermission(
  handle: FileSystemFileHandle,
  request = false,
): Promise<Permission> {
  const h = handle as FileSystemFileHandle & PermissionedHandle;
  const fn = request ? h.requestPermission : h.queryPermission;
  return fn ? fn.call(h, { mode: 'readwrite' }) : 'granted';
}

export async function writeBackupToFile(
  handle: FileSystemFileHandle,
  db: AppDb = getDb(),
  now = Date.now(),
): Promise<void> {
  const backup = await buildBackup(db, { now, appVersion: __APP_VERSION__ });
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(backup));
  await writable.close();
  await createSettingsRepo(db).set('lastBackupAt', now);
}
