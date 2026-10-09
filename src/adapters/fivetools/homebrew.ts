// Homebrew in the 5etools format (plan §10.3, steps 7.3 and 7.4). One or more homebrew files
// (each a JSON object with `_meta.sources` and record arrays) go through the same steps as the
// official data: `_copy`, `_versions`, subraces, item text, then the same converters. What is
// different:
//   - sources come from `_meta.sources` (name, abbreviation, authors, version), with origin
//     `homebrew`; the edition from `_meta.edition` or the records;
//   - `_copy` may point at content already on the device (official or other homebrew), which
//     is merged on converted entities (officialCopy.ts);
//   - homebrew is looser, so missing fields and dangling references are reported rather than
//     failing, and a source may not take the code of a source that isn't homebrew.

import {
  ENTITY_KINDS,
  refKey,
  type ContentEntity,
  type ContentOrigin,
  type Edition,
  type EntitiesByKind,
  type EntityKind,
  type HomebrewInfo,
  type Ref,
  type RefKey,
  type SourceInfo,
} from '../../schema/index.ts';
import { ADAPTER_VERSION } from '../version.ts';
import type { ConvertContext } from './convert/common.ts';
import { resolveCopies } from './copy.ts';
import { sourceEditions } from './editions.ts';
import { attachFluff } from './fluff.ts';
import { convertRecords, CONVERTERS, type Converter, type ImportResult } from './index.ts';
import { convertCreature } from './convert/creature.ts';
import { resolveItemEntries } from './itemEntries.ts';
import { collect, emptyRecords, IMPORTED_PROPS } from './manifest.ts';
import { blankRecord, copyTarget, mergeOfficialCopy, ownRecord } from './officialCopy.ts';
import { asArray, isObject, str, strArray, type RawEntity, type RawObject } from './raw.ts';
import { ReportBuilder } from './report.ts';
import { mergeSubraces } from './subraces.ts';
import { expandAllVersions } from './versions.ts';

export interface HomebrewFile {
  /** File name or URL, for the report. */
  name: string;
  text: string;
  /** Where it was fetched from, kept with its sources. */
  url?: string;
}

export interface HomebrewOptions {
  now?: number;
  /** Content already on the device, for `_copy` parents and references outside the files. */
  lookup?: (refs: Ref[]) => Promise<Map<RefKey, ContentEntity>>;
  /** Sources already on the device: homebrew may not replace one that isn't homebrew. */
  existing?: readonly SourceInfo[];
}

interface BrewSource {
  name: string;
  edition?: Edition;
  info: HomebrewInfo;
}

const EDITION_OF: Record<string, Edition> = { one: '2024', classic: '2014' };

/**
 * A GitHub page of a file (`github.com/<owner>/<repo>/blob/<branch>/<path>`) as its raw file,
 * so a link copied from the 5etools homebrew repository works as it is. Other URLs are kept.
 */
export function rawHomebrewUrl(url: string): string {
  const m = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:blob|raw)\/(.+)$/.exec(url.trim());
  return m ? `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}` : url.trim();
}

/** `_meta.sources` of one file, keyed by source code (5etools `json`). */
function readMeta(meta: RawObject, url: string | undefined): Map<string, BrewSource> {
  const out = new Map<string, BrewSource>();
  const edition = EDITION_OF[String(meta.edition)];
  for (const src of asArray(meta.sources)) {
    if (!isObject(src)) continue;
    const code = str(src.json) ?? str(src.abbreviation);
    if (!code) continue;
    const info: HomebrewInfo = {};
    const abbreviation = str(src.abbreviation);
    if (abbreviation) info.abbreviation = abbreviation;
    const authors = strArray(src.authors);
    if (authors.length) info.authors = authors;
    if (typeof src.version === 'string' || typeof src.version === 'number')
      info.version = String(src.version);
    const home = url ?? str(src.url);
    if (home) info.url = home;
    const brew: BrewSource = { name: str(src.full) ?? code, info };
    if (edition) brew.edition = edition;
    out.set(code, brew);
  }
  return out;
}

