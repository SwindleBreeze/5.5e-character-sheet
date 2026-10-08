import type { ImportSummary } from '../../adapters/importJob.ts';
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
  creature: 'Creatures',
};

const MAX_LISTED = 50;

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
        {summary.origin === 'pack' ? 'Pack imported' : '5etools data imported'}
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
                {code} ({messages.length})
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
