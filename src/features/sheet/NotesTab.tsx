// The Notes tab (plan §9.2, step 3.21): free notes, and a session log with a dated entry per
// session, newest first.

import { useRef, useState, type ReactNode } from 'react';
import { newId } from '../../engine/build/newCharacter.ts';
import {
  addSessionNote,
  removeSessionNote,
  sessionNotesByDate,
  setNotes,
  updateSessionNote,
} from '../../engine/play/details.ts';
import type { SessionNote } from '../../schema/index.ts';
import { Button } from '../../ui/Button.tsx';
import { columnsFor, useContainerWidth } from '../../ui/useContainerWidth.ts';
import { SectionHeader } from './components/stats.tsx';
import styles from './description/description.module.css';
import inventory from './inventory/inventory.module.css';
import mainStyles from './MainTab.module.css';
import type { SheetBindings } from './sheetBindings.ts';

/** Today on this device, as `YYYY-MM-DD`. */
function today(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** `2026-10-07` → the date in the device's own format. */
function dateText(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return date;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className={mainStyles.section} aria-labelledby={`notes-${id}`}>
      <SectionHeader id={`notes-${id}`} title={title} />
      {children}
    </section>
  );
}

function SessionForm({
  initial,
  submit,
  onSubmit,
  onCancel,
}: {
  initial: { date: string; text: string };
  submit: string;
  onSubmit: (note: { date: string; text: string }) => void;
  onCancel?: () => void;
}) {
  const [date, setDate] = useState(initial.date);
  const [text, setText] = useState(initial.text);
  const ready = !!date && !!text.trim();
  return (
    <form
      className={inventory.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        onSubmit({ date, text: text.trim() });
        setText('');
      }}
    >
      <label className={inventory.field}>
        <span className={inventory.fieldLabel}>Date</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </label>
      <label className={styles.text}>
        <span className={inventory.fieldLabel}>What happened</span>
        <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <div className={inventory.actions}>
        <Button type="submit" variant="primary" aria-disabled={!ready}>
          {submit}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

function SessionEntry({ note, apply }: { note: SessionNote } & Pick<SheetBindings, 'apply'>) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  if (editing) {
    return (
      <li className={`${inventory.item} ${styles.session}`} aria-label={dateText(note.date)}>
        <SessionForm
          initial={note}
          submit="Save"
          onSubmit={(patch) => {
            apply((c) => updateSessionNote(c, note.id, patch));
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }
  return (
    <li className={inventory.item} aria-label={dateText(note.date)}>
      <h3 className={inventory.resultName}>{dateText(note.date)}</h3>
      <p className={styles.entry}>{note.text}</p>
      <div className={inventory.actions}>
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          Edit
        </Button>
        {confirm ? (
          <>
            <Button
              size="sm"
              variant="danger"
              onClick={() => apply((c) => removeSessionNote(c, note.id))}
            >
              Delete this entry
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
              Keep it
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}>
            Delete
          </Button>
        )}
      </div>
    </li>
  );
}

export function NotesTab({ character, apply }: SheetBindings) {
  const ref = useRef<HTMLDivElement>(null);
  const columns = Math.min(2, columnsFor(useContainerWidth(ref)));
  const log = sessionNotesByDate(character.sessionLog);

  const notes = (
    <Section id="notes" title="Notes">
      <div className={inventory.card}>
        <label className={styles.text}>
          <span className="visually-hidden">Notes</span>
          <textarea
            rows={12}
            value={character.notes}
            placeholder="Anything worth remembering: names, places, quests, loot to sell…"
            onChange={(e) => apply((c) => setNotes(c, e.target.value))}
          />
        </label>
      </div>
    </Section>
  );

  const sessions = (
    <Section id="sessions" title="Session log">
      <div className={inventory.card}>
        <SessionForm
          initial={{ date: today(), text: '' }}
          submit="Add entry"
          onSubmit={(note) => apply((c) => addSessionNote(c, { id: newId(), ...note }))}
        />
      </div>
      {log.length ? (
        <ul className={inventory.list} aria-label="Session log entries">
          {log.map((n) => (
            <SessionEntry key={n.id} note={n} apply={apply} />
          ))}
        </ul>
      ) : (
        <p className={inventory.muted}>No sessions written down yet.</p>
      )}
    </Section>
  );

  return (
    <div ref={ref} className={mainStyles.main} data-columns={columns}>
      {columns === 1 ? (
        <div className={mainStyles.column}>
          {notes}
          {sessions}
        </div>
      ) : (
        <>
          <div className={mainStyles.column}>{notes}</div>
          <div className={mainStyles.column}>{sessions}</div>
        </>
      )}
    </div>
  );
}
