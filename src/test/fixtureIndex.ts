// Every fixture entity in one ContentIndex, for pure engine tests that need no database.

import { importFivetools } from '../adapters/fivetools/index.ts';
import { createContentIndex, type ContentIndex } from '../engine/content/contentIndex.ts';
import type { ContentEntity, EntitiesByKind } from '../schema/index.ts';
import { fixtureSource } from './fivetoolsFixture.ts';

let cached: Promise<{ index: ContentIndex; entities: EntitiesByKind }> | null = null;

export function fixtureContent() {
  cached ??= importFivetools(fixtureSource(), { now: 1 }).then((r) => ({
    entities: r.entities,
    index: createContentIndex(Object.values(r.entities).flat() as ContentEntity[]),
  }));
  return cached;
}

export async function fixtureIndex(): Promise<ContentIndex> {
  return (await fixtureContent()).index;
}
