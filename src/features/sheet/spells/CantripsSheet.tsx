// Changing a cantrip (plan §9.4, step 5.6): a caster's cantrip picks, each with what is in it
// and when the rules let it change; "Change" opens the pick. The timing is said, not enforced.

import { LiveChoiceSheet } from '../../choices/LiveChoiceSheet.tsx';
import { retrainText } from '../../choices/picks.ts';
import type { DerivedCaster } from '../../../engine/derive/types.ts';
import { Button } from '../../../ui/Button.tsx';
import { useSheet } from '../../../ui/sheetContext.ts';
import { useLiveBindings } from '../liveBindings.ts';
import type { SheetBindings } from '../sheetBindings.ts';
import styles from './spells.module.css';

export function CantripsSheet({
  bindings: opened,
  caster,
}: {
  bindings: SheetBindings;
  caster: DerivedCaster;
}) {
  const bindings = useLiveBindings(opened);
  const ui = useSheet();
  const picks = bindings.sheet.features
    .filter((f) => f.classId === caster.classId || f.ref.id === caster.key)
    .flatMap((f) => f.choices)
    .filter((c) => c.offer.key.slot.startsWith('cantrips.'))
    .sort((a, b) => a.entryIndex - b.entryIndex);
  if (!picks.length) return <p className={styles.muted}>No cantrip picks to change.</p>;
  return (
    <div className={styles.cast}>
      <p className={styles.muted}>{retrainText(picks[0]!)}</p>
      <ul className={styles.rows} aria-label="Cantrip picks">
        {picks.map((c) => {
          const level = c.offer.key.slot.split('.')[1];
          return (
            <li key={c.key} className={styles.row} aria-label={`Level ${level} cantrips`}>
              <span className={styles.spellName}>
                Level {level}: {c.labels.join(', ') || 'none picked'}
              </span>
              <Button
                size="sm"
                onClick={() =>
                  ui.push({
                    key: `cantrips:${c.key}`,
                    title: `${caster.name}: level ${level} cantrips`,
                    render: () => (
                      <LiveChoiceSheet bindings={bindings} choiceKey={c.key} onClose={ui.back} />
                    ),
                  })
                }
              >
                Change
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
