// The width of an element, kept current with a ResizeObserver. For layouts that follow their
// container rather than the screen (the sheet in a phone, a tablet, or a gallery frame).

import { useEffect, useState, type RefObject } from 'react';

export function useContainerWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w !== undefined) setWidth(Math.round(w));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

/** Columns for a width: one on phones, two on tablets, three on wide screens. */
export function columnsFor(width: number): 1 | 2 | 3 {
  if (width >= 1040) return 3;
  if (width >= 680) return 2;
  return 1;
}
