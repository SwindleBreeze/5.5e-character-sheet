// The 5etools `_mod` engine shared by `_copy` and `_versions` (plan §1). Implements the generic
// operations; bestiary-only operations are reported as unsupported. Text replacement never
// touches the inside of `{@tags}`.

import { splitByTags } from '../../richtext/parseTags.ts';
import {
  asArray,
  clone,
  deepEqual,
  deletePath,
  getPath,
  isObject,
  mapStrings,
  setPath,
  type RawObject,
} from './raw.ts';

export class ModError extends Error {}

export type ModWarn = (code: 'modFailed' | 'modUnsupported', message: string) => void;

/** Props that `*` applies to (as in 5etools; these are stat-block props). */
const STAR_PROPS = [
  'action',
  'bonus',
  'reaction',
  'trait',
  'legendary',
  'mythic',
  'variant',
  'spellcasting',
  'actionHeader',
  'bonusHeader',
  'reactionHeader',
  'legendaryHeader',
  'mythicHeader',
];

const TEXT_PROPS_DEFAULT: (string | null)[] = [null, 'entries', 'headerEntries', 'footerEntries'];

type ModInfo = RawObject & { mode?: string };

function arrayAt(target: RawObject, path: string[]): unknown[] | undefined {
  const value = getPath(target, path);
  return Array.isArray(value) ? value : undefined;
}

function requireArray(target: RawObject, path: string[]): unknown[] {
  const arr = arrayAt(target, path);
  if (!arr) throw new ModError(`no "${path.join('.')}" array`);
  return arr;
}

function nameOf(item: unknown): unknown {
  return isObject(item) ? item.name : undefined;
}

function textReplacer(info: ModInfo): (s: string) => string {
  const pattern = typeof info.replace === 'string' ? info.replace : '';
  const flags = typeof info.flags === 'string' ? info.flags : '';
  const re = new RegExp(pattern, `g${flags.replace(/g/g, '')}`);
  const withStr = typeof info.with === 'string' ? info.with : '';
  if (info.tagInsensitive === true) return (s) => s.replace(re, withStr);
  return (s) =>
    splitByTags(s)
      .map((seg) => (seg.startsWith('{@') ? seg : seg.replace(re, withStr)))
      .join('');
}

function combinedPath(propPath: string[] | null, info: ModInfo): string[] {
  const own = typeof info.prop === 'string' ? info.prop.split('.') : [];
  if (propPath && !(propPath.length === 1 && propPath[0] === '*')) return [...propPath, ...own];
  return own;
}

function findIndexForReplace(arr: unknown[], replace: unknown): number {
  if (isObject(replace) && typeof replace.regex === 'string') {
    const re = new RegExp(replace.regex, typeof replace.flags === 'string' ? replace.flags : '');
    return arr.findIndex((it) => {
      const name = nameOf(it);
      if (typeof name === 'string') return re.test(name);
      return typeof it === 'string' && re.test(it);
    });
  }
  if (isObject(replace) && typeof replace.index === 'number') return replace.index;
  return arr.findIndex((it) =>
    nameOf(it) !== undefined ? nameOf(it) === replace : it === replace,
  );
}

function scalar(target: RawObject, path: string[], info: ModInfo, op: (n: number) => number) {
  const tgt = getPath(target, path);
  if (!isObject(tgt)) return;
  const apply = (k: string) => {
    const before = tgt[k];
    const out = op(Number(before));
    tgt[k] = typeof before === 'string' ? `${out >= 0 ? '+' : ''}${out}` : out;
  };
  if (info.prop === '*') Object.keys(tgt).forEach(apply);
  else if (typeof info.prop === 'string') apply(info.prop);
}

