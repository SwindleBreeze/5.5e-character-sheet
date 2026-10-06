import { Outlet, useLocation } from 'react-router';
import { BottomNav } from './BottomNav.tsx';
import styles from './AppShell.module.css';

/** Routes that use the full screen (character sheet, wizards) hide the bottom navigation. */
function isFullScreenRoute(pathname: string): boolean {
  return pathname.startsWith('/c/') || pathname.startsWith('/new');
}

export function AppShell() {
  const { pathname } = useLocation();
  const showNav = !isFullScreenRoute(pathname);

  return (
    <div className={styles.shell} data-nav={showNav ? 'visible' : 'hidden'}>
      <main className={styles.main}>
        <Outlet />
      </main>
      {showNav && <BottomNav />}
    </div>
  );
}
