// One attack on the Actions tab (plan §9.2, step 3.17): how it is made, to-hit and damage that
// roll when tapped, riders as chips that add their dice, and the 2024 rules that apply to it.

import { useState } from 'react';
import type {
  Derived,
  DerivedAmmo,
  DerivedAttack,
  DerivedCost,
  DerivedRider,
  DerivedRoll,
  DerivedSheet,
} from '../../../engine/derive/types.ts';
import { Button } from '../../../ui/Button.tsx';
import { canPay, type CostChoice } from '../../../engine/play/costs.ts';
import { ruleId, type Character, type Ref } from '../../../schema/index.ts';
import type { ContentIndex } from '../../../engine/content/contentIndex.ts';
import { EntitySheet } from '../../../richtext/EntitySheet.tsx';
import { InlineText } from '../../../richtext/InlineText.tsx';
import { masteryHasSave, masterySaveNote, masteryWhen } from '../../../engine/explain/mastery.ts';
import { Badge } from '../../../ui/Badge.tsx';
import { useRoller } from '../../../ui/rollerContext.ts';
import { useSheet } from '../../../ui/sheetContext.ts';
import { ABILITY_ABBR, rollBreakdown, rollNoteLines } from '../components/format.ts';
import { AdvantageHint } from '../components/markers.tsx';
import { RollButton } from '../components/RollButton.tsx';
import { useCostPicker } from '../components/useCostPicker.tsx';
import { useExplain } from '../components/useExplain.tsx';
import { nameOf } from '../sheetBindings.ts';
import { damageRoll } from './damage.ts';
import { attackUseLabel } from './labels.ts';
import styles from './actions.module.css';
import { speciesName } from './sourceLabel.ts';

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
  /** Expend a piece of ammunition from a row (an attack roll with an Ammunition weapon). */
  onSpendAmmo?: (rowUid: string) => void;
  /** After a fight: recover half the ammunition used from these rows, or lose it all. */
  onRecoverAmmo?: (rowUids: string[], recover: boolean) => void;
  /** Draw the stowed weapon: rolling for it draws it, as part of the attack. */
  onDraw?: () => void;
}

