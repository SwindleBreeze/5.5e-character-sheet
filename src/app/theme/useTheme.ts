import { useCallback, useState } from 'react';
import {
  applyDirection,
  applyThemePref,
  readDirection,
  readThemePref,
  saveDirection,
  saveThemePref,
  type Direction,
  type ThemePref,
} from './theme.ts';

export function useTheme(): [ThemePref, (pref: ThemePref) => void] {
  const [pref, setPrefState] = useState<ThemePref>(readThemePref);

  const setPref = useCallback((next: ThemePref) => {
    applyThemePref(next);
    saveThemePref(next);
    setPrefState(next);
  }, []);

  return [pref, setPref];
}

/** The app-wide design direction, while both candidates exist (plan step 3.13). */
export function useDirection(): [Direction, (direction: Direction) => void] {
  const [direction, setState] = useState<Direction>(readDirection);

  const set = useCallback((next: Direction) => {
    applyDirection(next);
    saveDirection(next);
    setState(next);
  }, []);

  return [direction, set];
}
