import { createContext } from 'react';

/** True inside the rule sheet, so links push a page instead of reopening the sheet. */
export const InSheetContext = createContext(false);
