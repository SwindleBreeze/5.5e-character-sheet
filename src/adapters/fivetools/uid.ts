// 5etools UIDs: `|`-separated references with per-kind fields and defaults (plan §1). Empty
// fields fall back to defaults, e.g. `Projected Ward|Wizard||Abjuration||6` means class source
// PHB, subclass source PHB, feature source = subclass source.

import {
  classFeatureId,
  classId,
  nameSourceId,
  subclassFeatureId,
  subclassId,
  type Id,
} from '../../schema/index.ts';
import { isObject, type RawEntity } from './raw.ts';

const PHB = 'PHB';

function fields(uid: string): string[] {
  return uid.split('|').map((p) => p.trim());
}

function orDefault(value: string | undefined, fallback: string): string {
  return value ? value : fallback;
}

export interface NameSourceUid {
  name: string;
  source: string;
}

/** `name|source`, with the tag's default source. */
export function parseNameSourceUid(uid: string, defaultSource: string): NameSourceUid {
  const [name = '', source] = fields(uid);
  return { name, source: orDefault(source, defaultSource) };
}

export interface ClassFeatureUid {
  name: string;
  className: string;
  classSource: string;
  level: number;
  source: string;
}

/** `name|className|classSource|level|source`. */
export function parseClassFeatureUid(uid: string): ClassFeatureUid {
  const [name = '', className = '', classSourceRaw, level, source] = fields(uid);
  const classSource = orDefault(classSourceRaw, PHB);
  return {
    name,
    className,
    classSource,
    level: Number(level),
    source: orDefault(source, classSource),
  };
}

export interface SubclassFeatureUid {
  name: string;
  className: string;
  classSource: string;
  subclassShortName: string;
  subclassSource: string;
  level: number;
  source: string;
}

/** `name|className|classSource|subclassShortName|subclassSource|level|source`. */
export function parseSubclassFeatureUid(uid: string): SubclassFeatureUid {
  const [name = '', className = '', classSource, subclassShortName = '', subSource, level, source] =
    fields(uid);
  const subclassSource = orDefault(subSource, PHB);
  return {
    name,
    className,
    classSource: orDefault(classSource, PHB),
    subclassShortName,
    subclassSource,
    level: Number(level),
    source: orDefault(source, subclassSource),
  };
}

export interface SubclassUid {
  shortName: string;
  className: string;
  classSource: string;
  source: string;
}

/** `shortName|className|classSource|source`. */
export function parseSubclassUid(uid: string): SubclassUid {
  const [shortName = '', className = '', classSource, source] = fields(uid);
  return {
    shortName,
    className,
    classSource: orDefault(classSource, PHB),
    source: orDefault(source, PHB),
  };
}

export const uidToId = {
  classFeature(uid: string): Id {
    const u = parseClassFeatureUid(uid);
    return classFeatureId(u.name, u.className, u.classSource, u.level, u.source);
  },
  subclassFeature(uid: string): Id {
    const u = parseSubclassFeatureUid(uid);
    return subclassFeatureId(
      u.name,
      u.className,
      u.classSource,
      u.subclassShortName,
      u.subclassSource,
      u.level,
      u.source,
    );
  },
  subclass(uid: string): Id {
    const u = parseSubclassUid(uid);
    return subclassId(u.shortName, u.className, u.classSource, u.source);
  },
  nameSource(uid: string, defaultSource: string): Id {
    const u = parseNameSourceUid(uid, defaultSource);
    return nameSourceId(u.name, u.source);
  },
  class(uid: string): Id {
    const u = parseNameSourceUid(uid, PHB);
    return classId(u.name, u.source);
  },
};

function s(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

/**
 * The identity of a record within its 5etools type, used to find `_copy` parents. Mirrors the
 * fields of the type's UID, lowercased.
 */
export function identityKey(prop: string, e: RawEntity): string {
  let parts: unknown[];
  switch (prop) {
    case 'subclass':
      parts = [e.shortName, e.className, e.classSource, e.source];
      break;
    case 'classFeature':
      parts = [e.name, e.className, e.classSource, e.level, e.source];
      break;
    case 'subclassFeature':
      parts = [
        e.name,
        e.className,
        e.classSource,
        e.subclassShortName,
        e.subclassSource,
        e.level,
        e.source,
      ];
      break;
    case 'subrace':
      parts = [e.name, e.raceName, e.raceSource, e.source];
      break;
    case 'itemProperty':
    case 'itemType':
      parts = [e.abbreviation, e.source];
      break;
    case 'magicvariant':
      // A variant's source lives in `inherits`.
      parts = [e.name, isObject(e.inherits) ? (e.inherits.source ?? e.source) : e.source];
      break;
    default:
      parts = [e.name, e.source];
  }
  return parts.map(s).join('|').toLowerCase();
}
