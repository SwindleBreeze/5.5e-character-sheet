// The content a character uses, loaded once and read synchronously by the engine (plan §9.2,
// step 3.1). The engine never touches the database; `src/content/loadIndex.ts` fills this.

import {
  refKey,
  type ContentEntity,
  type EntityByKind,
  type EntityKind,
  type Id,
  type Ref,
  type RefKey,
} from '../../schema/index.ts';

export interface ContentIndex {
  get<K extends EntityKind>(ref: { kind: K; id: Id }): EntityByKind[K] | undefined;
  /** Every loaded entity. */
  all(): readonly ContentEntity[];
}

export function createContentIndex(entities: Iterable<ContentEntity>): ContentIndex {
  const byKey = new Map<RefKey, ContentEntity>();
  for (const e of entities) byKey.set(refKey({ kind: e.kind, id: e.id }), e);
  const list = [...byKey.values()];
  return {
    get<K extends EntityKind>(ref: { kind: K; id: Id }) {
      return byKey.get(refKey(ref)) as EntityByKind[K] | undefined;
    },
    all: () => list,
  };
}

export const EMPTY_INDEX: ContentIndex = createContentIndex([]);

/** A stable string for a set of refs, to tell when the set changed. */
export function refsKey(refs: readonly Ref[]): string {
  return [...new Set(refs.map(refKey))].sort().join('\n');
}
