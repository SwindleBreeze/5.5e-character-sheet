// Installing the app (plan step 7.2). Chromium browsers (Android, desktop) fire
// `beforeinstallprompt` when the app can be installed; it is kept here so an "Install" button can
// show the browser's own prompt later. iOS has no such event: the Share → Add to Home Screen steps
// are shown instead (`InstallGuide`).

import { useSyncExternalStore } from 'react';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** Start listening (once, at startup) so the event isn't missed before the UI mounts. */
export function listenForInstall(win: Window = window): void {
  win.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    notify();
  });
  win.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    notify();
  });
}

/** Show the browser's install prompt; true when the user accepted. */
export async function promptInstall(): Promise<boolean> {
  const e = deferred;
  if (!e) return false;
  await e.prompt();
  const { outcome } = await e.userChoice;
  deferred = null;
  if (outcome === 'accepted') installed = true;
  notify();
  return outcome === 'accepted';
}

const snapshot = () => (installed ? 'installed' : deferred ? 'available' : 'none');

/** `available`: the browser can install the app now; `installed`: it just was. */
export function useInstallState(): 'available' | 'installed' | 'none' {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    snapshot,
    () => 'none',
  );
}

/** For tests: forget a captured prompt. */
export function resetInstallState(): void {
  deferred = null;
  installed = false;
  notify();
}