export function AttackCard({
  attack: a,
  character,
  sheet: derived,
  index,
  onRidersUsed,
  onPayRiders,
  onSpendAmmo,
  onRecoverAmmo,
  onDraw,
}: AttackCardProps) {
  const roller = useRoller();
  const sheet = useSheet();
  const pay = useCostPicker();
  const explain = useExplain();
  const [chosen, setChosen] = useState<string[]>([]);
  const [crit, setCrit] = useState(false);
  const [ammoUid, setAmmoUid] = useState<string | null>(null);
  const ammo = a.ammo?.sources.find((s) => s.rowUid === ammoUid) ?? a.ammo?.sources[0];
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
        const expr = damageRoll([dice, ...riders.map((r) => r.dice)], damageBonus.value, crit);
        const types = [a.damageType, ...riders.map((r) => r.damageType)].filter(Boolean);
        roller.roll({
          label: `${a.name}: ${label}${crit ? ', critical hit' : ''} (${[...new Set(types)].join(', ')})`,
          expr,
          breakdown: rollBreakdown(
            damageBonus,
            riders.map((r) => ({ label: r.name, dice: r.dice })),
          ),
        });
        if (stowed) onDraw?.();
        const once = riders.filter((r) => r.oncePerTurn).map((r) => r.id);
        if (once.length) onRidersUsed(once);
        setChosen([]);
        setCrit(false);
      },
    );
  };

  // Magic ammunition adds its bonus to the attack and damage rolls made with it.
  const toHit: DerivedRoll | undefined =
    a.toHit && ammo?.hitBonus
      ? { ...a.toHit, bonus: plus(a.toHit.bonus, ammo.name, ammo.hitBonus) }
      : a.toHit;
  const damageBonus = ammo?.damageBonus
    ? plus(a.damageBonus, ammo.name, ammo.damageBonus)
    : a.damageBonus;

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
                  derived: toHit!.bonus,
                  bonus: true,
                  note: rollNoteLines(toHit!).length
                    ? rollNoteLines(toHit!).map((l) => <p key={l}>{l}</p>)
                    : undefined,
                })
              }
            >
              To hit
              <AdvantageHint roll={toHit!} />
            </button>
            <RollButton
              label={`${a.name}: to hit`}
              roll={toHit!}
              critOn={a.critRange}
              onRolled={(r) => {
                setCrit(r.natural !== undefined && r.natural >= a.critRange);
                // Each attack expends one piece of ammunition.
                if (ammo && onSpendAmmo) onSpendAmmo(ammo.rowUid);
                if (stowed) onDraw?.();
              }}
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
                  derived: damageBonus,
                  bonus: true,
                })
              }
            >
              Damage
            </button>
            <button
              type="button"
              className={`${styles.damage} numeric`}
              aria-label={`Roll ${a.name} damage, ${damageText(a.damageDice, damageBonus.value)} ${a.damageType}`}
              onClick={() => rollDamage(a.damageDice, 'damage')}
            >
              {damageText(a.damageDice, damageBonus.value)}
              <span className={styles.damageType}>{a.damageType}</span>
            </button>
          </span>
        )}
        {a.versatileDice && (
          <button
            type="button"
            className={`${styles.damage} numeric`}
            aria-label={`Roll ${a.name} damage with two hands, ${damageText(a.versatileDice, damageBonus.value)} ${a.damageType}`}
            onClick={() => rollDamage(a.versatileDice!, 'damage with two hands')}
          >
            {damageText(a.versatileDice, damageBonus.value)}
            <span className={styles.damageType}>{thrown ? 'two-handed, melee' : 'two-handed'}</span>
          </button>
        )}
      </div>

      {a.ammo && (
        <AmmoLine
          attack={a}
          ammo={a.ammo}
          chosen={ammo?.rowUid}
          onChoose={setAmmoUid}
          onRecover={onRecoverAmmo}
        />
      )}

      <p className={styles.meta}>
        {reach(a)} · {ABILITY_ABBR[a.ability]}
        {a.critRange < 20 && <> · Critical Hit on {a.critRange}–20</>}
      </p>

      {a.propertyIds.length > 0 && (
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
        </div>
      )}

      {a.mastery && (
        <MasteryLine
          mastery={a.mastery}
          index={index}
          dc={8 + derived.abilities[a.ability].mod + derived.pb.value}
          openRule={openRule}
        />
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

/**
 * The weapon's mastery property: when it applies (on a hit, on a miss, always), its text, and
 * for one that asks the target for a save, who rolls and the DC worked out. It comes on top of
 * the attack: nothing to choose before rolling.
 */
function MasteryLine({
  mastery,
  index,
  dc,
  openRule,
}: {
  mastery: { id: string; name: string };
  index: ContentIndex;
  dc: number;
  openRule: (ref: Ref, title: string) => void;
}) {
  const rule = index.get({ kind: 'rule', id: mastery.id });
  const text = rule?.entries.find((e): e is string => typeof e === 'string') ?? '';
  const when = masteryWhen(mastery.name);
  return (
    <div className={styles.mastery} data-kind="mastery">
      <p className={styles.masteryHead}>
        <button
          type="button"
          className={styles.inlineLink}
          onClick={() => openRule({ kind: 'rule', id: mastery.id }, mastery.name)}
        >
          Weapon mastery: {mastery.name}
        </button>
        {when && <span className={styles.masteryWhen}>{when}</span>}
      </p>
      {text && (
        <p className={styles.rule}>
          <InlineText text={text} />
          {masteryHasSave(text) && <strong> {masterySaveNote(dc)}</strong>}
        </p>
      )}
    </div>
  );
}

function plus(d: Derived, label: string, value: number): Derived {
  return { value: d.value + value, parts: [...d.parts, { label, value }] };
}

/** Ammunition to fire, the warnings that go with it, and recovering it after a fight. */
function AmmoLine({
  attack: a,
  ammo,
  chosen,
  onChoose,
  onRecover,
}: {
  attack: DerivedAttack;
  ammo: DerivedAmmo;
  chosen: string | undefined;
  onChoose: (rowUid: string) => void;
  onRecover: AttackCardProps['onRecoverAmmo'];
}) {
  const used = ammo.used.reduce((n, u) => n + u.count, 0);
  const back = ammo.used.reduce((n, u) => n + Math.floor(u.count / 2), 0);
  const label = (s: DerivedAmmo['sources'][number]) =>
    `${s.name} (${s.count}${s.bundle ? ', unopened' : ''})`;
  const rows = ammo.used.map((u) => u.rowUid);
  return (
    <div className={styles.ammo} role="group" aria-label={`${a.name}: ammunition`}>
      {ammo.sources.length > 1 ? (
        <label className={styles.select}>
          <span className={styles.ammoLabel}>Ammunition</span>
          <select value={chosen} onChange={(e) => onChoose(e.target.value)}>
            {ammo.sources.map((s) => (
              <option key={s.rowUid} value={s.rowUid}>
                {label(s)}
              </option>
            ))}
          </select>
        </label>
      ) : ammo.sources[0] ? (
        <span>
          <span className={styles.ammoLabel}>Ammunition</span> {label(ammo.sources[0])}
        </span>
      ) : null}
      {ammo.total === 0 && (
        <p className={styles.warn}>
          No {ammo.name} ammunition: you can make a ranged attack with it only when you have
          ammunition to fire.
        </p>
      )}
      {ammo.noHandToLoad && (
        <p className={styles.warn}>Loading it needs a free hand, and neither is free.</p>
      )}
      {used > 0 && onRecover && (
        <div className={styles.recover}>
          <span className={styles.rule}>
            {used} used since you last recovered. After a fight, 1 minute recovers half of each
            kind, rounded down; the rest is lost.
          </span>
          <Button size="sm" onClick={() => onRecover(rows, true)}>
            Recover {back}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onRecover(rows, false)}>
            Lose them
          </Button>
        </div>
      )}
    </div>
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
      {r.from && (
        <span className={styles.chipNote}>
          {' '}
          · {r.from.kind === 'species' ? `${speciesName(r.from.name)} trait` : 'feat'}
        </span>
      )}
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
        ? 'Stowed: draw it as part of an attack with the Attack action (one weapon per attack), or as part of throwing it. Rolling for it draws it.'
        : 'Stowed: draw it as part of an attack with the Attack action (one weapon per attack). Rolling for it draws it.',
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
  if (a.notes.includes('Loading'))
    lines.push(
      'Loading: you fire only one piece of ammunition when you use an action, a Bonus Action or a Reaction to fire it, however many attacks you can make.',
    );
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
