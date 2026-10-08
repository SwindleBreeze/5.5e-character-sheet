// Restoring characters from a backup file (plan §6.9, step 7.1): pick the file, see what it
// adds and updates, confirm. Used in Settings → Backup and on the "data was cleared" screen.

import { useState, type ChangeEvent } from 'react';
import {
  applyRestore,
  parseBackup,
  planRestore,
  type BackupFile,
  type RestorePlan,
} from '../../db/backup.ts';
import { Button } from '../../ui/Button.tsx';
import { fileAccept } from '../../ui/fileAccept.ts';
import { useSheet } from '../../ui/sheetContext.ts';
import styles from './SettingsPage.module.css';

function RestoreConfirm({
  backup,
  plan,
  onDone,
}: {
  backup: BackupFile;
  plan: RestorePlan;
  onDone: (message: string) => void;
}) {
  const [replaceNewer, setReplaceNewer] = useState(false);
  const writes =
    plan.add.length + plan.update.length + (replaceNewer ? plan.olderInBackup.length : 0);
  const names = (list: { name: string }[]) => list.map((c) => c.name).join(', ');

  return (
    <div className={styles.confirm}>
      <ul className={styles.planList}>
        {plan.add.length > 0 && (
          <li>
            <strong>Add {plan.add.length}:</strong> {names(plan.add)}
          </li>
        )}
        {plan.update.length > 0 && (
          <li>
            <strong>Update {plan.update.length}</strong> (newer in the backup): {names(plan.update)}
          </li>
        )}
        {plan.unchanged > 0 && <li>{plan.unchanged} already up to date</li>}
      </ul>
      {plan.olderInBackup.length > 0 && (
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={replaceNewer}
            onChange={(e) => setReplaceNewer(e.target.checked)}
          />
          <span>
            Also replace {plan.olderInBackup.length} that are newer on this device (
            {names(plan.olderInBackup)}). Changes made since the backup will be lost.
          </span>
        </label>
      )}
      <Button
        variant="primary"
        disabled={writes === 0}
        onClick={async () => {
          const n = await applyRestore(backup, plan, { replaceNewer });
          onDone(n === 1 ? 'Restored 1 character.' : `Restored ${n} characters.`);
        }}
      >
        {writes === 0 ? 'Nothing to restore' : `Restore ${writes}`}
      </Button>
    </div>
  );
}

/** A "Restore…" file button; what happened is reported through `onMessage`. */
export function RestoreFromFile({
  onMessage,
  label = 'Restore…',
}: {
  onMessage: (message: string | null) => void;
  label?: string;
}) {
  const sheet = useSheet();

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    onMessage(null);
    try {
      const backup = parseBackup(await file.text());
      const plan = await planRestore(backup);
      sheet.open({
        key: 'restore',
        title: 'Restore characters',
        render: () => (
          <RestoreConfirm
            backup={backup}
            plan={plan}
            onDone={(msg) => {
              sheet.close();
              onMessage(msg);
            }}
          />
        ),
      });
    } catch (err) {
      onMessage(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <label className={styles.fileButton}>
      <input
        type="file"
        accept={fileAccept('.json,application/json')}
        onChange={(e) => void onFile(e)}
      />
      {label}
    </label>
  );
}
