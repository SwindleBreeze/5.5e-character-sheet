// Looking up a ref for a character: loaded content first, then the character's snapshot, so a
// character keeps working when its content is missing (plan §4.4, `ownerMissing`).

import {
  refKey,
  type Character,
  type ContentEntity,
  type Ref,
  type Snapshot,
} from '../../schema/index.ts';
import type { ContentIndex } from './contentIndex.ts';

export type Resolved =
  | { status: 'loaded'; entity: ContentEntity }
  | { status: 'snapshot'; snapshot: Snapshot }
  | { status: 'missing' };

export function resolveRef(
  index: ContentIndex,
  snapshots: Character['snapshots'],
  ref: Ref,
): Resolved {
  const entity = index.get(ref);
  if (entity) return { status: 'loaded', entity };
  const snapshot = snapshots[refKey(ref)];
  return snapshot ? { status: 'snapshot', snapshot } : { status: 'missing' };
}

/** Name to show for a ref: the content's, the snapshot's, or the id. */
export function refName(index: ContentIndex, snapshots: Character['snapshots'], ref: Ref): string {
  const r = resolveRef(index, snapshots, ref);
  if (r.status === 'loaded') return r.entity.name;
  if (r.status === 'snapshot') return r.snapshot.name;
  return ref.id;
}
