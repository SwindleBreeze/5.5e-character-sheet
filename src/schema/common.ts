// Shared primitive types for the internal schema. Pure types only.

/** Lowercased, kind-specific id (see plan §4.1), e.g. `fireball|xphb`. */
export type Id = string;

/** Source code as used by the content, e.g. `XPHB`. */
export type SourceCode = string;

/** A string that may contain inline `{@tag text|arg|display}` markup (plan §4.2). */
export type TaggedString = string;

export const ENTITY_KINDS = [
  'spell',
  'class',
  'classFeature',
  'subclass',
  'subclassFeature',
  'background',
  'feat',
  'species',
  'item',
  'optionalFeature',
  'rule',
  'deity',
  'reward',
  'facility',
  'charOption',
] as const;

export type EntityKind = (typeof ENTITY_KINDS)[number];

export interface Ref {
  kind: EntityKind;
  id: Id;
}

/** Canonical string form of a Ref: `<kind>:<id>`. */
export type RefKey = string;

export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export type Skill =
  | 'acrobatics'
  | 'animal handling'
  | 'arcana'
  | 'athletics'
  | 'deception'
  | 'history'
  | 'insight'
  | 'intimidation'
  | 'investigation'
  | 'medicine'
  | 'nature'
  | 'perception'
  | 'performance'
  | 'persuasion'
  | 'religion'
  | 'sleight of hand'
  | 'stealth'
  | 'survival';

export type Size = 'T' | 'S' | 'M' | 'L' | 'H' | 'G';

export type MoveMode = 'walk' | 'fly' | 'swim' | 'climb' | 'burrow';

export type Edition = '2014' | '2024' | 'unknown';

export type Recharge = 'short' | 'long' | 'shortOne' | 'dawn' | 'none';

/**
 * A number, or an expression in the safe formula DSL (no eval), e.g. `pb`, `mod.wis`,
 * `level.fighter`, `table.second-wind`, `max(1,mod.cha)`.
 */
export type Formula = number | string;

/** A choice offered by an entity. `slot` is a stable local name (plan §4.4). */
export interface ChoiceSlot<T> {
  slot: string;
  count: Formula;
  from: T[] | 'any';
}

/** Rich text: a tree of blocks whose leaves are tagged strings. */
export type Entry = TaggedString | EntryBlock;

export type EntryBlock =
  | { type: 'entries' | 'section' | 'inset'; name?: string; entries: Entry[] }
  | { type: 'list'; items: Entry[]; style?: 'bullet' | 'none' }
  | { type: 'table'; caption?: string; colLabels: TaggedString[]; rows: Entry[][] }
  | { type: 'item'; name: string; entries: Entry[] }
  | { type: 'quote'; entries: Entry[]; by?: string }
  /** "Choose N of the following"; options are usually refs to features. */
  | { type: 'options'; count?: number; entries: Entry[] }
  | { type: 'ref'; ref: Ref }
  | { type: 'unknown'; raw: unknown };
