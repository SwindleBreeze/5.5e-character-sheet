// The content a picker can offer: available entities by kind, already filtered by the
// character's sources (plan §6.7). Pickers, the wizard and automatic picks read this.

import type { ContentEntity, EntityByKind, EntityKind, SourceCode } from '../../schema/index.ts';
import { availableOf } from '../../sources/sourceFilter.ts';

export interface Catalog {
  of<K extends EntityKind>(kind: K): readonly EntityByKind[K][];
}

export function createCatalog(
  entities: Iterable<ContentEntity>,
  enabled: ReadonlySet<SourceCode>,
): Catalog {
  const byKind = new Map<EntityKind, ContentEntity[]>();
  for (const e of entities) {
    const list = byKind.get(e.kind) ?? [];
    list.push(e);
    byKind.set(e.kind, list);
  }
  const available = new Map<EntityKind, ContentEntity[]>();
  return {
    of<K extends EntityKind>(kind: K) {
      let list = available.get(kind);
      if (!list) {
        list = availableOf(byKind.get(kind) ?? [], enabled).sort(
          (a, b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source),
        );
        available.set(kind, list);
      }
      return list as EntityByKind[K][];
    },
  };
}
