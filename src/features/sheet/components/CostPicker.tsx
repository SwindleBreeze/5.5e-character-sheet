// Picking what pays a cost (plan §9.2, step 3.18): which spell slot, which Hit Die size. Shown
// in the bottom sheet before an action, toggle or damage rider that needs one is paid.

import { useState } from 'react';
import type { DerivedSheet } from '../../../engine/derive/types.ts';
import {
  hitDieChoices,
  slotChoices,
  type CostChoice,
  type SlotChoice,
} from '../../../engine/play/costs.ts';
import { Button } from '../../../ui/Button.tsx';
import styles from './CostPicker.module.css';

export interface CostNeeds {
  slot?: { minLevel: number };
  hitDie?: boolean;
}

const slotKey = (s: SlotChoice) => `${s.pact ? 'pact' : 'slot'}:${s.level}`;

export function CostPicker({
  sheet,
  needs,
  confirmLabel,
  onConfirm,
}: {
  sheet: DerivedSheet;
  needs: CostNeeds;
  confirmLabel: string;
  onConfirm: (choice: CostChoice) => void;
}) {
  const slots = needs.slot ? slotChoices(sheet, needs.slot.minLevel) : [];
  const dice = needs.hitDie ? hitDieChoices(sheet) : [];
  const [slot, setSlot] = useState(slots[0] ? slotKey(slots[0]) : '');
  const [die, setDie] = useState(dice[0]?.faces ?? 0);
  const picked = slots.find((s) => slotKey(s) === slot);

  return (
    <form
      className={styles.picker}
      onSubmit={(e) => {
        e.preventDefault();
        const choice: CostChoice = {};
        if (picked)
          choice.slot = picked.pact ? { level: picked.level, pact: true } : { level: picked.level };
        if (die) choice.hitDie = die;
        onConfirm(choice);
      }}
    >
      {needs.slot && (
        <fieldset className={styles.group}>
          <legend>Spell slot (level {needs.slot.minLevel} or higher)</legend>
          {slots.map((s) => (
            <label key={slotKey(s)} className={styles.option}>
              <input
                type="radio"
                name="slot"
                checked={slot === slotKey(s)}
                onChange={() => setSlot(slotKey(s))}
              />
              {s.pact ? `Pact Magic slot, level ${s.level}` : `Level ${s.level} slot`}
              <span className={styles.left}>{s.left} left</span>
            </label>
          ))}
          {!slots.length && <p className={styles.none}>No slot of that level is left.</p>}
        </fieldset>
      )}
      {needs.hitDie && (
        <fieldset className={styles.group}>
          <legend>Hit Die</legend>
          {dice.map((d) => (
            <label key={d.faces} className={styles.option}>
              <input
                type="radio"
                name="hit-die"
                checked={die === d.faces}
                onChange={() => setDie(d.faces)}
              />
              d{d.faces}
              <span className={styles.left}>{d.left} left</span>
            </label>
          ))}
        </fieldset>
      )}
      <Button type="submit" variant="primary" disabled={!!needs.slot && !picked}>
        {confirmLabel}
      </Button>
    </form>
  );
}
