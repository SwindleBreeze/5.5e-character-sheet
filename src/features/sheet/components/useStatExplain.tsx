// Tapping a number on the sheet: how it adds up, what it is for, and a value of your own.
// Shared by the Main tab and the Combat tab.

import type { ReactNode } from 'react';
import type { Derived, DerivedRoll } from '../../../engine/derive/types.ts';
import { setOverride } from '../../../engine/play/reducers.ts';
import type { OverrideKey } from '../../../schema/index.ts';
import type { SheetBindings } from '../sheetBindings.ts';
import { rollNoteLines } from './format.ts';
import { useExplain } from './useExplain.tsx';

function rollNote(r: DerivedRoll): ReactNode {
  const lines = rollNoteLines(r);
  return lines.length ? lines.map((l) => <p key={l}>{l}</p>) : null;
}

/** Lines of text as paragraphs, skipping the missing ones. */
export const paragraphs = (...lines: (ReactNode | undefined)[]) =>
  lines.filter(Boolean).map((l, i) => <p key={i}>{l}</p>);

export function useStatExplain(apply: SheetBindings['apply']) {
  const explain = useExplain();
  const explainNumber = (
    key: OverrideKey,
    title: string,
    derived: Derived,
    opts: { bonus?: boolean; note?: ReactNode; about?: ReactNode } = {},
  ) =>
    explain({
      key,
      title,
      derived,
      ...opts,
      onOverride: (value) => apply((c) => setOverride(c, key, value)),
    });
  const explainRoll = (key: OverrideKey, title: string, r: DerivedRoll, about?: ReactNode) =>
    explainNumber(key, title, r.bonus, { bonus: true, note: rollNote(r), about });
  return { explainNumber, explainRoll };
}
