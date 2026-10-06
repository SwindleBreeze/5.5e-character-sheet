import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { filePermission, writeBackupToFile } from '../db/backupActions.ts';
import { getDb } from '../db/db.ts';
import { repos } from '../db/repos.ts';

const DELAY_MS = 3000;

/**
 * Saves a backup to the chosen file a few seconds after characters change, while the app has
 * permission to write it. Renders nothing.
 */
export function AutoBackup() {
  const handle = useLiveQuery(() => repos().settings.get('autoBackupHandle'), []);
  const lastBackupAt = useLiveQuery(() => repos().settings.get('lastBackupAt'), []);
  const lastChange = useLiveQuery(
    async () => (await getDb().characters.orderBy('updatedAt').last())?.updatedAt ?? null,
    [],
  );

  useEffect(() => {
    if (!handle || lastChange === undefined || lastChange === null) return;
    if (lastBackupAt !== undefined && lastBackupAt !== null && lastBackupAt >= lastChange) return;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          if ((await filePermission(handle)) === 'granted') await writeBackupToFile(handle);
        } catch {
          // The file moved or access was revoked; Settings shows how to resume.
        }
      })();
    }, DELAY_MS);
    return () => clearTimeout(timer);
  }, [handle, lastChange, lastBackupAt]);

  return null;
}
