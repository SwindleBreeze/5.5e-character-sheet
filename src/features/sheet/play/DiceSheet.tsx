// The dice roller (plan §9.2, step 3.22): for when there are no dice at the table. One die at a
// tap, or any expression (`2d6+3`, `4d6kh3`), with advantage or disadvantage on a lone d20, and
// this character's last rolls (kept in memory until the app closes).

import { useState } from 'react';
import { parseRoll, RollError, type RollMode } from '../../../engine/dice/roll.ts';
import { Button } from '../../../ui/Button.tsx';
import { describeDice, HISTORY_SIZE, useRoller } from '../../../ui/rollerContext.ts';
import inventory from '../inventory/inventory.module.css';
import styles from './play.module.css';

const DICE = [4, 6, 8, 10, 12, 20, 100];

const MODES: { id: RollMode; label: string }[] = [
  { id: 'normal', label: 'Normal' },
  { id: 'advantage', label: 'Advantage' },
  { id: 'disadvantage', label: 'Disadvantage' },
];

export function DiceSheet() {
  const roller = useRoller();
  const [expr, setExpr] = useState('');
  const [mode, setMode] = useState<RollMode>('normal');
  const [error, setError] = useState('');
  const [history, setHistory] = useState(roller.history);

  const roll = (text: string) => {
    try {
      parseRoll(text);
    } catch (err) {
      if (!(err instanceof RollError)) throw err;
      setError(err.message);
      return;
    }
    setError('');
    roller.roll({ label: text, expr: text, mode });
    setHistory(roller.history());
  };

  return (
    <div className={inventory.form}>
      <div className={styles.dice} role="group" aria-label="Roll one die">
        {DICE.map((faces) => (
          <Button key={faces} onClick={() => roll(`1d${faces}`)}>
            d{faces}
          </Button>
        ))}
      </div>
      <form
        className={inventory.field}
        onSubmit={(e) => {
          e.preventDefault();
          if (expr.trim()) roll(expr.trim());
        }}
      >
        <label className={inventory.field}>
          <span className={inventory.fieldLabel}>Dice</span>
          <input
            value={expr}
            placeholder="2d6+3"
            autoCapitalize="off"
            autoComplete="off"
            onChange={(e) => setExpr(e.target.value)}
          />
        </label>
        <Button type="submit" variant="primary" aria-disabled={!expr.trim()}>
          Roll
        </Button>
      </form>
      {error && <p className={inventory.warn}>{error}</p>}
      <fieldset className={styles.methods}>
        <legend className={inventory.fieldLabel}>A single d20</legend>
        {MODES.map((m) => (
          <label key={m.id} className={inventory.check}>
            <input
              type="radio"
              name="roll-mode"
              checked={mode === m.id}
              onChange={() => setMode(m.id)}
            />
            {m.label}
          </label>
        ))}
      </fieldset>
      <p className={inventory.help}>
        Advantage and Disadvantage roll two d20s and keep the higher or lower one.
      </p>

      <h3 className={inventory.fieldLabel}>Last rolls</h3>
      {history.length ? (
        <ol className={styles.history} aria-label="Last rolls">
          {history.map((r) => (
            <li key={r.id}>
              <span className={styles.historyText}>
                <span>
                  {r.label}
                  {r.mode && r.mode !== 'normal' && (
                    <span className={inventory.muted}>
                      {r.mode === 'advantage' ? ' · Adv' : ' · Dis'}
                    </span>
                  )}
                </span>
                <span className={inventory.muted}>{describeDice(r.result)}</span>
              </span>
              <strong className="numeric">{r.result.total}</strong>
            </li>
          ))}
        </ol>
      ) : (
        <p className={inventory.muted}>No rolls yet. The last {HISTORY_SIZE} are kept here.</p>
      )}
    </div>
  );
}
