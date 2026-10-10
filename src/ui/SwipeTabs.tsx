import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
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

/** The browser says when a scroll has come to rest (`scrollend`); older ones need a timer. */
const HAS_SCROLLEND = typeof window !== 'undefined' && 'onscrollend' in window;
/** Without `scrollend`: a scroll is over when no scroll event came for this long. */
const SETTLE_MS = 150;

/**
 * A tab bar over horizontally swipeable panels (CSS scroll-snap). The active tab is controlled
 * by the parent so it can live in the URL.
 *
 * A swipe changes the tab once it has come to rest, never in the middle: changing it mid-swipe
 * re-rendered the sheet and started a scroll of its own that fought the finger's, so the slide
 * stopped and started again.
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
  // Index we scrolled to programmatically; its end doesn't count as a user swipe.
  const programmaticIndex = useRef<number | null>(null);
  // Index a swipe landed on: the track is already there, so it isn't scrolled again.
  const swipedIndex = useRef<number | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // The latest props, for the scroll handlers.
  const latest = useRef({ tabs, activeId, onChange });
  useLayoutEffect(() => {
    latest.current = { tabs, activeId, onChange };
  });

  useEffect(() => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    if (swipedIndex.current === activeIndex) {
      swipedIndex.current = null;
      return;
    }
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

  // The scroll has come to rest: a swipe that landed on another panel changes the tab.
  function settle() {
    clearTimeout(settleTimer.current);
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    const target = programmaticIndex.current;
    programmaticIndex.current = null;
    // The end of our own scroll to the tab already chosen.
    if (target === index) return;
    const { tabs: list, activeId: active, onChange: change } = latest.current;
    const tab = list[index];
    if (tab && tab.id !== active) {
      swipedIndex.current = index;
      change(tab.id);
    }
  }

  useEffect(() => {
    const track = trackRef.current;
    if (!track || !HAS_SCROLLEND) return;
    track.addEventListener('scrollend', settle);
    return () => track.removeEventListener('scrollend', settle);
  }, []);
  useEffect(() => () => clearTimeout(settleTimer.current), []);

  function handleScroll() {
    if (HAS_SCROLLEND) return;
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(settle, SETTLE_MS);
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
