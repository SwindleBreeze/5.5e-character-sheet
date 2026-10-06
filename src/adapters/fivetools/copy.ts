// `_copy` resolution (plan §6.1 step 5): a record copies a parent of the same type, found by
// UID identity, keeps its own fields, then applies `_mod`. Parents may copy too (chains), and
// the parent may be in another source (PHB subclasses re-homed onto XPHB classes).

import { identityKey } from './uid.ts';
import { applyMods } from './mod.ts';
import { clone, isObject, type RawEntity, type RawObject } from './raw.ts';
import type { ReportBuilder } from './report.ts';

/** Fields only copied from the parent when `_preserve` asks for them (as in 5etools). */
const PRESERVE_REQUIRED = new Set([
  'page',
  'otherSources',
  'referenceSources',
  'srd',
  'srd52',
  'basicRules',
  'basicRules2024',
  'reprintedAs',
  'hasFluff',
  'hasFluffImages',
  'hasToken',
  'tokenCredit',
  'tokenCustom',
  'foundryTokenScale',
  'altArt',
  '_versions',
  // Item-specific in 5etools; harmless elsewhere.
  'lootTables',
  'tier',
]);

/** Merge `child` (which has `_copy`) onto a copy of `parent`. Returns a new record. */
export function mergeCopy(parent: RawEntity, child: RawEntity, report: ReportBuilder): RawEntity {
  const out = clone(child);
  const meta: RawObject = isObject(out._copy) ? out._copy : {};
  const preserve = isObject(meta._preserve) ? meta._preserve : {};

  for (const [key, value] of Object.entries(parent)) {
    if (key === '_copy') continue;
    if (out[key] === null) {
      delete out[key];
      continue;
    }
    if (out[key] !== undefined) continue;
    if (PRESERVE_REQUIRED.has(key) && !preserve['*'] && !preserve[key]) continue;
    out[key] = clone(value);
  }

  if (meta._mod !== undefined) {
    applyMods(out, meta._mod, (code, message) => report.warn(code, message, child));
  }
  delete out._copy;
  return out;
}

/** Which record types a type's `_copy` may point into. */
const LOOKUP_PROPS: Record<string, string[]> = {
  item: ['item', 'baseitem'],
};

/**
 * Resolve every `_copy` in `records`, in place. Records whose parent is missing, or that copy
 * in a cycle, are dropped and reported.
 */
export function resolveCopies(records: Record<string, RawEntity[]>, report: ReportBuilder): void {
  for (const [prop, list] of Object.entries(records)) {
    if (!list.some((e) => e._copy !== undefined)) continue;

    const lookup = new Map<string, RawEntity>();
    for (const lp of LOOKUP_PROPS[prop] ?? [prop]) {
      for (const e of records[lp] ?? []) {
        const key = identityKey(prop, e);
        if (!lookup.has(key)) lookup.set(key, e); // Earlier wins, as in 5etools.
      }
    }

    const resolved = new Map<RawEntity, RawEntity | null>();
    const resolve = (e: RawEntity, stack: Set<RawEntity>): RawEntity | null => {
      if (!isObject(e._copy)) return e;
      const done = resolved.get(e);
      if (done !== undefined) return done;
      if (stack.has(e)) {
        report.warn('copyCycle', `_copy cycle in ${prop}`, e);
        return null;
      }
      const parentRaw = lookup.get(identityKey(prop, e._copy as RawEntity));
      let result: RawEntity | null = null;
      if (!parentRaw) {
        const target = e._copy as RawEntity;
        report.warn(
          'copyMissing',
          `_copy parent not found: ${String(target.name)}|${String(target.source)}`,
          e,
        );
      } else {
        stack.add(e);
        const parent = resolve(parentRaw, stack);
        stack.delete(e);
        if (parent) result = mergeCopy(parent, e, report);
      }
      resolved.set(e, result);
      return result;
    };

    const out: RawEntity[] = [];
    for (const e of list) {
      const r = resolve(e, new Set());
      if (r) out.push(r);
    }
    records[prop] = out;
  }
}
