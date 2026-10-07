// Flavor text (plan §9.3b, step 4B.1): 5etools keeps what a class, species or background is
// like apart from its rules, in fluff records. They are matched to the converted entities by
// the same identity as their records (`_copy` already resolved), images dropped, and stored as
// `fluff`. A lineage or ancestry without its own takes its species'.

import type { ContentEntity, EntitiesByKind, EntityKind } from '../../schema/index.ts';
import { normalizeEntries } from './entries.ts';
import { identityKey } from './uid.ts';
import type { RawEntity } from './raw.ts';

const FLUFF_OF: Partial<Record<EntityKind, { prop: string; record: string }>> = {
  class: { prop: 'classFluff', record: 'class' },
  subclass: { prop: 'subclassFluff', record: 'subclass' },
  species: { prop: 'raceFluff', record: 'race' },
  background: { prop: 'backgroundFluff', record: 'background' },
  feat: { prop: 'featFluff', record: 'feat' },
};

/** The identity of an entity as its record had it: `name|source`, or a subclass's parts. */
function entityKey(e: ContentEntity): string {
  // Ids are already lowercased `name|source` (subclass: `short|class|classSource|source`).
  return e.id;
}

export function attachFluff(
  entities: EntitiesByKind,
  records: Readonly<Record<string, RawEntity[]>>,
): void {
  for (const [kind, { prop }] of Object.entries(FLUFF_OF) as [
    EntityKind,
    { prop: string; record: string },
  ][]) {
    const byKey = new Map<string, RawEntity>();
    for (const f of records[prop] ?? []) {
      const key = identityKey(prop, f);
      if (!byKey.has(key)) byKey.set(key, f);
    }
    const list = (entities[kind] ?? []) as ContentEntity[];
    for (const e of list) {
      const raw = byKey.get(entityKey(e));
      const text = raw ? normalizeEntries(raw.entries) : [];
      if (text.length) e.fluff = text;
    }
    // Lineages and ancestries: their species' text when they have none.
    if (kind === 'species') {
      const byId = new Map(list.map((e) => [e.id, e]));
      for (const e of list) {
        const parent = e.variantOf ? byId.get(e.variantOf) : undefined;
        if (!e.fluff && parent?.fluff) e.fluff = parent.fluff;
      }
    }
  }
}
