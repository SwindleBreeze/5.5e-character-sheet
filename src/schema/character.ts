// Character model (plan §4.4). Build decisions live only in `log`; play state is separate;
// snapshots are a cache of content so a character survives missing content.

import type {
  Ability,
  Entry,
  EntityKind,
  Id,
  MoveMode,
  Ref,
  RefKey,
  Skill,
  SourceCode,
} from './common.ts';
import type { Effect } from './effects.ts';

export const CHARACTER_SCHEMA_VERSION = 1;

/** Identifies one choice: the entity offering it, its local slot, and an instance number. */
export interface ChoiceKey {
  owner: Ref;
  slot: string;
  /** Instance number, only when the same owner can be taken more than once. */
  n?: number;
}

export interface ChoiceRecord {
  key: ChoiceKey;
  /** Entity ids, or enum values (ability codes, skill keys, tool keys). */
  values: string[];
  /** Set when `values` are entity ids. */
  valueKinds?: EntityKind[];
  /** Display names at pick time, used when content is missing. */
  labels: string[];
  madeAt: number;
  via: 'creation' | 'levelUp' | 'retrain' | 'manual';
}

export type HpGain = { mode: 'max' } | { mode: 'avg' } | { mode: 'roll'; value: number };

export interface LevelEntry {
  /** Character level reached by this entry, 1..20. */
  charLevel: number;
  /** The class that gained a level. */
  classRef: Ref;
  classLevel: number;
  /** Set on the entry where the subclass was chosen. */
  subclassRef?: Ref;
  /** Only on log[0]. */
  origin?: { speciesRef: Ref; backgroundRef: Ref };
  hp: HpGain;
  choices: ChoiceRecord[];
}

export type EquipSlot = 'armor' | 'shield' | 'mainHand' | 'offHand' | 'bothHands';

export interface InventoryItem {
  /** Stable id of this inventory row. */
  uid: string;
  itemRef?: Ref;
  /** Display name at the time it was added (or the custom name). */
  name: string;
  quantity: number;
  equipped?: EquipSlot;
  attuned: boolean;
  containerUid?: string;
  notes?: string;
  custom?: { weightLb?: number; valueCp?: number };
}

export interface Currency {
  cp: number;
  sp: number;
  ep: number;
  gp: number;
  pp: number;
}

export interface ActiveToggle {
  option?: string;
}

export interface PlayState {
  /** Damage taken, so a changed HP maximum never corrupts current HP. */
  damage: number;
  tempHp: number;
  deathSaves: { successes: number; failures: number };
  /** Hit dice spent, keyed by die size (6, 8, 10, 12). */
  hitDiceUsed: Partial<Record<number, number>>;
  /** Spell slots spent, index 0 = slot level 1. */
  slotsUsed: number[];
  pactSlotsUsed: number;
  resourcesUsed: Record<string, number>;
  /** Condition rule ids, excluding exhaustion. */
  conditions: Id[];
  exhaustion: number;
  heroicInspiration: boolean;
  concentration: Ref | null;
  activeToggles: Record<string, ActiveToggle>;
  /** Prepared spell ids per caster key (e.g. class id). */
  prepared: Record<string, Id[]>;
}

export interface Details {
  alignment?: string;
  appearance?: string;
  personality?: string;
  ideals?: string;
  bonds?: string;
  flaws?: string;
  backstory?: string;
  allies?: string;
}

export interface SessionNote {
  id: string;
  date: string;
  text: string;
}

export interface Snapshot {
  ref: Ref;
  name: string;
  entries: Entry[];
  effects: Effect[];
  capturedAt: number;
}

export type OverrideKey =
  | `score.${Ability}`
  | `save.${Ability}`
  | `skill.${Skill}`
  | `passive.${'perception' | 'insight' | 'investigation'}`
  | 'ac'
  | 'initiative'
  | `speed.${MoveMode}`
  | 'hpMax'
  | 'pb'
  | `spellDc.${string}`
  | `spellAttack.${string}`
  | `attack.${string}.toHit`
  | `attack.${string}.damage`;

export type ScoreMethod = 'standard' | 'pointBuy' | 'manual' | 'rolled';

export interface Character {
  id: string;
  schemaVersion: number;
  createdAt: number;
  updatedAt: number;
  name: string;
  /** null = follow the global setting. */
  enabledSources: SourceCode[] | null;
  baseScores: Record<Ability, number>;
  scoreMethod: ScoreMethod;
  /** The build. log[0] is character level 1. */
  log: LevelEntry[];
  inventory: InventoryItem[];
  currency: Currency;
  state: PlayState;
  overrides: Partial<Record<OverrideKey, number | string | boolean>>;
  details: Details;
  notes: string;
  sessionLog: SessionNote[];
  portraitId?: string;
  snapshots: Record<RefKey, Snapshot>;
  ui: { tabOrder?: string[]; hiddenTabs?: string[] };
}
