import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import page from '../../app/Page.module.css';
import {
  backupNow,
  canAutoBackup,
  chooseAutoBackupFile,
  filePermission,
  writeBackupToFile,
} from '../../db/backupActions.ts';
import { repos } from '../../db/repos.ts';
import { Badge } from '../../ui/Badge.tsx';
import { Button } from '../../ui/Button.tsx';
import { RestoreFromFile } from './RestoreFromFile.tsx';
import styles from './SettingsPage.module.css';

function AutoBackupControls() {
  const handle = useLiveQuery(() => repos().settings.get('autoBackupHandle'), []);
  const permission = useLiveQuery(async () => (handle ? filePermission(handle) : null), [handle]);
  const [error, setError] = useState<string | null>(null);

  async function enable() {
    setError(null);
    try {
      const chosen = await chooseAutoBackupFile();
      await writeBackupToFile(chosen);
      await repos().settings.set('autoBackupHandle', chosen);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }
  }

  async function resume() {
    if (!handle) return;
    if ((await filePermission(handle, true)) === 'granted') await writeBackupToFile(handle);
  }

  if (handle === undefined) return null;
  return (
    <div className={styles.autoBackup}>
      {handle ? (
        <>
          <div className={page.row}>
            <span>Auto-saving to {handle.name}</span>
            {permission === 'granted' ? (
              <Badge variant="accent">On</Badge>
            ) : (
              <Badge variant="warning">Paused</Badge>
            )}
          </div>
          <div className={page.row}>
            {permission !== 'granted' && (
              <Button size="sm" onClick={() => void resume()}>
                Resume
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void repos().settings.set('autoBackupHandle', null)}
            >
              Stop auto-saving
            </Button>
          </div>
        </>
      ) : (
        <Button size="sm" onClick={() => void enable()}>
          Auto-save to a file…
        </Button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

export function BackupCard() {
  const lastBackupAt = useLiveQuery(() => repos().settings.get('lastBackupAt'), []);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <section className={page.card} aria-labelledby="backup-title">
      <h2 id="backup-title" className={page.cardTitle}>
        Backup
      </h2>
      <p className={page.muted}>
        Last backup: {lastBackupAt ? new Date(lastBackupAt).toLocaleString() : 'never'}. Save
        backups to Files or iCloud Drive; content isn’t included, re-import your pack instead.
      </p>
      <div className={page.row}>
        <Button
          variant="primary"
          onClick={async () => {
            const outcome = await backupNow();
            if (outcome !== 'cancelled') setMessage('Backup saved.');
          }}
        >
          Back up characters
        </Button>
        <RestoreFromFile onMessage={setMessage} />
      </div>
      {canAutoBackup() && <AutoBackupControls />}
      {message && (
        <p role="status" className={page.muted}>
          {message}
        </p>
      )}
    </section>
  );
}
