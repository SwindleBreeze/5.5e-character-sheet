// Feature actions, toggles and limited-use counters on the Actions tab (plan §9.2, step 3.17).

import { useState } from 'react';
import type {
  DerivedAction,
  DerivedAttack,
  DerivedCost,
  DerivedOutcome,
  DerivedResource,
  DerivedSheet,
  DerivedToggle,
} from '../../../engine/derive/types.ts';
import type { Ref } from '../../../schema/index.ts';
import { EntitySheet } from '../../../richtext/EntitySheet.tsx';
import { InlineText } from '../../../richtext/InlineText.tsx';
import { Button } from '../../../ui/Button.tsx';
import { Counter } from '../../../ui/Counter.tsx';
import { canPayAll } from '../../../engine/play/costs.ts';
import { useRoller } from '../../../ui/rollerContext.ts';
import { useSheet } from '../../../ui/sheetContext.ts';
import styles from './actions.module.css';
import { leftOf, RECHARGE_TEXT } from './labels.ts';
import { sourceLabel } from './sourceLabel.ts';

function Costs({ sheet, costs }: { sheet: DerivedSheet; costs: readonly DerivedCost[] }) {
  const shown = costs.filter((c) => c.label);
  if (!shown.length) return null;
  return (
    <p className={styles.meta}>
      Costs{' '}
      {shown.map((c, i) => {
        const left = leftOf(sheet, c);
        return (
          <span key={i}>
            {i > 0 && ', '}
            {c.label}
            {left !== undefined && <span className="numeric"> ({left} left)</span>}
          </span>
        );
      })}
    </p>
  );
}

function outcomeText(o: DerivedOutcome, sheet: DerivedSheet): string {
  if ('heal' in o) return `Regain ${o.heal} Hit Points`;
  if ('tempHp' in o) return `Gain ${o.tempHp} Temporary Hit Points`;
  if ('toggleOn' in o) {
    const name = sheet.toggles.find((t) => t.toggleId === o.toggleOn)?.name ?? o.toggleOn;
    return `Turns on ${name}`;
  }
  if ('restore' in o) return `Regain ${o.restore.amount} ${o.restore.label}`;
  if (o.regainSlot.maxLevel >= 9) return 'Regain one expended spell slot';
  return `Regain one expended spell slot of level ${o.regainSlot.maxLevel} or lower`;
}

function useOpenRule() {
  const sheet = useSheet();
  return (ref: Ref, title: string) =>
    sheet.open({
      key: `${ref.kind}:${ref.id}`,
      title,
      render: () => <EntitySheet entityRef={ref} />,
    });
}

export function ActionCard({
  action: a,
  sheet,
  attacks,
  onUse,
}: {
  action: DerivedAction;
  sheet: DerivedSheet;
  attacks: readonly DerivedAttack[];
  onUse: () => void;
}) {
  const roller = useRoller();
  const openRule = useOpenRule();
  const canPay = canPayAll(sheet, a.costs);
  const usable =
    a.costs.some((c) => c.resourceKey || c.slot || c.hitDice || c.charges) || a.outcomes.length > 0;
  const attackNames = a.attackIds
    .map((id) => attacks.find((x) => x.id === id)?.name)
    .filter((n): n is string => !!n);
  return (
    <li className={styles.card} aria-label={a.name}>
      <div className={styles.cardHead}>
        <div className={styles.title}>
          {a.source ? (
            <button
              type="button"
              className={styles.name}
              onClick={() => openRule(a.source!, a.sourceName)}
            >
              {a.name}
            </button>
          ) : (
            <span className={styles.name}>{a.name}</span>
          )}
        </div>
        {a.sourceName !== a.name && (
          <span className={styles.use}>{sourceLabel(a.source, a.sourceName)}</span>
        )}
      </div>
      <Costs sheet={sheet} costs={a.costs} />
      {a.description && (
        <p className={styles.rule}>
          <InlineText text={a.description} />
        </p>
      )}
      {a.outcomes.map((o, i) => (
        <p key={i} className={styles.rule}>
          {outcomeText(o, sheet)}
        </p>
      ))}
      {attackNames.length > 0 && (
        <p className={styles.rule}>Attacks with: {attackNames.join(', ')}</p>
      )}
      {(a.roll || a.saveDc !== undefined || usable) && (
        <div className={styles.rolls}>
          {a.roll && (
            <button
              type="button"
              className={`${styles.damage} numeric`}
              aria-label={`Roll ${a.name}, ${a.roll}`}
              onClick={() => roller.roll({ label: a.name, expr: a.roll! })}
            >
              {a.roll}
            </button>
          )}
          {a.saveDc !== undefined && (
            <span className={styles.dc}>
              DC <span className="numeric">{a.saveDc}</span>
            </span>
          )}
          {usable && (
            <Button
              size="sm"
              variant="primary"
              aria-disabled={!canPay}
              onClick={() => {
                if (canPay) onUse();
              }}
            >
              Use
            </Button>
          )}
          {usable && !canPay && <span className={styles.warn}>No uses left</span>}
        </div>
      )}
    </li>
  );
}

