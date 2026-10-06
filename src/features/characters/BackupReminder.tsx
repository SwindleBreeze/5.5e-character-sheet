import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import page from '../../app/Page.module.css';
import { needsBackupReminder } from '../../db/backup.ts';
import { backupNow } from '../../db/backupActions.ts';
import { repos } from '../../db/repos.ts';
import type { Character } from '../../schema/index.ts';
import { Button } from '../../ui/Button.tsx';

/** Shown when characters changed and the last backup is over a week old (plan §6.9). */
export function BackupReminder({ characters }: { characters: Character[] }) {
  const lastBackupAt = useLiveQuery(() => repos().settings.get('lastBackupAt'), []);
  const [now] = useState(() => Date.now());
  if (lastBackupAt === undefined || !needsBackupReminder(characters, lastBackupAt, now)) {
    return null;
  }
  return (
    <section className={page.card} role="status" aria-labelledby="backup-reminder-title">
      <h2 id="backup-reminder-title" className={page.cardTitle}>
        Time for a backup
      </h2>
      <p className={page.muted}>
        Your characters changed since your last backup. Browsers can clear saved data, so keep a
        copy in Files or iCloud Drive.
      </p>
      <div className={page.row}>
        <Button variant="primary" onClick={() => void backupNow()}>
          Back up now
        </Button>
      </div>
    </section>
  );
}
