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

/** Player extras (plan §6.12). Optional: older 5etools versions lack some of them. */
export const OPTIONAL_ROOT_FILES = [
  'deities.json',
  'rewards.json',
  'bastions.json',
  'charcreationoptions.json',
];

/** Flavor text (plan §9.3b, step 4B.1). Optional, so data without it still imports. */
export const FLUFF_FILES = ['fluff-races.json', 'fluff-backgrounds.json', 'fluff-feats.json'];

/** Folders with an `index.json` mapping keys to file names. */
export const INDEXED_FOLDERS = ['class', 'spells'];

/** Class flavor text: `class/fluff-index.json` maps classes to their fluff files. */
export const FLUFF_INDEX = 'class/fluff-index.json';

/** Creatures (plan §10.3, step 7.6): `bestiary/index.json` maps sources to files. Optional. */
export const BESTIARY_INDEX = 'bestiary/index.json';

export const SPELL_LOOKUP_FILE = 'generated/gendata-spell-source-lookup.json';
export const SPELL_SOURCES_FALLBACK = 'spells/sources.json';
export const BOOK_FILES = ['books.json', 'adventures.json'];

/** The 2024 Player's Handbook's text, for the alignments' descriptions. Optional. */
export const ALIGNMENT_BOOK = 'book/book-xphb.json';

const ALIGNMENT_HEADING =
  /^((?:Lawful|Neutral|Chaotic) (?:Good|Neutral|Evil)|Neutral) \((LG|NG|CG|LN|N|CN|LE|NE|CE)\)$/;

/**
 * The alignments as records: the sections of the book headed `Lawful Good (LG)` and so on, each
 * with its own text.
 */
export function alignmentRecords(book: RawObject): RawEntity[] {
  const out: RawEntity[] = [];
  const visit = (v: unknown): void => {
    if (Array.isArray(v)) return v.forEach(visit);
    if (!isObject(v)) return;
    const m = typeof v.name === 'string' ? ALIGNMENT_HEADING.exec(v.name) : null;
    if (m && Array.isArray(v.entries)) {
      if (!out.some((r) => r.name === m[1]))
        out.push({
          name: m[1],
          source: 'XPHB',
          ...(typeof v.page === 'number' ? { page: v.page } : {}),
          abbreviation: m[2],
          entries: v.entries,
        } as RawEntity);
      return;
    }
    Object.values(v).forEach(visit);
  };
  visit(book.data);
  return out;
}

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
  'itemGroup',
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
  // Not a 5etools record type: the alignments, read from the 2024 Player's Handbook text.
  'alignment',
  'deity',
  'reward',
  'facility',
  'charoption',
  // Only the creatures player options summon or name, and Beasts, are kept (index.ts).
  'monster',
  // Not entities: flavor text, attached to the entities it describes (plan §9.3b).
  'classFluff',
  'subclassFluff',
  'raceFluff',
  'backgroundFluff',
  'featFluff',
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
async function indexedFiles(
  fs: FileSource,
  root: string,
  folder: string,
  report: ReportBuilder,
  indexFile = `${folder}/index.json`,
  required = true,
) {
  const index = await readJson(fs, `${root}${indexFile}`, report, required);
  if (!index) return [];
  return Object.values(index)
    .filter((v): v is string => typeof v === 'string')
    .map((file) => `${folder}/${file}`);
}

/** Add the record arrays of one file to `records`; other arrays are counted as ignored. */
export function collect(json: RawObject, records: RecordsByProp, report: ReportBuilder): void {
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
  const fluff = [
    ...FLUFF_FILES,
    ...(await indexedFiles(fs, root, 'class', report, FLUFF_INDEX, false)),
  ];
  const bestiary = await indexedFiles(fs, root, 'bestiary', report, BESTIARY_INDEX, false);
  for (const file of [...OPTIONAL_ROOT_FILES, ...fluff, ...bestiary]) {
    const json = await readJson(fs, root + file, report, false);
    if (json) collect(json, records, report);
  }

  const book = await readJson(fs, root + ALIGNMENT_BOOK, report, false);
  if (book) records.alignment.push(...alignmentRecords(book));

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
