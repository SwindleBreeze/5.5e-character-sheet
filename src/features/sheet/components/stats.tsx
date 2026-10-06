// The numbers of the sheet: ability cards, stat pills, save and skill rows, section headers.
// Every number either rolls (d20 tests) or opens its contribution sheet; labels explain.

import type { ReactNode } from 'react';
import type { Derived, DerivedRoll } from '../../../engine/derive/types.ts';
import type { Ability } from '../../../schema/index.ts';
import { ABILITY_ABBR, isOverridden, signed } from './format.ts';
import { AdvantageHint, OverrideMarker, ProficiencyMarker } from './markers.tsx';
import { RollButton } from './RollButton.tsx';
import styles from './stats.module.css';

export function SectionHeader({
  title,
  id,
  action,
}: {
  title: string;
  id?: string;
  action?: ReactNode;
}) {
  return (
    <div className={styles.sectionHeader}>
      <h2 id={id} className={styles.sectionTitle}>
        {title}
      </h2>
      {action}
    </div>
  );
}

export interface AbilityCardProps {
  ability: Ability;
  name: string;
  score: Derived;
  check: DerivedRoll;
  onExplain: () => void;
}

/** Modifier first (it rolls the check), the score beneath (it explains itself). */
export function AbilityCard({ ability, name, score, check, onExplain }: AbilityCardProps) {
  return (
    <div className={styles.ability} role="group" aria-label={name}>
      <span className={styles.abilityHead}>
        <span className={styles.abilityAbbr} title={name}>
          {ABILITY_ABBR[ability]}
        </span>
        <AdvantageHint roll={check} />
      </span>
      <RollButton label={`${name} check`} roll={check} size="lg" />
      <button
        type="button"
        className={`${styles.abilityScore} numeric`}
        aria-label={`${name} score ${score.value}, show how it adds up`}
        onClick={onExplain}
      >
        {score.value}
        {isOverridden(score) && <OverrideMarker />}
      </button>
    </div>
  );
}

export interface StatPillProps {
  label: string;
  /** The number; a roll makes it a roll button instead. */
  value?: ReactNode;
  roll?: DerivedRoll;
  /** Small text under the value: `unarmored`, `ft.`. */
  sub?: ReactNode;
  derived?: Derived<unknown>;
  /** Tapping the label (or the value, when it doesn't roll) explains it. */
  onExplain?: () => void;
  /** For on/off pills such as Heroic Inspiration. */
  pressed?: boolean;
  onToggle?: () => void;
}

export function StatPill({
  label,
  value,
  roll,
  sub,
  derived,
  onExplain,
  pressed,
  onToggle,
}: StatPillProps) {
  const marker = derived && isOverridden(derived) ? <OverrideMarker /> : null;
  if (onToggle) {
    return (
      <button
        type="button"
        className={styles.pill}
        aria-pressed={pressed}
        data-pressed={pressed}
        onClick={onToggle}
      >
        <span className={styles.pillLabel}>{label}</span>
        <span className={`${styles.pillValue} numeric`}>{value}</span>
        {sub && <span className={styles.pillSub}>{sub}</span>}
      </button>
    );
  }
  if (roll) {
    return (
      <div className={styles.pill} role="group" aria-label={label}>
        <button type="button" className={styles.pillLabelButton} onClick={onExplain}>
          {label}
          {marker}
        </button>
        <RollButton label={label} roll={roll} size="lg" />
        {sub && <span className={styles.pillSub}>{sub}</span>}
      </div>
    );
  }
  return (
    <button type="button" className={styles.pill} onClick={onExplain}>
      <span className={styles.pillLabel}>
        {label}
        {marker}
      </span>
      <span className={`${styles.pillValue} numeric`}>{value}</span>
      {sub && <span className={styles.pillSub}>{sub}</span>}
    </button>
  );
}

export interface RollRowProps {
  label: string;
  /** What the roll result says, when it differs from the label: `Wisdom save`. */
  rollLabel?: string;
  /** Ability abbreviation for skills (`DEX`). */
  ability?: Ability;
  roll: DerivedRoll;
  onExplain: () => void;
  /** Passive value shown after the bonus (Perception 14). */
  passive?: number;
}

/** A save or skill: proficiency marker, name, hints; the bonus rolls. */
export function RollRow({ label, rollLabel, ability, roll, onExplain, passive }: RollRowProps) {
  return (
    <li className={styles.row}>
      <button
        type="button"
        className={styles.rowLabel}
        onClick={onExplain}
        aria-label={`${label}, show how it adds up`}
      >
        <ProficiencyMarker level={roll.proficiency} />
        <span className={styles.rowName}>{label}</span>
        {ability && <span className={styles.rowAbility}>{ABILITY_ABBR[ability]}</span>}
        <AdvantageHint roll={roll} />
        {isOverridden(roll.bonus) && <OverrideMarker />}
      </button>
      {passive !== undefined && (
        <span className={`${styles.passive} numeric`} title="Passive">
          {passive}
        </span>
      )}
      <RollButton label={rollLabel ?? label} roll={roll} size="sm" />
    </li>
  );
}

export const SaveRow = RollRow;
export const SkillRow = RollRow;

/** A plain number with its parts: passives, spell DCs. */
export function ValueRow({
  label,
  derived,
  bonus,
  onExplain,
}: {
  label: string;
  derived: Derived;
  bonus?: boolean;
  onExplain: () => void;
}) {
  return (
    <li className={styles.row}>
      <button type="button" className={styles.rowLabel} onClick={onExplain}>
        <span className={styles.rowName}>{label}</span>
        {isOverridden(derived) && <OverrideMarker />}
      </button>
      <span className={`${styles.rowValue} numeric`}>
        {bonus ? signed(derived.value) : derived.value}
      </span>
    </li>
  );
}
