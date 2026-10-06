// `_versions` expansion (plan §6.1 step 6): species lineages and feat versions are listed on
// their parent and become records of their own. A version is either a plain record with a
// `_mod`, or an `_abstract` template expanded once per `_implementations` entry, with
// `{{variable}}` placeholders filled from the implementation's `_variables`.

import { mergeCopy } from './copy.ts';
import { asArray, clone, isObject, mapStrings, type RawEntity, type RawObject } from './raw.ts';
import type { ReportBuilder } from './report.ts';

/** Marker set on expanded versions: the parent's name and source. */
export const VERSION_OF = '__versionOf';

const NOT_INHERITED = ['_versions', 'hasToken', 'hasFluff', 'hasFluffImages'];

function fromTemplate(abstract: RawObject, impl: RawObject): RawObject {
  const vars = isObject(impl._variables) ? impl._variables : {};
  const filled = mapStrings(clone(abstract), (s) =>
    s.replace(/\{\{([^}]+)\}\}/g, (match, key: string) => {
      const value = vars[key];
      return typeof value === 'string' || typeof value === 'number' ? String(value) : match;
    }),
  ) as RawObject;
  const rest = clone(impl);
  delete rest._variables;
  return Object.assign(filled, rest);
}

/** The records described by `parent._versions` (not including the parent itself). */
export function expandVersions(parent: RawEntity, report: ReportBuilder): RawEntity[] {
  const raw = asArray(parent._versions).filter(isObject);
  const versions: RawObject[] = raw.flatMap((ver) =>
    isObject(ver._abstract) && Array.isArray(ver._implementations)
      ? ver._implementations
          .filter(isObject)
          .map((impl) => fromTemplate(ver._abstract as RawObject, impl))
      : [clone(ver)],
  );

  const base = clone(parent);
  for (const key of NOT_INHERITED) delete base[key];

  const out: RawEntity[] = [];
  for (const version of versions) {
    const asCopy: RawEntity = { ...version };
    asCopy._copy = { _mod: version._mod, _preserve: version._preserve ?? { '*': true } };
    delete asCopy._mod;
    delete asCopy._preserve;
    if (typeof asCopy.name !== 'string') {
      report.warn('versionFailed', 'Version without a name', parent);
      continue;
    }
    const merged = mergeCopy(base, asCopy, report);
    merged[VERSION_OF] = { name: parent.name, source: parent.source };
    out.push(merged);
  }
  return out;
}

/** Expand versions for every record of the given types, appending them after their parents. */
export function expandAllVersions(
  records: Record<string, RawEntity[]>,
  props: string[],
  report: ReportBuilder,
): void {
  for (const prop of props) {
    const list = records[prop];
    if (!list) continue;
    const out: RawEntity[] = [];
    for (const e of list) {
      out.push(e);
      if (e._versions !== undefined) out.push(...expandVersions(e, report));
    }
    records[prop] = out;
  }
}
