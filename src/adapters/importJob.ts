// One import, start to finish: read the input (5etools folder/zip or a pack), convert, and write
// to the database in one transaction with replace-by-source semantics (plan §6.2). Runs inside
// the import worker in the app, and directly in tests.

import type { ContentRepo } from '../db/contentRepo.ts';
import type { SettingsRepo } from '../db/settingsRepo.ts';
import { ENTITY_KINDS, type EntitiesByKind, type SourceInfo } from '../schema/index.ts';
import { dirHandleSource } from './fivetools/fs/dirHandle.ts';
import { fileListSource } from './fivetools/fs/fileList.ts';
import type { FileSource } from './fivetools/fs/types.ts';
import { zipFileSource } from './fivetools/fs/zip.ts';
import { importFivetools, type ImportStage } from './fivetools/index.ts';
import type { ImportReport } from './fivetools/report.ts';
import { readPack } from './pack/packFile.ts';

export type FivetoolsInput =
  | { type: 'files'; files: File[] }
  | { type: 'directory'; handle: FileSystemDirectoryHandle }
  | { type: 'zip'; file: Blob };

export type ImportJob =
  | { kind: 'fivetools'; input: FivetoolsInput; onlySources?: string[] }
  | { kind: 'pack'; file: Blob };

export type JobStage = ImportStage | 'unpack' | 'write';

export interface ImportSummary {
  origin: '5etools' | 'pack';
  sources: SourceInfo[];
  report: ImportReport;
  finishedAt: number;
}

async function fileSourceFor(input: FivetoolsInput): Promise<FileSource> {
  switch (input.type) {
    case 'files':
      return fileListSource(input.files);
    case 'directory':
      return dirHandleSource(input.handle);
    case 'zip':
      return zipFileSource(await input.file.arrayBuffer());
  }
}

/** What a pack import actually stored per source, so the registry never claims skipped kinds. */
function sourceCounts(entities: EntitiesByKind, code: string): SourceInfo['counts'] {
  const out: SourceInfo['counts'] = {};
  for (const kind of ENTITY_KINDS) {
    const n = (entities[kind] ?? []).filter((e) => e.source === code).length;
    if (n) out[kind] = n;
  }
  return out;
}

function counts(entities: EntitiesByKind): ImportReport['counts'] {
  const out: ImportReport['counts'] = {};
  for (const kind of ENTITY_KINDS) {
    const n = entities[kind]?.length ?? 0;
    if (n) out[kind] = n;
  }
  return out;
}

export async function runImportJob(
  job: ImportJob,
  deps: { content: ContentRepo; settings: SettingsRepo; now?: () => number },
  onProgress: (stage: JobStage) => void = () => {},
): Promise<ImportSummary> {
  const now = deps.now ?? Date.now;
  let entities: EntitiesByKind;
  let sources: SourceInfo[];
  let report: ImportReport;

  if (job.kind === 'fivetools') {
    const fs = await fileSourceFor(job.input);
    const result = await importFivetools(fs, {
      now: now(),
      onProgress,
      ...(job.onlySources ? { onlySources: job.onlySources } : {}),
    });
    ({ entities, sources, report } = result);
  } else {
    onProgress('unpack');
    const { pack, skippedKinds } = await readPack(new Uint8Array(await job.file.arrayBuffer()));
    const importedAt = now();
    entities = pack.entities;
    sources = pack.sources.map((s) => ({
      ...s,
      counts: sourceCounts(entities, s.code),
      origin: 'pack',
      importedAt,
    }));
    report = { filesRead: 1, counts: counts(entities), ignored: {}, warnings: [] };
    for (const [kind, n] of Object.entries(skippedKinds)) {
      report.warnings.push({
        code: 'kindUnknown',
        message: `Skipped ${n} ${kind} entries: this pack was made by a newer version of the app. Update the app, then import the pack again to get them.`,
      });
    }
  }

  onProgress('write');
  await deps.content.replaceSources(sources, entities);

  const summary: ImportSummary = {
    origin: job.kind === 'pack' ? 'pack' : '5etools',
    sources,
    report,
    finishedAt: now(),
  };
  await deps.settings.set('lastImport', summary);
  return summary;
}
