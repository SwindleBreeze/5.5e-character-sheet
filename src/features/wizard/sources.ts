// Content split by the book it comes from (plan §9.3b, step 4B.6): the core rulebooks first
// (the newest first, so the 2024 Player's Handbook leads), then each other book by name. Lets a
// list keep the Player's Handbook choices apart from those of supplements.

import type { SourceCode, SourceInfo } from '../../schema/index.ts';

export interface SourceGroup<T> {
  code: SourceCode;
  /** The book's name, or its code when it isn't registered. */
  label: string;
  core: boolean;
  items: T[];
}

export function groupBySource<T extends { source: SourceCode; name: string }>(
  items: readonly T[],
  sources: readonly SourceInfo[] | undefined,
): SourceGroup<T>[] {
  const info = new Map((sources ?? []).map((s) => [s.code, s]));
  const groups = new Map<SourceCode, SourceGroup<T>>();
  for (const item of items) {
    let g = groups.get(item.source);
    if (!g) {
      const s = info.get(item.source);
      g = {
        code: item.source,
        label: s?.name ?? item.source,
        core: s?.group === 'core',
        items: [],
      };
      groups.set(item.source, g);
    }
    g.items.push(item);
  }
  const published = (code: SourceCode) => info.get(code)?.published ?? '';
  return [...groups.values()]
    .map((g) => ({ ...g, items: [...g.items].sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => {
      if (a.core !== b.core) return a.core ? -1 : 1;
      if (a.core) return published(b.code).localeCompare(published(a.code));
      return a.label.localeCompare(b.label);
    });
}
