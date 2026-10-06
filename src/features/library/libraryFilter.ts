// Library search and filters (plan §6.5). Pure, so it is tested without the UI.

import type { ContentEntity, EntityKind } from '../../schema/index.ts';
import { nameFromId } from '../../richtext/entityMeta.ts';

export const LIBRARY_KINDS: { kind: EntityKind; label: string }[] = [
  { kind: 'spell', label: 'Spells' },
  { kind: 'class', label: 'Classes' },
  { kind: 'subclass', label: 'Subclasses' },
  { kind: 'species', label: 'Species' },
  { kind: 'background', label: 'Backgrounds' },
  { kind: 'feat', label: 'Feats' },
  { kind: 'item', label: 'Items' },
  { kind: 'optionalFeature', label: 'Options' },
  { kind: 'rule', label: 'Rules' },
];

export function isLibraryKind(value: string | null): value is EntityKind {
  return LIBRARY_KINDS.some((k) => k.kind === value);
}

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterDef {
  key: string;
  label: string;
  /** All values an entity has for this filter. */
  values: (e: ContentEntity) => string[];
  /** Display label for a value. */
  labelOf?: (value: string) => string;
  /** Sort values numerically instead of by label. */
  numeric?: boolean;
}

const ORDINALS = ['Cantrip', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const withSource = (id: string) =>
  `${nameFromId(id)} (${(id.split('|').pop() ?? '').toUpperCase()})`;

const FILTERS: Partial<Record<EntityKind, FilterDef[]>> = {
  spell: [
    {
      key: 'level',
      label: 'Level',
      values: (e) => (e.kind === 'spell' ? [String(e.level)] : []),
      labelOf: (v) => ORDINALS[Number(v)] ?? v,
      numeric: true,
    },
    {
      key: 'class',
      label: 'Class',
      values: (e) => (e.kind === 'spell' ? e.classIds : []),
      labelOf: withSource,
    },
    {
      key: 'school',
      label: 'School',
      values: (e) => (e.kind === 'spell' ? [e.school] : []),
      labelOf: cap,
    },
  ],
  subclass: [
    {
      key: 'class',
      label: 'Class',
      values: (e) => (e.kind === 'subclass' ? [e.classId] : []),
      labelOf: withSource,
    },
  ],
  feat: [
    {
      key: 'category',
      label: 'Category',
      values: (e) => (e.kind === 'feat' ? [e.category] : []),
      labelOf: cap,
    },
  ],
  item: [
    {
      key: 'type',
      label: 'Type',
      values: (e) => (e.kind === 'item' ? [e.itemKind] : []),
      labelOf: cap,
    },
    {
      key: 'rarity',
      label: 'Rarity',
      values: (e) => (e.kind === 'item' && e.rarity ? [e.rarity] : []),
      labelOf: cap,
    },
  ],
  optionalFeature: [
    {
      key: 'type',
      label: 'Type',
      values: (e) => (e.kind === 'optionalFeature' ? e.featureTypes : []),
    },
  ],
  rule: [
    {
      key: 'kind',
      label: 'Kind',
      values: (e) => (e.kind === 'rule' ? [e.ruleKind] : []),
      labelOf: cap,
    },
  ],
};

export function filtersFor(kind: EntityKind): FilterDef[] {
  return FILTERS[kind] ?? [];
}

/** The values present in `list` for a filter, as select options. */
export function optionsFor(def: FilterDef, list: readonly ContentEntity[]): FilterOption[] {
  const values = [...new Set(list.flatMap(def.values))];
  const options = values.map((value) => ({
    value,
    label: def.labelOf ? def.labelOf(value) : value,
  }));
  return def.numeric
    ? options.sort((a, b) => Number(a.value) - Number(b.value))
    : options.sort((a, b) => a.label.localeCompare(b.label));
}

/** Lowercase, without diacritics or punctuation differences, for forgiving search. */
export function searchKey(text: string): string {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[’']/g, "'").trim();
}

export function filterLibrary<T extends ContentEntity>(
  list: readonly T[],
  query: string,
  selected: Record<string, string>,
  kind: EntityKind,
): T[] {
  const q = searchKey(query);
  const defs = filtersFor(kind).filter((d) => selected[d.key]);
  return list
    .filter((e) => (q ? searchKey(e.name).includes(q) : true))
    .filter((e) => defs.every((d) => d.values(e).includes(selected[d.key] ?? '')))
    .sort((a, b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source));
}
