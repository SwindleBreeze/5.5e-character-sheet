/** Sheet tabs in their default order (plan §7). */
export const SHEET_TABS = [
  { id: 'main', label: 'Main' },
  { id: 'actions', label: 'Actions' },
  { id: 'spells', label: 'Spells' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'features', label: 'Features' },
  { id: 'extras', label: 'Extras' },
  { id: 'description', label: 'Description' },
  { id: 'notes', label: 'Notes' },
] as const;

export type SheetTabId = (typeof SHEET_TABS)[number]['id'];
