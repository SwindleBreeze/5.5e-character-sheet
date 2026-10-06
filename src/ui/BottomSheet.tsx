import { useMemo, useState, type ReactNode } from 'react';
import { Drawer } from 'vaul';
import styles from './BottomSheet.module.css';
import { SheetContext, type SheetApi, type SheetPage } from './sheetContext.ts';

/** Deep enough for rule → linked rule chains, small enough to keep "back" meaningful. */
const MAX_DEPTH = 12;

/**
 * App-wide bottom sheet for rules text and quick details. One sheet at a time: a tap inside it
 * replaces the content and adds a back button, rather than stacking sheets (plan §6.4).
 */
export function SheetProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<SheetPage[]>([]);

  const api = useMemo<SheetApi>(
    () => ({
      open: (page) => setStack([page]),
      push: (page) =>
        setStack((current) => {
          if (current.at(-1)?.key === page.key) return current;
          return [...current, page].slice(-MAX_DEPTH);
        }),
      back: () => setStack((current) => current.slice(0, -1)),
      close: () => setStack([]),
    }),
    [],
  );

  const top = stack.at(-1);

  return (
    <SheetContext.Provider value={api}>
      {children}
      <Drawer.Root open={stack.length > 0} onOpenChange={(open) => !open && api.close()}>
        <Drawer.Portal>
          <Drawer.Overlay className={styles.overlay} />
          <Drawer.Content className={styles.content} aria-describedby={undefined}>
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
            <div className={styles.body}>{top?.render()}</div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </SheetContext.Provider>
  );
}
