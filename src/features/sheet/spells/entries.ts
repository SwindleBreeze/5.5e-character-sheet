// The spells the Spells tab lists: each caster's cantrips and prepared spells, spells always
// prepared, a Wizard's spellbook (shown apart), and spells from feats, species and items.

import type { ContentIndex } from '../../../engine/content/contentIndex.ts';
import type { DerivedSheet } from '../../../engine/derive/types.ts';
import type { SpellSource } from '../../../engine/play/casting.ts';
import type { Id, Spell } from '../../../schema/index.ts';

export interface SpellEntry {
  /** Unique within the tab. */
  key: string;
  id: Id;
  /** Missing when the spell isn't in the imported content. */
  spell?: Spell;
  from: SpellSource;
  /** The caster or feature it comes from. */
  sourceName: string;
}

export interface SpellLists {
  /** Spells the character can cast: by caster, then granted. */
  ready: SpellEntry[];
  /** Spellbook spells not prepared, by caster key. */
  spellbooks: Record<string, SpellEntry[]>;
}

export function spellLists(sheet: DerivedSheet, index: ContentIndex): SpellLists {
  const spell = (id: Id) => index.get({ kind: 'spell', id });
  const ready: SpellEntry[] = [];
  const spellbooks: Record<string, SpellEntry[]> = {};
  for (const c of sheet.spellcasting.casters) {
    const always = new Set(c.alwaysPrepared);
    const own = [...new Set([...c.cantrips, ...c.prepared])].filter((id) => !always.has(id));
    const entry = (id: Id, status: 'prepared' | 'always' | 'spellbook'): SpellEntry => {
      const e: SpellEntry = {
        key: `${c.key}:${status}:${id}`,
        id,
        from: { caster: { key: c.key, status } },
        sourceName: c.name,
      };
      const s = spell(id);
      if (s) e.spell = s;
      return e;
    };
    ready.push(
      ...own.map((id) => entry(id, 'prepared')),
      ...c.alwaysPrepared.map((id) => entry(id, 'always')),
    );
    if (c.spellbook) {
      const prepared = new Set([...own, ...always]);
      spellbooks[c.key] = c.spellbook
        .filter((id) => !prepared.has(id))
        .map((id) => entry(id, 'spellbook'));
    }
  }
  sheet.spellcasting.granted.forEach((g, i) => {
    const e: SpellEntry = {
      key: `granted:${i}:${g.spellId}`,
      id: g.spellId,
      from: { granted: g },
      sourceName: g.sourceName,
    };
    const s = spell(g.spellId);
    if (s) e.spell = s;
    ready.push(e);
  });
  return { ready, spellbooks };
}

/** Entries by spell level, cantrips first; spells that aren't imported last (level -1). */
export function byLevel(entries: readonly SpellEntry[]): [number, SpellEntry[]][] {
  const groups = new Map<number, SpellEntry[]>();
  for (const e of entries) {
    const level = e.spell?.level ?? -1;
    groups.set(level, [...(groups.get(level) ?? []), e]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a < 0 ? 99 : a) - (b < 0 ? 99 : b))
    .map(([level, list]) => [
      level,
      [...list].sort((x, y) => (x.spell?.name ?? x.id).localeCompare(y.spell?.name ?? y.id)),
    ]);
}
