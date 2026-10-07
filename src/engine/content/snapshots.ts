// Snapshots (plan §4.4, step 3.23): a copy of the name, text and effects of every entity a
// character uses, so the character keeps working, and keeps its text, when that content is
// removed or not imported on another device. Refreshed when the sheet opens; pure.

import {
  refKey,
  type Character,
  type ContentEntity,
  type Ref,
  type RefKey,
  type Snapshot,
} from '../../schema/index.ts';
import type { DerivedSheet } from '../derive/types.ts';
import type { ContentIndex } from './contentIndex.ts';
import { valueKind } from './refs.ts';

/**
 * The entities a character uses: its classes, subclasses, species and background, everything
 * whose effects apply, what its picks name, its items and its spells.
 */
export function usedRefs(character: Character, sheet: DerivedSheet): Ref[] {
  const out: Ref[] = [];
  for (const entry of character.log) {
    out.push(entry.classRef);
    if (entry.subclassRef) out.push(entry.subclassRef);
    for (const ref of [entry.origin?.speciesRef, entry.origin?.backgroundRef])
      if (ref) out.push(ref);
    for (const record of entry.choices) {
      out.push(record.key.owner);
      record.values.forEach((id, i) => {
        const kind = valueKind(record.valueKinds, i);
        if (kind) out.push({ kind, id });
      });
    }
  }
  for (const row of character.inventory) {
    if (row.itemRef) out.push(row.itemRef);
    if (row.variantRef) out.push(row.variantRef);
  }
  for (const f of sheet.features) out.push(f.ref);
  const spells = new Set<string>([
    ...Object.values(character.state.prepared).flat(),
    ...sheet.spellcasting.granted.map((g) => g.spellId),
    ...sheet.spellcasting.casters.flatMap((c) => [
      ...c.cantrips,
      ...c.prepared,
      ...c.alwaysPrepared,
      ...(c.spellbook ?? []),
    ]),
  ]);
  for (const id of spells) out.push({ kind: 'spell', id });
  if (character.details.deity?.ref) out.push(character.details.deity.ref);
  return out;
}

function snapshotOf(entity: ContentEntity, now: number): Snapshot {
  const s: Snapshot = {
    ref: { kind: entity.kind, id: entity.id },
    name: entity.name,
    entries: entity.entries,
    effects: entity.effects,
    capturedAt: now,
  };
  if (entity.supersededBy?.length) s.supersededBy = entity.supersededBy;
  return s;
}

/** The same content: the capture time aside. */
function same(a: Snapshot, b: Snapshot): boolean {
  const { capturedAt: _a, ...x } = a;
  const { capturedAt: _b, ...y } = b;
  return JSON.stringify(x) === JSON.stringify(y);
}

/**
 * Snapshots for every entity the character uses: taken fresh from loaded content when it
 * changed, and kept as they are for content that isn't loaded. Those the character no longer
 * uses are dropped, but only while all its content is loaded: with a class missing, its
 * features aren't reached, yet their snapshots are still worth keeping. Returns the same
 * character when nothing changed, so nothing is written.
 */
export function refreshSnapshots(
  character: Character,
  index: ContentIndex,
  sheet: DerivedSheet,
  now = Date.now(),
): Character {
  const next: Record<RefKey, Snapshot> = {};
  let changed = false;
  let complete = true;
  for (const ref of usedRefs(character, sheet)) {
    const key = refKey(ref);
    if (next[key]) continue;
    const old = character.snapshots[key];
    const entity = index.get(ref);
    if (!entity) {
      complete = false;
      if (old) next[key] = old;
      continue;
    }
    const fresh = snapshotOf(entity, now);
    if (old && same(old, fresh)) next[key] = old;
    else {
      next[key] = fresh;
      changed = true;
    }
  }
  const snapshots = complete ? next : { ...character.snapshots, ...next };
  if (!changed && Object.keys(snapshots).length === Object.keys(character.snapshots).length) {
    return character;
  }
  return { ...character, snapshots };
}
