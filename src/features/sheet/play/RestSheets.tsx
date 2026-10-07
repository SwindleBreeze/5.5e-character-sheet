// Short and Long Rests (plan §9.2, step 3.22). Both list what the rest spends, gives back and
// ends before it is taken, and say so again afterwards. On a Short Rest the player spends Hit
// Dice one at a time (the 2024 rules let you decide after each roll): rolled here, rolled with
// their own dice and typed in, or taken at the fixed value.

import { useState } from 'react';
import { hitDieFixed, canRest, restSummary, type RestSummary } from '../../../engine/play/rests.ts';
import { longRest, shortRest } from '../../../engine/play/reducers.ts';
import type { Character } from '../../../schema/index.ts';
import { Button } from '../../../ui/Button.tsx';
import { useRoller } from '../../../ui/rollerContext.ts';
import { signed } from '../components/format.ts';
import inventory from '../inventory/inventory.module.css';
import { nameOf, type SheetBindings } from '../sheetBindings.ts';
import styles from './play.module.css';

type Method = 'roll' | 'own' | 'fixed';

const METHODS: { id: Method; label: string }[] = [
  { id: 'roll', label: 'Roll them here' },
  { id: 'own', label: 'I roll my own dice' },
  { id: 'fixed', label: 'Fixed value' },
];

const HEADINGS = {
  preview: { spent: 'You spend', back: 'You get back', ends: 'Ends or drops' },
  done: { spent: 'You spent', back: 'You got back', ends: 'Ended or dropped' },
};

