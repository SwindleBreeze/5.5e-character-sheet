// Content entities of the internal schema (plan §4.3). Pure types only.

import type {
  Ability,
  ChoiceSlot,
  Edition,
  Entry,
  EntityKind,
  Id,
  MoveMode,
  Ref,
  Size,
  SourceCode,
  TaggedString,
} from './common.ts';
import type { Effect } from './effects.ts';

export interface ContentOrigin {
  adapter: '5etools' | 'pack' | 'homebrew';
  adapterVersion: number;
  importedAt: number;
}

export interface BaseEntity {
  id: Id;
  kind: EntityKind;
  name: string;
  source: SourceCode;
  page?: number;
  edition: Edition;
  /** Ids of entities that reprint this one (from 5etools `reprintedAs`). */
  supersededBy?: Id[];
  /** Set on `_versions` variants (species lineages, feat versions, 2014 subraces). */
  variantOf?: Id;
  entries: Entry[];
  /** Effects derived automatically from structured data. */
  effects: Effect[];
  origin: ContentOrigin;
}

/** A class or subclass table column, referenced by its normalized `key` (plan §4.3). */
export interface TableColumn {
  key: string;
  label: TaggedString;
  /** 20 rows; numeric strings are parsed to numbers. */
  values: (string | number)[];
}

export interface Progression {
  key: string;
  name: string;
  atLevels: Record<number, number>;
}

export interface FeatProgression extends Progression {
  categories: string[];
}

export interface OptionalFeatureProgression extends Progression {
  featureTypes: string[];
}

export type Prereq =
  | { type: 'level'; level: number; classId?: Id; subclassId?: Id }
  | { type: 'ability'; anyOf: Partial<Record<Ability, number>>[] }
  | { type: 'proficiency'; category: string; value: string }
  | { type: 'spellcasting' }
  | { type: 'feature'; ref: Ref }
  | { type: 'feat'; ref: Ref }
  | { type: 'other'; text: TaggedString };

/** Prerequisites as any-of groups of all-of requirements; empty means none. */
export type Prereqs = Prereq[][];

/** What using a feature spends, e.g. one Superiority Die (P14; becomes an action cost). */
export interface Consumes {
  name: string;
  amount?: number;
}

export interface EquipmentItemGrant {
  itemId?: Id;
  /** Free-text item when no entity exists (e.g. "Spellbook"). */
  special?: string;
  quantity: number;
}

/** One lettered option of a starting-equipment choice (A/B/C…). */
export interface EquipmentOption {
  key: string;
  /** Option group, for sources with several independent choices (2014 classes). */
  group?: number;
  items: EquipmentItemGrant[];
  /** Coins in copper pieces. */
  valueCp: number;
}

export interface Spell extends BaseEntity {
  kind: 'spell';
  level: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  school: string;
  time: { amount: number; unit: string; condition?: string }[];
  range: { type: string; distance?: { type: string; amount?: number } };
  components: {
    v?: boolean;
    s?: boolean;
    m?: { text: string; costCp?: number; consumed?: boolean };
  };
  duration: { type: string; amount?: number; unit?: string; concentration?: boolean }[];
  ritual: boolean;
  classIds: Id[];
  subclassIds: Id[];
  higherLevel?: Entry[];
  damageTypes?: string[];
  saves?: Ability[];
  attack?: 'melee' | 'ranged';
}

export interface ClassSpellcasting {
  ability: Ability;
  progression: 'full' | 'half' | 'third' | 'pact' | 'artificer';
  preparedByLevel?: number[];
  cantripsByLevel?: number[];
  spellbookByLevel?: number[];
}

export interface ClassDef extends BaseEntity {
  kind: 'class';
  hitDie: number;
  /** Any-of groups: Fighter is `[['str'], ['dex']]`. */
  primaryAbility: Ability[][];
  saves: Ability[];
  startingProficiencies: {
    armor: string[];
    weapons: string[];
    tools: string[];
    skills?: ChoiceSlot<string>;
  };
  startingEquipment: EquipmentOption[];
  multiclass: {
    prereq: Ability[][];
    gains: { armor: string[]; weapons: string[]; tools: string[]; skills?: ChoiceSlot<string> };
  };
  spellcasting?: ClassSpellcasting;
  table: TableColumn[];
  /** Spell slots per level (index 0 = class level 1), then slot level 1..9. */
  slotTable?: number[][];
  features: { level: number; featureId: Id; gainSubclassFeature: boolean }[];
  subclassTitle: string;
  subclassLevel: number;
  featProgression: FeatProgression[];
  optionalFeatureProgression: OptionalFeatureProgression[];
}

