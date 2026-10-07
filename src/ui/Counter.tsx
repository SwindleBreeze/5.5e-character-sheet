import styles from './Counter.module.css';

export interface CounterProps {
  label: string;
  value: number;
  max: number;
  min?: number;
  onChange: (next: number) => void;
}

/**
 * A step button that keeps focus at its limit: `aria-disabled` rather than `disabled`, because
 * a focused button that becomes disabled drops focus to the page, which can scroll it.
 */
export function StepButton({
  label,
  symbol,
  blocked,
  onStep,
  className,
}: {
  label: string;
  symbol: string;
  blocked: boolean;
  onStep: () => void;
  className?: string | undefined;
}) {
  return (
    <button
      type="button"
      className={className ?? styles.step}
      aria-label={label}
      aria-disabled={blocked}
      onClick={() => {
        if (!blocked) onStep();
      }}
    >
      {symbol}
    </button>
  );
}

/** A tappable used/max counter for resources, slots and hit dice. */
export function Counter({ label, value, max, min = 0, onChange }: CounterProps) {
  return (
    <div className={styles.counter} role="group" aria-label={label}>
      <StepButton
        label={`Decrease ${label}`}
        symbol="−"
        blocked={value <= min}
        onStep={() => onChange(Math.max(min, value - 1))}
      />
      <output className={styles.value} aria-live="polite">
        {value}
        <span className={styles.max}> / {max}</span>
      </output>
      <StepButton
        label={`Increase ${label}`}
        symbol="+"
        blocked={value >= max}
        onStep={() => onChange(Math.min(max, value + 1))}
      />
    </div>
  );
}
