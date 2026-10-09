// Dexie database (plan §5, "Dexie v1"; v2 in plan §6.12). Only the repos in this folder touch it directly.

import { Dexie, type EntityTable } from 'dexie';
import type {
  Background,
  CharOption,
  Character,
  Creature,
  ClassDef,
  ClassFeature,
  Deity,
  EntityKind,
  Facility,
  Feat,
  Item,
  OptionalFeature,
  Reward,
  Rule,
  SourceInfo,
  Species,
  Spell,
  Subclass,
  SubclassFeature,
} from '../schema/index.ts';

export interface PortraitRow {
  id: string;
  blob: Blob;
  updatedAt: number;
}

export interface SettingRow {
  key: string;
  value: unknown;
}

export const DB_NAME = 'char-sheet';

export class AppDb extends Dexie {
  spells!: EntityTable<Spell, 'id'>;
  classes!: EntityTable<ClassDef, 'id'>;
  classFeatures!: EntityTable<ClassFeature, 'id'>;
  subclasses!: EntityTable<Subclass, 'id'>;
  subclassFeatures!: EntityTable<SubclassFeature, 'id'>;
  backgrounds!: EntityTable<Background, 'id'>;
  feats!: EntityTable<Feat, 'id'>;
  species!: EntityTable<Species, 'id'>;
  items!: EntityTable<Item, 'id'>;
  optionalFeatures!: EntityTable<OptionalFeature, 'id'>;
  rules!: EntityTable<Rule, 'id'>;
  deities!: EntityTable<Deity, 'id'>;
  rewards!: EntityTable<Reward, 'id'>;
  facilities!: EntityTable<Facility, 'id'>;
  charOptions!: EntityTable<CharOption, 'id'>;
  creatures!: EntityTable<Creature, 'id'>;
  sources!: EntityTable<SourceInfo, 'code'>;
  characters!: EntityTable<Character, 'id'>;
  portraits!: EntityTable<PortraitRow, 'id'>;
  settings!: EntityTable<SettingRow, 'key'>;

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(1).stores({
      spells: 'id, source, level, *classIds, *subclassIds, name',
      classes: 'id, source',
      classFeatures: 'id, classId, level, source',
      subclasses: 'id, classId, source',
      subclassFeatures: 'id, subclassId, level, source',
      backgrounds: 'id, source',
      feats: 'id, source, category',
      species: 'id, source, variantOf',
      items: 'id, source, itemKind',
      optionalFeatures: 'id, source, *featureTypes',
      rules: 'id, ruleKind, source',
      sources: 'code',
      characters: 'id, updatedAt',
      portraits: 'id',
      settings: 'key',
    });
    // Phase 2b (plan §6.12): player extras. New tables only, so no upgrade function.
    this.version(2).stores({
      deities: 'id, source, pantheon',
      rewards: 'id, source, rewardType',
      facilities: 'id, source, facilityType, level',
      charOptions: 'id, source',
    });
    // Phase 7 (plan §10.3, step 7.6): creatures that player options summon or name, and Beasts.
    this.version(3).stores({ creatures: 'id, source' });
  }
}

/** Dexie table name for each content kind. */
export const TABLE_BY_KIND = {
  spell: 'spells',
  class: 'classes',
  classFeature: 'classFeatures',
  subclass: 'subclasses',
  subclassFeature: 'subclassFeatures',
  background: 'backgrounds',
  feat: 'feats',
  species: 'species',
  item: 'items',
  optionalFeature: 'optionalFeatures',
  rule: 'rules',
  deity: 'deities',
  reward: 'rewards',
  facility: 'facilities',
  charOption: 'charOptions',
  creature: 'creatures',
} as const satisfies Record<EntityKind, keyof AppDb>;

let instance: AppDb | null = null;

/** The app-wide database. Created lazily so tests can swap it out. */
export function getDb(): AppDb {
  instance ??= new AppDb();
  return instance;
}

/** Test helper: replace the app-wide database with a fresh, empty one. */
export async function resetDb(name: string = DB_NAME): Promise<AppDb> {
  if (instance) {
    instance.close();
    await Dexie.delete(instance.name);
  }
  await Dexie.delete(name);
  instance = new AppDb(name);
  return instance;
}
