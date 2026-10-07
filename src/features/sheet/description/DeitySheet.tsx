// Choosing a god (plan §6.12, step 3.21): the deities of the enabled sources, filtered by
// pantheon and searched by name, title or domain, or any name typed in.

import { useMemo, useState } from 'react';
import { useEnabledSources, useEntitiesOfKind } from '../../../content/hooks.ts';
import type { Details, SourceCode } from '../../../schema/index.ts';
import { EntitySheet } from '../../../richtext/EntitySheet.tsx';
import { availableOf } from '../../../sources/sourceFilter.ts';
import { Button } from '../../../ui/Button.tsx';
import featureStyles from '../features/features.module.css';
import inventory from '../inventory/inventory.module.css';

export function DeitySheet({
  current,
  sources,
  onPick,
}: {
  /** The character's own sources, when it has them (plan §6.7). */
  sources?: SourceCode[] | null;
  current: Details['deity'];
  onPick: (deity: NonNullable<Details['deity']>) => void;
}) {
  const all = useEntitiesOfKind('deity');
  const enabled = useEnabledSources(sources);
  const [pantheon, setPantheon] = useState('');
  const [query, setQuery] = useState('');
  const [reading, setReading] = useState<string | null>(null);
  const [typed, setTyped] = useState(current && !current.ref ? current.name : '');
  const available = useMemo(
    () => availableOf(all ?? [], new Set(enabled)).sort((a, b) => a.name.localeCompare(b.name)),
    [all, enabled],
  );
  if (!all) return <p className={inventory.muted}>Loading gods…</p>;

  const pantheons = [...new Set(available.map((d) => d.pantheon))].sort();
  const q = query.trim().toLowerCase();
  const results = available.filter(
    (d) =>
      (!pantheon || d.pantheon === pantheon) &&
      (!q ||
        [d.name, d.title ?? '', ...d.domains, ...(d.altNames ?? [])].some((t) =>
          t.toLowerCase().includes(q),
        )),
  );

  return (
    <div className={inventory.add}>
      {pantheons.length > 1 && (
        <label className={inventory.field}>
          <span className={inventory.fieldLabel}>Pantheon</span>
          <select value={pantheon} onChange={(e) => setPantheon(e.target.value)}>
            <option value="">All pantheons</option>
            {pantheons.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      )}
      <input
        type="search"
        className={inventory.search}
        aria-label="Find a god"
        placeholder="Find a god by name, title or domain"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {!results.length && (
        <p className={inventory.muted}>
          {available.length ? 'No gods match.' : 'Your sources have no gods.'}
        </p>
      )}
      <ul className={featureStyles.options} aria-label="Gods found">
        {results.map((d) => (
          <li key={d.id} className={featureStyles.option}>
            <button
              type="button"
              className={inventory.result}
              aria-expanded={reading === d.id}
              onClick={() => setReading(reading === d.id ? null : d.id)}
            >
              <span className={inventory.resultName}>{d.name}</span>
              <span className={inventory.muted}>
                {[d.title, d.pantheon, d.domains.join(', ')].filter(Boolean).join(' · ')}
              </span>
            </button>
            {current?.ref?.id === d.id ? (
              <span className={inventory.muted}>Your god</span>
            ) : (
              <Button
                size="sm"
                aria-label={`Choose ${d.name}`}
                onClick={() => onPick({ ref: { kind: 'deity', id: d.id }, name: d.name })}
              >
                Choose
              </Button>
            )}
            {reading === d.id && (
              <div className={featureStyles.reading}>
                <EntitySheet entityRef={{ kind: 'deity', id: d.id }} />
              </div>
            )}
          </li>
        ))}
      </ul>
      <form
        className={inventory.form}
        onSubmit={(e) => {
          e.preventDefault();
          if (typed.trim()) onPick({ name: typed.trim() });
        }}
      >
        <label className={inventory.field}>
          <span className={inventory.fieldLabel}>Or type a name</span>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} />
        </label>
        <div className={inventory.actions}>
          <Button type="submit" aria-disabled={!typed.trim()}>
            Use this name
          </Button>
        </div>
      </form>
    </div>
  );
}
