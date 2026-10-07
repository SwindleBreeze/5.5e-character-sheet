// Description and notes (plan §9.2, step 3.21). Pure: each returns a new character. None of
// these change a number on the sheet; a god has no effects (plan §9.1).

import type { Character, Details, SessionNote, SourceCode } from '../../schema/index.ts';

export type TextDetail = Exclude<keyof Details, 'deity'>;

export function setName(c: Character, name: string): Character {
  return { ...c, name };
}

/** A details field; an empty one is removed (spaces are kept: the player may be typing). */
export function setDetail(c: Character, key: TextDetail, value: string): Character {
  const details = { ...c.details };
  if (value) details[key] = value;
  else delete details[key];
  return { ...c, details };
}

/** A god from the library (with its ref) or typed in; `null` clears it. */
export function setDeity(c: Character, deity: Details['deity'] | null): Character {
  const details = { ...c.details };
  if (deity?.name.trim()) details.deity = deity;
  else delete details.deity;
  return { ...c, details };
}

/** The portrait's id in the `portraits` table; `null` removes it. */
export function setPortrait(c: Character, id: string | null): Character {
  const n = { ...c };
  if (id) n.portraitId = id;
  else delete n.portraitId;
  return n;
}

/** The sources this character's pickers offer; `null` follows the app's setting (plan §6.7). */
export function setSources(c: Character, sources: SourceCode[] | null): Character {
  return { ...c, enabledSources: sources && [...new Set(sources)].sort() };
}

export function setNotes(c: Character, notes: string): Character {
  return { ...c, notes };
}

export function addSessionNote(c: Character, note: SessionNote): Character {
  return { ...c, sessionLog: [...c.sessionLog, note] };
}

export function updateSessionNote(
  c: Character,
  id: string,
  patch: Partial<Omit<SessionNote, 'id'>>,
): Character {
  return {
    ...c,
    sessionLog: c.sessionLog.map((n) => (n.id === id ? { ...n, ...patch } : n)),
  };
}

export function removeSessionNote(c: Character, id: string): Character {
  return { ...c, sessionLog: c.sessionLog.filter((n) => n.id !== id) };
}

/** Newest session first; entries on the same day in the order written, latest first. */
export function sessionNotesByDate(log: readonly SessionNote[]): SessionNote[] {
  return log
    .map((n, i) => ({ n, i }))
    .sort((a, b) => b.n.date.localeCompare(a.n.date) || b.i - a.i)
    .map((x) => x.n);
}
