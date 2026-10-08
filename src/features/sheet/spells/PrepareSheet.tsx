// Changing a Long Rest caster's prepared spells (plan §9.1, §9.2 step 3.18). By default it
// offers the caster's list (a Wizard: the spellbook) up to the highest level it can prepare,
// and stops at the limit. "Ignore rules" offers every spell and no limit; what breaks a rule
// is saved anyway and shows as a warning on the sheet. Each spell shows its facts and first
// sentence, and reads in full in place. In the wizard (`instant`) every tap is saved.

import { useState } from 'react';
import { firstSentence } from '../../../richtext/entityMeta.ts';
import { EntitySheet } from '../../../richtext/EntitySheet.tsx';
import { spellDetail } from '../../../engine/choices/options.ts';
import choices from '../../choices/choices.module.css';
import { useEnabledSources, useEntitiesOfKind } from '../../../content/hooks.ts';
import type { DerivedCaster } from '../../../engine/derive/types.ts';
import { matchesSpellFilter } from '../../../engine/spells/filter.ts';
import type { Id, SourceCode, Spell } from '../../../schema/index.ts';
import { availableOf } from '../../../sources/sourceFilter.ts';
import { Button } from '../../../ui/Button.tsx';
import { levelHeading } from './spellText.ts';
import styles from './spells.module.css';

export function PrepareSheet({
  caster,
  current,
  sources,
  onSave,
  instant,
}: {
  /** The character's own sources, when it has them (plan §6.7). */
  sources?: SourceCode[] | null;
  caster: DerivedCaster;
  /** The prepared list as stored (without spells known from choices). */
  current: readonly Id[];
  onSave: (ids: Id[]) => void;
  /** Save every tap (the wizard, which shows the character live) instead of with Save. */
  instant?: boolean;
}) {
  const all = useEntitiesOfKind('spell');
  const enabled = useEnabledSources(sources);
  const [local, setLocal] = useState<Id[]>([...current]);
  const picked = instant ? [...current] : local;
  const setPicked = (ids: Id[]) => (instant ? onSave(ids) : setLocal(ids));
  // Read in place: a page pushed on the sheet would replace this one and lose the picks.
  const [reading, setReading] = useState<Id | null>(null);
  const [ignore, setIgnore] = useState(false);
  const [query, setQuery] = useState('');

  const always = new Set(caster.alwaysPrepared);
  const book = caster.spellbook ? new Set(caster.spellbook) : undefined;
  const onList = (s: Spell) =>
    book
      ? book.has(s.id)
      : caster.list.ids.includes(s.id) || caster.list.filters.some((f) => matchesSpellFilter(s, f));
  const candidates = availableOf(all ?? [], new Set(enabled)).filter(
    (s) =>
      s.level > 0 &&
      !always.has(s.id) &&
      (ignore || (s.level <= caster.maxSpellLevel && onList(s))),
  );

  // Picks that aren't offered any more (off the list, too high) stay listed so they can be removed.
  const shown = [
    ...candidates,
    ...(all ?? []).filter((s) => picked.includes(s.id) && !candidates.some((c) => c.id === s.id)),
  ].filter((s) => !query || s.name.toLowerCase().includes(query.toLowerCase()));
  const levels = [...new Set(shown.map((s) => s.level))].sort((a, b) => a - b);
  const full = !ignore && picked.length >= caster.preparedMax;
  const removed = current.filter((id) => !picked.includes(id)).length;
  const swaps = caster.swapsSinceRest + removed;

  if (!all) return <p className={styles.muted}>Loading spells…</p>;
  return (
    <form
      className={styles.prepare}
      onSubmit={(e) => {
        e.preventDefault();
        onSave(picked);
      }}
    >
      <div className={styles.prepareBar}>
        <strong className="numeric" aria-live="polite">
          {picked.length} / {caster.preparedMax} prepared
        </strong>
        <label className={styles.toggle}>
          <input type="checkbox" checked={ignore} onChange={(e) => setIgnore(e.target.checked)} />
          Ignore rules
        </label>
        <input
          type="search"
          aria-label="Find a spell"
          placeholder="Find a spell"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {!instant && (
          <Button type="submit" variant="primary">
            Save
          </Button>
        )}
      </div>
      <p className={styles.muted}>
        {book ? 'From your spellbook, ' : 'From your spell list, '}
        levels 1 to {caster.maxSpellLevel}.{' '}
        {caster.swapLimit !== undefined
          ? `After a Long Rest you can replace ${caster.swapLimit} prepared spell.`
          : 'After a Long Rest you can change any number of them.'}
        {caster.alwaysPrepared.length > 0 &&
          ' Spells you always have prepared don’t count and aren’t listed.'}
      </p>
      {caster.swapLimit !== undefined && swaps > caster.swapLimit && (
        <p className={styles.warn}>
          That replaces {swaps} since your last Long Rest; you can replace {caster.swapLimit}.
        </p>
      )}
      {levels.map((level) => (
        <section key={level} aria-label={levelHeading(level)}>
          <h3 className={styles.levelTitle}>{levelHeading(level)}</h3>
          {shown
            .filter((s) => s.level === level)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((s) => {
              const on = picked.includes(s.id);
              const blocked = !on && full;
              const summary = firstSentence(s.entries);
              return (
                <div key={s.id} className={choices.option}>
                  <label className={choices.check} data-blocked={blocked}>
                    <input
                      type="checkbox"
                      checked={on}
                      aria-disabled={blocked}
                      onChange={() => {
                        if (on) setPicked(picked.filter((x) => x !== s.id));
                        else if (!blocked) setPicked([...picked, s.id]);
                      }}
                    />
                    <span className={choices.label}>{s.name}</span>
                    <span className={styles.muted}>{s.source}</span>
                  </label>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Read ${s.name}`}
                    aria-expanded={reading === s.id}
                    onClick={() => setReading(reading === s.id ? null : s.id)}
                  >
                    Read
                  </Button>
                  <span className={choices.text}>
                    <span className={choices.detail}>{spellDetail(s)}</span>
                    {summary && <span className={choices.about}>{summary}</span>}
                  </span>
                  {reading === s.id && (
                    <div className={choices.reading}>
                      <EntitySheet entityRef={{ kind: 'spell', id: s.id }} />
                    </div>
                  )}
                </div>
              );
            })}
        </section>
      ))}
      {!levels.length && <p className={styles.muted}>No spells match.</p>}
    </form>
  );
}
