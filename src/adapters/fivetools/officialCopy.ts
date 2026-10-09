// Homebrew `_copy` of content already on the device (plan §10.3, step 7.3). The device keeps
// converted entities, not the 5etools records they came from, so the copy is made on converted
// entities: the homebrew record is converted on its own, and every field it set (one that
// differs from converting a record with only its name and source) replaces the parent's.
// `_mod` changes to the text apply; changes to other fields can't, and are reported.

import type { ContentEntity, Effect, Entry } from '../../schema/index.ts';
import { normalizeEntries } from './entries.ts';
import { applyMods, type ModWarn } from './mod.ts';
import { asArray, clone, deepEqual, isObject, type RawEntity, type RawObject } from './raw.ts';

/** Fields that place a record: they name the parent in `_copy` and the child keeps its own. */
const IDENTITY_KEYS = [
  'name',
  'source',
  'shortName',
  'className',
  'classSource',
  'subclassShortName',
  'subclassSource',
  'level',
  'edition',
];

/** Entity fields always taken from the homebrew record, never from the parent. */
const OWN_FIELDS = new Set([
  'id',
  'kind',
  'name',
  'source',
  'edition',
  'origin',
  'page',
  'supersededBy',
  'variantOf',
  'classId',
  'subclassId',
  'level',
  'shortName',
]);

/** The `_copy` target as a record of its own, to work out the parent's id. */
export function copyTarget(raw: RawEntity): RawEntity | null {
  if (!isObject(raw._copy)) return null;
  const out: RawEntity = {};
  for (const [k, v] of Object.entries(raw._copy)) if (!k.startsWith('_')) out[k] = v;
  return out;
}

/**
 * The homebrew record with the parent's placing fields where it has none (a copied class
 * feature keeps its class unless it says otherwise), without `_copy`.
 */
export function ownRecord(raw: RawEntity): RawEntity {
  const out = clone(raw);
  const target = copyTarget(raw) ?? {};
  for (const key of IDENTITY_KEYS) {
    if (out[key] === undefined && target[key] !== undefined) out[key] = target[key];
  }
  delete out._copy;
  return out;
}

/** Only the placing fields: what converting "nothing but a name" gives. */
export function blankRecord(own: RawEntity): RawEntity {
  const out: RawEntity = {};
  for (const [k, v] of Object.entries(own)) {
    if (IDENTITY_KEYS.includes(k) || k.startsWith('__')) out[k] = v;
  }
  return out;
}

/** Normalize the entries a `_mod` adds, so they match the parent's converted text. */
function normalizeModItems(mods: unknown): unknown {
  if (!isObject(mods)) return mods;
  const out: RawObject = {};
  for (const [prop, list] of Object.entries(mods)) {
    out[prop] = asArray(list).map((m) =>
      isObject(m) && m.items !== undefined ? { ...m, items: normalizeEntries(m.items) } : m,
    );
  }
  return out;
}

/**
 * Merge a homebrew record onto an entity already on the device. `own` is the homebrew record
 * converted, `blank` the same with only its placing fields. Effects are replaced by kind: an
 * effect type the homebrew sets replaces the parent's effects of that type, the rest stay.
 */
export function mergeOfficialCopy(
  parent: ContentEntity,
  own: ContentEntity,
  blank: ContentEntity,
  mods: unknown,
  warn: ModWarn,
): ContentEntity {
  const out = clone(parent) as unknown as RawObject;
  for (const key of Object.keys(out)) {
    if (OWN_FIELDS.has(key)) delete out[key];
  }
  const ownObj = own as unknown as RawObject;
  const blankObj = blank as unknown as RawObject;
  for (const [key, value] of Object.entries(ownObj)) {
    if (key === 'effects') continue;
    if (OWN_FIELDS.has(key) || !deepEqual(value, blankObj[key])) out[key] = clone(value);
  }

  const added = own.effects.filter((e) => !blank.effects.some((b) => deepEqual(b, e)));
  const types = new Set(added.map((e) => e.type));
  out.effects = [
    ...parent.effects.filter((e) => !types.has(e.type)),
    ...clone(added),
  ] satisfies Effect[];

  if (isObject(mods)) {
    const textMods: RawObject = {};
    for (const [prop, list] of Object.entries(mods)) {
      if (prop === 'entries') textMods[prop] = list;
      else if (prop !== '*')
        warn('modUnsupported', `Copy of an imported entity: changes to "${prop}" are not applied`);
    }
    applyMods(out, normalizeModItems(textMods), warn);
    out.entries = asArray<Entry>(out.entries);
  }
  return out as unknown as ContentEntity;
}
