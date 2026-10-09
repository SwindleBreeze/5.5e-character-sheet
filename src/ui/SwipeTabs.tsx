import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import styles from './SwipeTabs.module.css';

export interface TabDef {
  id: string;
  label: string;
  content: ReactNode;
}

export interface SwipeTabsProps {
  label: string;
  tabs: TabDef[];
  activeId: string;
  onChange: (id: string) => void;
}

/** The player asked for less motion: tabs change without sliding. */
function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * A tab bar over horizontally swipeable panels (CSS scroll-snap). The active tab is controlled
 * by the parent so it can live in the URL.
 */
export function SwipeTabs({ label, tabs, activeId, onChange }: SwipeTabsProps) {
  const baseId = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => t.id === activeId),
  );
  // Index we scrolled to programmatically; scroll events for it don't count as a user swipe.
  const programmaticIndex = useRef<number | null>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const left = activeIndex * track.clientWidth;
    if (Math.abs(track.scrollLeft - left) < 2) return;
    programmaticIndex.current = activeIndex;
    track.scrollTo({ left, behavior: reducedMotion() ? 'instant' : 'smooth' });
  }, [activeIndex]);

  // Scrolls only the tab bar: scrollIntoView would also scroll the page vertically.
  const activeTabId = tabs[activeIndex]?.id ?? '';
  useEffect(() => {
    const bar = barRef.current;
    const tab = tabRefs.current.get(activeTabId);
    if (!bar || !tab) return;
    const b = bar.getBoundingClientRect();
    const t = tab.getBoundingClientRect();
    if (t.left < b.left) bar.scrollLeft += t.left - b.left;
    else if (t.right > b.right) bar.scrollLeft += t.right - b.right;
  }, [activeTabId]);

  function handleScroll() {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    if (programmaticIndex.current !== null) {
      if (index === programmaticIndex.current) programmaticIndex.current = null;
      return;
    }
    const tab = tabs[index];
    if (tab && tab.id !== activeId) onChange(tab.id);
  }

  function handleKeyDown(event: KeyboardEvent) {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = tabs[(activeIndex + delta + tabs.length) % tabs.length];
    if (next) {
      onChange(next.id);
      tabRefs.current.get(next.id)?.focus();
    }
  }

  return (
    <div className={styles.root}>
      <div
        ref={barRef}
        className={styles.tabBar}
        role="tablist"
        aria-label={label}
        onKeyDown={handleKeyDown}
      >
        {tabs.map((tab, index) => {
          const selected = index === activeIndex;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                if (el) tabRefs.current.set(tab.id, el);
                else tabRefs.current.delete(tab.id);
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              className={styles.tab}
              onClick={() => onChange(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div ref={trackRef} className={styles.track} onScroll={handleScroll}>
        {tabs.map((tab, index) => (
          <section
            key={tab.id}
            role="tabpanel"
            id={`${baseId}-panel-${tab.id}`}
            aria-labelledby={`${baseId}-tab-${tab.id}`}
            aria-hidden={index !== activeIndex}
            inert={index !== activeIndex}
            className={styles.panel}
          >
            {/* Only the active tab and its neighbours, which a swipe reveals, are rendered:
                every tab re-rendering on each change is slow on a phone. */}
            {Math.abs(index - activeIndex) <= 1 ? tab.content : null}
          </section>
        ))}
      </div>
    </div>
  );
}
