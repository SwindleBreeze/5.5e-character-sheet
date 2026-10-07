// The sticky sheet header (plan §9.2, step 3.15): name, classes, HP, AC, conditions and the
// "Needs attention" chip, above every tab. Step 3.22 adds Concentration and the "More" menu
// (rests, dice roller, sources, overrides, level up).

import { Link } from 'react-router';
import { setOverride } from '../../engine/play/reducers.ts';
import { useSheet } from '../../ui/sheetContext.ts';
import { isOverridden } from './components/format.ts';
import { OverrideMarker } from './components/markers.tsx';
import { useExplain } from './components/useExplain.tsx';
import { HpPill, NeedsAttentionChip, type ConditionOption } from './components/vitals.tsx';
import { MoreMenu } from './play/MoreSheets.tsx';
import { useConcentrationStatus } from './play/useConcentrationStatus.tsx';
import { useHpActions } from './play/useHpActions.tsx';
import { attentionCount, classSummary, nameOf, type SheetBindings } from './sheetBindings.ts';
import styles from './SheetHeader.module.css';

function AttentionList({ sheet }: Pick<SheetBindings, 'sheet'>) {
  const { pending, attention } = sheet.choices;
  const warnings = sheet.issues.filter((i) => i.severity === 'warn');
  return (
    <div className={styles.attentionList}>
      {pending.length > 0 && (
        <section>
          <h3>Choices to make</h3>
          <ul>
            {pending.map((p) => (
              <li key={`${p.offer.key.owner.id}#${p.offer.key.slot}@${p.offer.key.n ?? ''}`}>
                {p.offer.source.name}: {p.count - p.have} more to pick
              </li>
            ))}
          </ul>
        </section>
      )}
      {attention.length > 0 && (
        <section>
          <h3>Picks to check</h3>
          <ul>
            {attention.map((r) => (
              <li key={r.key}>
                {r.at.record.labels.join(', ') || r.key} ({r.status})
              </li>
            ))}
          </ul>
        </section>
      )}
      {warnings.length > 0 && (
        <section>
          <h3>Rules</h3>
          <ul>
            {warnings.map((i, n) => (
              <li key={n}>{i.message}</li>
            ))}
          </ul>
        </section>
      )}
      <p className={styles.muted}>Picking and fixing arrive with level-up (phase 5).</p>
    </div>
  );
}

export function SheetHeader({
  character,
  sheet,
  index,
  apply,
  conditionOptions,
}: SheetBindings & { conditionOptions: ConditionOption[] }) {
  const bottomSheet = useSheet();
  const explain = useExplain();
  const count = attentionCount(sheet);
  const bindings = { character, sheet, index, apply };
  const hpActions = useHpActions(bindings);
  const openConcentration = useConcentrationStatus(bindings);
  const concentration = character.state.concentration;
  const conditionName = (id: string) =>
    conditionOptions.find((o) => o.id === id)?.name ?? nameOf(index, 'rule', id);

  return (
    <header className={styles.header}>
      <div className={styles.top}>
        <Link to="/" className={styles.back} aria-label="Back">
          <span aria-hidden="true">‹</span>
        </Link>
        <div className={styles.identity}>
          <h1 className={styles.name}>{character.name}</h1>
          <p className={styles.summary}>
            {sheet.classes.length > 1 && `Level ${sheet.charLevel} · `}
            {classSummary(sheet)}
          </p>
        </div>
        <div className={styles.stats}>
          <HpPill
            values={{ current: sheet.hp.current, max: sheet.hp.max.value, temp: sheet.hp.temp }}
            actions={hpActions}
          />
          <button
            type="button"
            className={`${styles.ac} numeric`}
            aria-label={`Armor Class ${sheet.ac.value}, show how it adds up`}
            onClick={() =>
              explain({
                key: 'ac',
                title: 'Armor Class',
                derived: sheet.ac,
                note: <p>{sheet.ac.calculation}</p>,
                onOverride: (v) => apply((c) => setOverride(c, 'ac', v)),
              })
            }
          >
            <span className={styles.acLabel}>AC</span> {sheet.ac.value}
            {isOverridden(sheet.ac) && <OverrideMarker />}
          </button>
          <button
            type="button"
            className={styles.more}
            aria-label="More: rests, dice roller, sources, overrides"
            onClick={() =>
              bottomSheet.open({
                key: 'more',
                title: 'More',
                render: () => <MoreMenu bindings={bindings} />,
              })
            }
          >
            <span aria-hidden="true">⋯</span>
          </button>
        </div>
      </div>
      {(sheet.conditions.length > 0 || sheet.exhaustion > 0 || count > 0 || concentration) && (
        <div className={styles.status}>
          {concentration && (
            <button type="button" className={styles.condition} onClick={openConcentration}>
              Concentrating: {nameOf(index, concentration.kind, concentration.id)}
            </button>
          )}
          {sheet.conditions.map((id) => (
            <span key={id} className={styles.condition}>
              {conditionName(id)}
            </span>
          ))}
          {sheet.exhaustion > 0 && (
            <span className={styles.condition}>Exhaustion {sheet.exhaustion}</span>
          )}
          <NeedsAttentionChip
            count={count}
            onOpen={() =>
              bottomSheet.open({
                key: 'needs-attention',
                title: 'Needs attention',
                render: () => <AttentionList sheet={sheet} />,
              })
            }
          />
        </div>
      )}
    </header>
  );
}
