// One attack on the Actions tab (plan §9.2, step 3.17): how it is made, to-hit and damage that
// roll when tapped, riders as chips that add their dice, and the 2024 rules that apply to it.

import { useState } from 'react';
import type {
  DerivedAttack,
  DerivedCost,
  DerivedRider,
  DerivedSheet,
} from '../../../engine/derive/types.ts';
import { canPay, type CostChoice } from '../../../engine/play/costs.ts';
import { ruleId, type Character, type Ref } from '../../../schema/index.ts';
import type { ContentIndex } from '../../../engine/content/contentIndex.ts';
import { EntitySheet } from '../../../richtext/EntitySheet.tsx';
import { Badge } from '../../../ui/Badge.tsx';
import { useRoller } from '../../../ui/rollerContext.ts';
import { useSheet } from '../../../ui/sheetContext.ts';
import { ABILITY_ABBR } from '../components/format.ts';
import { RollButton } from '../components/RollButton.tsx';
import { useCostPicker } from '../components/useCostPicker.tsx';
import { useExplain } from '../components/useExplain.tsx';
import { nameOf } from '../sheetBindings.ts';
import { damageRoll } from './damage.ts';
import { attackUseLabel } from './labels.ts';
import styles from './actions.module.css';

const UNARMED_STRIKE = ruleId('variantrule', 'Unarmed Strike', 'XPHB');

/** `Melee 5 ft. · Thrown 20/60 ft.`, `Ranged 80/320 ft.`, `Range 60 ft.` (a save cantrip). */
function reach(a: DerivedAttack): string {
  if (a.save) return `Range ${a.distance}`;
  const [first, thrown] = a.distance.split(' or ');
  if (thrown) return `Melee ${first} · Thrown ${thrown}`;
  return `${a.range === 'melee' ? 'Melee' : 'Ranged'} ${a.distance}`;
}

function damageText(dice: string, bonus: number): string {
  if (!dice) return String(bonus);
  return bonus ? `${dice} ${bonus < 0 ? '−' : '+'} ${Math.abs(bonus)}` : dice;
}

export interface AttackCardProps {
  attack: DerivedAttack;
  character: Character;
  sheet: DerivedSheet;
  index: ContentIndex;
  /** Note once-per-turn riders as used. */
  onRidersUsed: (riderIds: string[]) => void;
  /** Pay what the riders added to a damage roll cost. */
  onPayRiders: (costs: DerivedCost[], choice: CostChoice) => void;
}