/** Source codes a file says it needs (`_meta.dependencies` / `includes`), by record type. */
function dependencies(meta: RawObject): string[] {
  const out = new Set<string>();
  for (const prop of ['dependencies', 'includes']) {
    const deps = meta[prop];
    if (!isObject(deps)) continue;
    for (const list of Object.values(deps)) for (const code of strArray(list)) out.add(code);
  }
  return [...out];
}

/** Give records without a source the file's only source, and count them. */
function fillSources(json: RawObject, code: string | undefined): number {
  if (!code) return 0;
  let filled = 0;
  for (const [prop, list] of Object.entries(json)) {
    if (prop.startsWith('_') || !Array.isArray(list)) continue;
    for (const rec of list) {
      if (isObject(rec) && typeof rec.source !== 'string') {
        rec.source = code;
        filled++;
      }
    }
  }
  return filled;
}

/** Which kind and converter a 5etools record type has. */
const CONVERTER_OF = new Map(CONVERTERS.map(([prop, kind, convert]) => [prop, { kind, convert }]));

/** Converting for an id or a baseline only: warnings from it are not the user's business. */
function quietContext(ctx: ConvertContext): ConvertContext {
  return { ...ctx, report: new ReportBuilder(), parentEdition: new Map(ctx.parentEdition) };
}

/** The parent a pending `_copy` names, as a ref, or null when it can't be worked out. */
function parentRef(prop: string, raw: RawEntity, ctx: ConvertContext): Ref | null {
  const c = CONVERTER_OF.get(prop);
  const target = copyTarget(raw);
  if (!c || !target || typeof target.name !== 'string') return null;
  try {
    return { kind: c.kind, id: c.convert(target, quietContext(ctx)).id };
  } catch {
    return null;
  }
}

/** Refs an entity makes to class and subclass features, checked after conversion. */
function featureRefs(e: ContentEntity): Ref[] {
  if (e.kind === 'class')
    return e.features.map((f) => ({ kind: 'classFeature', id: f.featureId }) satisfies Ref);
  if (e.kind === 'subclass')
    return [
      { kind: 'class', id: e.classId },
      ...e.features.map((f) => ({ kind: 'subclassFeature', id: f.featureId }) satisfies Ref),
    ];
  return [];
}

/** Raw types of the text blocks the app doesn't know, kept as they are but worth reporting. */
function unknownBlocks(value: unknown, out: Set<string>): void {
  if (Array.isArray(value)) for (const v of value) unknownBlocks(v, out);
  else if (isObject(value)) {
    if (value.type === 'unknown' && isObject(value.raw)) out.add(String(value.raw.type));
    else for (const v of Object.values(value)) unknownBlocks(v, out);
  }
}

/** Spellcasters whose data gives no count of prepared spells (homebrew may leave it out). */
function lacksSpellCounts(e: ContentEntity): boolean {
  if ((e.kind !== 'class' && e.kind !== 'subclass') || !e.spellcasting) return false;
  if (e.spellcasting.preparedByLevel?.length) return false;
  return !(e.table ?? []).some((c) => c.key === 'prepared-spells' || c.key === 'spells-known');
}

