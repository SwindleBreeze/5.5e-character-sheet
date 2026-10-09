// Storage durability helpers (plan §6.9). All browser storage shares one eviction policy, so the
// app asks for persistent storage, and on iOS guides users to install to the Home Screen first.

export interface StorageEnv {
  /** Running as an installed app (Home Screen / standalone window). */
  standalone: boolean;
  /** iPhone, iPad or iPod (including iPadOS that reports as a Mac). */
  ios: boolean;
  /** The Storage API (`navigator.storage.persist`) exists. */
  persistSupported: boolean;
}

export interface StorageStatus extends StorageEnv {
  /** null when the browser can't tell. */
  persisted: boolean | null;
  usageBytes: number | null;
  quotaBytes: number | null;
}

interface NavigatorLike {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
  standalone?: boolean;
  storage?: Partial<Pick<StorageManager, 'persist' | 'persisted' | 'estimate'>>;
}

interface WindowLike {
  matchMedia?: (query: string) => { matches: boolean };
}

export function detectEnv(nav: NavigatorLike = navigator, win: WindowLike = window): StorageEnv {
  const ios =
    /iPad|iPhone|iPod/.test(nav.userAgent) ||
    (nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1);
  const standalone =
    nav.standalone === true || win.matchMedia?.('(display-mode: standalone)').matches === true;
  return { ios, standalone, persistSupported: typeof nav.storage?.persist === 'function' };
}

/** iOS Safari tabs should install first: installed apps get their own, longer-lived storage. */
export function shouldShowInstallGuide(env: StorageEnv): boolean {
  return env.ios && !env.standalone;
}

/**
 * Ask for persistent storage when it is likely to be granted and matters: once the app is
 * installed, or once the user has saved a character. Returns the resulting persisted state.
 */
export async function requestPersistenceIfUseful(
  env: StorageEnv,
  reason: { hasSavedCharacter: boolean },
  nav: NavigatorLike = navigator,
): Promise<boolean | null> {
  if (!env.persistSupported || !nav.storage?.persist) return null;
  if (nav.storage.persisted && (await nav.storage.persisted())) return true;
  if (!env.standalone && !reason.hasSavedCharacter) return false;
  try {
    return await nav.storage.persist();
  } catch {
    return false;
  }
}

export async function getStorageStatus(
  nav: NavigatorLike = navigator,
  win: WindowLike = window,
): Promise<StorageStatus> {
  const env = detectEnv(nav, win);
  let persisted: boolean | null = null;
  let usageBytes: number | null = null;
  let quotaBytes: number | null = null;
  try {
    if (nav.storage?.persisted) persisted = await nav.storage.persisted();
    if (nav.storage?.estimate) {
      const estimate = await nav.storage.estimate();
      usageBytes = estimate.usage ?? null;
      quotaBytes = estimate.quota ?? null;
    }
  } catch {
    // Some browsers throw in private mode; the status card just shows "unknown".
  }
  return { ...env, persisted, usageBytes, quotaBytes };
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return 'unknown';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

// ---- Eviction (plan step 7.1) ----
// A second store (localStorage) remembers that characters existed. If the database comes back
// empty while it says there were some, the browser has cleared the app's data: the app says so
// and offers to restore from a backup file. A browser that clears everything clears this too,
// so the backup file stays the real safety net.

const MARKER_KEY = '5e-sheet:characters';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function local(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** How many characters the app last saw, from the second store (0 when none or unknown). */
export function readCharacterMarker(store: StorageLike | null = local()): number {
  try {
    return Math.max(0, Number(store?.getItem(MARKER_KEY)) || 0);
  } catch {
    return 0;
  }
}

export function writeCharacterMarker(count: number, store: StorageLike | null = local()): void {
  try {
    if (count > 0) store?.setItem(MARKER_KEY, String(count));
    else store?.removeItem(MARKER_KEY);
  } catch {
    // Private mode or storage blocked: nothing to remember with.
  }
}

/** The database is empty at startup but the second store says characters existed. */
export function looksEvicted(countAtStart: number, marker: number): boolean {
  return countAtStart === 0 && marker > 0;
}
