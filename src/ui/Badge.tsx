import type { ReactNode } from 'react';
import styles from './Badge.module.css';

export interface BadgeProps {
  variant?: 'neutral' | 'accent' | 'warning' | 'override';
  title?: string;
  children: ReactNode;
}

/** Small inline label: source codes, "overridden", "content not loaded", counts. */
export function Badge({ variant = 'neutral', title, children }: BadgeProps) {
  return (
    <span className={styles.badge} data-variant={variant} title={title}>
      {children}
    </span>
  );
}
