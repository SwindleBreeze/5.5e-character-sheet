// A list of things to pick one of (a class, a background), each with what it gives at a glance
// (plan §9.3 step 4.4, §9.3b steps 4B.5 and 4B.6). The chosen one opens in place, with its
// choices inside, so nothing it asks for is out of sight below the list. From more than one
// book, the list is split under each book's name.

import { useId, type ReactNode } from 'react';
import { Button } from '../../ui/Button.tsx';
import styles from './wizard.module.css';

export interface CardItem {
  id: string;
  name: string;
  detail?: string;
  /** Short facts shown as tags: `+2/+1: INT · WIS · CHA`, `Arcana`, `Magic Initiate`. */
  chips?: string[];
  /** The book it comes from; with more than one, the list is split under their names. */
  group?: string;
  /** Why it suits the character (`Good for a Barbarian: raises Strength`), highlighted. */
  suggested?: string | undefined;
}

export function EntityCards({
  label,
  items,
  selected,
  onSelect,
  onRead,
  expanded,
}: {
  /** The list's accessible name, e.g. `Classes`. */
  label: string;
  items: readonly CardItem[];
  selected: string | undefined;
  onSelect: (id: string) => void;
  onRead: (id: string) => void;
  /** Shown inside the selected card: what it is and what it asks for. */
  expanded?: ReactNode;
}) {
  const baseId = useId();
  if (!items.length) {
    return (
      <p className={styles.notice}>
        Nothing to choose from. Import content, or check Settings → Sources.
      </p>
    );
  }
  const groups: { label: string; items: { item: CardItem; i: number }[] }[] = [];
  items.forEach((item, i) => {
    const g = groups.find((x) => x.label === (item.group ?? ''));
    if (g) g.items.push({ item, i });
    else groups.push({ label: item.group ?? '', items: [{ item, i }] });
  });

  const card = (item: CardItem, i: number) => {
    const on = item.id === selected;
    const nameId = `${baseId}-${i}-name`;
    const detailId = `${baseId}-${i}-detail`;
    return (
      <li
        key={item.id}
        className={styles.card}
        data-selected={on}
        aria-label={on ? item.name : undefined}
      >
        <div className={styles.cardHead}>
          <label className={styles.pick}>
            <input
              type="radio"
              name={label}
              checked={on}
              aria-labelledby={nameId}
              aria-describedby={
                item.detail || item.suggested || item.chips?.length ? detailId : undefined
              }
              onChange={() => onSelect(item.id)}
            />
            <span className={styles.pickText}>
              <span id={nameId} className={styles.pickName}>
                {item.name}
              </span>
              <span id={detailId} className={styles.pickDetail}>
                {item.detail}
                {item.suggested && <span className={styles.suggested}>{item.suggested}</span>}
                {item.chips?.length ? (
                  <span className={styles.chips}>
                    {item.chips.map((c) => (
                      <span key={c} className={styles.chip}>
                        {c}
                      </span>
                    ))}
                  </span>
                ) : null}
              </span>
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
        </div>
        {on && expanded && <div className={styles.cardBody}>{expanded}</div>}
      </li>
    );
  };

  if (groups.length < 2) {
    return (
      <ul className={styles.cards} aria-label={label}>
        {items.map(card)}
      </ul>
    );
  }
  return (
    <div className={styles.cardGroups}>
      {groups.map((g) => (
        <div key={g.label} className={styles.cardGroup}>
          <h3 className={styles.groupTitle}>{g.label || 'Other'}</h3>
          <ul className={styles.cards} aria-label={`${label}: ${g.label || 'Other'}`}>
            {g.items.map(({ item, i }) => card(item, i))}
          </ul>
        </div>
      ))}
    </div>
  );
}