export async function importHomebrew(
  files: readonly HomebrewFile[],
  opts: HomebrewOptions = {},
): Promise<ImportResult> {
  const now = opts.now ?? Date.now();
  const report = new ReportBuilder();
  const records = emptyRecords() as unknown as Record<string, RawEntity[]>;
  const brews = new Map<string, BrewSource>();
  const needs = new Map<string, string>();

  // 1. Read each file: its sources, then its records.
  for (const file of files) {
    let json: unknown;
    try {
      json = JSON.parse(file.text);
    } catch {
      json = null;
    }
    report.report.filesRead++;
    if (!isObject(json)) {
      report.warn('fileInvalid', `Not a homebrew file (not a JSON object): ${file.name}`);
      continue;
    }
    const meta = isObject(json._meta) ? json._meta : {};
    const declared = readMeta(meta, file.url);
    if (!declared.size) {
      report.warn('fileInvalid', `No sources in "_meta" (records keep their own): ${file.name}`);
    }
    for (const [code, brew] of declared) brews.set(code, brew);
    for (const code of dependencies(meta)) needs.set(code, file.name);
    const only = declared.size === 1 ? [...declared.keys()][0] : undefined;
    const filled = fillSources(json, only);
    if (filled) {
      report.warn('fieldMissing', `${filled} records had no source and were given ${only}`);
    }
    collect(json, records as never, report);
  }

  // 2. Which sources may be written: never one that is on the device and isn't homebrew.
  const existing = new Map((opts.existing ?? []).map((s) => [s.code, s]));
  const official = (code: string) => {
    const s = existing.get(code);
    return s !== undefined && s.origin !== 'homebrew';
  };
  const refused = new Set<string>();
  const undeclared = new Set<string>();
  for (const prop of IMPORTED_PROPS) {
    records[prop] = (records[prop] ?? []).filter((r) => {
      const code = typeof r.source === 'string' ? r.source : '';
      if (CONVERTER_OF.has(prop) && prop !== 'itemProperty' && typeof r.name !== 'string') {
        report.warn('fieldMissing', `${prop} without a name; skipped`, r);
        return false;
      }
      if (!code) {
        report.warn('fieldMissing', `${prop} without a source; skipped`, r);
        return false;
      }
      if (official(code)) {
        if (!refused.has(code)) {
          refused.add(code);
          report.warn(
            'sourceConflict',
            `Records with source ${code} were skipped: ${code} is already imported and isn't homebrew`,
          );
        }
        return false;
      }
      if (!brews.has(code) && !undeclared.has(code)) {
        undeclared.add(code);
        report.warn('sourceUndeclared', `Source ${code} is not in "_meta.sources"; named by code`);
      }
      return true;
    });
  }
  for (const [code, file] of needs) {
    if (!brews.has(code) && !existing.has(code)) {
      report.warn('dependency', `${file} needs ${code}, which is not imported; import it first`);
    }
  }

  // 3. The same steps as official data; copies of content outside the files wait.
  resolveCopies(records, report, { keepMissing: true });
  expandAllVersions(
    records,
    IMPORTED_PROPS.filter((p) => p !== 'race' && p !== 'subrace'),
    report,
  );
  records.race = mergeSubraces(records.race ?? [], records.subrace ?? [], report, true);
  records.subrace = [];
  expandAllVersions(records, ['race'], report);
  resolveItemEntries(records, report);

  // 4. Editions: the file's `_meta.edition`, else what the records say.
  const marked = sourceEditions(Object.values(records).flat(), new Map());
  const editions = new Map<string, Edition>(marked);
  for (const [code, brew] of brews) if (brew.edition) editions.set(code, brew.edition);

  const ctx: ConvertContext = {
    origin: {
      adapter: 'homebrew',
      adapterVersion: ADAPTER_VERSION,
      importedAt: now,
    } satisfies ContentOrigin,
    report,
    sourceEdition: editions,
    parentEdition: new Map(),
  };

  // 5. Fetch the parents of the copies that wait, then convert.
  const pending = new Map<RawEntity, Ref>();
  for (const prop of CONVERTER_OF.keys()) {
    for (const raw of records[prop] ?? []) {
      if (!isObject(raw._copy)) continue;
      const ref = parentRef(prop, raw, ctx);
      if (ref) pending.set(raw, ref);
    }
  }
  const parents =
    pending.size && opts.lookup ? await opts.lookup([...pending.values()]) : new Map();

  const convertOne = (_prop: string, raw: RawEntity, convert: Converter): ContentEntity | null => {
    if (!isObject(raw._copy)) return convert(raw, ctx);
    const target = copyTarget(raw);
    const ref = pending.get(raw);
    const parent = ref ? parents.get(refKey(ref)) : undefined;
    if (!parent || parent.kind !== ref?.kind) {
      report.warn(
        'copyMissing',
        `Copies ${String(target?.name)}|${String(target?.source)}, which is not imported on this device; import it first`,
        raw,
      );
      return null;
    }
    const own = ownRecord(raw);
    const mine = convert(own, ctx);
    const blank = convert(blankRecord(own), quietContext(ctx));
    return mergeOfficialCopy(parent, mine, blank, raw._copy._mod, (code, message) =>
      report.warn(code, message, raw),
    );
  };
  const entities = convertRecords(records, ctx, convertOne);
  // Homebrew creatures are all kept: the player imported them for a reason (a companion).
  const creatures: ContentEntity[] = [];
  for (const raw of records.monster ?? []) {
    try {
      creatures.push(convertCreature(raw, ctx));
    } catch (err) {
      report.warn(
        'convertFailed',
        `monster: ${err instanceof Error ? err.message : String(err)}`,
        raw,
      );
    }
  }
  if (creatures.length) (entities as Record<string, ContentEntity[]>).creature = creatures;
  attachFluff(entities, records);
  for (const kind of ENTITY_KINDS) {
    const n = entities[kind]?.length ?? 0;
    if (n) report.report.counts[kind] = n;
    else delete entities[kind];
  }

  // 6. What the homebrew points at but doesn't have (7.4): features, a subclass's class.
  const all = ENTITY_KINDS.flatMap((k) => (entities[k] ?? []) as ContentEntity[]);
  const have = new Set(all.map((e) => refKey({ kind: e.kind, id: e.id })));
  const wanted = new Map<RefKey, { ref: Ref; by: ContentEntity }>();
  for (const e of all) {
    for (const ref of featureRefs(e)) {
      const key = refKey(ref);
      if (!have.has(key) && !wanted.has(key)) wanted.set(key, { ref, by: e });
    }
    const blocks = new Set<string>();
    unknownBlocks(e.entries, blocks);
    if (blocks.size) {
      report.warn(
        'unknownShape',
        `Text blocks the app can't show as intended (shown plainly): ${[...blocks].join(', ')}`,
        e,
      );
    }
    if (lacksSpellCounts(e)) {
      report.warn(
        'spellCounts',
        `${e.name} casts spells but gives no number of prepared spells; prepare them with Ignore rules`,
        e,
      );
    }
  }
  const onDevice =
    wanted.size && opts.lookup ? await opts.lookup([...wanted.values()].map((w) => w.ref)) : null;
  for (const [key, { ref, by }] of wanted) {
    if (onDevice?.has(key)) continue;
    const what = ref.kind === 'class' ? 'Class' : 'Feature';
    report.warn('refMissing', `${what} not found: ${ref.id}`, by);
  }

  return {
    entities,
    sources: homebrewSources(entities, brews, editions, now),
    report: report.report,
  };
}

function homebrewSources(
  entities: EntitiesByKind,
  brews: Map<string, BrewSource>,
  editions: Map<string, Edition>,
  now: number,
): SourceInfo[] {
  const byCode = new Map<string, SourceInfo>();
  for (const kind of ENTITY_KINDS) {
    for (const e of (entities[kind] ?? []) as ContentEntity[]) {
      let info = byCode.get(e.source);
      if (!info) {
        const brew = brews.get(e.source);
        info = {
          code: e.source,
          name: brew?.name ?? e.source,
          edition: editions.get(e.source) ?? 'unknown',
          group: 'other',
          counts: {},
          importedAt: now,
          adapterVersion: ADAPTER_VERSION,
          origin: 'homebrew',
        };
        if (brew && Object.keys(brew.info).length) info.homebrew = brew.info;
        byCode.set(e.source, info);
      }
      info.counts[kind as EntityKind] = (info.counts[kind as EntityKind] ?? 0) + 1;
    }
  }
  return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
}
