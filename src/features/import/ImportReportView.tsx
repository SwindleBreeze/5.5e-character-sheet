import type { ImportSummary } from '../../adapters/importJob.ts';
import type { WarningCode } from '../../adapters/fivetools/report.ts';
import page from '../../app/Page.module.css';
import type { EntityKind } from '../../schema/index.ts';
import styles from './ImportPage.module.css';

const KIND_LABELS: Record<EntityKind, string> = {
  spell: 'Spells',
  class: 'Classes',
  classFeature: 'Class features',
  subclass: 'Subclasses',
  subclassFeature: 'Subclass features',
  background: 'Backgrounds',
  feat: 'Feats',
  species: 'Species',
  item: 'Items',
  optionalFeature: 'Optional features',
  rule: 'Rules',
  deity: 'Deities',
  reward: 'Supernatural gifts',
  facility: 'Bastion facilities',
  charOption: 'Character options',
};

const MAX_LISTED = 50;

/** What each kind of warning means, in a few words; the code itself for the rest. */
const WARNING_TITLES: Partial<Record<WarningCode, string>> = {
  fileMissing: 'Files not read',
  fileInvalid: 'Files not understood',
  copyMissing: 'Skipped: copies something not on this device',
  convertFailed: 'Skipped: could not be read',
  duplicateId: 'Skipped: same name twice',
  sourceConflict: 'Skipped: source already imported',
  sourceUndeclared: 'Sources the file doesn’t describe',
  fieldMissing: 'Missing fields',
  refMissing: 'Names something that isn’t there',
  spellCounts: 'No prepared-spell counts',
  dependency: 'Needs other homebrew',
  unknownShape: 'Text shown plainly',
  modUnsupported: 'Changes not applied',
  modFailed: 'Changes that failed',
};

const ORIGIN_LABELS: Record<ImportSummary['origin'], string> = {
  pack: 'Pack imported',
  '5etools': '5etools data imported',
  homebrew: 'Homebrew imported',
};

export function ImportReportView({ summary }: { summary: ImportSummary }) {
  const { report, sources } = summary;
  const byCode = new Map<string, string[]>();
  for (const w of report.warnings) {
    const list = byCode.get(w.code) ?? [];
    list.push(w.entity ? `${w.entity}: ${w.message}` : w.message);
    byCode.set(w.code, list);
  }
  const ignored = Object.entries(report.ignored);

  return (
    <div className={styles.report}>
      <p>
        {ORIGIN_LABELS[summary.origin]}
        {report.dataVersion ? ` (version ${report.dataVersion})` : ''} on{' '}
        {new Date(summary.finishedAt).toLocaleString()}: {sources.length}{' '}
        {sources.length === 1 ? 'source' : 'sources'}.
      </p>
      <dl className={styles.counts}>
        {(Object.keys(KIND_LABELS) as EntityKind[])
          .filter((k) => report.counts[k])
          .map((k) => (
            <div key={k}>
              <dt>{KIND_LABELS[k]}</dt>
              <dd>{report.counts[k]}</dd>
            </div>
          ))}
      </dl>
      {byCode.size > 0 && (
        <details>
          <summary>
            {report.warnings.length} {report.warnings.length === 1 ? 'warning' : 'warnings'}
          </summary>
          {[...byCode].map(([code, messages]) => (
            <section key={code} className={styles.warningGroup}>
              <h3 className={styles.warningTitle}>
                {WARNING_TITLES[code as WarningCode] ?? code} ({messages.length})
              </h3>
              <ul>
                {messages.slice(0, MAX_LISTED).map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
                {messages.length > MAX_LISTED && <li>…and {messages.length - MAX_LISTED} more</li>}
              </ul>
            </section>
          ))}
        </details>
      )}
      {ignored.length > 0 && (
        <p className={page.muted}>
          Not imported (not used by the app): {ignored.map(([k, n]) => `${k} (${n})`).join(', ')}.
        </p>
      )}
    </div>
  );
}
