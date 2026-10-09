import type { ReactNode } from 'react';
import { BackLink } from './BackLink.tsx';
import styles from './TopBar.module.css';

export interface TopBarProps {
  title: string;
  /** Route for the back button; omitted on top-level screens. */
  backTo?: string;
  /** Paths that belong to this screen and are left with it (a wizard's steps). */
  backFlow?: string;
  actions?: ReactNode;
}

export function TopBar({ title, backTo, backFlow, actions }: TopBarProps) {
  return (
    <header className={styles.bar}>
      <div className={styles.side}>
        {backTo && (
          <BackLink to={backTo} flow={backFlow} className={styles.back}>
            <span aria-hidden="true">‹</span>
          </BackLink>
        )}
      </div>
      <h1 className={styles.title}>{title}</h1>
      <div className={`${styles.side} ${styles.actions}`}>{actions}</div>
    </header>
  );
}
