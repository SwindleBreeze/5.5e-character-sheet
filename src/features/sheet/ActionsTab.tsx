// The Actions tab (plan §9.2, step 3.17; play-test redesign): what the character can do in a
// fight, by the part of the turn it takes. Four tabs (Action, Bonus, Reaction, Other), each a
// short list: attacks with tap-to-roll numbers (details a tap away), feature actions, switches,
// Bonus Action and Reaction spells, potions, and the actions everyone has. Limited-use counters
// sit in one line above. Each tab says what the turn allows; nothing tracks it: that is the
// player's to keep in mind. Side by side when there is room.

import { useRef, useState, type ReactNode } from 'react';
import {
  endTurn,
  heal,
  payCost,
  restoreResource,
  spendResource,
  toggle,
  useAction as takeAction,
  useRider as markRiderUsed,
  type RollAmount,
} from '../../engine/play/reducers.ts';
import type { CostChoice } from '../../engine/play/costs.ts';
import {
  drawWeapon,
  loseAmmo,
  recoverAmmo,
  spendAmmo,
  consumeOne,
} from '../../engine/play/inventory.ts';
import { EntitySheet } from '../../richtext/EntitySheet.tsx';
import { Button } from '../../ui/Button.tsx';
import { useRoller } from '../../ui/rollerContext.ts';
import { useSheet } from '../../ui/sheetContext.ts';
import { columnsFor, useContainerWidth } from '../../ui/useContainerWidth.ts';
import { AttackCard } from './actions/AttackCard.tsx';
import { ActionCard, ResourceCard, ToggleCard } from './actions/FeatureCards.tsx';
import actionStyles from './actions/actions.module.css';
import {
  groupSize,
  TURN_NOTES,
  TURN_PARTS,
  turnGroups,
  type PotionRow,
  type TurnGroup,
  type TurnPart,
} from './actions/turn.ts';
import { useCostPicker } from './components/useCostPicker.tsx';
import { useExplain } from './components/useExplain.tsx';
import { useLiveBindings, usePublishBindings } from './liveBindings.ts';
import type { SheetBindings } from './sheetBindings.ts';
import { spellLists } from './spells/entries.ts';
import { useSpellCasting } from './spells/useSpellCasting.tsx';
import spellStyles from './spells/spells.module.css';

/** Empty parts of the turn say why, so the tab never looks broken. */
const NOTHING: Record<TurnPart, string> = {
  action: 'Nothing of your own here yet: the actions everyone has are below.',
  bonus: 'Nothing you have uses a Bonus Action yet.',
  reaction: 'Nothing you have uses a Reaction yet.',
  other: 'Nothing here.',
};

/** A group's heading: under a column's own title on a wide screen, the first level on a phone. */
function Heading({
  children,
  action,
  sub,
}: {
  children: ReactNode;
  action?: ReactNode;
  sub: boolean;
}) {
  const H = sub ? 'h3' : 'h2';
  return (
    <div className={actionStyles.groupHead}>
      <H className={actionStyles.groupTitle}>{children}</H>
      {action}
    </div>
  );
}

