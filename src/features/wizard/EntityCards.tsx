// A list of things to pick one of (a class, a background, a species), each with a line of what
// it gives and a button to read it (plan §9.3, step 4.4). Optionally under headings.

import { useState } from 'react';
import { Button } from '../../ui/Button.tsx';
import inventory from '../sheet/inventory/inventory.module.css';
import styles from './wizard.module.css';

export interface CardItem {
  id: string;
  name: string;
  detail?: string;
  /** Heading it is listed under (a species' lineages under the species). */
  group?: string;
}

const SEARCH_FROM = 12;

export function EntityCards({
  label,
  items,
  selected,
  onSelect,
  onRead,
}: {
  /** The list's accessible name, e.g. `Classes`. */
  label: string;
  items: readonly CardItem[];
  selected: string | undefined;
  onSelect: (id: string) => void;
  onRead: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = items.filter(
    (i) =>
      !q ||
      i.id === selected ||
      i.name.toLowerCase().includes(q) ||
      (i.group ?? '').toLowerCase().includes(q),
  );
  const groups = [...new Set(shown.map((i) => i.group ?? ''))];

  const card = (item: CardItem) => (
    <li key={item.id} className={styles.card} data-selected={item.id === selected}>
      <label className={styles.pick}>
        <input
          type="radio"
          name={label}
          checked={item.id === selected}
          onChange={() => onSelect(item.id)}
        />
        <span className={styles.pickText}>
          <span className={styles.pickName}>{item.name}</span>
          {item.detail && <span className={styles.pickDetail}>{item.detail}</span>}
        </span>
      </label>
      <Button
        size="sm"
        variant="ghost"
        aria-label={`Read ${item.name}`}
        onClick={() => onRead(item.id)}
      >
        Read
      </Button>
    </li>
  );

  return (
    <div className={inventory.form}>
      {items.length > SEARCH_FROM && (
        <input
          type="search"
          className={inventory.search}
          aria-label={`Find in ${label.toLowerCase()}`}
          placeholder="Find…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      {!items.length && (
        <p className={inventory.warn}>
          Nothing to choose from. Import content, or check Settings → Sources.
        </p>
      )}
      {groups.length > 1 ? (
        groups.map((g) => (
          <section key={g} aria-label={g}>
            <h3 className={styles.groupTitle}>{g}</h3>
            <ul className={styles.cards} aria-label={g}>
              {shown.filter((i) => (i.group ?? '') === g).map(card)}
            </ul>
          </section>
        ))
      ) : (
        <ul className={styles.cards} aria-label={label}>
          {shown.map(card)}
        </ul>
      )}
    </div>
  );
}
