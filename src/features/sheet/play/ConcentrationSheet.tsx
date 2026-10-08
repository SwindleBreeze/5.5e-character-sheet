// Concentration after damage (plan §9.2, step 3.22): the Constitution save and its DC, rolled
// here or with real dice, and whether the effect goes on.

import { useState } from 'react';
import type { DerivedRoll } from '../../../engine/derive/types.ts';
import { concentrationDc } from '../../../engine/play/reducers.ts';
import { Button } from '../../../ui/Button.tsx';
import { RollButton } from '../components/RollButton.tsx';
import inventory from '../inventory/inventory.module.css';
import styles from './play.module.css';

export function ConcentrationSheet({
  effect,
  damage,
  dropped,
  save,
  onKeep,
  onLose,
}: {
  /** The effect concentrated on. */
  effect: string;
  damage: number;
  /** The damage left the character at 0 Hit Points. */
  dropped: boolean;
  save: DerivedRoll;
  onKeep: () => void;
  onLose: () => void;
}) {
  const [rolled, setRolled] = useState<number | null>(null);
  const dc = concentrationDc(damage);

  if (dropped) {
    return (
      <div className={inventory.form}>
        <p>
          At 0 Hit Points you are Unconscious, so your Concentration on <strong>{effect}</strong>{' '}
          ends.
        </p>
        <div className={inventory.actions}>
          <Button variant="primary" onClick={onKeep}>
            OK
          </Button>
        </div>
      </div>
    );
  }

  const kept = rolled !== null && rolled >= dc;
  return (
    <div className={`${inventory.form} ${styles.concentration}`}>
      <p>
        You took {damage} damage while concentrating on <strong>{effect}</strong>. Roll a
        Constitution saving throw: meet the DC and it goes on.
      </p>
      <div className={styles.saveRow}>
        <div className={styles.saveCard}>
          <span className={styles.saveLabel}>DC</span>
          <strong className={`${styles.saveValue} numeric`}>{dc}</strong>
          <span className={styles.saveHint}>10, or half the damage if higher</span>
        </div>
        <div className={styles.saveCard}>
          <span className={styles.saveLabel}>Your save</span>
          <RollButton
            label="Concentration save"
            roll={save}
            size="lg"
            onRolled={(r) => setRolled(r.total)}
          />
          <span className={styles.saveHint}>Tap to roll, or roll your own dice</span>
        </div>
      </div>
      {rolled !== null && (
        <p className={styles.saveResult} data-kept={kept} aria-live="polite">
          You rolled <strong className="numeric">{rolled}</strong>:{' '}
          {kept ? 'you keep concentrating.' : 'your Concentration ends.'}
        </p>
      )}
      <div className={inventory.actions}>
        <Button variant={rolled === null || kept ? 'primary' : 'secondary'} onClick={onKeep}>
          Kept it
        </Button>
        <Button variant={rolled !== null && !kept ? 'primary' : 'danger'} onClick={onLose}>
          Lost it
        </Button>
      </div>
    </div>
  );
}
