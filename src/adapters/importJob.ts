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
import { importHomebrew, rawHomebrewUrl, type HomebrewFile } from './fivetools/homebrew.ts';
import { ImportError, importFivetools, type ImportStage } from './fivetools/index.ts';
import type { ImportReport } from './fivetools/report.ts';
import { readPack } from './pack/packFile.ts';

export type FivetoolsInput =
  | { type: 'files'; files: File[] }
  | { type: 'directory'; handle: FileSystemDirectoryHandle }
  | { type: 'zip'; file: Blob };

export type ImportJob =
  | { kind: 'fivetools'; input: FivetoolsInput; onlySources?: string[] }
  | { kind: 'pack'; file: Blob }
  /** 5etools-format homebrew: picked files, and URLs to fetch (plan step 7.3). */
  | { kind: 'homebrew'; files?: File[]; urls?: string[] };

export type JobStage = ImportStage | 'unpack' | 'write';

export interface ImportSummary {
  origin: '5etools' | 'pack' | 'homebrew';
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

/** The text of each homebrew file and URL; one that can't be read is reported, not fatal. */
async function homebrewInputs(
  job: Extract<ImportJob, { kind: 'homebrew' }>,
  report: ImportReport['warnings'],
): Promise<HomebrewFile[]> {
  const out: HomebrewFile[] = [];
  for (const file of job.files ?? []) out.push({ name: file.name, text: await file.text() });
  for (const url of job.urls ?? []) {
    const raw = rawHomebrewUrl(url);
    try {
      const res = await fetch(raw);
      if (!res.ok) throw new Error(`the server answered ${res.status}`);
      out.push({ name: url, text: await res.text(), url });
    } catch (err) {
      report.push({
        code: 'fileMissing',
        message: `Could not download ${url}: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }
  if (!out.length) {
    throw new ImportError(report[0]?.message ?? 'Pick a homebrew file or paste a link first.');
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
  } else if (job.kind === 'homebrew') {
    onProgress('read');
    const fetchWarnings: ImportReport['warnings'] = [];
    const files = await homebrewInputs(job, fetchWarnings);
    const existing = await deps.content.listSources();
    onProgress('convert');
    const result = await importHomebrew(files, {
      now: now(),
      lookup: (refs) => deps.content.getMany(refs),
      existing,
    });
    ({ entities, sources, report } = result);
    report.warnings.unshift(...fetchWarnings);
    // Homebrew someone just imported is meant to be used: new sources start switched on.
    const known = new Set(existing.map((s) => s.code));
    const fresh = sources.map((s) => s.code).filter((c) => !known.has(c));
    if (fresh.length) {
      const enabled = await deps.settings.get('enabledSources');
      await deps.settings.set('enabledSources', [...new Set([...enabled, ...fresh])].sort());
    }
  } else {
    onProgress('unpack');
    const { pack, skippedKinds } = await readPack(new Uint8Array(await job.file.arrayBuffer()));
    const importedAt = now();
    entities = pack.entities;
    sources = pack.sources.map((s) => ({
      ...s,
      counts: sourceCounts(entities, s.code),
      // Homebrew stays homebrew, so it keeps its own group and can be removed as one.
      origin: s.origin === 'homebrew' ? 'homebrew' : 'pack',
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
    origin: job.kind === 'fivetools' ? '5etools' : job.kind,
    sources,
    report,
    finishedAt: now(),
  };
  await deps.settings.set('lastImport', summary);
  return summary;
}
