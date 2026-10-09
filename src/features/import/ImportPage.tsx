import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { runImport } from '../../adapters/importClient.ts';
import type { ImportJob, ImportSummary, JobStage } from '../../adapters/importJob.ts';
import { exportPack } from '../../adapters/pack/exportPack.ts';
import { shareOrDownload } from '../../app/shareFile.ts';
import { TopBar } from '../../app/TopBar.tsx';
import page from '../../app/Page.module.css';
import { useSources } from '../../content/hooks.ts';
import { repos } from '../../db/repos.ts';
import { detectEnv, shouldShowInstallGuide } from '../../db/storage.ts';
import { Button } from '../../ui/Button.tsx';
import { fileAccept } from '../../ui/fileAccept.ts';
import { InstallGuide } from '../settings/InstallGuide.tsx';
import { ImportReportView } from './ImportReportView.tsx';
import styles from './ImportPage.module.css';

const STAGE_LABELS: Record<JobStage, string> = {
  locate: 'Finding the data…',
  read: 'Reading files…',
  resolve: 'Resolving copies and versions…',
  convert: 'Converting…',
  finish: 'Building spell lists…',
  unpack: 'Unpacking…',
  write: 'Saving…',
};

type Status =
  | { state: 'idle' }
  | { state: 'running'; stage: JobStage | null }
  | { state: 'done'; summary: ImportSummary }
  | { state: 'error'; message: string };

interface DirectoryPickerWindow {
  showDirectoryPicker?: (options?: { mode?: 'read' }) => Promise<FileSystemDirectoryHandle>;
}

function parseCodes(text: string): string[] | undefined {
  const codes = text
    .split(/[\s,]+/)
    .map((c) => c.trim())
    .filter(Boolean);
  return codes.length ? codes : undefined;
}

/** Whether the browser thinks it is online; links need a connection. */
function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}

