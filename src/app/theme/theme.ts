// Theme preference: stored per device in localStorage (a per-viewer convenience), applied as
// `data-theme` on <html>. `system` removes the attribute so prefers-color-scheme decides.
// The inline script in index.html applies the same logic before first paint.

export type ThemePref = 'system' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'theme';

export function readThemePref(): ThemePref {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

export function applyThemePref(
  pref: ThemePref,
  root: HTMLElement = document.documentElement,
): void {
  if (pref === 'system') delete root.dataset.theme;
  else root.dataset.theme = pref;
}

export function saveThemePref(pref: ThemePref): void {
  try {
    if (pref === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Storage can be unavailable (private mode); the theme still applies for this session.
  }
}
