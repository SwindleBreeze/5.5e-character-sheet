// Adding to a spellbook (plan §9.4, step 5.6): a Wizard copies spells it finds (scrolls, other
// spellbooks) into its book. Spells on its list up to the highest level it can prepare, not in
// the book yet; the 2024 cost of copying (2 hours and 50 GP per level) is said, not charged.
// Copied spells can be taken out again; the ones its levels gave are changed on Features.

import { useState } from 'react';
import { useEnabledSources, useEntitiesOfKind } from '../../../content/hooks.ts';
import type { DerivedCaster } from '../../../engine/derive/types.ts';
import {
  copiedSpells,
  copyCost,
  copyToSpellbook,
  removeCopied,
} from '../../../engine/play/spellbook.ts';
import { matchesSpellFilter } from '../../../engine/spells/filter.ts';
import type { Ref } from '../../../schema/index.ts';
import { availableOf } from '../../../sources/sourceFilter.ts';
import { Button } from '../../../ui/Button.tsx';
import { useLiveBindings } from '../liveBindings.ts';
import { nameOf, type SheetBindings } from '../sheetBindings.ts';
import { levelHeading } from './spellText.ts';
import styles from './spells.module.css';

export function SpellbookSheet({
  bindings: opened,
  caster,
}: {
  bindings: SheetBindings;
  caster: DerivedCaster;
}) {
  const { character, sheet, index, apply } = useLiveBindings(opened);
  const all = useEntitiesOfKind('spell');
  const enabled = useEnabledSources(character.enabledSources);
  const [query, setQuery] = useState('');
  const live = sheet.spellcasting.casters.find((c) => c.key === caster.key) ?? caster;
  const owner: Ref = { kind: 'class', id: live.classId ?? live.key };
  const book = new Set(live.spellbook ?? []);
  const copied = copiedSpells(character, owner);
  const q = query.trim().toLowerCase();
  const candidates = availableOf(all ?? [], new Set(enabled))
    .filter(
      (s) =>
        s.level >= 1 &&
        s.level <= live.maxSpellLevel &&
        !book.has(s.id) &&
        (live.list.ids.includes(s.id) || live.list.filters.some((f) => matchesSpellFilter(s, f))),
    )
    .filter((s) => !q || s.name.toLowerCase().includes(q))
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  const levels = [...new Set(candidates.map((s) => s.level))];

  if (!all) return <p className={styles.muted}>Loading spells…</p>;
  return (
    <div className={styles.cast}>
      <p className={styles.muted}>
        Found a spell scroll or another wizard’s book? Copy the spell into yours: it takes 2 hours
        and 50 GP of inks per spell level (not taken from your coins here). Spells up to level{' '}
        {live.maxSpellLevel}, from your list.
      </p>
      {copied.length > 0 && (
        <section aria-label="Copied spells">
          <h3 className={styles.levelTitle}>Copied into your book</h3>
          <ul className={styles.rows}>
            {copied.map((id) => (
              <li key={id} className={styles.row} aria-label={nameOf(index, 'spell', id)}>
                <span className={styles.spellName}>{nameOf(index, 'spell', id)}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => apply((c) => removeCopied(c, owner, id))}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <input
        type="search"
        aria-label="Find a spell"
        placeholder="Find a spell"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {!candidates.length && (
        <p className={styles.muted}>Every spell on your list you can copy is in your book.</p>
      )}
      {levels.map((level) => (
        <section key={level} aria-label={levelHeading(level)}>
          <h3 className={styles.levelTitle}>{levelHeading(level)}</h3>
          <ul className={styles.rows}>
            {candidates
              .filter((s) => s.level === level)
              .map((s) => {
                const cost = copyCost(s.level);
                return (
                  <li key={s.id} className={styles.row} aria-label={s.name}>
                    <span className={styles.spellName}>{s.name}</span>
                    <Button
                      size="sm"
                      onClick={() => apply((c) => copyToSpellbook(c, owner, s.id, s.name))}
                    >
                      Copy
                    </Button>
                    <span className={styles.meta}>
                      {cost.hours} hours · {cost.gp} GP
                    </span>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </div>
  );
}
