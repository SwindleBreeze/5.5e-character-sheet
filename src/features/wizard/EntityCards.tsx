// A list of things to pick one of (a class, a background), each with what it gives at a glance
// (plan §9.3 step 4.4, §9.3b step 4B.5). The chosen one opens in place, with its choices inside,
// so nothing it asks for is out of sight below the list.

import { useId, type ReactNode } from 'react';
import { Button } from '../../ui/Button.tsx';
import styles from './wizard.module.css';

export interface CardItem {
  id: string;
  name: string;
  detail?: string;
  /** Short facts shown as tags: `+2/+1: INT · WIS · CHA`, `Arcana`, `Magic Initiate`. */
  chips?: string[];
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
  return (
    <ul className={styles.cards} aria-label={label}>
      {items.map((item, i) => {
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
                  aria-describedby={item.detail || item.chips?.length ? detailId : undefined}
                  onChange={() => onSelect(item.id)}
                />
                <span className={styles.pickText}>
                  <span id={nameId} className={styles.pickName}>
                    {item.name}
                  </span>
                  <span id={detailId} className={styles.pickDetail}>
                    {item.detail}
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
      })}
    </ul>
  );
}
