import { NavLink } from 'react-router';
import styles from './BottomNav.module.css';

const ITEMS = [
  { to: '/', label: 'Characters', icon: '☰', end: true },
  { to: '/library', label: 'Library', icon: '❖', end: false },
  { to: '/settings', label: 'Settings', icon: '⚙', end: false },
] as const;

export function BottomNav() {
  return (
    <nav className={styles.nav} aria-label="Main">
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => (isActive ? `${styles.item} ${styles.active}` : styles.item)}
        >
          <span className={styles.icon} aria-hidden="true">
            {item.icon}
          </span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
