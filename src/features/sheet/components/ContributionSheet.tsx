// Why a number is what it is (plan §8.2 rule 3): its parts, its total, and the player's own
// value replacing it when they want one. Shown in the bottom sheet when a number is tapped.

import { useId, useState, type ReactNode } from 'react';
import type { Derived } from '../../../engine/derive/types.ts';
import { Button } from '../../../ui/Button.tsx';
import { isOverridden, partValue, signed } from './format.ts';
import styles from './ContributionSheet.module.css';

export interface ContributionSheetProps {
  derived: Derived;
  /** Show the total with its sign (`+5`), for bonuses. */
  bonus?: boolean;
  /** More about the number: advantage reasons, dice added, the AC calculation. */
  note?: ReactNode;
  /** When given, the player can set their own value; `undefined` removes it. */
  onOverride?: (value: number | undefined) => void;
}

export function ContributionSheet({ derived, bonus, note, onOverride }: ContributionSheetProps) {
  const inputId = useId();
  const overridden = isOverridden(derived);
  const [draft, setDraft] = useState(overridden ? String(derived.value) : '');
  const parsed = draft.trim() === '' ? NaN : Number(draft);
  const total = bonus ? signed(derived.value) : String(derived.value);

  return (
    <div className={styles.sheet}>
      <p className={`${styles.total} numeric`} aria-label={`Total ${total}`}>
        {total}
      </p>
      {note && <div className={styles.note}>{note}</div>}
      <table className={styles.parts}>
        <caption className="visually-hidden">How it adds up</caption>
        <tbody>
          {derived.parts.map((p, i) => (
            <tr key={i} data-kind={p.kind ?? 'bonus'}>
              <th scope="row">
                {p.label}
                {p.kind === 'set' && <span className={styles.kind}> sets the value</span>}
                {p.kind === 'override' && <span className={styles.kind}> replaces the value</span>}
              </th>
              <td className="numeric">{partValue(p)}</td>
            </tr>
          ))}
          {!derived.parts.length && (
            <tr>
              <th scope="row">Nothing adds to this</th>
              <td className="numeric">{derived.value}</td>
            </tr>
          )}
        </tbody>
      </table>
      {onOverride && (
        <form
          className={styles.override}
          onSubmit={(e) => {
            e.preventDefault();
            if (Number.isFinite(parsed)) onOverride(Math.trunc(parsed));
          }}
        >
          <label htmlFor={inputId} className={styles.overrideLabel}>
            Your own value
          </label>
          <p className={styles.help}>Replaces the computed number until you remove it.</p>
          <div className={styles.overrideRow}>
            <input
              id={inputId}
              type="number"
              inputMode="numeric"
              value={draft}
              placeholder={String(derived.value)}
              onChange={(e) => setDraft(e.target.value)}
            />
            <Button type="submit" variant="primary" disabled={!Number.isFinite(parsed)}>
              Use this
            </Button>
            {overridden && (
              <Button variant="ghost" onClick={() => onOverride(undefined)}>
                Remove
              </Button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
