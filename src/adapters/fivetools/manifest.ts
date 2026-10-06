// Which 5etools files to read and which record types to keep (plan §6.1 step 3, checked
// against 5etools 2.36.1). Records are dispatched by their top-level key, not by file name.

import type { SourceGroup } from '../../schema/index.ts';
import type { FileSource } from './fs/types.ts';
import { isObject, type RawEntity, type RawObject } from './raw.ts';
import type { ReportBuilder } from './report.ts';

/** Files read from the data root, besides those listed by the index files. */
export const ROOT_FILES = [
  'backgrounds.json',
  'feats.json',
  'races.json',
  'items-base.json',
  'items.json',
  'magicvariants.json',
  'optionalfeatures.json',
  'conditionsdiseases.json',
  'variantrules.json',
  'actions.json',
  'senses.json',
  'skills.json',
  'languages.json',
];

/** Folders with an `index.json` mapping keys to file names. */
export const INDEXED_FOLDERS = ['class', 'spells'];

export const SPELL_LOOKUP_FILE = 'generated/gendata-spell-source-lookup.json';
export const SPELL_SOURCES_FALLBACK = 'spells/sources.json';
export const BOOK_FILES = ['books.json', 'adventures.json'];

/** 5etools record types the importer converts. */
export const IMPORTED_PROPS = [
  'class',
  'subclass',
  'classFeature',
  'subclassFeature',
  'spell',
  'background',
  'feat',
  'race',
  'subrace',
  'optionalfeature',
  'baseitem',
  'item',
  'magicvariant',
  'itemProperty',
  'itemMastery',
  // Not entities: shared item text, merged into items before conversion.
  'itemEntry',
  'itemTypeAdditionalEntries',
  'condition',
  'disease',
  'status',
  'variantrule',
  'action',
  'sense',
  'skill',
  'language',
] as const;

export type ImportedProp = (typeof IMPORTED_PROPS)[number];

const IMPORTED = new Set<string>(IMPORTED_PROPS);

export type RecordsByProp = Record<ImportedProp, RawEntity[]>;

export interface SourceMeta {
  name: string;
  /** ISO date, e.g. `2024-09-17`. */
  published?: string;
  group: SourceGroup;
}

export interface SpellLookup {
  /** `gendata`: generated lookup with subclasses; `sources`: older class-only file. */
  format: 'gendata' | 'sources';
  data: RawObject;
}

export interface ManifestData {
  records: RecordsByProp;
  /** Raw spell → class lookup, or null if missing (see spellLists.ts for both formats). */
  spellLookup: SpellLookup | null;
  sources: Map<string, SourceMeta>;
  dataVersion?: string;
}

export function emptyRecords(): RecordsByProp {
  return Object.fromEntries(IMPORTED_PROPS.map((p) => [p, []])) as unknown as RecordsByProp;
}

async function readJson(
  fs: FileSource,
  path: string,
  report: ReportBuilder,
  required: boolean,
): Promise<RawObject | null> {
  const text = await fs.readText(path);
  if (text === null) {
    if (required) report.warn('fileMissing', `Missing file: ${path}`);
    return null;
  }
  report.report.filesRead++;
  try {
    const json: unknown = JSON.parse(text);
    if (isObject(json)) return json;
  } catch {
    // Reported below.
  }
  report.warn('fileInvalid', `Not a JSON object: ${path}`);
  return null;
}

/** The file names listed by `<folder>/index.json`. */
async function indexedFiles(fs: FileSource, root: string, folder: string, report: ReportBuilder) {
  const index = await readJson(fs, `${root}${folder}/index.json`, report, true);
  if (!index) return [];
  return Object.values(index)
    .filter((v): v is string => typeof v === 'string')
    .map((file) => `${folder}/${file}`);
}

function collect(json: RawObject, records: RecordsByProp, report: ReportBuilder): void {
  for (const [prop, value] of Object.entries(json)) {
    if (prop.startsWith('_') || !Array.isArray(value)) continue;
    if (IMPORTED.has(prop)) {
      const list = records[prop as ImportedProp];
      for (const rec of value) if (isObject(rec)) list.push(rec as RawEntity);
    } else {
      report.ignore(prop, value.length);
    }
  }
}

function collectSources(
  json: RawObject | null,
  into: Map<string, SourceMeta>,
  isAdventure: boolean,
): void {
  for (const list of Object.values(json ?? {})) {
    if (!Array.isArray(list)) continue;
    for (const book of list) {
      if (!isObject(book)) continue;
      const code = typeof book.source === 'string' ? book.source : book.id;
      if (typeof code !== 'string' || typeof book.name !== 'string') continue;
      const group: SourceGroup = isAdventure
        ? 'adventure'
        : book.group === 'core'
          ? 'core'
          : 'supplement';
      const meta: SourceMeta = { name: book.name, group };
      if (typeof book.published === 'string') meta.published = book.published;
      into.set(code, meta);
    }
  }
}

export async function readManifest(
  fs: FileSource,
  root: string,
  report: ReportBuilder,
): Promise<ManifestData> {
  const records = emptyRecords();
  const files = [...ROOT_FILES];
  for (const folder of INDEXED_FOLDERS)
    files.push(...(await indexedFiles(fs, root, folder, report)));

  for (const file of files) {
    const json = await readJson(fs, root + file, report, true);
    if (json) collect(json, records, report);
  }

  const gendata = await readJson(fs, root + SPELL_LOOKUP_FILE, report, false);
  const fallback = gendata ? null : await readJson(fs, root + SPELL_SOURCES_FALLBACK, report, true);
  const spellLookup: SpellLookup | null = gendata
    ? { format: 'gendata', data: gendata }
    : fallback
      ? { format: 'sources', data: fallback }
      : null;

  const sources = new Map<string, SourceMeta>();
  for (const file of BOOK_FILES) {
    collectSources(
      await readJson(fs, root + file, report, false),
      sources,
      file === 'adventures.json',
    );
  }

  const data: ManifestData = { records, spellLookup, sources };
  if (root.endsWith('data/')) {
    const pkgText = await fs.readText(`${root.slice(0, -'data/'.length)}package.json`);
    try {
      const pkg: unknown = pkgText ? JSON.parse(pkgText) : null;
      if (isObject(pkg) && typeof pkg.version === 'string') data.dataVersion = pkg.version;
    } catch {
      // No version; not important.
    }
  }
  return data;
}
