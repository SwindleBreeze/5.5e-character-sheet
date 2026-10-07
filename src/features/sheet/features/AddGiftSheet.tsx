// Adding a gift (plan §6.12, step 3.20): a charm, blessing or boon the DM gave, found in the
// library of the enabled sources.

import { useMemo, useState } from 'react';
import { useEnabledSources, useEntitiesOfKind } from '../../../content/hooks.ts';
import type { Reward, SourceCode } from '../../../schema/index.ts';
import { EntitySheet } from '../../../richtext/EntitySheet.tsx';
import { availableOf } from '../../../sources/sourceFilter.ts';
import { Button } from '../../../ui/Button.tsx';
import inventory from '../inventory/inventory.module.css';
import styles from './features.module.css';

export function AddGiftSheet({
  have,
  sources,
  onAdd,
}: {
  /** The character's own sources, when it has them (plan §6.7). */
  sources?: SourceCode[] | null;
  /** Ids of the gifts the character has. */
  have: ReadonlySet<string>;
  onAdd: (gift: Reward) => void;
}) {
  const all = useEntitiesOfKind('reward');
  const enabled = useEnabledSources(sources);
  const [reading, setReading] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const available = useMemo(
    () => availableOf(all ?? [], new Set(enabled)).sort((a, b) => a.name.localeCompare(b.name)),
    [all, enabled],
  );
  if (!all) return <p className={inventory.muted}>Loading gifts…</p>;

  const q = query.trim().toLowerCase();
  const results = q
    ? available.filter(
        (g) => g.name.toLowerCase().includes(q) || g.rewardType.toLowerCase().includes(q),
      )
    : available;

  return (
    <div className={inventory.add}>
      <p className={inventory.muted}>
        Charms, blessings and boons are given by the DM. Add the one you were given; its effects and
        uses apply like a feat’s.
      </p>
      <input
        type="search"
        className={inventory.search}
        aria-label="Find a gift"
        placeholder="Find a charm, blessing or boon"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {!results.length && (
        <p className={inventory.muted}>
          {available.length ? 'No gifts match.' : 'Your sources have no gifts.'}
        </p>
      )}
      <ul className={styles.options} aria-label="Gifts found">
        {results.map((g) => (
          <li key={g.id} className={styles.option}>
            <button
              type="button"
              className={inventory.result}
              aria-expanded={reading === g.id}
              onClick={() => setReading(reading === g.id ? null : g.id)}
            >
              <span className={inventory.resultName}>{g.name}</span>
              <span className={inventory.muted}>
                {g.rewardType} · {g.source}
              </span>
            </button>
            {have.has(g.id) ? (
              <span className={inventory.muted}>You have it</span>
            ) : (
              <Button size="sm" aria-label={`Add ${g.name}`} onClick={() => onAdd(g)}>
                Add
              </Button>
            )}
            {reading === g.id && (
              <div className={styles.reading}>
                <EntitySheet entityRef={{ kind: 'reward', id: g.id }} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
