// Hit points, hit dice, death saves, conditions and exhaustion: the parts of the sheet that
// change during play. Presentational: values in, changes out through callbacks.

import { useState, type ReactNode } from 'react';
import { Button } from '../../../ui/Button.tsx';
import { StepButton } from '../../../ui/Counter.tsx';
import { useSheet } from '../../../ui/sheetContext.ts';
import stats from './stats.module.css';
import styles from './vitals.module.css';

export interface HpValues {
  current: number;
  max: number;
  temp: number;
  ward?: { name: string; current: number; max: number } | undefined;
}

export interface HpActions {
  onDamage: (amount: number) => void;
  onHeal: (amount: number) => void;
  onTempHp: (amount: number) => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'] as const;

/** A number pad for HP changes: type an amount, then say what it is. */
export function HpKeypad({
  current,
  max,
  temp,
  onDamage,
  onHeal,
  onTempHp,
  onExplainMax,
}: HpValues & HpActions & { onExplainMax?: (() => void) | undefined }) {
  const [amount, setAmount] = useState('');
  const n = Number(amount) || 0;
  const press = (key: (typeof KEYS)[number]) =>
    setAmount((a) =>
      key === 'clear'
        ? ''
        : key === 'back'
          ? a.slice(0, -1)
          : (a + key).replace(/^0+/, '').slice(0, 4),
    );
  return (
    <div className={styles.keypad}>
      <p className={styles.keypadNow}>
        <span className="numeric">
          {current} / {max}
        </span>{' '}
        HP{temp > 0 && <span className="numeric"> · {temp} temp</span>}
        {onExplainMax && (
          <>
            {' · '}
            <button type="button" className={styles.link} onClick={onExplainMax}>
              Max HP
            </button>
          </>
        )}
      </p>
      <output className={`${styles.keypadAmount} numeric`} aria-label="Amount" aria-live="polite">
        {amount || '0'}
      </output>
      <div className={styles.keys}>
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className={styles.key}
            onClick={() => press(key)}
            aria-label={key === 'clear' ? 'Clear' : key === 'back' ? 'Delete digit' : key}
          >
            {key === 'clear' ? 'C' : key === 'back' ? '⌫' : key}
          </button>
        ))}
      </div>
      <div className={styles.keypadActions}>
        <Button variant="danger" disabled={!n} onClick={() => onDamage(n)}>
          Damage
        </Button>
        <Button className={styles.heal} disabled={!n} onClick={() => onHeal(n)}>
          Heal
        </Button>
        <Button disabled={!n} onClick={() => onTempHp(n)}>
          Temp HP
        </Button>
      </div>
    </div>
  );
}

/** Opens the HP keypad; an action closes it first, so it can open another sheet (a save). */
function useHpKeypad(values: HpValues, actions: HpActions, onExplainMax?: () => void) {
  const sheet = useSheet();
  return () =>
    sheet.open({
      key: 'hp-keypad',
      title: 'Hit points',
      render: () => (
        <HpKeypad
          {...values}
          onExplainMax={onExplainMax}
          onDamage={(n) => (sheet.close(), actions.onDamage(n))}
          onHeal={(n) => (sheet.close(), actions.onHeal(n))}
          onTempHp={(n) => (sheet.close(), actions.onTempHp(n))}
        />
      ),
    });
}

/** A grid of stat tiles, the same as the Combat tiles. */
export function Tiles({ children }: { children: ReactNode }) {
  return <div className={styles.tiles}>{children}</div>;
}

