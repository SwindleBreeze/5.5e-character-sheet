// Theme preference and design direction, both stored per device in localStorage (per-viewer
// conveniences). Applied to <html> as:
//   data-theme   the explicit choice (`light`/`dark`); absent for `system`
//   data-scheme  the scheme in effect (`light`/`dark`), which the palettes in tokens.css read
//   data-dir     the design direction (`a`/`b`) while both candidates exist (plan step 3.13)
// The inline script in index.html applies the same logic before first paint.

export type ThemePref = 'system' | 'light' | 'dark';
export type Scheme = 'light' | 'dark';
export type Direction = 'a' | 'b';

export const THEME_STORAGE_KEY = 'theme';
export const DIRECTION_STORAGE_KEY = 'design-direction';

export const DIRECTIONS: { value: Direction; label: string; description: string }[] = [
  { value: 'a', label: 'A · Parchment', description: 'Warm paper, serif headings, bordered' },
  { value: 'b', label: 'B · Slate', description: 'Cool greys, all sans, rounded and lifted' },
];

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode); the choice still applies for this session.
  }
}

export function readThemePref(): ThemePref {
  const value = read(THEME_STORAGE_KEY);
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function systemScheme(): Scheme {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function resolveScheme(pref: ThemePref): Scheme {
  return pref === 'system' ? systemScheme() : pref;
}

export function applyThemePref(
  pref: ThemePref,
  root: HTMLElement = document.documentElement,
): void {
  if (pref === 'system') delete root.dataset.theme;
  else root.dataset.theme = pref;
  root.dataset.scheme = resolveScheme(pref);
}

export function saveThemePref(pref: ThemePref): void {
  write(THEME_STORAGE_KEY, pref === 'system' ? null : pref);
}

export function readDirection(): Direction {
  return read(DIRECTION_STORAGE_KEY) === 'b' ? 'b' : 'a';
}

export function applyDirection(
  direction: Direction,
  root: HTMLElement = document.documentElement,
): void {
  root.dataset.dir = direction;
}

export function saveDirection(direction: Direction): void {
  write(DIRECTION_STORAGE_KEY, direction === 'a' ? null : direction);
}

/**
 * Keep `data-scheme` in step with the system while the preference is `system`. Returns a
 * function that stops watching.
 */
export function watchSystemScheme(root: HTMLElement = document.documentElement): () => void {
  if (typeof matchMedia !== 'function') return () => {};
  const query = matchMedia('(prefers-color-scheme: dark)');
  const update = () => applyThemePref(readThemePref(), root);
  query.addEventListener('change', update);
  return () => query.removeEventListener('change', update);
}
