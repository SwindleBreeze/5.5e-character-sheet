// The sticky sheet header (plan §9.2, step 3.15): name, classes, HP, AC, conditions and the
// "Needs attention" chip, above every tab. Step 3.22 adds Concentration and the "More" menu
// (rests, dice roller, sources, overrides, level up).

import { Link } from 'react-router';
import { attentionCount, attentionItems } from '../../engine/play/attention.ts';
import { setOverride } from '../../engine/play/reducers.ts';
import { useSheet } from '../../ui/sheetContext.ts';
import { isOverridden } from './components/format.ts';
import { OverrideMarker } from './components/markers.tsx';
import { useExplain } from './components/useExplain.tsx';
import { HpPill, NeedsAttentionChip, type ConditionOption } from './components/vitals.tsx';
import { MoreMenu } from './play/MoreSheets.tsx';
import { useConcentrationStatus } from './play/useConcentrationStatus.tsx';
import { useHpActions } from './play/useHpActions.tsx';
import { classSummary, nameOf, type SheetBindings } from './sheetBindings.ts';
import { AttentionSheet } from './attention/AttentionSheet.tsx';
import styles from './SheetHeader.module.css';

export function SheetHeader({
  character,
  sheet,
  index,
  apply,
  conditionOptions,
}: SheetBindings & { conditionOptions: ConditionOption[] }) {
  const bottomSheet = useSheet();
  const explain = useExplain();
  const count = attentionCount(attentionItems(sheet, character, index), character);
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
                render: () => <AttentionSheet bindings={bindings} />,
              })
            }
          />
        </div>
      )}
    </header>
  );
}