function applyOne(target: RawObject, propPath: string[] | null, info: unknown, warn: ModWarn) {
  const path = propPath ?? [];
  if (typeof info === 'string') {
    if (info === 'remove') {
      if (propPath) deletePath(target, propPath);
      return;
    }
    throw new ModError(`unknown mode "${info}"`);
  }
  if (!isObject(info)) throw new ModError('mod is not an object');
  const m = info as ModInfo;
  const items = () => clone(asArray(m.items));

  switch (m.mode) {
    case 'appendStr': {
      const existing = getPath(target, path);
      const add = typeof m.str === 'string' ? m.str : '';
      const joiner = typeof m.joiner === 'string' ? m.joiner : '';
      setPath(target, path, existing ? `${String(existing)}${joiner}${add}` : add);
      return;
    }
    case 'prependArr': {
      const existing = arrayAt(target, path);
      setPath(target, path, existing ? [...items(), ...existing] : items());
      return;
    }
    case 'appendArr': {
      const existing = arrayAt(target, path);
      setPath(target, path, existing ? [...existing, ...items()] : items());
      return;
    }
    case 'appendIfNotExistsArr': {
      const existing = arrayAt(target, path);
      if (!existing) return setPath(target, path, items());
      setPath(target, path, [
        ...existing,
        ...items().filter((it) => !existing.some((x) => deepEqual(it, x))),
      ]);
      return;
    }
    case 'replaceArr':
    case 'replaceOrAppendArr': {
      const existing = arrayAt(target, path);
      const ix = existing ? findIndexForReplace(existing, m.replace) : -1;
      if (existing && ix >= 0) {
        existing.splice(ix, 1, ...items());
        return;
      }
      if (m.mode === 'replaceOrAppendArr') {
        setPath(target, path, [...(existing ?? []), ...items()]);
        return;
      }
      throw new ModError(`no item "${JSON.stringify(m.replace)}" in "${path.join('.')}"`);
    }
    case 'insertArr': {
      const arr = requireArray(target, path);
      const index = typeof m.index === 'number' && m.index >= 0 ? m.index : arr.length;
      arr.splice(index, 0, ...items());
      return;
    }
    case 'removeArr': {
      const arr = requireArray(target, path);
      if (m.names !== undefined) {
        for (const name of asArray(m.names)) {
          const ix = arr.findIndex((it) => nameOf(it) === name);
          if (ix >= 0) arr.splice(ix, 1);
          else if (m.force !== true)
            throw new ModError(`no item named "${String(name)}" to remove`);
        }
      } else if (m.items !== undefined) {
        for (const item of asArray(m.items)) {
          const ix = arr.findIndex((it) => deepEqual(it, item));
          if (ix >= 0) arr.splice(ix, 1);
          else throw new ModError(`no item ${JSON.stringify(item)} to remove`);
        }
      } else throw new ModError('removeArr needs "names" or "items"');
      return;
    }
    case 'renameArr': {
      const arr = requireArray(target, path);
      for (const rename of asArray(m.renames)) {
        if (!isObject(rename)) continue;
        const ent = arr.find((it) => nameOf(it) === rename.rename);
        if (!isObject(ent)) throw new ModError(`no item named "${String(rename.rename)}"`);
        ent.name = rename.with;
      }
      return;
    }
    case 'replaceName': {
      const arr = arrayAt(target, path);
      if (!arr) return;
      const replace = textReplacer(m);
      for (const ent of arr) {
        if (isObject(ent) && typeof ent.name === 'string') ent.name = replace(ent.name);
      }
      return;
    }
    case 'replaceTxt': {
      const arr = arrayAt(target, path);
      if (!arr) return;
      const replace = textReplacer(m);
      const props = Array.isArray(m.props) ? (m.props as (string | null)[]) : TEXT_PROPS_DEFAULT;
      setPath(
        target,
        path,
        arr.map((ent) => {
          if (typeof ent === 'string') return props.includes(null) ? replace(ent) : ent;
          if (!isObject(ent)) return ent;
          for (const prop of props) {
            if (prop !== null && ent[prop] !== undefined) {
              ent[prop] = mapStrings(ent[prop], replace);
            }
          }
          return ent;
        }),
      );
      return;
    }
    case 'setProp':
      setPath(target, combinedPath(propPath, m), clone(m.value));
      return;
    case 'prefixSuffixStringProp': {
      const p = combinedPath(propPath, m);
      const existing = getPath(target, p);
      if (typeof existing !== 'string') return;
      const prefix = typeof m.prefix === 'string' ? m.prefix : '';
      const suffix = typeof m.suffix === 'string' ? m.suffix : '';
      setPath(target, p, `${prefix}${existing}${suffix}`);
      return;
    }
    case 'scalarAddProp':
      scalar(target, path, m, (n) => n + Number(m.scalar));
      return;
    case 'scalarMultProp':
      scalar(target, path, m, (n) => {
        const out = n * Number(m.scalar);
        return m.floor === true ? Math.floor(out) : out;
      });
      return;
    default:
      warn('modUnsupported', `Unsupported _mod mode "${String(m.mode)}"`);
  }
}

/**
 * Apply a `_mod` block to `target` in place. Failed operations are reported and skipped, so
 * one bad operation does not lose the whole record.
 */
export function applyMods(target: RawObject, mods: unknown, warn: ModWarn): void {
  if (!isObject(mods)) return;
  const tail = (p: string) => (p === '_' ? 1 : p === '*' ? 2 : 0);
  const props = Object.keys(mods).sort((a, b) => tail(a) - tail(b));
  for (const prop of props) {
    const paths: (string[] | null)[] =
      prop === '_' ? [null] : prop === '*' ? STAR_PROPS.map((p) => [p]) : [prop.split('.')];
    for (const info of asArray(mods[prop])) {
      for (const path of paths) {
        try {
          applyOne(target, path, info, warn);
        } catch (err) {
          // Missing star props are expected (they are stat-block props), so stay quiet there.
          if (prop === '*' && err instanceof ModError) continue;
          warn('modFailed', `${prop}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  }
}
