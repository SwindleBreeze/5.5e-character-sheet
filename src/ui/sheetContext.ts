import { createContext, useContext, type ReactNode } from 'react';

export interface SheetPage {
  /** Stable identity, e.g. a ref key; reopening the same key does not stack. */
  key: string;
  title: string;
  render: () => ReactNode;
}

export interface SheetApi {
  /** Open the sheet with a single page, replacing anything shown. */
  open: (page: SheetPage) => void;
  /** Show a page inside the open sheet, with a back button to the previous one. */
  push: (page: SheetPage) => void;
  back: () => void;
  close: () => void;
}

export const SheetContext = createContext<SheetApi | null>(null);

export function useSheet(): SheetApi {
  const api = useContext(SheetContext);
  if (!api) throw new Error('useSheet must be used inside <SheetProvider>');
  return api;
}
