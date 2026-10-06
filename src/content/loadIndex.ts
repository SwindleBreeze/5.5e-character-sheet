// Loads the content a character uses into a ContentIndex (plan §9.2, step 3.1): the refs the
// character holds, then whatever that content leads to, a batch per round, until nothing new
// turns up. Refs that are not imported are simply absent; the engine falls back to the
// character's snapshots for them.

import { createContentIndex, type ContentIndex } from '../engine/content/contentIndex.ts';
import { characterRefs, entityRefs } from '../engine/content/refs.ts';
import {
  refKey,
  type Character,
  type ContentEntity,
  type Ref,
  type RefKey,
} from '../schema/index.ts';

export type GetMany = (refs: Ref[]) => Promise<Map<RefKey, ContentEntity>>;

/** More rounds than any real chain needs (class → feature → granted feat → its spells). */
export const MAX_ROUNDS = 6;

export async function loadContentIndex(
  character: Character,
  getMany: GetMany,
  extraRefs: readonly Ref[] = [],
): Promise<ContentIndex> {
  const loaded = new Map<RefKey, ContentEntity>();
  const asked = new Set<RefKey>();
  let pending: Ref[] = [...characterRefs(character), ...extraRefs];

  for (let round = 0; round < MAX_ROUNDS && pending.length; round++) {
    const batch: Ref[] = [];
    for (const ref of pending) {
      const key = refKey(ref);
      if (asked.has(key)) continue;
      asked.add(key);
      batch.push(ref);
    }
    if (!batch.length) break;
    const found = await getMany(batch);
    pending = [];
    for (const [key, entity] of found) {
      loaded.set(key, entity);
      pending.push(...entityRefs(entity));
    }
  }
  return createContentIndex(loaded.values());
}
