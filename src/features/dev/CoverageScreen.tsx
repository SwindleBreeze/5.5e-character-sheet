// The featureEffects coverage report (plan §9.2, step 3.11) for the enabled sources: which
// class and subclass features have mappings, and which ask for a choice nothing offers. Also
// lists mappings that don't validate against the imported content.

import { useMemo, useState } from 'react';
import { TopBar } from '../../app/TopBar.tsx';
import page from '../../app/Page.module.css';
import { useAllContent, useEnabledSources } from '../../content/hooks.ts';
import { coverageReport, type CoverageRow } from '../../engine/featureEffects/coverage.ts';
import { featureEffects } from '../../engine/featureEffects/index.ts';
import { validateFeatureEffects } from '../../engine/featureEffects/validate.ts';
import styles from './Dev.module.css';

type Show = 'unoffered' | 'none' | 'all';

const SHOW: { value: Show; label: string }[] = [
  { value: 'unoffered', label: 'Choices with no offer' },
  { value: 'none', label: 'No effects at all' },
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
  const rows =
    show === 'unoffered'
      ? report.unofferedChoices
      : show === 'none'
        ? report.rows.filter((r) => r.status === 'none')
        : report.rows;

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
          <ul aria-label="Features" className={styles.plainList}>
            {rows.map((r) => (
              <li key={`${r.feature.kind}:${r.feature.id}`}>
                <strong>{r.feature.name}</strong>{' '}
                <small className={page.muted}>
                  {r.owner} {r.level}, {statusLabel(r)}
                  {r.choiceInText ? (r.offered ? ', choice offered' : ', choice not offered') : ''}
                </small>
              </li>
            ))}
          </ul>
          {!rows.length && <p className={page.muted}>Nothing to list.</p>}
        </section>
      </div>
    </>
  );
}
