import { describe, expect, it } from 'vitest';
import { newCharacter } from '../build/newCharacter.ts';
import {
  addSessionNote,
  removeSessionNote,
  sessionNotesByDate,
  setDeity,
  setDetail,
  setPortrait,
  updateSessionNote,
} from './details.ts';

describe('description and notes', () => {
  it('sets and clears details; an empty field is removed', () => {
    let c = setDetail(newCharacter('Ada', 0), 'backstory', 'Raised by wolves.');
    expect(c.details.backstory).toBe('Raised by wolves.');
    c = setDetail(c, 'backstory', '');
    expect('backstory' in c.details).toBe(false);
  });

  it('a god from the library or typed in; null clears it', () => {
    const god = { ref: { kind: 'deity', id: 'mirela|faerûnian|tst' }, name: 'Mirela' } as const;
    let c = setDeity(newCharacter('Ada', 0), god);
    expect(c.details.deity).toEqual(god);
    c = setDeity(c, { name: 'The Unnamed' });
    expect(c.details.deity).toEqual({ name: 'The Unnamed' });
    expect(setDeity(c, null).details.deity).toBeUndefined();
  });

  it('a portrait id, and removing it', () => {
    const c = setPortrait(newCharacter('Ada', 0), 'p1');
    expect(c.portraitId).toBe('p1');
    expect('portraitId' in setPortrait(c, null)).toBe(false);
  });

  it('session log entries: added, edited, removed, newest first', () => {
    let c = newCharacter('Ada', 0);
    c = addSessionNote(c, { id: 'a', date: '2026-10-01', text: 'First' });
    c = addSessionNote(c, { id: 'b', date: '2026-10-07', text: 'Third' });
    c = addSessionNote(c, { id: 'c', date: '2026-10-01', text: 'Second' });
    expect(sessionNotesByDate(c.sessionLog).map((n) => n.id)).toEqual(['b', 'c', 'a']);
    c = updateSessionNote(c, 'a', { text: 'Session one' });
    expect(c.sessionLog[0]).toEqual({ id: 'a', date: '2026-10-01', text: 'Session one' });
    c = removeSessionNote(c, 'b');
    expect(c.sessionLog.map((n) => n.id)).toEqual(['a', 'c']);
  });
});