/** An HP tile: the number inside a ring that empties as HP drops; tapping opens the keypad. */
export function HpWidget({
  values,
  actions,
  onExplainMax,
}: {
  values: HpValues;
  actions: HpActions;
  onExplainMax?: () => void;
}) {
  const open = useHpKeypad(values, actions, onExplainMax);
  const { current, max, temp, ward } = values;
  const fill = max > 0 ? Math.min(100, (current / max) * 100) : 0;
  const tempFill = max > 0 ? Math.min(100 - fill, (temp / max) * 100) : 0;
  const state = current === 0 ? 'down' : current <= max / 2 ? 'bloodied' : 'healthy';
  return (
    <button
      type="button"
      className={`${stats.pill} ${styles.hp}`}
      data-state={state}
      onClick={open}
      aria-label={`Hit points ${current} of ${max}${temp ? `, ${temp} temporary` : ''}. Change`}
    >
      <span className={stats.pillLabel}>Hit points</span>
      <span className={styles.ring}>
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <circle className={styles.ringTrack} cx="32" cy="32" r="28" pathLength={100} />
          <circle
            className={styles.ringFill}
            cx="32"
            cy="32"
            r="28"
            pathLength={100}
            strokeDasharray={`${fill} 100`}
          />
          {tempFill > 0 && (
            <circle
              className={styles.ringTemp}
              cx="32"
              cy="32"
              r="28"
              pathLength={100}
              strokeDasharray={`0 ${fill} ${tempFill} 100`}
            />
          )}
        </svg>
        <span className={`${styles.ringText} numeric`}>
          <span className={styles.hpCurrent}>{current}</span>
          <span className={styles.hpMax}>/ {max}</span>
        </span>
      </span>
      {temp > 0 && (
        <span className={`${stats.pillSub} ${styles.hpTemp} numeric`}>+{temp} temp</span>
      )}
      {ward && (
        <span className={`${stats.pillSub} numeric`}>
          {ward.name} {ward.current}/{ward.max}
        </span>
      )}
    </button>
  );
}

/** A tile with −/+ under its number: hit dice, exhaustion. */
function StepperTile({
  label,
  name,
  value,
  max,
  sub,
  onChange,
}: {
  label: string;
  /** What the buttons change, for screen readers: `d10 hit dice left`. */
  name: string;
  value: number;
  max: number;
  sub: string;
  onChange: (next: number) => void;
}) {
  return (
    <div className={stats.pill} role="group" aria-label={name}>
      <span className={stats.pillLabel}>{label}</span>
      <output className={`${stats.pillValue} numeric`} aria-live="polite">
        {value}
        <span className={styles.of}>/{max}</span>
      </output>
      <span className={stats.pillSub}>{sub}</span>
      <span className={styles.steps}>
        <StepButton
          className={styles.step}
          label={`Decrease ${name}`}
          symbol="−"
          blocked={value <= 0}
          onStep={() => onChange(value - 1)}
        />
        <StepButton
          className={styles.step}
          label={`Increase ${name}`}
          symbol="+"
          blocked={value >= max}
          onStep={() => onChange(value + 1)}
        />
      </span>
    </div>
  );
}

/** The HP pill in the sheet header: small, opens the same keypad. */
export function HpPill({ values, actions }: { values: HpValues; actions: HpActions }) {
  const open = useHpKeypad(values, actions);
  const { current, max, temp } = values;
  const state = current === 0 ? 'down' : current <= max / 2 ? 'bloodied' : 'healthy';
  return (
    <button
      type="button"
      className={`${styles.hpPill} numeric`}
      data-state={state}
      onClick={open}
      aria-label={`Hit points ${current} of ${max}${temp ? `, ${temp} temporary` : ''}. Change`}
    >
      <span aria-hidden="true">♥</span> {current}/{max}
      {temp > 0 && <span className={styles.hpTemp}> +{temp}</span>}
    </button>
  );
}

export function HitDice({
  dice,
  onChange,
}: {
  dice: { faces: number; total: number; used: number }[];
  onChange: (faces: number, used: number) => void;
}) {
  return dice.map((d) => (
    <StepperTile
      key={d.faces}
      label="Hit dice"
      name={`d${d.faces} hit dice left`}
      value={d.total - d.used}
      max={d.total}
      sub={`d${d.faces}`}
      onChange={(left) => onChange(d.faces, d.total - left)}
    />
  ));
}

