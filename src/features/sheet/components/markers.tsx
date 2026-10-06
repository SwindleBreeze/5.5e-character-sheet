// Small markers next to numbers: proficiency level, advantage, overrides, sources.

import type { DerivedRoll } from '../../../engine/derive/types.ts';
import type { SourceCode } from '../../../schema/index.ts';
import { Badge } from '../../../ui/Badge.tsx';
import styles from './markers.module.css';

const PROFICIENCY_LABEL: Record<DerivedRoll['proficiency'], string> = {
  none: 'Not proficient',
  half: 'Half proficiency',
  proficient: 'Proficient',
  expertise: 'Expertise',
};

/** Empty ring, half-filled, filled, or filled with an outer ring for expertise. */
export function ProficiencyMarker({ level }: { level: DerivedRoll['proficiency'] }) {
  return (
    <span
      className={styles.proficiency}
      data-level={level}
      role="img"
      aria-label={PROFICIENCY_LABEL[level]}
      title={PROFICIENCY_LABEL[level]}
    />
  );
}

/** "Adv" or "Dis" when a roll has it, with the reasons as its title. */
export function AdvantageHint({ roll }: { roll: DerivedRoll }) {
  if (roll.mode === 'normal' && !roll.advantage.length && !roll.disadvantage.length) return null;
  const reasons = [
    ...roll.advantage.map((r) => `Advantage: ${r}`),
    ...roll.disadvantage.map((r) => `Disadvantage: ${r}`),
  ].join('\n');
  const text = roll.mode === 'advantage' ? 'Adv' : roll.mode === 'disadvantage' ? 'Dis' : 'Adv/Dis';
  return (
    <span className={styles.hint} data-mode={roll.mode} title={reasons}>
      {text}
    </span>
  );
}

/** Shown next to a number the player has set by hand. */
export function OverrideMarker() {
  return (
    <span className={styles.override} role="img" aria-label="Your override" title="Your override">
      ✎
    </span>
  );
}

export function SourceBadge({ source }: { source: SourceCode }) {
  return <Badge title={`Source: ${source}`}>{source}</Badge>;
}

/** The content behind something isn't imported; the character's snapshot stands in. */
export function ContentMissingBadge() {
  return (
    <Badge variant="warning" title="This content isn't imported; a saved copy is shown">
      Content not loaded
    </Badge>
  );
}
