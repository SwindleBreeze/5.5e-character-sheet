// Theme preference, stored per device in localStorage (a per-viewer convenience). Applied to
// <html> as:
//   data-theme   the explicit choice (`light`/`dark`); absent for `system`
//   data-scheme  the scheme in effect (`light`/`dark`), which the palettes in tokens.css read
// The inline script in index.html applies the same logic before first paint.

export type ThemePref = 'system' | 'light' | 'dark';
export type Scheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'theme';

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

/** The browser's bar colour for each scheme: the palette's background (tokens.css). */
export const THEME_COLORS: Record<Scheme, string> = { light: '#f4efe4', dark: '#16120e' };

export function applyThemePref(
  pref: ThemePref,
  root: HTMLElement = document.documentElement,
): void {
  if (pref === 'system') delete root.dataset.theme;
  else root.dataset.theme = pref;
  const scheme = resolveScheme(pref);
  root.dataset.scheme = scheme;
  // `only`: browsers that darken pages on their own (Chrome's and Samsung Internet's dark
  // modes) leave the app's palettes alone. The bar above the app follows the chosen theme.
  const doc = root.ownerDocument;
  doc
    .querySelector<HTMLMetaElement>('meta[name=color-scheme]')
    ?.setAttribute('content', `only ${scheme}`);
  doc
    .querySelector<HTMLMetaElement>('meta[name=theme-color]')
    ?.setAttribute('content', THEME_COLORS[scheme]);
}

export function saveThemePref(pref: ThemePref): void {
  write(THEME_STORAGE_KEY, pref === 'system' ? null : pref);
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
