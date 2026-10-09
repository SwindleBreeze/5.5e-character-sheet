// A background's ability increases picked freely (plan step 8.2): one row per ability with +2
// and +1, instead of a list of every combination (fifty of them with all six abilities).

import { useState } from 'react';
import { ABILITIES, ABILITY_NAMES, type Ability } from '../../schema/index.ts';
import type { ChoicePickerProps } from './ChoicePicker.tsx';
import { choiceHelp } from './help.ts';
import { spreadAmount, spreadComplete, toggleSpread } from './spread.ts';
import styles from './choices.module.css';
import { Button } from '../../ui/Button.tsx';

export function SpreadGrid({ choice, ctx, onSave, instant }: ChoicePickerProps) {
  const saved = choice.values as Ability[];
  const [draft, setDraft] = useState<Ability[] | null>(null);
  const picks = instant ? saved : (draft ?? saved);
  const from = new Set(choice.offer.from as Ability[]);
  const help = choiceHelp(choice);
  // Scores before this pick: the sheet's, less the increases picked now.
  const before = (a: Ability) => ctx.sheet.abilities[a].score.value - spreadAmount(saved, a);
  const done = spreadComplete(picks);
  const save = (values: Ability[]) => onSave({ values, labels: values });
  const tap = (a: Ability, amount: 1 | 2) => {
    const next = toggleSpread(picks, a, amount);
    if (instant) save(next);
    else setDraft(next);
  };

  return (
    <div className={styles.picker}>
      {help && <p className={styles.help}>{help}</p>}
      <div className={styles.head}>
        <span className={styles.count} aria-live="polite" data-done={done}>
          {done ? 'Chosen' : 'Choose +2 and +1, or +1 three times'}
        </span>
      </div>
      <ul className={styles.spread} aria-label="Ability increases">
        {ABILITIES.filter((a) => from.has(a)).map((a) => {
          const now = spreadAmount(picks, a);
          const was = before(a);
          return (
            <li key={a} className={styles.spreadRow}>
              <span className={styles.spreadName}>{ABILITY_NAMES[a]}</span>
              <span className={`${styles.spreadScore} numeric`}>
                {was}
                {now > 0 && <> → {Math.min(20, was + now)}</>}
              </span>
              {([2, 1] as const).map((amount) => (
                <button
                  key={amount}
                  type="button"
                  className={styles.spreadButton}
                  aria-pressed={now === amount}
                  aria-label={`+${amount} ${ABILITY_NAMES[a]}`}
                  disabled={now !== amount && was + amount > 20}
                  onClick={() => tap(a, amount)}
                >
                  +{amount}
                </button>
              ))}
            </li>
          );
        })}
      </ul>
      {!instant && (
        <div className={styles.head}>
          <span />
          <Button
            variant="primary"
            aria-disabled={!done}
            onClick={() => {
              if (done) save(picks);
            }}
          >
            Save
          </Button>
        </div>
      )}
    </div>
  );
}
