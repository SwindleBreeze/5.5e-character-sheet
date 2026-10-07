// Rolling from the sheet (plan §9.2, step 3.15): tap a d20 number, see the result in a toast
// that names what was rolled and shows the dice. Step 3.22 keeps the last rolls per character
// in memory, for the dice roller sheet. A notice (a spell cast) shows the same way, without dice.

import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { cryptoRng, roll, type Rng } from '../engine/dice/roll.ts';
import styles from './Roller.module.css';
import {
  HISTORY_SIZE,
  RollerContext,
  describeDice,
  type Notice,
  type RollerApi,
  type ShownRoll,
} from './rollerContext.ts';

type Toast = ShownRoll | (Notice & { id: number; result?: undefined });

/** How long a result stays up; tapping it dismisses it sooner. */
const SHOW_MS = 6000;
const MAX_SHOWN = 3;

export function RollerProvider({
  children,
  rng = cryptoRng,
}: {
  children: ReactNode;
  rng?: Rng | undefined;
}) {
  const [shown, setShown] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const scope = useRef('');
  const history = useRef(new Map<string, ShownRoll[]>());

  const dismiss = useCallback((id: number) => setShown((s) => s.filter((r) => r.id !== id)), []);
  const show = useCallback(
    (toast: Toast) => {
      setShown((s) => [...s, toast].slice(-MAX_SHOWN));
      setTimeout(() => dismiss(toast.id), SHOW_MS);
    },
    [dismiss],
  );

  const api = useMemo<RollerApi>(
    () => ({
      roll(request) {
        const result = roll(request.expr, rng, request.mode ?? 'normal');
        const rolled = { ...request, id: nextId.current++, result };
        const list = history.current.get(scope.current) ?? [];
        history.current.set(scope.current, [rolled, ...list].slice(0, HISTORY_SIZE));
        show(rolled);
        return result;
      },
      notify(notice) {
        show({ ...notice, id: nextId.current++ });
      },
      history: () => history.current.get(scope.current) ?? [],
      setScope: (next) => {
        scope.current = next;
      },
    }),
    [rng, show],
  );

  return (
    <RollerContext.Provider value={api}>
      {children}
      <div className={styles.region} role="status" aria-live="polite" aria-label="Rolls">
        {shown.map((r) =>
          !r.result ? (
            <button
              key={r.id}
              type="button"
              className={styles.toast}
              onClick={() => dismiss(r.id)}
              aria-label={`${r.label}${r.detail ? `: ${r.detail}` : ''}. Dismiss`}
            >
              <span className={styles.text}>
                <span className={styles.label}>{r.label}</span>
                {r.detail && <span className={styles.breakdown}>{r.detail}</span>}
              </span>
            </button>
          ) : (
            <button
              key={r.id}
              type="button"
              className={styles.toast}
              data-natural={
                r.result.natural === undefined
                  ? undefined
                  : r.result.natural >= (r.critOn ?? 20)
                    ? 'crit'
                    : r.result.natural === 1
                      ? 'fumble'
                      : undefined
              }
              onClick={() => dismiss(r.id)}
              aria-label={`${r.label}: ${r.result.total}. Dismiss`}
            >
              <span className={styles.text}>
                <span className={styles.label}>
                  {r.label}
                  {r.mode && r.mode !== 'normal' ? (
                    <span className={styles.mode}>
                      {r.mode === 'advantage' ? ' · Adv' : ' · Dis'}
                    </span>
                  ) : null}
                </span>
                <span className={styles.dice}>{describeDice(r.result)}</span>
                {r.breakdown && <span className={styles.breakdown}>{r.breakdown}</span>}
              </span>
              <span className={`${styles.total} numeric`}>{r.result.total}</span>
            </button>
          ),
        )}
      </div>
    </RollerContext.Provider>
  );
}
