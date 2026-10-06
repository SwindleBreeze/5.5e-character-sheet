import type { ReactNode } from 'react';
import { Link } from 'react-router';
import styles from './TopBar.module.css';

export interface TopBarProps {
  title: string;
  /** Route for the back button; omitted on top-level screens. */
  backTo?: string;
  actions?: ReactNode;
}

export function TopBar({ title, backTo, actions }: TopBarProps) {
  return (
    <header className={styles.bar}>
      <div className={styles.side}>
        {backTo && (
          <Link to={backTo} className={styles.back} aria-label="Back">
            <span aria-hidden="true">‹</span>
          </Link>
        )}
      </div>
      <h1 className={styles.title}>{title}</h1>
      <div className={`${styles.side} ${styles.actions}`}>{actions}</div>
    </header>
  );
}
