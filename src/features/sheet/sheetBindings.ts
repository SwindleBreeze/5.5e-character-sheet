// What every sheet tab gets: the character, its derived sheet, the content it uses, and the
// way to change it. The Main tab and the design gallery both render from this.

import type { ContentIndex } from '../../engine/content/contentIndex.ts';
import type { DerivedSheet } from '../../engine/derive/types.ts';
import type { Character, EntityKind, Id } from '../../schema/index.ts';
import type { CharacterUpdate } from './useCharacterActions.ts';
import { titleCase } from './components/format.ts';

export interface SheetBindings {
  character: Character;
  sheet: DerivedSheet;
  index: ContentIndex;
  apply: (update: CharacterUpdate) => void;
}

/** A content name for display, from the index, else readable from the id. */
export function nameOf(index: ContentIndex, kind: EntityKind, id: Id): string {
  const name = index.get({ kind, id })?.name;
  if (name) return name;
  // `condition/prone|xphb` → `Prone`, `buckler|tst` → `Buckler`
  return titleCase((id.split('|')[0] ?? id).split('/').pop() ?? id);
}

/** `Brute 5 (Spark) / Lorekeeper 2`. */
export function classSummary(sheet: DerivedSheet): string {
  return sheet.classes
    .map((c) => `${c.name} ${c.level}${c.subclassName ? ` (${c.subclassName})` : ''}`)
    .join(' / ');
}
