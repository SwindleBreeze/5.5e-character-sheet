// Normalize 5etools entry trees to our Entry union (plan §4.2). Leaves stay tagged strings.
// Images and other presentation-only blocks are dropped; anything unrecognised is kept as
// `unknown` so nothing is silently lost.

import type { Entry, EntryBlock, Ref } from '../../schema/index.ts';
import { ABILITY_NAMES } from '../../schema/index.ts';
import { uidToId } from './uid.ts';
import { asArray, isObject, type RawObject } from './raw.ts';

const DROPPED = new Set(['image', 'gallery', 'hr', 'pagebreak', 'homebrew', 'wrapper']);

function name(o: RawObject): string | undefined {
  return typeof o.name === 'string' ? o.name : undefined;
}

function withName<T extends object>(block: T, n: string | undefined): T & { name?: string } {
  return n === undefined ? block : { ...block, name: n };
}

function abilityList(o: RawObject): string {
  const names = asArray(o.attributes)
    .filter((a): a is string => typeof a === 'string')
    .map((a) => (ABILITY_NAMES as Record<string, string>)[a] ?? a);
  return names.join(' or ');
}

function refEntry(o: RawObject): Entry | null {
  let ref: Ref | null = null;
  if (o.type === 'refClassFeature' && typeof o.classFeature === 'string') {
    ref = { kind: 'classFeature', id: uidToId.classFeature(o.classFeature) };
  } else if (o.type === 'refSubclassFeature' && typeof o.subclassFeature === 'string') {
    ref = { kind: 'subclassFeature', id: uidToId.subclassFeature(o.subclassFeature) };
  } else if (o.type === 'refOptionalfeature' && typeof o.optionalfeature === 'string') {
    ref = { kind: 'optionalFeature', id: uidToId.nameSource(o.optionalfeature, 'PHB') };
  } else if (o.type === 'refFeat' && typeof o.feat === 'string') {
    ref = { kind: 'feat', id: uidToId.nameSource(o.feat, 'PHB') };
  }
  return ref ? { type: 'ref', ref } : null;
}

function cell(value: unknown): Entry {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (isObject(value) && value.type === 'cell') {
    if (value.entry !== undefined) return normalizeEntry(value.entry) ?? '';
    const roll = isObject(value.roll) ? value.roll : {};
    if (typeof roll.exact === 'number') return String(roll.exact);
    if (typeof roll.min === 'number' && typeof roll.max === 'number') {
      return roll.min === roll.max ? String(roll.min) : `${roll.min}–${roll.max}`;
    }
    return '';
  }
  return normalizeEntry(value) ?? '';
}

/** Normalize one entry. Returns null for entries that are intentionally dropped. */
export function normalizeEntry(raw: unknown): Entry | null {
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number') return String(raw);
  if (!isObject(raw)) return null;
  const type = typeof raw.type === 'string' ? raw.type : 'entries';
  if (DROPPED.has(type)) return null;

  const children = (value: unknown) => normalizeEntries(value);
  let block: EntryBlock;

  switch (type) {
    case 'entries':
    case 'section':
    case 'variantSub':
    case 'flowBlock':
    case 'optfeature':
      block = withName(
        { type: type === 'section' ? 'section' : 'entries', entries: children(raw.entries) },
        name(raw),
      );
      break;
    case 'inset':
    case 'insetReadaloud':
    case 'variant':
    case 'variantInner':
      block = withName({ type: 'inset', entries: children(raw.entries) }, name(raw));
      break;
    case 'list': {
      const style =
        raw.style === 'list-no-bullets' || String(raw.style ?? '').includes('notitle')
          ? 'none'
          : 'bullet';
      block = { type: 'list', items: children(raw.items), style };
      break;
    }
    case 'item':
    case 'itemSub':
    case 'itemSpell': {
      const body = raw.entries !== undefined ? children(raw.entries) : children(raw.entry);
      block = { type: 'item', name: name(raw) ?? '', entries: body };
      break;
    }
    case 'table': {
      const rows = asArray(raw.rows).map((row) => {
        if (isObject(row) && row.type === 'row') return asArray(row.row).map(cell);
        return asArray(row).map(cell);
      });
      block = {
        type: 'table',
        colLabels: asArray(raw.colLabels).map((l) => (typeof l === 'string' ? l : '')),
        rows,
      };
      if (typeof raw.caption === 'string') block.caption = raw.caption;
      break;
    }
    case 'tableGroup':
      block = { type: 'entries', entries: children(raw.tables) };
      break;
    case 'quote': {
      block = { type: 'quote', entries: children(raw.entries) };
      if (typeof raw.by === 'string') block.by = raw.by;
      break;
    }
    case 'options': {
      block = { type: 'options', entries: children(raw.entries) };
      if (typeof raw.count === 'number') block.count = raw.count;
      break;
    }
    case 'inline':
    case 'inlineBlock': {
      const parts = children(raw.entries);
      if (parts.every((p) => typeof p === 'string')) return parts.join('');
      block = { type: 'entries', entries: parts };
      break;
    }
    case 'link':
      return typeof raw.text === 'string' ? raw.text : null;
    case 'dice':
      return isObject(raw) && Array.isArray(raw.toRoll)
        ? `{@dice ${raw.toRoll
            .filter(isObject)
            .map((d) => `${String(d.number ?? 1)}d${String(d.faces ?? 6)}`)
            .join('+')}}`
        : null;
    case 'abilityDc':
      return `{@b ${name(raw) ?? 'Spell'} save DC} = 8 + your Proficiency Bonus + your ${abilityList(raw)} modifier`;
    case 'abilityAttackMod':
      return `{@b ${name(raw) ?? 'Spell'} attack modifier} = your Proficiency Bonus + your ${abilityList(raw)} modifier`;
    case 'abilityGeneric': {
      const text = typeof raw.text === 'string' ? raw.text : '';
      return name(raw) ? `{@b ${name(raw)}} = ${text}` : text;
    }
    case 'statblock':
    case 'statblockInline': {
      const tag = typeof raw.tag === 'string' ? raw.tag : 'creature';
      const n = name(raw) ?? (isObject(raw.data) ? String(raw.data.name ?? '') : '');
      const src = typeof raw.source === 'string' ? `|${raw.source}` : '';
      return n ? `{@${tag} ${n}${src}}` : null;
    }
    case 'refClassFeature':
    case 'refSubclassFeature':
    case 'refOptionalfeature':
    case 'refFeat':
      return refEntry(raw);
    default:
      if (Array.isArray(raw.entries)) {
        block = withName({ type: 'entries', entries: children(raw.entries) }, name(raw));
      } else {
        block = { type: 'unknown', raw };
      }
  }
  return block;
}

export function normalizeEntries(value: unknown): Entry[] {
  const out: Entry[] = [];
  for (const e of asArray(value)) {
    const n = normalizeEntry(e);
    if (n !== null) out.push(n);
  }
  return out;
}