export function ImportPage() {
  const [status, setStatus] = useState<Status>({ state: 'idle' });
  const [onlySources, setOnlySources] = useState('');
  const [exporting, setExporting] = useState(false);
  const lastImport = useLiveQuery(() => repos().settings.get('lastImport'), []);
  const sources = useSources();
  const showInstallGuide = useMemo(() => shouldShowInstallGuide(detectEnv()), []);
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  const busy = status.state === 'running';
  const online = useOnline();
  const [brewUrl, setBrewUrl] = useState('');

  async function start(job: ImportJob) {
    setStatus({ state: 'running', stage: null });
    try {
      const summary = await runImport(job, (stage) => setStatus({ state: 'running', stage }));
      setStatus({ state: 'done', summary });
    } catch (err) {
      setStatus({ state: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }

  function fivetools(input: Extract<ImportJob, { kind: 'fivetools' }>['input']) {
    const codes = parseCodes(onlySources);
    void start({ kind: 'fivetools', input, ...(codes ? { onlySources: codes } : {}) });
  }

  function onPack(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void start({ kind: 'pack', file });
  }

  function onHomebrewFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    e.target.value = '';
    if (files.length) void start({ kind: 'homebrew', files });
  }

  function onHomebrewUrl(e: FormEvent) {
    e.preventDefault();
    const urls = brewUrl
      .split(/\s+/)
      .map((u) => u.trim())
      .filter(Boolean);
    if (urls.length) void start({ kind: 'homebrew', urls });
  }

  function onFolderFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    e.target.value = '';
    if (files.length) fivetools({ type: 'files', files });
  }

  function onZip(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) fivetools({ type: 'zip', file });
  }

  async function pickFolder() {
    if (!picker) return;
    try {
      const handle = await picker.call(window, { mode: 'read' });
      fivetools({ type: 'directory', handle });
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setStatus({ state: 'error', message: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  async function exportAll() {
    setExporting(true);
    try {
      const { bytes, fileName } = await exportPack(repos().content);
      await shareOrDownload(new Uint8Array(bytes), fileName, 'application/gzip');
    } catch (err) {
      setStatus({ state: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setExporting(false);
    }
  }

  const shownSummary = status.state === 'done' ? status.summary : lastImport;

  return (
    <>
      <TopBar title="Import" backTo="/library" />
      <div className={page.content}>
        {showInstallGuide && <InstallGuide compact />}

        <section className={page.card} aria-labelledby="pack-title">
          <h2 id="pack-title" className={page.cardTitle}>
            Content pack
          </h2>
          <p className={page.muted}>
            Open the pack file your group shared (it ends in .pack.json.gz). This is the quickest
            way to get content onto a phone.
          </p>
          <label className={styles.fileButton} data-disabled={busy || undefined}>
            <input
              type="file"
              accept={fileAccept('.gz,.json,application/gzip,application/json')}
              disabled={busy}
              onChange={onPack}
            />
            Open pack file
          </label>
        </section>

        <section className={page.card} aria-labelledby="fivetools-title">
          <h2 id="fivetools-title" className={page.cardTitle}>
            5etools data
          </h2>
          <p className={page.muted}>
            On a computer, pick your 5etools folder (or its data folder), or the 5etools zip. Every
            source is imported; you choose which ones to use in Sources.
          </p>
          <div className={page.row}>
            {picker ? (
              <Button disabled={busy} onClick={() => void pickFolder()}>
                Choose folder
              </Button>
            ) : (
              <label className={styles.fileButton} data-disabled={busy || undefined}>
                <input
                  type="file"
                  multiple
                  disabled={busy}
                  ref={(el) => el?.setAttribute('webkitdirectory', '')}
                  onChange={onFolderFiles}
                />
                Choose folder
              </label>
            )}
            <label className={styles.fileButton} data-disabled={busy || undefined}>
              <input
                type="file"
                accept={fileAccept('.zip,application/zip')}
                disabled={busy}
                onChange={onZip}
              />
              Choose zip
            </label>
          </div>
          <details className={styles.advanced}>
            <summary>Advanced</summary>
            <label className={styles.field}>
              <span>Only import these sources (codes, comma separated)</span>
              <input
                type="text"
                value={onlySources}
                placeholder="e.g. XPHB, XDMG"
                onChange={(e) => setOnlySources(e.target.value)}
              />
            </label>
          </details>
        </section>

        <section className={page.card} aria-labelledby="homebrew-title">
          <h2 id="homebrew-title" className={page.cardTitle}>
            Homebrew
          </h2>
          <p className={page.muted}>
            Open homebrew files in the 5etools format (.json), or paste a link to one, such as a
            file from the 5etools homebrew repository. Import the books it builds on first.
          </p>
          <label className={styles.fileButton} data-disabled={busy || undefined}>
            <input
              type="file"
              multiple
              accept={fileAccept('.json,application/json')}
              disabled={busy}
              onChange={onHomebrewFiles}
            />
            Open homebrew files
          </label>
          <form className={styles.urlForm} onSubmit={onHomebrewUrl}>
            <label className={styles.field}>
              <span>Link to a homebrew file</span>
              <input
                type="url"
                inputMode="url"
                value={brewUrl}
                placeholder="https://…/homebrew.json"
                onChange={(e) => setBrewUrl(e.target.value)}
              />
            </label>
            <Button type="submit" disabled={busy || !online || !brewUrl.trim()}>
              Download
            </Button>
            {!online && <p className={page.muted}>Links need an internet connection.</p>}
          </form>
        </section>

        <div aria-live="polite">
          {status.state === 'running' && (
            <p className={styles.progress}>
              {status.stage ? STAGE_LABELS[status.stage] : 'Starting…'}
            </p>
          )}
          {status.state === 'error' && (
            <p role="alert" className={styles.error}>
              {status.message}
            </p>
          )}
        </div>

        {shownSummary && (
          <section className={page.card} aria-labelledby="result-title">
            <h2 id="result-title" className={page.cardTitle}>
              {status.state === 'done' ? 'Import finished' : 'Last import'}
            </h2>
            <ImportReportView summary={shownSummary} />
          </section>
        )}

        {sources && sources.length > 0 && (
          <section className={page.card} aria-labelledby="share-title">
            <h2 id="share-title" className={page.cardTitle}>
              Share with your group
            </h2>
            <p className={page.muted}>
              Make a pack of everything imported on this device, then send it to your group’s
              phones. Keep packs private: they contain the content you imported.
            </p>
            <div className={page.row}>
              <Button disabled={exporting || busy} onClick={() => void exportAll()}>
                {exporting ? 'Making pack…' : 'Export pack'}
              </Button>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
