import { useCallback, useState } from 'react';
import { applyThemePref, readThemePref, saveThemePref, type ThemePref } from './theme.ts';

export function useTheme(): [ThemePref, (pref: ThemePref) => void] {
  const [pref, setPrefState] = useState<ThemePref>(readThemePref);

  const setPref = useCallback((next: ThemePref) => {
    applyThemePref(next);
    saveThemePref(next);
    setPrefState(next);
  }, []);

  return [pref, setPref];
}