export function AttackCard({
  attack: a,
  character,
  sheet: derived,
  index,
  onRidersUsed,
  onPayRiders,
}: AttackCardProps) {
  const roller = useRoller();
  const sheet = useSheet();
  const pay = useCostPicker();
  const explain = useExplain();
  const [chosen, setChosen] = useState<string[]>([]);
  const [crit, setCrit] = useState(false);
  const used = character.state.turn.ridersUsed;
  const usedThisTurn = (r: DerivedRider) => r.oncePerTurn && used.includes(r.id);

  const openRule = (ref: Ref, title: string) =>
    sheet.open({
      key: `${ref.kind}:${ref.id}`,
      title,
      render: () => <EntitySheet entityRef={ref} />,
    });
  const source: Ref | undefined =
    a.itemRef ??
    a.spellRef ??
    (a.kind === 'unarmed' ? { kind: 'rule', id: UNARMED_STRIKE } : undefined);

  // Always-on riders are part of every hit (a used once-per-turn one is left out); opt-in ones
  // only when chosen.
  const riders = a.riders.filter((r) => (r.optIn ? chosen.includes(r.id) : !usedThisTurn(r)));
  const rollDamage = (dice: string, label: string) => {
    const costs = riders.flatMap((r) => (r.cost ? [r.cost] : []));
    // Riders that cost something are paid first (a slot or Hit Die is picked when needed).
    pay(
      derived,
      costs,
      { title: `${a.name}: extra damage`, confirm: 'Pay and roll damage' },
      (choice) => {
        if (costs.length) onPayRiders(costs, choice);
        const expr = damageRoll([dice, ...riders.map((r) => r.dice)], a.damageBonus.value, crit);
        const types = [a.damageType, ...riders.map((r) => r.damageType)].filter(Boolean);
        roller.roll({
          label: `${a.name}: ${label}${crit ? ', critical hit' : ''} (${[...new Set(types)].join(', ')})`,
          expr,
        });
        const once = riders.filter((r) => r.oncePerTurn).map((r) => r.id);
        if (once.length) onRidersUsed(once);
        setChosen([]);
        setCrit(false);
      },
    );
  };

  const stowed = a.kind === 'weapon' && !a.ready;
  const thrown = a.notes.includes('Thrown');
  // A cantrip that only imposes a save (no damage) has nothing to roll for damage.
  const hasDamage = a.kind !== 'spell' || !!a.damageDice || a.damageBonus.value !== 0;

  return (
    <li className={styles.card} aria-label={a.name}>
      <div className={styles.cardHead}>
        <div className={styles.title}>
          {source ? (
            <button type="button" className={styles.name} onClick={() => openRule(source, a.name)}>
              {a.name}
            </button>
          ) : (
            <span className={styles.name}>{a.name}</span>
          )}
          {stowed && <Badge>Stowed</Badge>}
        </div>
        <span className={styles.use}>{attackUseLabel(a)}</span>
      </div>

      <div className={styles.rolls}>
        {a.toHit && (
          <span className={styles.rollGroup}>
            <button
              type="button"
              className={styles.rollLabel}
              onClick={() =>
                explain({
                  key: `attack.${a.id}.hit`,
                  title: `${a.name}: to hit`,
                  derived: a.toHit!.bonus,
                  bonus: true,
                })
              }
            >
              To hit
            </button>
            <RollButton
              label={`${a.name}: to hit`}
              roll={a.toHit}
              critOn={a.critRange}
              onRolled={(r) => setCrit(r.natural !== undefined && r.natural >= a.critRange)}
            />
          </span>
        )}
        {a.save && (
          <button
            type="button"
            className={styles.dc}
            onClick={() =>
              explain({
                key: `attack.${a.id}.dc`,
                title: `${a.name}: save DC`,
                derived: a.save!.dc,
              })
            }
          >
            DC <span className="numeric">{a.save.dc.value}</span> {ABILITY_ABBR[a.save.ability]}{' '}
            save
          </button>
        )}
        {hasDamage && (
          <span className={styles.rollGroup}>
            <button
              type="button"
              className={styles.rollLabel}
              onClick={() =>
                explain({
                  key: `attack.${a.id}.damage`,
                  title: `${a.name}: damage bonus`,
                  derived: a.damageBonus,
                  bonus: true,
                })
              }
            >
              Damage
            </button>
            <button
              type="button"
              className={`${styles.damage} numeric`}
              aria-label={`Roll ${a.name} damage, ${damageText(a.damageDice, a.damageBonus.value)} ${a.damageType}`}
              onClick={() => rollDamage(a.damageDice, 'damage')}
            >
              {damageText(a.damageDice, a.damageBonus.value)}
              <span className={styles.damageType}>{a.damageType}</span>
            </button>
          </span>
        )}
        {a.versatileDice && (
          <button
            type="button"
            className={`${styles.damage} numeric`}
            aria-label={`Roll ${a.name} damage with two hands, ${damageText(a.versatileDice, a.damageBonus.value)} ${a.damageType}`}
            onClick={() => rollDamage(a.versatileDice!, 'damage with two hands')}
          >
            {damageText(a.versatileDice, a.damageBonus.value)}
            <span className={styles.damageType}>{thrown ? 'two-handed, melee' : 'two-handed'}</span>
          </button>
        )}
      </div>

      <p className={styles.meta}>
        {reach(a)} · {ABILITY_ABBR[a.ability]}
        {a.critRange < 20 && <> · Critical Hit on {a.critRange}–20</>}
      </p>

      {(a.propertyIds.length > 0 || a.mastery) && (
        <div className={styles.chips}>
          {a.propertyIds.map((id) => {
            const name = nameOf(index, 'rule', id);
            return (
              <button
                key={id}
                type="button"
                className={styles.tag}
                onClick={() => openRule({ kind: 'rule', id }, name)}
              >
                {name}
              </button>
            );
          })}
          {a.mastery && (
            <button
              type="button"
              className={styles.tag}
              data-kind="mastery"
              onClick={() => openRule({ kind: 'rule', id: a.mastery!.id }, a.mastery!.name)}
            >
              Mastery: {a.mastery.name}
            </button>
          )}
        </div>
      )}

      {a.toHit && (
        <div className={styles.chips} role="group" aria-label={`${a.name}: add to the damage`}>
          <button
            type="button"
            className={styles.chip}
            data-kind="crit"
            aria-pressed={crit}
            onClick={() => setCrit(!crit)}
          >
            Critical hit
          </button>
          {a.riders.map((r) => (
            <RiderChip
              key={r.id}
              rider={r}
              chosen={chosen.includes(r.id)}
              usedThisTurn={usedThisTurn(r)}
              affordable={!r.cost || canPay(derived, r.cost)}
              onToggle={() =>
                setChosen(
                  chosen.includes(r.id) ? chosen.filter((x) => x !== r.id) : [...chosen, r.id],
                )
              }
            />
          ))}
        </div>
      )}

      <AttackRules attack={a} stowed={stowed} thrown={thrown} openRule={openRule} />
    </li>
  );
}

