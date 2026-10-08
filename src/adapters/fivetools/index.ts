// 5etools importer (plan §6.1). Pure: reads from a FileSource and returns entities, the source
// registry and a report. Writing to the database is the caller's job (plan §6.2).
//
// Pipeline: locate → read manifest → resolve `_copy` → expand `_versions` → merge subraces →
// shared item text → deity reprints → work out editions → convert → creatures → spell lists →
// filter sources → build the registry.

import {
  ENTITY_KINDS,
  type ContentEntity,
  type ContentOrigin,
  type Edition,
  type EntitiesByKind,
  type EntityKind,
  type SourceInfo,
} from '../../schema/index.ts';
import {
  convertClass,
  convertClassFeature,
  convertSubclass,
  convertSubclassFeature,
} from './convert/class.ts';
import type { ConvertContext } from './convert/common.ts';
import { convertCreature, namedCreatureIds, selectCreatures } from './convert/creature.ts';
import {
  convertCharOption,
  convertDeity,
  convertFacility,
  convertReward,
  linkDeityReprints,
} from './convert/extras.ts';
import {
  convertBaseItem,
  convertItem,
  convertItemGroup,
  convertMagicVariant,
} from './convert/item.ts';
import { convertBackground, convertFeat, convertSpecies } from './convert/origin.ts';
import { convertOptionalFeature, convertRule, RULE_KIND_BY_PROP } from './convert/rules.ts';
import { convertSpell } from './convert/spell.ts';
import { ADAPTER_VERSION } from '../version.ts';
import { resolveCopies } from './copy.ts';
import { sourceEditions } from './editions.ts';
import type { FileSource } from './fs/types.ts';
import { locateDataRoot } from './locate.ts';
import { IMPORTED_PROPS, readManifest, type SourceMeta } from './manifest.ts';
import type { RawEntity } from './raw.ts';
import { ReportBuilder, type ImportReport } from './report.ts';
import { attachFluff } from './fluff.ts';
import { resolveItemEntries } from './itemEntries.ts';
import { applySpellLists } from './spellLists.ts';
import { mergeSubraces } from './subraces.ts';
import { expandAllVersions } from './versions.ts';

export { ADAPTER_VERSION };

export interface ImportOptions {
  /** Timestamp stored on every entity; defaults to now. */
  now?: number;
  /** Keep only these source codes (the "advanced" option). Default: everything. */
  onlySources?: string[];
  onProgress?: (stage: ImportStage) => void;
}

export type ImportStage = 'locate' | 'read' | 'resolve' | 'convert' | 'finish';

export interface ImportResult {
  entities: EntitiesByKind;
  sources: SourceInfo[];
  report: ImportReport;
}

export class ImportError extends Error {}

type Converter = (raw: RawEntity, ctx: ConvertContext) => ContentEntity;

/** 5etools record type → our kind and converter. Order matters: classes before features. */
const CONVERTERS: [string, EntityKind, Converter][] = [
  ['class', 'class', convertClass],
  ['subclass', 'subclass', convertSubclass],
  ['classFeature', 'classFeature', convertClassFeature],
  ['subclassFeature', 'subclassFeature', convertSubclassFeature],
  ['spell', 'spell', convertSpell],
  ['background', 'background', convertBackground],
  ['feat', 'feat', convertFeat],
  ['race', 'species', convertSpecies],
  ['optionalfeature', 'optionalFeature', convertOptionalFeature],
  ['baseitem', 'item', convertBaseItem],
  ['item', 'item', convertItem],
  ['magicvariant', 'item', convertMagicVariant],
  ['itemGroup', 'item', convertItemGroup],
  ['deity', 'deity', convertDeity],
  ['reward', 'reward', convertReward],
  ['facility', 'facility', convertFacility],
  ['charoption', 'charOption', convertCharOption],
  ...Object.entries(RULE_KIND_BY_PROP).map(([prop, ruleKind]): [string, EntityKind, Converter] => [
    prop,
    'rule',
    (raw, ctx) => convertRule(raw, ruleKind, ctx),
  ]),
];

function sourceInfos(
  entities: EntitiesByKind,
  editions: Map<string, Edition>,
  books: Map<string, SourceMeta>,
  now: number,
): SourceInfo[] {
  const byCode = new Map<string, SourceInfo>();
  for (const kind of ENTITY_KINDS) {
    for (const e of entities[kind] ?? []) {
      let info = byCode.get(e.source);
      if (!info) {
        const book = books.get(e.source);
        info = {
          code: e.source,
          name: book?.name ?? e.source,
          edition: editions.get(e.source) ?? 'unknown',
          group: book?.group ?? 'other',
          counts: {},
          importedAt: now,
          adapterVersion: ADAPTER_VERSION,
          origin: '5etools',
        };
        if (book?.published) info.published = book.published;
        byCode.set(e.source, info);
      }
      info.counts[kind] = (info.counts[kind] ?? 0) + 1;
    }
  }
  return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
}

