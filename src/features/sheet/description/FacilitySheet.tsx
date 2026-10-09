// Adding a Bastion facility (plan step 7.7): the facilities of the enabled sources, by type and
// searched by name or order. Nothing is checked: the player adds what their Bastion has.

import { useMemo, useState } from 'react';
import { useEnabledSources, useEntitiesOfKind } from '../../../content/hooks.ts';
import type { Facility, SourceCode } from '../../../schema/index.ts';
import { EntitySheet } from '../../../richtext/EntitySheet.tsx';
import { entityMeta } from '../../../richtext/entityMeta.ts';
import { availableOf } from '../../../sources/sourceFilter.ts';
import { Button } from '../../../ui/Button.tsx';
import featureStyles from '../features/features.module.css';
import inventory from '../inventory/inventory.module.css';

export function FacilitySheet({
  have,
  sources,
  onAdd,
}: {
  /** How many of each facility (by id) the Bastion has. */
  have: ReadonlyMap<string, number>;
  /** The character's own sources, when it has them (plan §6.7). */
  sources?: SourceCode[] | null;
  onAdd: (facility: Facility) => void;
}) {
  const all = useEntitiesOfKind('facility');
  const enabled = useEnabledSources(sources);
  const [type, setType] = useState<'' | Facility['facilityType']>('');
  const [query, setQuery] = useState('');
  const [reading, setReading] = useState<string | null>(null);
  const available = useMemo(
    () =>
      availableOf(all ?? [], new Set(enabled)).sort(
        (a, b) => (a.level ?? 0) - (b.level ?? 0) || a.name.localeCompare(b.name),
      ),
    [all, enabled],
  );
  if (!all) return <p className={inventory.muted}>Loading facilities…</p>;

  const types = new Set(available.map((f) => f.facilityType));
  const q = query.trim().toLowerCase();
  const results = available.filter(
    (f) =>
      (!type || f.facilityType === type) &&
      (!q || [f.name, ...f.orders].some((t) => t.toLowerCase().includes(q))),
  );

  return (
    <div className={inventory.add}>
      {types.size > 1 && (
        <label className={inventory.field}>
          <span className={inventory.fieldLabel}>Type</span>
          <select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="">All facilities</option>
            <option value="basic">Basic</option>
            <option value="special">Special</option>
          </select>
        </label>
      )}
      <input
        type="search"
        className={inventory.search}
        aria-label="Find a facility"
        placeholder="Find a facility by name or order"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {!results.length && (
        <p className={inventory.muted}>
          {available.length ? 'No facilities match.' : 'Your sources have no Bastion facilities.'}
        </p>
      )}
      <ul className={featureStyles.options} aria-label="Facilities found">
        {results.map((f) => (
          <li key={f.id} className={featureStyles.option}>
            <button
              type="button"
              className={inventory.result}
              aria-expanded={reading === f.id}
              onClick={() => setReading(reading === f.id ? null : f.id)}
            >
              <span className={inventory.resultName}>{f.name}</span>
              <span className={inventory.muted}>
                {[entityMeta(f).subtitle, have.get(f.id) && `you have ${have.get(f.id)}`]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </button>
            <Button size="sm" aria-label={`Add ${f.name}`} onClick={() => onAdd(f)}>
              {have.get(f.id) ? 'Add another' : 'Add'}
            </Button>
            {reading === f.id && (
              <div className={featureStyles.reading}>
                <EntitySheet entityRef={{ kind: 'facility', id: f.id }} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