export interface ClassFeature extends BaseEntity {
  kind: 'classFeature';
  classId: Id;
  level: number;
  consumes?: Consumes;
}

export interface Subclass extends BaseEntity {
  kind: 'subclass';
  classId: Id;
  shortName: string;
  features: { level: number; featureId: Id }[];
  table?: TableColumn[];
  slotTable?: number[][];
  spellcasting?: ClassSpellcasting;
  featProgression?: FeatProgression[];
  optionalFeatureProgression?: OptionalFeatureProgression[];
}

export interface SubclassFeature extends BaseEntity {
  kind: 'subclassFeature';
  classId: Id;
  subclassId: Id;
  level: number;
  consumes?: Consumes;
}

export interface Background extends BaseEntity {
  kind: 'background';
  /** Allowed ability increases, e.g. `{ from: ['con','int','wis'], weights: [2,1] }`. */
  abilityOptions: { from: Ability[]; weights: number[] }[];
  featId?: Id;
  equipment: EquipmentOption[];
}

export interface Feat extends BaseEntity {
  kind: 'feat';
  /** Normalized category: origin, general, fightingStyle, epicBoon, or the raw code. */
  category: string;
  prerequisites: Prereqs;
  repeatable: boolean;
}

export interface Species extends BaseEntity {
  kind: 'species';
  size: Size[];
  speed: Partial<Record<MoveMode, number>>;
  creatureType: string;
}

export type ItemKind =
  | 'weapon'
  | 'armor'
  | 'shield'
  | 'gear'
  | 'pack'
  | 'tool'
  | 'ammo'
  | 'focus'
  | 'wondrous'
  | 'variant'
  | 'other';

export type ItemBonus =
  | 'weapon'
  | 'weaponAttack'
  | 'weaponDamage'
  | 'ac'
  | 'spellAttack'
  | 'spellSaveDc'
  | 'savingThrow'
  | 'abilityCheck';

/**
 * A generic magic variant (`+1 Weapon`), applied to a base item on demand (plan §1).
 * `requires`/`excludes` are 5etools item filters, kept as data.
 */
export interface MagicVariant {
  requires: Record<string, unknown>[];
  excludes?: Record<string, unknown>;
  namePrefix?: string;
  nameSuffix?: string;
  /** Item fields the variant sets, e.g. rarity, bonuses, attunement. */
  inherits: Record<string, unknown>;
}

export interface Item extends BaseEntity {
  kind: 'item';
  itemKind: ItemKind;
  weightLb?: number;
  valueCp?: number;
  rarity?: string;
  attunement?: boolean | string;
  weapon?: {
    category: 'simple' | 'martial';
    damage: string;
    versatile?: string;
    damageType: string;
    properties: Id[];
    masteryId?: Id;
    range?: [number, number];
  };
  armor?: {
    category: 'light' | 'medium' | 'heavy';
    ac: number;
    strReq?: number;
    stealthDis?: boolean;
  };
  shieldAc?: number;
  packContents?: { itemId: Id; quantity: number }[];
  containerCapacityLb?: number;
  bonuses?: Partial<Record<ItemBonus, number>>;
  charges?: number;
  recharge?: string;
  /** For magic items built on a base item, e.g. `longsword|xphb`. */
  baseItemId?: Id;
  variant?: MagicVariant;
}

export interface OptionalFeature extends BaseEntity {
  kind: 'optionalFeature';
  featureTypes: string[];
  prerequisites: Prereqs;
  consumes?: Consumes;
}

export type RuleKind =
  | 'variantrule'
  | 'action'
  | 'sense'
  | 'skill'
  | 'language'
  | 'status'
  | 'itemProperty'
  | 'condition'
  | 'disease'
  | 'mastery';

export interface Rule extends BaseEntity {
  kind: 'rule';
  ruleKind: RuleKind;
  /** Item properties: the short code used by items, e.g. `V`. */
  abbreviation?: string;
  /** Skills: the ability they use. */
  ability?: Ability;
  /** Languages: `standard`, `rare`, `secret`… */
  languageType?: string;
}

export type Condition = Rule & { ruleKind: 'condition' };
export type WeaponMastery = Rule & { ruleKind: 'mastery' };

export interface EntityByKind {
  spell: Spell;
  class: ClassDef;
  classFeature: ClassFeature;
  subclass: Subclass;
  subclassFeature: SubclassFeature;
  background: Background;
  feat: Feat;
  species: Species;
  item: Item;
  optionalFeature: OptionalFeature;
  rule: Rule;
}

export type ContentEntity = EntityByKind[EntityKind];

/** Entities grouped by kind, as produced by an import and stored in a pack. */
export type EntitiesByKind = { [K in EntityKind]?: EntityByKind[K][] };