export function ActionsTab(bindings: SheetBindings) {
  const { character, sheet, index, apply } = bindings;
  usePublishBindings(bindings);
  const ref = useRef<HTMLDivElement>(null);
  const columns = columnsFor(useContainerWidth(ref));
  // Room for three columns: Action, Bonus and Reaction side by side, each under its own title.
  const wide = columns >= 3;
  const roller = useRoller();
  const explain = useExplain();
  const ui = useSheet();
  const rollAmount: RollAmount = (expr, label) => roller.roll({ label, expr }).total;
  const pay = useCostPicker();
  const casting = useSpellCasting({ character, sheet, index, apply });
  const [part, setPart] = useState<TurnPart>('action');

  const groups = turnGroups(character, sheet, index, spellLists(sheet, index).ready);
  const perAction = sheet.attacksPerAction.value;
  const hasOncePerTurn = sheet.attacks.some((a) => a.riders.some((r) => r.oncePerTurn));
  const usedThisTurn = character.state.turn.ridersUsed.length;
  /** Names of the attacks an action makes. */
  const attackNames = (ids: readonly string[]) =>
    sheet.attacks
      .filter((a) => ids.includes(a.id))
      .map((a) => a.name)
      .join(', ');

  const openRule = (ref: NonNullable<(typeof sheet.actions)[number]['source']>, title: string) =>
    ui.open({ key: `rule:${ref.id}`, title, render: () => <EntitySheet entityRef={ref} /> });

  const attackCard = (a: (typeof sheet.attacks)[number]) => (
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
      onSpendAmmo={(rowUid) => apply((c) => spendAmmo(c, rowUid, a.ammo!.itemId, index))}
      onRecoverAmmo={(rows, recover) =>
        apply((c) => (recover ? recoverAmmo(c, rows) : loseAmmo(c, rows)))
      }
      {...(a.rowUid ? { onDraw: () => apply((c) => drawWeapon(c, a.rowUid!, index)) } : {})}
    />
  );

  const drink = (p: PotionRow) => {
    const healed = p.heals ? rollAmount(p.heals, `${p.item.name}: Hit Points regained`) : 0;
    if (!p.heals) roller.notify({ label: `Drank ${p.item.name}` });
    apply((c) => {
      const n = consumeOne(c, p.row.uid);
      return healed ? heal(n, sheet, healed) : n;
    });
  };

  const attacksHead = (
    <Heading
      sub={wide}
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
      Attack action
    </Heading>
  );

  const content = (p: TurnPart, g: TurnGroup) => {
    const weapons = g.attacks.filter((a) => a.use.kind !== 'cast');
    const spells = g.attacks.filter((a) => a.use.kind === 'cast');
    const opportunity = g.standard.find((a) => a.name === 'Opportunity Attack');
    const everyone = g.standard.filter((a) => a !== opportunity);
    return (
      <>
        {groupSize(g) === 0 && !opportunity && <p className={actionStyles.nothing}>{NOTHING[p]}</p>}

        {(weapons.length > 0 || g.stowed.length > 0) && (
          <section className={actionStyles.group}>
            {p === 'action' ? (
              attacksHead
            ) : (
              <Heading sub={wide}>{p === 'bonus' ? 'Extra attack' : 'Attacks'}</Heading>
            )}
            <ul className={actionStyles.list}>{weapons.map(attackCard)}</ul>
            {g.stowed.length > 0 && (
              <details className={actionStyles.stowed}>
                <summary>Stowed weapons ({g.stowed.length})</summary>
                <ul className={actionStyles.list}>{g.stowed.map(attackCard)}</ul>
              </details>
            )}
          </section>
        )}

        {opportunity && (
          <section className={actionStyles.group}>
            <Heading sub={wide}>Opportunity Attack</Heading>
            <p className={actionStyles.groupNote}>
              <button
                type="button"
                className={actionStyles.inlineName}
                onClick={() => opportunity.source && openRule(opportunity.source, opportunity.name)}
              >
                Opportunity Attack
              </button>
              : one melee attack, {attackNames(opportunity.attackIds) || 'an Unarmed Strike'}.
            </p>
          </section>
        )}

        {spells.length > 0 && (
          <section className={actionStyles.group}>
            <Heading sub={wide}>Cantrips and spell attacks</Heading>
            <ul className={actionStyles.list}>{spells.map(attackCard)}</ul>
          </section>
        )}

        {g.actions.length > 0 && (
          <section className={actionStyles.group}>
            <Heading sub={wide}>Features</Heading>
            <ul className={actionStyles.list}>
              {g.actions.map((a) => (
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
          </section>
        )}

        {g.toggles.length > 0 && (
          <section className={actionStyles.group}>
            <Heading sub={wide}>{p === 'other' ? 'Switches' : 'Switch on'}</Heading>
            <ul className={actionStyles.list}>
              {g.toggles.map((t) => (
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
                    if (on)
                      pay(sheet, t.costs, { title: t.name, confirm: `Turn on ${t.name}` }, run);
                    else run({});
                  }}
                />
              ))}
            </ul>
          </section>
        )}

        {g.spells.length > 0 && (
          <section className={actionStyles.group}>
            <Heading sub={wide}>Spells</Heading>
            <ul className={spellStyles.rows} aria-label={`${TITLE[p]}: spells`}>
              {g.spells.map((e) => casting.row(e))}
            </ul>
          </section>
        )}

        {g.potions.length > 0 && (
          <section className={actionStyles.group}>
            <Heading sub={wide}>Potions</Heading>
            <ul className={actionStyles.rows}>
              {g.potions.map((potion) => (
                <li key={potion.row.uid} className={actionStyles.row}>
                  <button
                    type="button"
                    className={actionStyles.inlineName}
                    onClick={() => openRule(potion.item, potion.item.name)}
                  >
                    {potion.item.name}
                  </button>
                  {potion.row.quantity > 1 && (
                    <span className="numeric"> ×{potion.row.quantity}</span>
                  )}
                  {potion.heals && (
                    <span className={actionStyles.rowNote}>Heals {potion.heals}</span>
                  )}
                  <Button
                    size="sm"
                    className={actionStyles.rowButton}
                    aria-label={`Drink ${potion.item.name}`}
                    onClick={() => drink(potion)}
                  >
                    Drink
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {everyone.length > 0 && (
          <section className={actionStyles.group}>
            <Heading sub={wide}>Anyone can</Heading>
            <div className={actionStyles.everyone}>
              {everyone.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={actionStyles.tag}
                  onClick={() => a.source && openRule(a.source, a.name)}
                >
                  {a.name}
                </button>
              ))}
            </div>
          </section>
        )}
      </>
    );
  };

  const resources = sheet.resources.length ? (
    <button
      type="button"
      className={actionStyles.limited}
      onClick={() =>
        ui.open({
          key: 'actions:limited',
          title: 'Limited use',
          render: () => <LimitedUse bindings={bindings} />,
        })
      }
    >
      <span className={actionStyles.limitedTitle}>Limited use</span>
      {sheet.resources.map((r) => (
        <span key={r.key} className={actionStyles.limitedItem}>
          {r.name}{' '}
          <span className="numeric">
            {r.max.value - r.used}/{r.max.value}
          </span>
        </span>
      ))}
    </button>
  ) : null;

  const note = (p: TurnPart) => (
    <p className={actionStyles.turnNote}>
      <span className={actionStyles.dot} data-part={p} aria-hidden="true" />
      {TURN_NOTES[p]}
    </p>
  );

  // Room for three columns: Action, Bonus and Reaction side by side; Other under Reaction.
  if (wide) {
    return (
      <div ref={ref} className={actionStyles.turn}>
        {resources}
        <div className={actionStyles.turnColumns}>
          {(['action', 'bonus', 'reaction'] as const).map((p) => (
            <section key={p} className={actionStyles.turnColumn} aria-label={TITLE[p]}>
              <h2 className={actionStyles.columnTitle}>{TITLE[p]}</h2>
              {note(p)}
              {content(p, groups[p])}
              {p === 'reaction' && groupSize(groups.other) > 0 && (
                <>
                  <h2 className={actionStyles.columnTitle}>Other</h2>
                  {note('other')}
                  {content('other', groups.other)}
                </>
              )}
            </section>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className={actionStyles.turn}>
      <div className={actionStyles.turnBar} role="tablist" aria-label="Part of the turn">
        {TURN_PARTS.map(({ part: p, title }) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={p === part}
            className={actionStyles.turnTab}
            onClick={() => setPart(p)}
          >
            {title}
            <span className={actionStyles.turnCount}>
              {groupSize(groups[p]) + (p === 'reaction' && groups.reaction.standard.length ? 1 : 0)}
            </span>
          </button>
        ))}
      </div>
      {resources}
      <div role="tabpanel" aria-label={`Turn: ${TITLE[part]}`} className={actionStyles.turnPanel}>
        {note(part)}
        {content(part, groups[part])}
      </div>
    </div>
  );
}

const TITLE: Record<TurnPart, string> = {
  action: 'Actions',
  bonus: 'Bonus Actions',
  reaction: 'Reactions',
  other: 'Other',
};

/** Every limited-use counter, in a bottom sheet: spend or get uses back. */
function LimitedUse({ bindings }: { bindings: SheetBindings }) {
  const { sheet, apply } = useLiveBindings(bindings);
  return (
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
  );
}
