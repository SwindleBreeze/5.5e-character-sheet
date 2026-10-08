// The featureEffects coverage report (plan §9.2, step 3.11) for the enabled sources: which
// class and subclass features have mappings, and which ask for a choice nothing offers. Also
// lists mappings that don't validate against the imported content. Per class: progress and the
// coverage gate (plan §10.2, step 6.1). A feature opens to its text, its data effects and a
// draft mapping found from patterns in its text, ready to copy.

import { useMemo, useState } from 'react';
import type { ContentIndex } from '../../engine/content/contentIndex.ts';
import { DONE_CLASSES } from '../../engine/featureEffects/done.ts';
import { mappingCode, suggestMapping } from '../../engine/featureEffects/suggest.ts';
import { EntityView } from '../../richtext/EntitySheet.tsx';
import { refKey } from '../../schema/index.ts';
import { Button } from '../../ui/Button.tsx';
import { TopBar } from '../../app/TopBar.tsx';
import page from '../../app/Page.module.css';
import { useAllContent, useEnabledSources } from '../../content/hooks.ts';
import { coverageReport, type CoverageRow } from '../../engine/featureEffects/coverage.ts';
import { featureEffects } from '../../engine/featureEffects/index.ts';
import { validateFeatureEffects } from '../../engine/featureEffects/validate.ts';
import styles from './Dev.module.css';

type Show = 'unoffered' | 'unmapped' | 'none' | 'needs' | 'all';

const SHOW: { value: Show; label: string }[] = [
  { value: 'unoffered', label: 'Choices with no offer' },
  { value: 'unmapped', label: 'No mapping' },
  { value: 'none', label: 'No effects at all' },
  { value: 'needs', label: 'Needs a primitive' },
  { value: 'all', label: 'All features' },
];

function statusLabel(r: CoverageRow): string {
  if (r.status === 'mapped') return `mapped (${r.automation})`;
  return r.status === 'data' ? 'from data' : 'no effects';
}

