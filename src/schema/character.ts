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

/** 2: drafts, deity, ward, once-per-turn reminders, item variants and charges (plan §9.1). */
export const CHARACTER_SCHEMA_VERSION = 2;

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

/** Where an item is in use. `worn`: rings, cloaks and other items that are not held. */
export type EquipSlot = 'armor' | 'shield' | 'mainHand' | 'offHand' | 'bothHands' | 'worn';

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
  /** A magic variant applied to this base item: `+1 Longsword` is longsword + `+1 weapon`. */
  variantRef?: Ref;
  chargesUsed?: number;
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
  /** P12: current ward hit points (Arcane Ward). */
  wardHp: number;
  /** Once-per-turn reminders: rider ids used this turn, cleared from the Actions tab. */
  turn: { ridersUsed: string[] };
  /** When a prepared spell was last swapped, for one-swap-per-rest casters (warning only). */
  lastPrepSwapAt?: number;
}

export interface Details {
  alignment?: string;
  /** A god from the library, or free text (no `ref`). Gods have no effects (plan §9.1). */
  deity?: { ref?: Ref; name: string };
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
  /** The entity's reprints when captured, so a missing owner can be aliased (plan §4.4). */
  supersededBy?: Id[];
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
  /** Set while the character is still in the creation wizard. */
  draft?: { step: string };
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
