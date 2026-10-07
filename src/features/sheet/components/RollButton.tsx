import type { RollResult } from '../../../engine/dice/roll.ts';
import type { DerivedRoll } from '../../../engine/derive/types.ts';
import { d20Expr, useRoller } from '../../../ui/rollerContext.ts';
import { extraDice, signed } from './format.ts';
import styles from './RollButton.module.css';

export interface RollButtonProps {
  /** What is rolled, for the result and the button's name: `Athletics`. */
  label: string;
  roll: DerivedRoll;
  size?: 'sm' | 'md' | 'lg';
  /** Attack rolls: the lowest natural d20 that is a Critical Hit. */
  critOn?: number;
  onRolled?: (result: RollResult) => void;
}

/** A d20 bonus that rolls when tapped, with advantage or disadvantage already applied. */
export function RollButton({ label, roll, size = 'md', critOn, onRolled }: RollButtonProps) {
  const roller = useRoller();
  const bonus = roll.bonus.value;
  const mode = roll.mode;
  const modeText =
    mode === 'advantage' ? ', advantage' : mode === 'disadvantage' ? ', disadvantage' : '';
  return (
    <button
      type="button"
      className={`${styles.roll} numeric`}
      data-size={size}
      data-mode={mode}
      aria-label={`Roll ${label}, ${signed(bonus)}${modeText}`}
      onClick={() => {
        const result = roller.roll({
          label,
          expr: d20Expr(bonus) + extraDice(roll),
          mode,
          ...(critOn !== undefined ? { critOn } : {}),
        });
        onRolled?.(result);
      }}
    >
      {signed(bonus)}
    </button>
  );
}