export async function importFivetools(
  fs: FileSource,
  opts: ImportOptions = {},
): Promise<ImportResult> {
  const now = opts.now ?? Date.now();
  const report = new ReportBuilder();
  const progress = opts.onProgress ?? (() => {});

  progress('locate');
  const root = await locateDataRoot(fs);
  if (root === null) {
    throw new ImportError(
      'Could not find the 5etools data. Pick the 5etools folder, its "data" folder, or the zip.',
    );
  }

  progress('read');
  const manifest = await readManifest(fs, root, report);
  if (manifest.dataVersion) report.report.dataVersion = manifest.dataVersion;
  const records = manifest.records as Record<string, RawEntity[]>;

  progress('resolve');
  // Creatures are picked and resolved after the player content is converted (below).
  const monsters = records.monster ?? [];
  records.monster = [];
  resolveCopies(records, report);
  // Subraces merge into their race first; the merged record may itself carry `_versions`
  // (2014 Dragonborn colours), which only make sense on the merged text.
  expandAllVersions(
    records,
    IMPORTED_PROPS.filter((p) => p !== 'race' && p !== 'subrace'),
    report,
  );
  records.race = mergeSubraces(records.race ?? [], records.subrace ?? [], report);
  records.subrace = [];
  expandAllVersions(records, ['race'], report);
  resolveItemEntries(records, report);
  linkDeityReprints(records.deity ?? [], manifest.sources);

  const editions = sourceEditions(
    [...Object.values(records).flat(), ...monsters],
    manifest.sources,
  );
  const ctx: ConvertContext = {
    origin: {
      adapter: '5etools',
      adapterVersion: ADAPTER_VERSION,
      importedAt: now,
    } satisfies ContentOrigin,
    report,
    sourceEdition: editions,
    parentEdition: new Map(),
  };

  progress('convert');
  const entities: EntitiesByKind = {};
  const seen = new Map<EntityKind, Set<string>>();
  const convertAll = (prop: string, kind: EntityKind, convert: Converter, raws: RawEntity[]) => {
    const list = (entities[kind] ??= []) as ContentEntity[];
    const ids = seen.get(kind) ?? new Set<string>();
    seen.set(kind, ids);
    for (const raw of raws) {
      let entity: ContentEntity;
      try {
        entity = convert(raw, ctx);
      } catch (err) {
        report.warn(
          'convertFailed',
          `${prop}: ${err instanceof Error ? err.message : String(err)}`,
          raw,
        );
        continue;
      }
      if (ids.has(entity.id)) {
        report.warn('duplicateId', `Duplicate ${kind} id "${entity.id}"; kept the first`, raw);
        continue;
      }
      ids.add(entity.id);
      list.push(entity);
      if (kind === 'class' || kind === 'subclass') ctx.parentEdition.set(entity.id, entity.edition);
    }
  };
  for (const [prop, kind, convert] of CONVERTERS)
    convertAll(prop, kind, convert, records[prop] ?? []);

  // Creatures last: which ones are kept depends on what the player content above names. Only
  // those are resolved, so the rest of the bestiary costs nothing but reading it.
  const picked = selectCreatures(monsters, namedCreatureIds(Object.values(entities).flat()));
  const creatureRecords = { monster: picked.records };
  resolveCopies(creatureRecords, report);
  creatureRecords.monster = creatureRecords.monster.filter(picked.isKept);
  expandAllVersions(creatureRecords, ['monster'], report);
  convertAll('monster', 'creature', convertCreature, creatureRecords.monster);

  progress('finish');
  applySpellLists(entities.spell ?? [], manifest.spellLookup);
  attachFluff(entities, records);

  if (opts.onlySources?.length) {
    const keep = new Set(opts.onlySources);
    for (const kind of ENTITY_KINDS) {
      const list = entities[kind] as ContentEntity[] | undefined;
      if (list) entities[kind] = list.filter((e) => keep.has(e.source)) as never;
    }
  }
  for (const kind of ENTITY_KINDS) {
    const n = entities[kind]?.length ?? 0;
    if (n) report.report.counts[kind] = n;
    else delete entities[kind];
  }

  return {
    entities,
    sources: sourceInfos(entities, editions, manifest.sources, now),
    report: report.report,
  };
}

export type { FileSource } from './fs/types.ts';
export type { ImportReport, ImportWarning } from './report.ts';
