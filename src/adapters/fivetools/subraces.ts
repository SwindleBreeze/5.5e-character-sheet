// 2014 subraces become species variants of their race (2024 content has none). The merge follows
// 5etools: the subrace's ability bonuses are combined index by index, entries are appended or
// overwrite a same-named entry, language proficiencies are appended, and other fields replace
// the race's. A nameless subrace is the race's standard form and replaces the base record.

import { VERSION_OF } from './versions.ts';
import { asArray, clone, isObject, type RawEntity, type RawObject } from './raw.ts';
import type { ReportBuilder } from './report.ts';

const NOT_INHERITED = [
  'subraces',
  'srd',
  'srd52',
  'basicRules',
  'basicRules2024',
  '_versions',
  'hasFluff',
  'hasFluffImages',
  'reprintedAs',
];

export function subraceName(raceName: string, subrace: string): string {
  const m = /^(.*?)\((.*?)\)$/.exec(raceName);
  if (!m) return `${raceName} (${subrace})`;
  return `${m[1]}(${m[2]}; ${subrace})`;
}

function mergeSubrace(race: RawEntity, subrace: RawEntity): RawEntity {
  const out = clone(race);
  for (const key of NOT_INHERITED) delete out[key];
  const sr = clone(subrace);
  const overwrite = isObject(sr.overwrite) ? sr.overwrite : {};
  delete sr.raceName;
  delete sr.raceSource;
  delete sr.overwrite;

  if (typeof sr.name === 'string' && sr.name) out.name = subraceName(String(race.name), sr.name);
  delete sr.name;

  if (Array.isArray(sr.ability)) {
    const base = !overwrite.ability && Array.isArray(out.ability) ? out.ability : [];
    out.ability = sr.ability.map((obj, i) => ({
      ...(isObject(base[i]) ? base[i] : {}),
      ...(isObject(obj) ? obj : {}),
    }));
    delete sr.ability;
  }

  if (Array.isArray(sr.entries)) {
    const entries = Array.isArray(out.entries) ? out.entries : [];
    for (const ent of sr.entries) {
      const target =
        isObject(ent) && isObject(ent.data) && typeof ent.data.overwrite === 'string'
          ? ent.data.overwrite.toLowerCase().trim()
          : null;
      const ix =
        target === null
          ? -1
          : entries.findIndex(
              (it) =>
                isObject(it) &&
                String(it.name ?? '')
                  .toLowerCase()
                  .trim() === target,
            );
      if (ix >= 0) entries[ix] = ent;
      else entries.push(ent);
    }
    out.entries = entries;
    delete sr.entries;
  }

  for (const key of ['traitTags', 'languageProficiencies']) {
    if (sr[key] === undefined) continue;
    out[key] = overwrite[key] ? sr[key] : [...asArray(out[key]), ...asArray(sr[key])];
    delete sr[key];
  }

  Object.assign(out, sr);
  for (const [k, v] of Object.entries(out)) if (v === null) delete out[k];
  return out;
}

/**
 * Turn `subrace` records into species records. Named subraces are added as variants of their
 * race; nameless ones replace the base race record.
 */
export function mergeSubraces(
  races: RawEntity[],
  subraces: RawEntity[],
  report: ReportBuilder,
): RawEntity[] {
  const out = [...races];
  for (const sr of subraces) {
    const ix = out.findIndex(
      (r) => r.name === sr.raceName && r.source === sr.raceSource && r[VERSION_OF] === undefined,
    );
    const race = out[ix];
    if (!race) {
      report.warn(
        'subraceOrphan',
        `Race not found: ${String(sr.raceName)}|${String(sr.raceSource)}`,
        sr,
      );
      continue;
    }
    const merged = mergeSubrace(race, sr);
    if (typeof merged.source !== 'string') merged.source = race.source;
    if (typeof sr.name === 'string' && sr.name) {
      merged[VERSION_OF] = { name: race.name, source: race.source } satisfies RawObject;
      out.push(merged);
    } else {
      out[ix] = merged;
    }
  }
  return out;
}
