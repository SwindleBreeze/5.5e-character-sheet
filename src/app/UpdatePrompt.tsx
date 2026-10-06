import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '../ui/Button.tsx';
import styles from './UpdatePrompt.module.css';

/** Registers the service worker and offers to reload when a new version is ready. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

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
