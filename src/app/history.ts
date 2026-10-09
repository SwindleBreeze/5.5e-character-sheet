// Back that matches the phone's back. The app's own back buttons and the ends of the wizard and
// level-up go *back* in the browser history when the screen they lead to is the one before,
// instead of adding it again: otherwise the phone's back afterwards returns to the screen just
// left (the wizard's steps, the sheet after "Back" to the list).
//
// React Router keeps each entry's position in `history.state.idx`; what each position shows is
// recorded here (and in sessionStorage, so it survives a reload of the tab).

import { useCallback, useEffect } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router';

const STORE_KEY = 'history-paths';

let paths: Record<number, string> = load();

function load(): Record<number, string> {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Record<number, string>) : {};
  } catch {
    return {};
  }
}

function store() {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(paths));
  } catch {
    // Without storage the record lasts until the tab reloads.
  }
}

/** The position of the current history entry, if React Router gave it one. */
function currentIdx(): number | null {
  const idx = (window.history.state as { idx?: unknown } | null)?.idx;
  return typeof idx === 'number' ? idx : null;
}

/** Record what the current entry shows. A push drops the entries that were ahead of it. */
export function recordEntry(pathname: string, pushed: boolean, idx = currentIdx()) {
  if (idx === null) return;
  if (pushed) {
    paths = Object.fromEntries(Object.entries(paths).filter(([k]) => Number(k) < idx));
  }
  paths[idx] = pathname;
  store();
}

/** Test helper: forget every entry. */
export function resetHistoryRecord() {
  paths = {};
  store();
}

/** Keeps the record of entries; rendered once inside the router. */
export function HistoryTracker() {
  const { pathname } = useLocation();
  const type = useNavigationType();
  useEffect(() => recordEntry(pathname, type === 'PUSH'), [pathname, type]);
  return null;
}

/**
 * The same screen: a sheet with another tab open counts as the sheet (its tabs replace each
 * other), but its level-up page does not.
 */
export function sameScreen(a: string, b: string): boolean {
  const sheet = (p: string) => /^\/c\/([^/]+)(?:\/(?!level-up$)[^/]*)?$/.exec(p)?.[1];
  const sa = sheet(a);
  return sa !== undefined ? sa === sheet(b) : a === b;
}

/**
 * How to get from the current entry to `target`: `back` entries back, then (when `replace`)
 * `target` put in place of the entry landed on. `flow` is the start of the paths that belong to
 * the screen being left (a wizard's steps), all of which are left together.
 */
export function planBack(
  target: string,
  flow: string | undefined,
  idx: number | null,
  record: Record<number, string> = paths,
): { back: number; replace: boolean } {
  if (idx === null) return { back: 0, replace: true };
  // Entries of this flow, ending at the current one.
  let n = 1;
  while (flow && record[idx - n]?.startsWith(flow)) n++;
  const before = record[idx - n];
  if (before !== undefined && sameScreen(before, target)) return { back: n, replace: false };
  return { back: n - 1, replace: true };
}

/** Go back to `target` (see `planBack`). */
export function useGoBack() {
  const navigate = useNavigate();
  return useCallback(
    (target: string, flow?: string) => {
      const { back, replace } = planBack(target, flow, currentIdx());
      if (back === 0) {
        void navigate(target, { replace: true });
        return;
      }
      if (replace) {
        // Once the history has moved back (React Router has seen it first), the entry landed on
        // becomes the target.
        window.addEventListener('popstate', () => void navigate(target, { replace: true }), {
          once: true,
        });
      }
      void navigate(-back);
    },
    [navigate],
  );
}
