// Make a pack from what is in the database: all sources by default, or the chosen ones (the
// homebrew group shares its sources this way). `fileName` is the start of the file's name.

import type { ContentRepo } from '../../db/contentRepo.ts';
import { ENTITY_KINDS, type EntitiesByKind, type SourceCode } from '../../schema/index.ts';
import { ADAPTER_VERSION } from '../version.ts';
import { buildPack, encodePack, packFileName } from './packFile.ts';

export async function exportPack(
  content: ContentRepo,
  opts: { sources?: SourceCode[]; now?: number; fileName?: string } = {},
): Promise<{ bytes: Uint8Array; fileName: string; entityCount: number }> {
  const now = opts.now ?? Date.now();
  const keep = opts.sources ? new Set(opts.sources) : null;
  const sources = (await content.listSources()).filter((s) => !keep || keep.has(s.code));
  const codes = new Set(sources.map((s) => s.code));

  const entities: EntitiesByKind = {};
  let entityCount = 0;
  for (const kind of ENTITY_KINDS) {
    const list = (await content.listByKind(kind)).filter((e) => codes.has(e.source));
    if (list.length) {
      (entities as Record<string, unknown[]>)[kind] = list;
      entityCount += list.length;
    }
  }
  const bytes = await encodePack(buildPack(entities, sources, ADAPTER_VERSION, now));
  return { bytes, fileName: packFileName(now, opts.fileName), entityCount };
}
