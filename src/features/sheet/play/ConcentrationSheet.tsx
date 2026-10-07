// Concentration after damage (plan §9.2, step 3.22): the Constitution save and its DC, rolled
// here or with real dice, and whether the effect goes on.

import { useState } from 'react';
import type { DerivedRoll } from '../../../engine/derive/types.ts';
import { concentrationDc } from '../../../engine/play/reducers.ts';
import { Button } from '../../../ui/Button.tsx';
import { RollButton } from '../components/RollButton.tsx';
import inventory from '../inventory/inventory.module.css';

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

  return (
    <div className={inventory.form}>
      <p>
        You took {damage} damage while concentrating on <strong>{effect}</strong>. Make a
        Constitution saving throw to keep it going.
      </p>
      <p>
        <strong className="numeric">DC {dc}</strong>{' '}
        <span className={inventory.muted}>
          (10 or half the damage, whichever is higher, up to 30)
        </span>
      </p>
      <div className={inventory.field}>
        <span className={inventory.fieldLabel}>Your save</span>
        <RollButton label="Concentration save" roll={save} onRolled={(r) => setRolled(r.total)} />
        {rolled !== null && (
          <span className={rolled >= dc ? undefined : inventory.warn}>
            {rolled} — {rolled >= dc ? 'you keep concentrating' : 'Concentration ends'}
          </span>
        )}
      </div>
      <div className={inventory.actions}>
        <Button variant="primary" onClick={onKeep}>
          Kept it
        </Button>
        <Button variant="danger" onClick={onLose}>
          Lost it
        </Button>
      </div>
    </div>
  );
}
