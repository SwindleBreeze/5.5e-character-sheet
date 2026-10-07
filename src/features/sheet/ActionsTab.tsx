// The Actions tab (plan §9.2, step 3.17): attacks with tap-to-roll to-hit and damage, the
// actions features grant grouped by what they take (action, Bonus Action, Reaction), toggles,
// limited-use counters, and the standard actions everyone has (collapsed).

import { useRef, type ReactNode } from 'react';
import type { DerivedAttack } from '../../engine/derive/types.ts';
import {
  endTurn,
  payCost,
  restoreResource,
  spendResource,
  toggle,
  useAction as takeAction,
  useRider as markRiderUsed,
  type RollAmount,
} from '../../engine/play/reducers.ts';
import type { CostChoice } from '../../engine/play/costs.ts';
import type { ActionType } from '../../schema/index.ts';
import { EntitySheet } from '../../richtext/EntitySheet.tsx';
import { Button } from '../../ui/Button.tsx';
import { useRoller } from '../../ui/rollerContext.ts';
import { useSheet } from '../../ui/sheetContext.ts';
import { columnsFor, useContainerWidth } from '../../ui/useContainerWidth.ts';
import { AttackCard } from './actions/AttackCard.tsx';
import { ActionCard, ResourceCard, ToggleCard } from './actions/FeatureCards.tsx';
import actionStyles from './actions/actions.module.css';
import { SectionHeader } from './components/stats.tsx';
import { useCostPicker } from './components/useCostPicker.tsx';
import { useExplain } from './components/useExplain.tsx';
import type { SheetBindings } from './sheetBindings.ts';
import styles from './MainTab.module.css';

type SectionId = 'attacks' | 'features' | 'toggles' | 'resources' | 'standard';

const LAYOUTS: Record<1 | 2 | 3, SectionId[][]> = {
  1: [['attacks', 'features', 'toggles', 'resources', 'standard']],
  2: [['attacks'], ['features', 'toggles', 'resources', 'standard']],
  3: [['attacks'], ['features', 'toggles'], ['resources', 'standard']],
};

const GROUPS: { type: ActionType; title: string }[] = [
  { type: 'action', title: 'Actions' },
  { type: 'bonus', title: 'Bonus Actions' },
  { type: 'reaction', title: 'Reactions' },
  { type: 'other', title: 'Other' },
];

const CAST_ORDER: Record<ActionType, number> = { action: 0, bonus: 1, reaction: 2, other: 3 };

/** In hand, the Light extra attack, the Unarmed Strike, stowed weapons, then cantrips. */
function attackRank(a: DerivedAttack): number {
  if (a.use.kind === 'cast') return 10 + CAST_ORDER[a.use.time];
  if (a.use.kind === 'lightExtra') return 1;
  if (a.kind === 'unarmed') return 2;
  return a.ready ? 0 : 3;
}

function Section({
  id,
  title,
  action,
  children,
}: {
  id: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={styles.section} aria-labelledby={`actions-${id}`}>
      <SectionHeader id={`actions-${id}`} title={title} action={action} />
      {children}
    </section>
  );
}