function RiderChip({
  rider: r,
  chosen,
  usedThisTurn,
  affordable,
  onToggle,
}: {
  rider: DerivedRider;
  chosen: boolean;
  usedThisTurn: boolean;
  affordable: boolean;
  onToggle: () => void;
}) {
  const text = (
    <>
      {r.name} +{r.dice}
      {r.damageType ? ` ${r.damageType}` : ''}
      {r.oncePerTurn && (
        <span className={styles.chipNote}>
          {usedThisTurn ? ' · used this turn' : ' · once per turn'}
        </span>
      )}
      {r.cost && (
        <span className={styles.chipNote}>
          {' '}
          · costs {r.cost.label}
          {!affordable && ', none left'}
        </span>
      )}
    </>
  );
  if (!r.optIn) {
    return (
      <span className={styles.chip} data-kind="always" data-used={usedThisTurn || undefined}>
        {text}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={styles.chip}
      aria-pressed={chosen}
      aria-disabled={!chosen && !affordable}
      data-used={usedThisTurn || undefined}
      onClick={() => {
        if (chosen || affordable) onToggle();
      }}
    >
      {text}
    </button>
  );
}

/** The 2024 rules that decide when and how this attack can be made. */
function AttackRules({
  attack: a,
  stowed,
  thrown,
  openRule,
}: {
  attack: DerivedAttack;
  stowed: boolean;
  thrown: boolean;
  openRule: (ref: Ref, title: string) => void;
}) {
  const lines: string[] = [];
  if (stowed) {
    lines.push(
      thrown
        ? 'Stowed: draw it as part of an attack with the Attack action (one weapon per attack), or as part of throwing it.'
        : 'Stowed: draw it as part of an attack with the Attack action (one weapon per attack).',
    );
  }
  if (a.use.kind === 'lightExtra') {
    lines.push(
      a.use.nick
        ? 'Light extra attack, made as part of the Attack action thanks to Nick: after you attack with a different Light weapon, once per turn.'
        : 'Light extra attack: a Bonus Action later on a turn when you took the Attack action and attacked with a different Light weapon.',
      'Your ability modifier isn’t added to its damage unless it is negative.',
    );
  }
  if (!a.proficient)
    lines.push('Not proficient: your Proficiency Bonus isn’t added to the attack roll.');

  return (
    <>
      {a.grapple && (
        <p className={styles.rule}>
          <button
            type="button"
            className={styles.inlineLink}
            onClick={() => openRule({ kind: 'rule', id: UNARMED_STRIKE }, 'Unarmed Strike')}
          >
            Grapple or Shove
          </button>
          : instead of damage, the target makes a Strength or Dexterity save (its choice) against DC{' '}
          <span className="numeric">{a.grapple.dc.value}</span>. It can be no more than one size
          larger than you.
          {!a.grapple.freeHand && (
            <strong className={styles.warn}> Grappling needs a free hand.</strong>
          )}
        </p>
      )}
      {lines.map((l) => (
        <p key={l} className={styles.rule}>
          {l}
        </p>
      ))}
    </>
  );
}
