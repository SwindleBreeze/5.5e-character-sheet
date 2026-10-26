// Loads the free rules on first run (plan 9.3). Renders nothing; a failure leaves the app as it
// was, with importing content still open to the player.

import { useEffect } from 'react';
import { ensureFreeRules } from '../content/freeRules.ts';

export function FreeRules() {
  useEffect(() => {
    ensureFreeRules().catch((err: unknown) => console.warn('Free rules not loaded', err));
  }, []);
  return null;
}
