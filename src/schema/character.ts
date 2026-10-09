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
  /**
   * Only on log[0]. Both are set on a finished character; a draft in the creation wizard may
   * have one before the other.
   */
  origin?: { speciesRef?: Ref; backgroundRef?: Ref };
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
  /** The row of the container it is in. Equipped items are never in a container. */
  containerUid?: string;
  notes?: string;
  custom?: { weightLb?: number; valueCp?: number };
  /** A magic variant applied to this base item: `+1 Longsword` is longsword + `+1 weapon`. */
  variantRef?: Ref;
  chargesUsed?: number;
  /** This item's maximum charges, when the item gives them as dice (rolled when found). */
  chargesMax?: number;
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
  /**
   * Once-per-turn reminders, cleared by ending the turn: rider ids used this turn, and whether
   * a spell slot was already expended to cast a spell (only one per turn, 2024).
   */
  turn: { ridersUsed: string[]; slotSpent?: boolean };
  /**
   * Prepared spells replaced since the last Long Rest, by caster key. Paladins and Rangers may
   * replace one (2024); more is a warning, never a block.
   */
  prepSwaps?: Record<string, number>;
  /**
   * Ammunition expended since it was last recovered, by inventory row: after a fight, half
   * of it (rounded down) can be recovered (2024 Ammunition property).
   */
  ammoUsed?: Record<string, number>;
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
  /** A class's Hit Die, so its hit points stay right while its content isn't loaded. */
  hitDie?: number;
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

/**
 * An effect the player added to a feature (plan step 7.5): for what the app doesn't apply by
 * itself, a homebrew feature most of all. Shown as "added by you" wherever it counts.
 */
export interface CustomEffect {
  uid: string;
  /** The feature, feat, species or item it belongs to; it applies while that one does. */
  owner: Ref;
  effect: Effect;
}

/**
 * A familiar, steed, companion or summon kept on the sheet (plan §10.3, step 7.6): its stat
 * block, the spell level it was summoned at, and its hit points.
 */
export interface Extra {
  /** Stable id of this row. */
  uid: string;
  /** The creature (kind `creature`); missing for one written in by hand. */
  creatureRef?: Ref;
  /** Its name: the creature's at the time it was added, or the player's own. */
  name: string;
  /** Spell level it was summoned at, for stat blocks that scale with it. */
  spellLevel?: number;
  /** Damage taken, as on the character, so a changed maximum never corrupts current HP. */
  damage: number;
  tempHp: number;
  /** The player's own HP maximum, when the stat block's can't be worked out. */
  hpMax?: number;
  notes?: string;
}

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
  /**
   * Set while the character is still in the creation wizard (plan §9.3 step 4.4): the step it
   * is on, the items picked for "any …" starting equipment entries (keyed by
   * `<owner ref key>#<option>#<entry index>`), the dice of rolled ability scores, and the picks
   * set aside when a class, background or species was changed (they come back when it is
   * chosen again; plan step 4C.1). Cleared when it is created.
   */
  draft?: {
    step: string;
    anyItems?: Record<string, Id>;
    rolls?: number[][];
    setAside?: ChoiceRecord[];
  };
  inventory: InventoryItem[];
  /** Familiars, steeds, companions and summons (step 7.6; optional, no migration). */
  extras?: Extra[];
  /**
   * Beast forms known for Wild Shape, by creature id (step 7.6; optional, no migration). Like
   * prepared spells, they may change after a Long Rest, so they are play state, not choices.
   */
  wildShapeForms?: Id[];
  currency: Currency;
  state: PlayState;
  overrides: Partial<Record<OverrideKey, number | string | boolean>>;
  details: Details;
  notes: string;
  sessionLog: SessionNote[];
  portraitId?: string;
  snapshots: Record<RefKey, Snapshot>;
  /** Effects the player added to features (plan step 7.5). */
  customEffects?: CustomEffect[];
  ui: {
    tabOrder?: string[];
    hiddenTabs?: string[];
    /** "Needs attention" items the player chose to ignore, by key (step 3.23). */
    ignoredAttention?: string[];
  };
}
