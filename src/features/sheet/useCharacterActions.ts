// Saving play changes (plan §9.1): a reducer applies to the character in memory at once, and
// the result is written to the database at most every 250 ms, and right away when the page is
// hidden, the sheet closes or the app reloads for an update. The stored copy takes over again
// once it has caught up. A save that fails keeps the change and tries again, and says so: a
// change is never dropped quietly (play-test fix: a draft's ability scores were lost).

import { useCallback, useEffect, useRef, useState } from 'react';
import { repos } from '../../db/repos.ts';
import type { Character } from '../../schema/index.ts';

export const SAVE_DELAY_MS = 250;
/** After a failed save, the next try. */
export const RETRY_MS = 2000;

export type CharacterUpdate = (c: Character) => Character;

export interface CharacterActions {
  /** The character to show: the latest change, saved or not. */
  character: Character | undefined;
  /** Apply a change (usually a play reducer) and save it soon. */
  apply: (update: CharacterUpdate) => void;
  /** Write a pending change now; rejects when it can't be saved (it is kept and retried). */
  flush: () => Promise<void>;
  /** Why the last save failed, until one succeeds. */
  saveError: string | null;
}

/** Every open character's pending changes, written before the app reloads for an update. */
const pending = new Set<() => Promise<void>>();

export async function flushAllSaves(): Promise<void> {
  await Promise.allSettled([...pending].map((flush) => flush()));
}

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

export function useCharacterActions(stored: Character | undefined): CharacterActions {
  const [local, setLocal] = useState<Character | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // The latest character, including changes React hasn't rendered yet (several taps in a row).
  const latest = useRef<Character | undefined>(stored);
  const unsaved = useRef<Character | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushRef = useRef<() => Promise<void>>(async () => {});

  // Our own unsaved change wins; otherwise the stored copy (which may come from elsewhere).
  const character = local && (!stored || local.updatedAt > stored.updatedAt) ? local : stored;
  useEffect(() => {
    if (!unsaved.current) latest.current = character;
  }, [character]);

  /** Save soon, never throwing: a failure is kept, shown and tried again. */
  const later = useCallback((ms: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flushRef.current().catch(() => {}), ms);
  }, []);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const next = unsaved.current;
    if (!next) return;
    unsaved.current = null;
    try {
      await repos().characters.save(next, next.updatedAt);
      setSaveError(null);
    } catch (err) {
      // Keep it, unless a newer change came in meanwhile (that one is saved instead).
      if (!unsaved.current) unsaved.current = next;
      setSaveError(messageOf(err));
      later(RETRY_MS);
      throw err;
    }
  }, [later]);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

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
      later(SAVE_DELAY_MS);
    },
    [later],
  );

  useEffect(() => {
    const quiet = () => flush().catch(() => {});
    const onHide = () => void quiet();
    pending.add(quiet);
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      pending.delete(quiet);
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onHide);
      void quiet();
    };
  }, [flush]);

  return { character, apply, flush, saveError };
}
