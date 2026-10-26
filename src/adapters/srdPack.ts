// The free rules the app ships (plan 9.3–9.4), stored like any pack with one difference: SRD
// entries share their ids with their twins in the 2024 books, so an entry a book already holds
// stays the book's. Importing a book later replaces the SRD entries it covers the same way, and
// characters keep working either way, since they refer to entries by id.

import { SRD_SOURCE } from '../content/srd.ts';
import type { ContentRepo } from '../db/contentRepo.ts';
import type { SettingsRepo } from '../db/settingsRepo.ts';
import {
  ENTITY_KINDS,
  refKey,
  type ContentEntity,
  type EntitiesByKind,
  type SourceInfo,
} from '../schema/index.ts';
import { readPack } from './pack/packFile.ts';

/** Where the pack is served, under the app's base path. */
export const SRD_PACK_PATH = 'srd/srd52.pack.json.gz';

export async function storeSrdPack(
  bytes: Uint8Array,
  deps: { content: ContentRepo; settings: SettingsRepo },
  importedAt: number,
): Promise<SourceInfo> {
  const { pack } = await readPack(bytes);
  const source = pack.sources.find((s) => s.code === SRD_SOURCE);
  if (!source) throw new Error('The free rules pack is damaged.');

  const entities: EntitiesByKind = {};
  const counts: SourceInfo['counts'] = {};
  for (const kind of ENTITY_KINDS) {
    const list = (pack.entities[kind] ?? []) as ContentEntity[];
    if (!list.length) continue;
    const held = await deps.content.getMany(list.map((e) => ({ kind, id: e.id })));
    const free = list.filter((e) => {
      const other = held.get(refKey({ kind, id: e.id }));
      return !other || other.source === SRD_SOURCE;
    });
    (entities as Record<string, ContentEntity[]>)[kind] = free;
    if (free.length) counts[kind] = free.length;
  }

  const info: SourceInfo = { ...source, counts, origin: 'pack', importedAt };
  await deps.content.replaceSources([info], entities);
  const enabled = await deps.settings.get('enabledSources');
  if (!enabled.includes(SRD_SOURCE)) {
    await deps.settings.set('enabledSources', [...enabled, SRD_SOURCE].sort());
  }
  return info;
}
