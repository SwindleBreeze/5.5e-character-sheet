// React hooks over imported content and source settings. Live: they update when an import or a
// settings change lands, including writes made by the import worker.

import { useLiveQuery } from 'dexie-react-hooks';
import { DEFAULT_SETTINGS } from '../db/settingsRepo.ts';
import { repos } from '../db/repos.ts';
import type { EntityByKind, EntityKind, Ref, SourceCode, SourceInfo } from '../schema/index.ts';

/** `undefined` while loading, `null` when the entity is not imported. */
export function useEntity<K extends EntityKind>(
  ref: { kind: K; id: string } | Ref,
): EntityByKind[K] | null | undefined {
  return useLiveQuery(
    async () => ((await repos().content.get(ref.kind, ref.id)) ?? null) as EntityByKind[K] | null,
    [ref.kind, ref.id],
  );
}

export function useEntitiesOfKind<K extends EntityKind>(kind: K): EntityByKind[K][] | undefined {
  return useLiveQuery(() => repos().content.listByKind(kind), [kind]);
}

export function useSources(): SourceInfo[] | undefined {
  return useLiveQuery(() => repos().content.listSources(), []);
}

export function useEnabledSources(): SourceCode[] {
  return (
    useLiveQuery(() => repos().settings.get('enabledSources'), []) ??
    DEFAULT_SETTINGS.enabledSources
  );
}
