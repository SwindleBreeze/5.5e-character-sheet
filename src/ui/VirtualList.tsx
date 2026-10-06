import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import styles from './VirtualList.module.css';

export interface VirtualListProps<T> {
  items: readonly T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  /** Row height estimate in px; rows are measured after render. */
  estimateSize?: number;
  'aria-label'?: string;
}

/** A long list that only renders the rows near the viewport. Scrolls with the page. */
export function VirtualList<T>({
  items,
  getKey,
  renderItem,
  estimateSize = 64,
  'aria-label': ariaLabel,
}: VirtualListProps<T>) {
  const listRef = useRef<HTMLUListElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    setScrollMargin(listRef.current?.offsetTop ?? 0);
  }, []);

  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => estimateSize,
    overscan: 8,
    scrollMargin,
    getItemKey: (index) => {
      const item = items[index];
      return item === undefined ? index : getKey(item);
    },
  });

  return (
    <ul
      ref={listRef}
      className={styles.list}
      style={{ height: virtualizer.getTotalSize() }}
      aria-label={ariaLabel}
    >
      {virtualizer.getVirtualItems().map((row) => {
        const item = items[row.index];
        if (item === undefined) return null;
        return (
          <li
            key={row.key}
            data-index={row.index}
            ref={virtualizer.measureElement}
            className={styles.row}
            style={{ transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)` }}
          >
            {renderItem(item)}
          </li>
        );
      })}
    </ul>
  );
}
