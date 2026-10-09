import { useState } from 'react';
import { exportPack } from '../../adapters/pack/exportPack.ts';
import page from '../../app/Page.module.css';
import { shareOrDownload } from '../../app/shareFile.ts';
import { repos } from '../../db/repos.ts';
import type { SourceInfo } from '../../schema/index.ts';
import { Button } from '../../ui/Button.tsx';
import { useSheet } from '../../ui/sheetContext.ts';
import styles from './SourceToggles.module.css';

/** Who made it and which version, from the homebrew file. */
function byline(source: SourceInfo): string {
  const parts: string[] = [];
  const authors = source.homebrew?.authors ?? [];
  if (authors.length) parts.push(`by ${authors.join(', ')}`);
  if (source.homebrew?.version) parts.push(`version ${source.homebrew.version}`);
  return parts.join(' · ') || 'Homebrew';
}

async function removeSource(source: SourceInfo) {
  const { content, settings } = repos();
  await content.deleteSource(source.code);
  const enabled = await settings.get('enabledSources');
  await settings.set(
    'enabledSources',
    enabled.filter((c) => c !== source.code),
  );
}

/**
 * A homebrew source's byline under its toggle and, in Settings, a way to remove it (plan step
 * 7.3). Characters keep their snapshots of what they use, so removing never breaks one.
 */
export function HomebrewMeta({ source, manage }: { source: SourceInfo; manage: boolean }) {
  const sheet = useSheet();
  const confirm = () =>
    sheet.open({
      key: `remove-source:${source.code}`,
      title: `Remove ${source.name}?`,
      render: () => (
        <div className={page.content}>
          <p>
            This removes its content from this device. Characters that use it keep what they have;
            to get it back, import the homebrew file again.
          </p>
          <Button
            variant="danger"
            onClick={async () => {
              await removeSource(source);
              sheet.close();
            }}
          >
            Remove
          </Button>
        </div>
      ),
    });

  return (
    <div className={styles.brewMeta}>
      <span>{byline(source)}</span>
      {manage && (
        <Button size="sm" variant="ghost" aria-label={`Remove ${source.name}…`} onClick={confirm}>
          Remove…
        </Button>
      )}
    </div>
  );
}

/** Share every homebrew source as one pack file, for the group's phones. */
export function HomebrewActions({ sources }: { sources: SourceInfo[] }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function share() {
    setBusy(true);
    setError(null);
    try {
      const { bytes, fileName } = await exportPack(repos().content, {
        sources: sources.map((s) => s.code),
        fileName: 'homebrew',
      });
      await shareOrDownload(new Uint8Array(bytes), fileName, 'application/gzip');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.brewActions}>
      <p>Share your homebrew as one pack file. Your group opens it on the Import screen.</p>
      <div className={page.row}>
        <Button size="sm" disabled={busy} onClick={() => void share()}>
          {busy ? 'Making pack…' : 'Share homebrew'}
        </Button>
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
