// Saving play changes (plan §9.1): a reducer applies to the character in memory at once, and
// the result is written to the database at most every 250 ms, and right away when the page is
// hidden or the sheet closes. The stored copy takes over again once it has caught up.

import { useCallback, useEffect, useRef, useState } from 'react';
import { repos } from '../../db/repos.ts';
import type { Character } from '../../schema/index.ts';

export const SAVE_DELAY_MS = 250;

export type CharacterUpdate = (c: Character) => Character;

export interface CharacterActions {
  /** The character to show: the latest change, saved or not. */
  character: Character | undefined;
  /** Apply a change (usually a play reducer) and save it soon. */
  apply: (update: CharacterUpdate) => void;
  /** Write a pending change now. */
  flush: () => Promise<void>;
}

export function useCharacterActions(stored: Character | undefined): CharacterActions {
  const [local, setLocal] = useState<Character | null>(null);
  // The latest character, including changes React hasn't rendered yet (several taps in a row).
  const latest = useRef<Character | undefined>(stored);
  const unsaved = useRef<Character | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Our own unsaved change wins; otherwise the stored copy (which may come from elsewhere).
  const character = local && (!stored || local.updatedAt > stored.updatedAt) ? local : stored;
  useEffect(() => {
    if (!unsaved.current) latest.current = character;
  }, [character]);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const next = unsaved.current;
    if (!next) return;
    unsaved.current = null;
    await repos().characters.save(next, next.updatedAt);
  }, []);

  const apply = useCallback(
    (update: CharacterUpdate) => {
      const base = latest.current;
      if (!base) return;
      const changed = update(base);
      if (changed === base) return;
      // Strictly newer than anything stored, so it shows until the save lands.
      const next = { ...changed, updatedAt: Math.max(Date.now(), base.updatedAt + 1) };
      latest.current = next;
      unsaved.current = next;
      setLocal(next);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [flush],
  );

  useEffect(() => {
    const onHide = () => void flush();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onHide);
      void flush();
    };
  }, [flush]);

  return { character, apply, flush };
}
