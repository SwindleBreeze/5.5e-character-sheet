import styles from './Counter.module.css';

export interface CounterProps {
  label: string;
  value: number;
  max: number;
  min?: number;
  onChange: (next: number) => void;
}

/** A tappable used/max counter for resources, slots and hit dice. */
export function Counter({ label, value, max, min = 0, onChange }: CounterProps) {
  return (
    <div className={styles.counter} role="group" aria-label={label}>
      <button
        type="button"
        className={styles.step}
        aria-label={`Decrease ${label}`}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </button>
      <output className={styles.value} aria-live="polite">
        {value}
        <span className={styles.max}> / {max}</span>
      </output>
      <button
        type="button"
        className={styles.step}
        aria-label={`Increase ${label}`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        +
      </button>
    </div>
  );
}