export function CoverageScreen() {
  const content = useAllContent();
  const enabled = useEnabledSources();
  const [show, setShow] = useState<Show>('unoffered');
  const [classId, setClassId] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const result = useMemo(() => {
    if (!content) return undefined;
    const registry = featureEffects();
    return {
      report: coverageReport(content.index, registry, new Set(enabled)),
      issues: validateFeatureEffects(registry, content.index),
    };
  }, [content, enabled]);

  if (!result) {
    return (
      <>
        <TopBar title="Mapping coverage" backTo="/settings" />
        <div className={page.empty}>Loading content…</div>
      </>
    );
  }

  const { report, issues } = result;
  // A mapping for a feature whose source isn't imported is not a problem with the mapping.
  const problems = issues.filter((i) => i.code !== 'ownerMissing');
  const notImported = issues.length - problems.length;
  const shown =
    show === 'unoffered'
      ? report.unofferedChoices
      : show === 'unmapped'
        ? report.rows.filter((r) => r.status !== 'mapped')
        : show === 'none'
          ? report.rows.filter((r) => r.status === 'none')
          : show === 'needs'
            ? report.needsPrimitive
            : report.rows;
  const rows = classId ? shown.filter((r) => r.classId === classId) : shown;

  return (
    <>
      <TopBar title="Mapping coverage" backTo="/settings" />
      <div className={page.content}>
        <section className={page.card} aria-labelledby="coverage-summary">
          <h2 id="coverage-summary" className={page.cardTitle}>
            Summary
          </h2>
          <p className={page.muted}>
            Class and subclass features of the enabled sources ({enabled.join(', ')}).
          </p>
          <p>
            {report.rows.length} features: {report.counts.mapped} mapped (A {report.byAutomation.A},
            B {report.byAutomation.B}, C {report.byAutomation.C}), {report.counts.data} with effects
            from data only, {report.counts.none} with none. {report.unofferedChoices.length} ask for
            a choice nothing offers.
          </p>
        </section>

        <section className={page.card} aria-labelledby="coverage-classes">
          <h2 id="coverage-classes" className={page.cardTitle}>
            By class
          </h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Class</th>
                <th scope="col">Mapped</th>
                <th scope="col">A / B / C</th>
                <th scope="col">No offer</th>
                <th scope="col">Done</th>
              </tr>
            </thead>
            <tbody>
              {report.byClass.map((c) => (
                <tr key={c.classId}>
                  <th scope="row">{c.name}</th>
                  <td className="numeric">
                    {c.counts.mapped} / {c.total}
                  </td>
                  <td className="numeric">
                    {c.byAutomation.A} / {c.byAutomation.B} / {c.byAutomation.C}
                  </td>
                  <td className="numeric">{c.unoffered}</td>
                  <td>{DONE_CLASSES.includes(c.classId) ? 'Yes' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className={page.card} aria-labelledby="coverage-issues">
          <h2 id="coverage-issues" className={page.cardTitle}>
            Mapping problems
          </h2>
          {problems.length ? (
            <ul>
              {problems.map((i, n) => (
                <li key={n}>
                  <code>{i.key}</code>: {i.message} ({i.code})
                </li>
              ))}
            </ul>
          ) : (
            <p className={page.muted}>Every mapping is valid.</p>
          )}
          {notImported > 0 && (
            <p className={page.muted}>
              {notImported} {notImported === 1 ? 'mapping is' : 'mappings are'} for content that
              isn’t imported.
            </p>
          )}
        </section>

        <section className={page.card} aria-labelledby="coverage-features">
          <h2 id="coverage-features" className={page.cardTitle}>
            Features
          </h2>
          <label className={styles.field}>
            Show
            <select value={show} onChange={(e) => setShow(e.target.value as Show)}>
              {SHOW.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            Class
            <select value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">Every class</option>
              {report.byClass.map((c) => (
                <option key={c.classId} value={c.classId}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <ul aria-label="Features" className={styles.plainList}>
            {rows.map((r) => {
              const key = refKey({ kind: r.feature.kind, id: r.feature.id });
              return (
                <li key={key}>
                  <button
                    type="button"
                    className={styles.linkButton}
                    aria-expanded={open === key}
                    onClick={() => setOpen(open === key ? null : key)}
                  >
                    {r.feature.name}
                  </button>{' '}
                  <small className={page.muted}>
                    {r.owner} {r.level}, {statusLabel(r)}
                    {r.choiceInText
                      ? r.offered
                        ? ', choice offered'
                        : r.unofferedReason
                          ? ', choice not offered (reason given)'
                          : ', choice not offered'
                      : ''}
                    {r.needs ? `, needs ${r.needs}` : ''}
                  </small>
                  {open === key && <Draft row={r} index={content!.index} mappingKey={key} />}
                </li>
              );
            })}
          </ul>
          {!rows.length && <p className={page.muted}>Nothing to list.</p>}
        </section>
      </div>
    </>
  );
}

/** A feature's text, its data effects and a draft mapping from its text, to copy. */
function Draft({
  row,
  index,
  mappingKey,
}: {
  row: CoverageRow;
  index: ContentIndex;
  mappingKey: string;
}) {
  const f = row.feature;
  const owners = [
    f.kind === 'subclassFeature' ? index.get({ kind: 'subclass', id: f.subclassId }) : undefined,
    index.get({ kind: 'class', id: f.classId }),
  ];
  const code = mappingCode(mappingKey, suggestMapping(f, owners));
  return (
    <div className={styles.draft}>
      <EntityView entity={f} bare />
      <h3 className={styles.draftTitle}>Effects from data</h3>
      <pre className={styles.code}>
        {f.effects.length ? JSON.stringify(f.effects, null, 2) : 'None'}
      </pre>
      <h3 className={styles.draftTitle}>Draft mapping</h3>
      <pre className={styles.code} aria-label="Draft mapping">
        {code}
      </pre>
      <Button size="sm" onClick={() => void navigator.clipboard?.writeText(code)}>
        Copy
      </Button>
    </div>
  );
}
