import { useEffect, useState } from 'react';
import page from '../../app/Page.module.css';
import { formatBytes, getStorageStatus, type StorageStatus } from '../../db/storage.ts';
import { Badge } from '../../ui/Badge.tsx';
import { Button } from '../../ui/Button.tsx';

export function StorageCard() {
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void getStorageStatus().then((s) => {
      if (!cancelled) setStatus(s);
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  async function requestPersist() {
    try {
      await navigator.storage?.persist?.();
    } finally {
      setRefresh((n) => n + 1);
    }
  }

  return (
    <section className={page.card} aria-labelledby="storage-title">
      <h2 id="storage-title" className={page.cardTitle}>
        Storage
      </h2>
      {status === null ? (
        <p className={page.muted}>Checking…</p>
      ) : (
        <>
          <div className={page.row}>
            <span>Persistent storage:</span>
            {status.persisted === true ? (
              <Badge variant="accent">On</Badge>
            ) : status.persisted === false ? (
              <Badge variant="warning">Off</Badge>
            ) : (
              <Badge>Unknown</Badge>
            )}
            {status.standalone && <Badge>Installed app</Badge>}
          </div>
          <p className={page.muted}>
            Using {formatBytes(status.usageBytes)} of {formatBytes(status.quotaBytes)}.
          </p>
          {status.persisted === false && status.persistSupported && (
            <div className={page.row}>
              <Button size="sm" onClick={requestPersist}>
                Ask to keep data
              </Button>
            </div>
          )}
          <p className={page.muted}>
            Browsers can clear saved data. Back up your characters regularly.
          </p>
        </>
      )}
    </section>
  );
}