export function ToggleCard({
  toggle: t,
  sheet,
  onChange,
}: {
  toggle: DerivedToggle;
  sheet: DerivedSheet;
  onChange: (on: boolean, option?: string) => void;
}) {
  const openRule = useOpenRule();
  const [option, setOption] = useState(t.options[0]?.id ?? '');
  const canPay = canPayAll(sheet, t.costs);
  const activeOption = t.options.find((o) => o.id === t.option)?.name;
  const group = t.group
    ? sheet.toggles.filter((x) => x.group === t.group && x.toggleId !== t.toggleId)
    : [];
  return (
    <li className={styles.card} aria-label={t.name}>
      <div className={styles.cardHead}>
        <div className={styles.title}>
          <button
            type="button"
            className={styles.name}
            onClick={() => openRule(t.source, t.sourceName)}
          >
            {t.name}
          </button>
          {t.active && (
            <span className={styles.on}>On{activeOption ? `: ${activeOption}` : ''}</span>
          )}
        </div>
        {t.sourceName !== t.name && (
          <span className={styles.use}>{sourceLabel(t.source, t.sourceName)}</span>
        )}
      </div>
      <Costs sheet={sheet} costs={t.costs} />
      {t.onActivate.map((o, i) => (
        <p key={i} className={styles.rule}>
          When it starts: {outcomeText(o, sheet)}
        </p>
      ))}
      {t.endsOn.length > 0 && (
        <p className={styles.rule}>
          Ends on a {t.endsOn.map((e) => (e === 'shortRest' ? 'Short' : 'Long')).join(' or ')} Rest.
        </p>
      )}
      {group.length > 0 && (
        <p className={styles.rule}>
          Turning it on turns off {group.map((g) => g.name).join(', ')}.
        </p>
      )}
      <div className={styles.rolls}>
        {!t.active && t.options.length > 0 && (
          <label className={styles.select}>
            <span className="visually-hidden">{t.name} option</span>
            <select value={option} onChange={(e) => setOption(e.target.value)}>
              {t.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <Button
          size="sm"
          variant={t.active ? 'ghost' : 'primary'}
          aria-pressed={t.active}
          aria-disabled={!t.active && !canPay}
          onClick={() => {
            if (t.active || canPay) onChange(!t.active, t.active ? undefined : option || undefined);
          }}
        >
          {t.active ? `Turn off ${t.name}` : `Turn on ${t.name}`}
        </Button>
        {!t.active && !canPay && <span className={styles.warn}>No uses left</span>}
      </div>
    </li>
  );
}

export function ResourceCard({
  resource: r,
  onSpend,
  onRestore,
}: {
  resource: DerivedResource;
  onSpend: (amount: number) => void;
  onRestore: (amount: number) => void;
}) {
  const openRule = useOpenRule();
  const [amount, setAmount] = useState('');
  const left = r.max.value - r.used;
  const n = Math.trunc(Number(amount)) || 0;
  return (
    <li className={styles.card} aria-label={r.name}>
      <div className={styles.cardHead}>
        <div className={styles.title}>
          <button
            type="button"
            className={styles.name}
            onClick={() => openRule(r.source, r.sourceName)}
          >
            {r.name}
          </button>
          {r.die && <span className={styles.use}>{r.die}</span>}
        </div>
        <span className={styles.use}>
          {r.source.kind === 'species' || r.source.kind === 'feat'
            ? `${sourceLabel(r.source, r.sourceName)} · `
            : ''}
          Recharge: {RECHARGE_TEXT[r.recharge]}
        </span>
      </div>
      <div className={styles.rolls}>
        <Counter
          label={`${r.name} left`}
          value={left}
          max={r.max.value}
          onChange={(next) => (next < left ? onSpend(left - next) : onRestore(next - left))}
        />
        {r.pool && (
          <form
            className={styles.pool}
            onSubmit={(e) => {
              e.preventDefault();
              if (n < 1 || n > left) return;
              onSpend(n);
              setAmount('');
            }}
          >
            <label>
              <span className="visually-hidden">Amount of {r.name}</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={r.max.value}
                value={amount}
                placeholder="Amount"
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <Button size="sm" type="submit" aria-disabled={n < 1 || n > left}>
              Spend
            </Button>
            <Button
              size="sm"
              aria-disabled={n < 1 || n > r.used}
              onClick={() => {
                if (n < 1 || n > r.used) return;
                onRestore(n);
                setAmount('');
              }}
            >
              Restore
            </Button>
          </form>
        )}
      </div>
      {r.restoreWith.map((w, i) => (
        <p key={i} className={styles.rule}>
          Regain {w.amount} by spending {w.costs.join(' and ')}.
        </p>
      ))}
    </li>
  );
}