export function ActionsTab({ character, sheet, index, apply }: SheetBindings) {
  const ref = useRef<HTMLDivElement>(null);
  const columns = columnsFor(useContainerWidth(ref));
  const roller = useRoller();
  const explain = useExplain();
  const ui = useSheet();
  const rollAmount: RollAmount = (expr, label) => roller.roll({ label, expr }).total;
  const pay = useCostPicker();

  const attacks = sheet.attacks
    .map((a, i) => ({ a, i }))
    .sort((x, y) => attackRank(x.a) - attackRank(y.a) || x.i - y.i)
    .map((x) => x.a);
  const perAction = sheet.attacksPerAction.value;
  const hasOncePerTurn = sheet.attacks.some((a) => a.riders.some((r) => r.oncePerTurn));
  const usedThisTurn = character.state.turn.ridersUsed.length;
  const features = sheet.actions.filter((a) => !a.standard);
  const standard = sheet.actions.filter((a) => a.standard);
  /** Names of the attacks an action makes, in the order the Attacks list shows them. */
  const attackNames = (ids: readonly string[]) =>
    attacks
      .filter((a) => ids.includes(a.id))
      .map((a) => a.name)
      .join(', ');

  const sections: Record<SectionId, ReactNode> = {
    attacks: (
      <Section
        id="attacks"
        title="Attacks"
        action={
          <span className={actionStyles.headerActions}>
            {hasOncePerTurn && usedThisTurn > 0 && (
              <Button size="sm" variant="ghost" onClick={() => apply(endTurn)}>
                End turn
              </Button>
            )}
            <button
              type="button"
              className={actionStyles.perAction}
              onClick={() =>
                explain({
                  key: 'attacksPerAction',
                  title: 'Attacks per Attack action',
                  derived: sheet.attacksPerAction,
                })
              }
            >
              <span className="numeric">{perAction}</span> per Attack action
            </button>
          </span>
        }
      >
        <ul className={actionStyles.list}>
          {attacks.map((a) => (
            <AttackCard
              key={a.id}
              attack={a}
              character={character}
              sheet={sheet}
              index={index}
              onRidersUsed={(ids) => apply((c) => ids.reduce(markRiderUsed, c))}
              onPayRiders={(costs, choice) =>
                apply((c) => costs.reduce((n, cost) => payCost(n, sheet, cost, choice), c))
              }
            />
          ))}
        </ul>
      </Section>
    ),
    features: (
      <>
        {GROUPS.map(({ type, title }) => {
          const list = features.filter((a) => a.actionType === type);
          if (!list.length) return null;
          return (
            <Section key={type} id={type} title={title}>
              <ul className={actionStyles.list}>
                {list.map((a) => (
                  <ActionCard
                    key={a.id}
                    action={a}
                    sheet={sheet}
                    attacks={sheet.attacks}
                    onUse={() =>
                      pay(sheet, a.costs, { title: a.name, confirm: `Use ${a.name}` }, (choice) =>
                        apply((c) => takeAction(c, sheet, a.id, { rollAmount, choice })),
                      )
                    }
                  />
                ))}
              </ul>
            </Section>
          );
        })}
      </>
    ),
    toggles: sheet.toggles.length ? (
      <Section id="toggles" title="Toggles">
        <ul className={actionStyles.list}>
          {sheet.toggles.map((t) => (
            <ToggleCard
              key={t.toggleId}
              toggle={t}
              sheet={sheet}
              onChange={(on, option) => {
                const run = (choice: CostChoice) =>
                  apply((c) =>
                    toggle(c, sheet, t.toggleId, on, {
                      rollAmount,
                      choice,
                      ...(option ? { option } : {}),
                    }),
                  );
                if (on) pay(sheet, t.costs, { title: t.name, confirm: `Turn on ${t.name}` }, run);
                else run({});
              }}
            />
          ))}
        </ul>
      </Section>
    ) : null,
    resources: sheet.resources.length ? (
      <Section id="resources" title="Limited use">
        <ul className={actionStyles.list}>
          {sheet.resources.map((r) => (
            <ResourceCard
              key={r.key}
              resource={r}
              onSpend={(n) => apply((c) => spendResource(c, sheet, r.key, n))}
              onRestore={(n) => apply((c) => restoreResource(c, r.key, n))}
            />
          ))}
        </ul>
      </Section>
    ) : null,
    standard: (
      <details className={actionStyles.standard}>
        <summary>
          <span className={actionStyles.standardTitle}>Standard actions</span>
          <span className={actionStyles.use}>Everyone can take these</span>
        </summary>
        <ul className={actionStyles.standardList}>
          {standard.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                className={actionStyles.name}
                onClick={() =>
                  ui.open({
                    key: `rule:${a.source!.id}`,
                    title: a.name,
                    render: () => <EntitySheet entityRef={a.source!} />,
                  })
                }
              >
                {a.name}
              </button>
              <span className={actionStyles.use}>
                {a.actionType === 'reaction' ? 'Reaction' : 'Action'}
              </span>
              {a.name === 'Attack' && (
                <span className={actionStyles.standardNote}>
                  {perAction} {perAction === 1 ? 'attack' : 'attacks'}: {attackNames(a.attackIds)}
                </span>
              )}
              {a.name === 'Opportunity Attack' && (
                <span className={actionStyles.standardNote}>
                  One melee attack: {attackNames(a.attackIds)}
                </span>
              )}
            </li>
          ))}
        </ul>
      </details>
    ),
  };

  return (
    <div ref={ref} className={styles.main} data-columns={columns}>
      {LAYOUTS[columns].map((column, i) => (
        <div key={i} className={styles.column}>
          {column.map((id) => (
            <div key={id} className={styles.column}>
              {sections[id]}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