function Pips({
  kind,
  count,
  onSet,
}: {
  kind: 'Success' | 'Failure';
  count: number;
  onSet: (n: number) => void;
}) {
  return (
    <div
      className={styles.pips}
      role="group"
      aria-label={kind === 'Success' ? 'Successes' : 'Failures'}
    >
      {[1, 2, 3].map((i) => (
        <button
          key={i}
          type="button"
          className={styles.pip}
          data-kind={kind}
          aria-pressed={count >= i}
          aria-label={`${kind} ${i}`}
          // Tapping the last marked pip unmarks it; any other sets the count to it.
          onClick={() => onSet(count === i ? i - 1 : i)}
        />
      ))}
    </div>
  );
}

export function DeathSaves({
  successes,
  failures,
  onChange,
  onRoll,
}: {
  successes: number;
  failures: number;
  onChange: (saves: { successes: number; failures: number }) => void;
  onRoll?: () => void;
}) {
  const status = failures >= 3 ? 'Dead' : successes >= 3 ? 'Stable' : null;
  return (
    <div className={styles.deathSaves}>
      <div className={styles.deathRow}>
        <span className={styles.deathLabel}>Successes</span>
        <Pips
          kind="Success"
          count={successes}
          onSet={(n) => onChange({ successes: n, failures })}
        />
      </div>
      <div className={styles.deathRow}>
        <span className={styles.deathLabel}>Failures</span>
        <Pips kind="Failure" count={failures} onSet={(n) => onChange({ successes, failures: n })} />
      </div>
      <div className={styles.deathFooter}>
        {status && <strong data-status={status}>{status}</strong>}
        {onRoll && (
          <Button size="sm" onClick={onRoll}>
            Roll death save
          </Button>
        )}
      </div>
    </div>
  );
}

export interface ConditionOption {
  id: string;
  name: string;
}

export function ConditionChips({
  active,
  available,
  onAdd,
  onRemove,
}: {
  active: ConditionOption[];
  available: ConditionOption[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const sheet = useSheet();
  const activeIds = new Set(active.map((c) => c.id));
  const pick = () =>
    sheet.open({
      key: 'add-condition',
      title: 'Add a condition',
      render: () => (
        <ul className={styles.pickList}>
          {available
            .filter((c) => !activeIds.has(c.id))
            .map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={styles.pickItem}
                  onClick={() => (onAdd(c.id), sheet.close())}
                >
                  {c.name}
                </button>
              </li>
            ))}
          {!available.length && <li>No conditions are imported.</li>}
        </ul>
      ),
    });
  return (
    <div className={styles.chips}>
      {active.map((c) => (
        <span key={c.id} className={styles.chip}>
          {c.name}
          <button
            type="button"
            className={styles.chipRemove}
            aria-label={`Remove ${c.name}`}
            onClick={() => onRemove(c.id)}
          >
            ✕
          </button>
        </span>
      ))}
      <Button size="sm" variant="ghost" onClick={pick}>
        + Condition
      </Button>
    </div>
  );
}

/** Exhaustion 0–6 (2024): −2 per level to d20 tests, −5 ft. per level of Speed. */
export function ExhaustionStepper({
  level,
  onChange,
}: {
  level: number;
  onChange: (level: number) => void;
}) {
  return (
    <StepperTile
      label="Exhaustion"
      name="Exhaustion"
      value={level}
      max={6}
      sub={level === 0 ? 'None' : level >= 6 ? 'Death' : `−${2 * level} d20, −${5 * level} ft.`}
      onChange={onChange}
    />
  );
}

/** "Needs attention (N)": choices to make, picks to fix, rules broken. Hidden at zero. */
export function NeedsAttentionChip({ count, onOpen }: { count: number; onOpen: () => void }) {
  if (!count) return null;
  return (
    <button type="button" className={styles.attention} onClick={onOpen}>
      Needs attention <span className="numeric">({count})</span>
    </button>
  );
}
