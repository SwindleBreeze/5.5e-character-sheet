// The sheet as it is now, for pages shown in the bottom sheet (plan §9.3, step 4.3). A bottom
// sheet's page is drawn by the sheet provider from what was on screen when it opened; a page that
// must follow changes (a pick whose new choices open below it) reads the bindings the sheet's
// tabs publish here instead, by character id.

import { useLayoutEffect, useSyncExternalStore } from 'react';
import type { SheetBindings } from './sheetBindings.ts';

interface Store {
  value: SheetBindings;
  listeners: Set<() => void>;
}

const stores = new Map<string, Store>();

function storeFor(id: string, value: SheetBindings): Store {
  let store = stores.get(id);
  if (!store) {
    store = { value, listeners: new Set() };
    stores.set(id, store);
  }
  return store;
}

/** Publish the bindings a tab renders with, whenever they change. */
export function usePublishBindings(bindings: SheetBindings): void {
  const { character, sheet, index, apply } = bindings;
  useLayoutEffect(() => {
    const store = storeFor(character.id, { character, sheet, index, apply });
    const v = store.value;
    if (v.character === character && v.sheet === sheet && v.index === index && v.apply === apply)
      return;
    store.value = { character, sheet, index, apply };
    for (const listener of store.listeners) listener();
  }, [character, sheet, index, apply]);
}

/** The latest published bindings of this character; `opened` until a tab publishes. */
export function useLiveBindings(opened: SheetBindings): SheetBindings {
  const id = opened.character.id;
  return useSyncExternalStore(
    (listener) => {
      const store = storeFor(id, opened);
      store.listeners.add(listener);
      return () => store.listeners.delete(listener);
    },
    () => stores.get(id)?.value ?? opened,
  );
}
