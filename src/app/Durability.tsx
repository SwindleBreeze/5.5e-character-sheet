// Keeping characters safe (plan §6.9, step 7.1): ask for persistent storage once a character is
// saved, remember in a second store that characters exist, and if the database comes back empty
// while that store says otherwise, say the browser cleared the app's data and offer a restore.

import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { getDb } from '../db/db.ts';
import {
  detectEnv,
  looksEvicted,
  readCharacterMarker,
  requestPersistenceIfUseful,
  writeCharacterMarker,
} from '../db/storage.ts';
import { RestoreFromFile } from '../features/settings/RestoreFromFile.tsx';
import { Button } from '../ui/Button.tsx';
import page from './Page.module.css';

export function Durability() {
  const count = useLiveQuery(() => getDb().characters.count(), []);
  // What the database and the second store held when the app started.
  const [start, setStart] = useState<{ count: number; marker: number } | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const asked = useRef(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void getDb()
      .characters.count()
      .then((n) => setStart({ count: n, marker: readCharacterMarker() }));
  }, []);

  const evicted = !!start && looksEvicted(start.count, start.marker) && !dismissed && count === 0;

  useEffect(() => {
    if (count === undefined || !start || evicted) return;
    writeCharacterMarker(count);
    if (count > 0 && !asked.current) {
      asked.current = true;
      void requestPersistenceIfUseful(detectEnv(), { hasSavedCharacter: true });
    }
  }, [count, start, evicted]);

  if (!evicted || !start) return null;
  return (
    <div className={page.overlay} role="dialog" aria-modal="true" aria-labelledby="evicted-title">
      <section className={page.card}>
        <h2 id="evicted-title" className={page.cardTitle}>
          Your browser cleared this app’s data
        </h2>
        <p>
          This device had {start.marker === 1 ? 'a character' : `${start.marker} characters`}, and
          they are gone: browsers can clear a website’s storage when space runs low or after a while
          unused. Restore them from your latest backup file.
        </p>
        <p className={page.muted}>
          Content (your pack) needs importing again too. Installing the app to your Home Screen
          keeps its data safer.
        </p>
        <div className={page.row}>
          <RestoreFromFile onMessage={setMessage} label="Restore from a backup file…" />
          <Button
            variant="ghost"
            onClick={() => {
              writeCharacterMarker(0);
              setDismissed(true);
            }}
          >
            Start fresh
          </Button>
        </div>
        {message && <p role="status">{message}</p>}
      </section>
    </div>
  );
}