/** What the rest spends, gives back and ends, before it is taken (`preview`) or after. */
function Summary({
  summary,
  tense,
  empty,
}: {
  summary: RestSummary;
  tense: keyof typeof HEADINGS;
  empty: string;
}) {
  const parts = (['spent', 'back', 'ends'] as const).filter((p) => summary[p].length);
  if (!parts.length) return <p className={inventory.muted}>{empty}</p>;
  return parts.map((p) => (
    <section key={p} aria-label={HEADINGS[tense][p]}>
      <h3 className={inventory.fieldLabel}>{HEADINGS[tense][p]}</h3>
      <ul className={styles.summary}>
        {summary[p].map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </section>
  ));
}

function NeedsHp({ bindings }: { bindings: SheetBindings }) {
  if (canRest(bindings.sheet)) return null;
  return (
    <p className={inventory.warn}>
      You need at least 1 Hit Point to start a rest. Stabilize or heal first.
    </p>
  );
}

function useSummary(bindings: SheetBindings) {
  const { sheet, index } = bindings;
  return (before: Character, after: Character) =>
    restSummary(before, after, sheet, (ref) => nameOf(index, ref.kind, ref.id));
}

export function ShortRestSheet({
  bindings,
  onClose,
}: {
  bindings: SheetBindings;
  onClose: () => void;
}) {
  const { character, sheet, apply } = bindings;
  const roller = useRoller();
  const summary = useSummary(bindings);
  const [method, setMethod] = useState<Method>('roll');
  const [spent, setSpent] = useState<{ faces: number; roll: number }[]>([]);
  const [typed, setTyped] = useState<Record<number, string>>({});
  const [done, setDone] = useState<RestSummary | null>(null);
  const con = sheet.abilities.con.mod;

  const spend = spent.reduce<{ faces: number; rolls: number[] }[]>((out, s) => {
    const group = out.find((g) => g.faces === s.faces);
    if (group) group.rolls.push(s.roll);
    else out.push({ faces: s.faces, rolls: [s.roll] });
    return out;
  }, []);
  const preview = summary(character, shortRest(character, sheet, spend));

  if (done) {
    return (
      <div className={inventory.form}>
        <p>You finished a Short Rest.</p>
        <Summary summary={done} tense="done" empty="Nothing changed: nothing was spent." />
        <div className={inventory.actions}>
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  const add = (faces: number, roll: number) => setSpent([...spent, { faces, roll }]);

  return (
    <div className={inventory.form}>
      <p className={inventory.muted}>
        An hour of rest. Spend Hit Dice to heal: each heals its roll {signed(con)} (your
        Constitution modifier), at least 1. Short Rest features and Pact Magic slots come back.
      </p>
      <NeedsHp bindings={bindings} />

      <fieldset className={styles.methods}>
        <legend className={inventory.fieldLabel}>Hit Dice</legend>
        {METHODS.map((m) => (
          <label key={m.id} className={inventory.check}>
            <input
              type="radio"
              name="hit-dice-method"
              checked={method === m.id}
              onChange={() => setMethod(m.id)}
            />
            {m.label}
          </label>
        ))}
      </fieldset>
      {method === 'fixed' && (
        <p className={inventory.help}>
          The rules roll Hit Dice on a rest. The fixed value (half the die plus 1, as when gaining a
          level) is for tables that agree to use it.
        </p>
      )}

      {sheet.hitDice.map((h) => {
        const left = h.total - h.used - spent.filter((s) => s.faces === h.faces).length;
        const value = Number(typed[h.faces]);
        const valid = Number.isInteger(value) && value >= 1 && value <= h.faces;
        return (
          <div key={h.faces} className={inventory.field}>
            <span className={inventory.fieldLabel}>
              d{h.faces}: {left} of {h.total} left
            </span>
            {method === 'own' && (
              <label>
                <span className="visually-hidden">Your d{h.faces} roll</span>
                <input
                  className={styles.number}
                  inputMode="numeric"
                  placeholder={`1–${h.faces}`}
                  value={typed[h.faces] ?? ''}
                  onChange={(e) => setTyped({ ...typed, [h.faces]: e.target.value })}
                />
              </label>
            )}
            <Button
              size="sm"
              aria-disabled={left < 1 || (method === 'own' && !valid)}
              onClick={() => {
                if (left < 1) return;
                if (method === 'roll') {
                  add(
                    h.faces,
                    roller.roll({ label: `Hit Die (d${h.faces})`, expr: `1d${h.faces}` }).total,
                  );
                } else if (method === 'fixed') {
                  add(h.faces, hitDieFixed(h.faces));
                } else if (valid) {
                  add(h.faces, value);
                  setTyped({ ...typed, [h.faces]: '' });
                }
              }}
            >
              Spend a d{h.faces}
              {method === 'fixed' ? ` (${hitDieFixed(h.faces)})` : ''}
            </Button>
          </div>
        );
      })}

      {spent.length > 0 && (
        <div className={inventory.field}>
          <span>
            Rolls:{' '}
            {spent
              .map((s) => `d${s.faces} ${s.roll}${signed(con)} = ${Math.max(1, s.roll + con)}`)
              .join(', ')}
          </span>
          <Button size="sm" variant="ghost" onClick={() => setSpent(spent.slice(0, -1))}>
            Undo last
          </Button>
        </div>
      )}

      <Summary summary={preview} tense="preview" empty="Nothing to get back yet." />
      <div className={inventory.actions}>
        <Button
          variant="primary"
          onClick={() => {
            apply((c) => shortRest(c, sheet, spend));
            setDone(preview);
          }}
        >
          Finish Short Rest
        </Button>
      </div>
    </div>
  );
}

export function LongRestSheet({
  bindings,
  onClose,
}: {
  bindings: SheetBindings;
  onClose: () => void;
}) {
  const { character, sheet, apply } = bindings;
  const summary = useSummary(bindings);
  const [done, setDone] = useState<RestSummary | null>(null);
  const preview = summary(character, longRest(character, sheet));

  return (
    <div className={inventory.form}>
      {done ? (
        <p>You finished a Long Rest.</p>
      ) : (
        <>
          <p className={inventory.muted}>
            At least 8 hours, 6 of them asleep. You regain all Hit Points and all spent Hit Dice,
            spell slots and the features that recharge on a rest come back, and Exhaustion drops by
            one level. After one, you must wait 16 hours before starting another.
          </p>
          <NeedsHp bindings={bindings} />
        </>
      )}
      <Summary
        summary={done ?? preview}
        tense={done ? 'done' : 'preview'}
        empty="Nothing: you have everything already."
      />
      <div className={inventory.actions}>
        {done ? (
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={() => {
              apply((c) => longRest(c, sheet));
              setDone(preview);
            }}
          >
            Finish Long Rest
          </Button>
        )}
      </div>
    </div>
  );
}
