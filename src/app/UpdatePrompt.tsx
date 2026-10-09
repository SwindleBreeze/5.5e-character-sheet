import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '../ui/Button.tsx';
import styles from './UpdatePrompt.module.css';

/** How often a running app looks for a new version, besides each time it comes back on screen. */
const CHECK_EVERY_MS = 60 * 60 * 1000;

/**
 * Registers the service worker and offers to reload when a new version is ready. The browser
 * only looks for one when a page loads, and an installed app is mostly brought back rather than
 * started, so it could run an old version for days: it also looks when the app comes back on
 * screen, and every hour.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => {
        if (navigator.onLine && !registration.installing)
          void registration.update().catch(() => {});
      };
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
      setInterval(check, CHECK_EVERY_MS);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className={styles.toast} role="status">
      <span>A new version is ready.</span>
      <Button size="sm" variant="primary" onClick={() => void updateServiceWorker()}>
        Reload
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>
        Later
      </Button>
    </div>
  );
}
