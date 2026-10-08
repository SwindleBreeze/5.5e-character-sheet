import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Drawer } from 'vaul';
import styles from './BottomSheet.module.css';
import { SheetContext, type SheetApi, type SheetPage } from './sheetContext.ts';

/** Deep enough for rule → linked rule chains, small enough to keep "back" meaningful. */
const MAX_DEPTH = 12;

/** A field that brings up the on-screen keyboard. */
function typing(): boolean {
  const el = document.activeElement;
  if (el instanceof HTMLTextAreaElement) return true;
  if (!(el instanceof HTMLInputElement)) return false;
  return !['checkbox', 'radio', 'button', 'submit', 'range', 'color', 'file'].includes(el.type);
}

/**
 * App-wide bottom sheet for rules text and quick details. One sheet at a time: a tap inside it
 * replaces the content and adds a back button, rather than stacking sheets (plan §6.4).
 */
export function SheetProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<SheetPage[]>([]);
  // vaul keeps the sheet on its own compositor layer (`will-change: transform`), which renders
  // its text as a texture: soft, and blurred when centring puts it on a half pixel. Once the
  // sheet has slid in, it is let go of that layer until it moves again.
  const [settled, setSettled] = useState(false);

  const api = useMemo<SheetApi>(
    () => ({
      open: (page) => setStack([page]),
      push: (page) =>
        setStack((current) => {
          if (current.at(-1)?.key === page.key) return current;
          return [...current, page].slice(-MAX_DEPTH);
        }),
      back: () => setStack((current) => current.slice(0, -1)),
      close: () => {
        setSettled(false);
        setStack([]);
      },
    }),
    [],
  );

  const top = stack.at(-1);
  const open = stack.length > 0;

  // While the on-screen keyboard is up, vaul gives the sheet a fixed height to keep the field
  // in view, and keeps that height afterwards: a search that listed many results left the
  // sheet tall once they were gone. When no field has focus, the sheet fits its content again.
  const contentRef = useRef<HTMLDivElement>(null);
  const [inner, setInner] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!inner || typeof ResizeObserver === 'undefined') return;
    const release = () => {
      if (contentRef.current && !typing()) contentRef.current.style.height = '';
    };
    const observer = new ResizeObserver(release);
    observer.observe(inner);
    window.visualViewport?.addEventListener('resize', release);
    return () => {
      observer.disconnect();
      window.visualViewport?.removeEventListener('resize', release);
    };
  }, [inner]);

  return (
    <SheetContext.Provider value={api}>
      {children}
      <Drawer.Root open={open} onOpenChange={(next) => !next && api.close()}>
        <Drawer.Portal>
          <Drawer.Overlay className={styles.overlay} />
          <Drawer.Content
            ref={contentRef}
            className={styles.content}
            aria-describedby={undefined}
            data-settled={settled}
            onAnimationEnd={(e) => {
              if (e.target === e.currentTarget && open) setSettled(true);
            }}
            // A roll's toast sits above the sheet: tapping it (to dismiss it) is not a tap
            // outside, so a sheet waiting on that roll (a Concentration save) stays open. Each
            // toast carries the mark: by the time this runs it may be gone from the page.
            onInteractOutside={(e) => {
              if (e.target instanceof Element && e.target.closest('[data-roller]'))
                e.preventDefault();
            }}
          >
            <div className={styles.handle} aria-hidden="true" />
            <header className={styles.header}>
              {stack.length > 1 ? (
                <button type="button" className={styles.iconButton} onClick={api.back}>
                  <span aria-hidden="true">‹</span> Back
                </button>
              ) : (
                <span className={styles.spacer} />
              )}
              <Drawer.Title className={styles.title}>{top?.title ?? ''}</Drawer.Title>
              <button
                type="button"
                className={styles.iconButton}
                aria-label="Close"
                onClick={api.close}
              >
                <span aria-hidden="true">✕</span>
              </button>
            </header>
            <div className={styles.body}>
              <div ref={setInner}>{top?.render()}</div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </SheetContext.Provider>
  );
}
