// Helpers for reading untyped 5etools JSON. The adapter never trusts the shape of the input:
// every read goes through these guards.

export type RawObject = { [key: string]: unknown };

/** A 5etools record. Most have `name` and `source`; the rest is kind-specific. */
export interface RawEntity extends RawObject {
  name?: string;
  source?: string;
}

export function isObject(value: unknown): value is RawObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asArray<T = unknown>(value: unknown): T[] {
  if (value === undefined || value === null) return [];
  return (Array.isArray(value) ? value : [value]) as T[];
}

export function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function num(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export function strArray(value: unknown): string[] {
  return asArray(value).filter((v): v is string => typeof v === 'string');
}

export function clone<T>(value: T): T {
  return structuredClone(value);
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a)) {
    return Array.isArray(b) && a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  }
  if (isObject(a) && isObject(b)) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => k in b && deepEqual(a[k], b[k]));
  }
  return false;
}

/** Read a dotted property path. */
export function getPath(obj: RawObject, path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (!isObject(cur)) return undefined;
    cur = cur[key];
  }
  return cur;
}

/** Write a dotted property path, creating objects on the way. */
export function setPath(obj: RawObject, path: string[], value: unknown): void {
  let cur = obj;
  for (const key of path.slice(0, -1)) {
    const next = cur[key];
    if (isObject(next)) cur = next;
    else {
      const created: RawObject = {};
      cur[key] = created;
      cur = created;
    }
  }
  const last = path.at(-1);
  if (last !== undefined) cur[last] = value;
}

export function deletePath(obj: RawObject, path: string[]): void {
  const parent = getPath(obj, path.slice(0, -1));
  const last = path.at(-1);
  if (isObject(parent) && last !== undefined) delete parent[last];
}

/** Apply `fn` to every string in a JSON tree, returning a new tree. */
export function mapStrings(value: unknown, fn: (s: string) => string): unknown {
  if (typeof value === 'string') return fn(value);
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn));
  if (isObject(value)) {
    const out: RawObject = {};
    for (const [k, v] of Object.entries(value)) out[k] = mapStrings(v, fn);
    return out;
  }
  return value;
}
