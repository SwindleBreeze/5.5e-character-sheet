// The derived sheet (plan §9.2, step 3.5): every number the sheet shows, each with the parts
// that make it up, so tapping a number can explain it (plan §8.2 rule 3).

import type {
  Ability,
  ActionType,
  ClassSpellcasting,
  EntityKind,
  Id,
  MoveMode,
  Recharge,
  Ref,
  Size,
  Skill,
  SpellGrant,
} from '../../schema/index.ts';
import type { Pending, Reconciled, RecordStatus } from '../choices/reconcile.ts';
import type { Offer } from '../collect/types.ts';
import type { ItemCharges } from '../items/items.ts';

export interface Contribution {
  label: string;
  value: number;
  /** The entity it comes from, when there is one. */
  source?: Ref;
  /** `set`: replaces the value (an item setting a score); `override`: the player's own. */
  kind?: 'base' | 'bonus' | 'set' | 'override';
}

export interface Derived<T = number> {
  value: T;
  parts: Contribution[];
}

export type RollState = 'normal' | 'advantage' | 'disadvantage';

export interface DerivedRoll {
  bonus: Derived;
  /** Dice added to the roll (Bless: `1d4`), with where they come from. */
  dice: { label: string; dice: string }[];
  proficiency: 'none' | 'half' | 'proficient' | 'expertise';
  /** Advantage and disadvantage together cancel out to `normal`. */
  mode: RollState;
  /** Why there is advantage or disadvantage. */
  advantage: string[];
  disadvantage: string[];
  /** A d20 below this counts as this (Reliable Talent). */
  floor?: number;
}

export interface DerivedSkill extends DerivedRoll {
  skill: Skill;
  ability: Ability;
  passive: Derived;
}

export interface SourcedValue<T = string> {
  value: T;
  sources: string[];
}

export interface RuleIssue {
  severity: 'warn' | 'info';
  code: string;
  message: string;
  ref?: Ref;
}

/** P4: extra damage the player can add to a hit. */
export interface DerivedRider {
  id: string;
  name: string;
  dice: string;
  damageType?: string;
  oncePerTurn: boolean;
  /** Added only when tapped; otherwise part of every hit. */
  optIn: boolean;
  /** Paid when the rider is added to a damage roll. */
  cost?: DerivedCost;
}

/**
 * How an attack is made (2024 rules):
 * - `attackAction`: one attack of the Attack action (a melee one in hand can also be an
 *   Opportunity Attack);
 * - `lightExtra`: the Light property's extra attack, a Bonus Action after attacking with a
 *   different Light weapon; with Nick it is part of the Attack action instead, once per turn;
 * - `cast`: a cantrip, cast with its casting time.
 */
export type AttackUse =
  | { kind: 'attackAction' }
  | { kind: 'lightExtra'; nick: boolean }
  | { kind: 'cast'; time: ActionType };

/** P3: one way to attack, with everything needed to roll it. */
export interface DerivedAttack {
  /**
   * Stable within the sheet: `item:<row uid>`, `item:<row uid>:light` (the Light extra
   * attack), `unarmed`, `spell:<caster>:<spell id>`.
   */
  id: string;
  name: string;
  kind: 'weapon' | 'unarmed' | 'spell';
  use: AttackUse;
  /** Inventory row, for weapons. */
  rowUid?: string;
  itemRef?: Ref;
  spellRef?: Ref;
  /**
   * In hand (weapons), so the attack is ready. Stowed weapons are listed after: the Attack
   * action lets you draw one as part of each attack, and a Thrown weapon is drawn as part of
   * the throw.
   */
  ready: boolean;
  range: 'melee' | 'ranged';
  /** `5 ft.`, `20/60 ft.` */
  distance: string;
  ability: Ability;
  proficient: boolean;
  toHit?: DerivedRoll;
  /** For attacks that call for a saving throw instead (spells). */
  save?: { ability: Ability; dc: Derived };
  /** Dice rolled for damage; empty for none. */
  damageDice: string;
  damageBonus: Derived;
  damageType: string;
  /**
   * Damage of a melee attack with both hands, when the weapon is Versatile, is not already
   * held in both hands, and a hand is free for it (no shield; a free hand when in hand).
   */
  versatileDice?: string;
  critRange: number;
  mastery?: { id: Id; name: string };
  /** The weapon's properties, as rule ids (`itemProperty/l|xphb`), for their rule text. */
  propertyIds: Id[];
  /** The Unarmed Strike's Grapple and Shove: their save DC, and whether a hand is free. */
  grapple?: { dc: Derived; freeHand: boolean };
  /** An Ammunition weapon that names its ammunition: what the character has to fire. */
  ammo?: DerivedAmmo;
  riders: DerivedRider[];
  /** Property names and other reminders. */
  notes: string[];
}

/** One inventory row of ammunition an attack can fire. */
export interface AmmoSource {
  rowUid: string;
  name: string;
  /** Pieces in it; a bundle ("Arrows (20)") counts what it holds. */
  count: number;
  /** An unopened bundle, opened when a piece is taken from it. */
  bundle: boolean;
  /** Magic ammunition: a bonus to attack and damage rolls made with it. */
  hitBonus: number;
  damageBonus: number;
}

/**
 * The 2024 Ammunition property: a ranged attack only with ammunition to fire; each attack
 * expends one piece; after a fight, half of what was used (rounded down) can be recovered.
 */
export interface DerivedAmmo {
  /** The ammunition item it fires: `arrow|xphb`. */
  itemId: Id;
  name: string;
  /** Loose pieces first, then bundles; only rows with pieces left. */
  sources: AmmoSource[];
  total: number;
  /** Pieces used since the last recovery, by row (rows that still exist). */
  used: { rowUid: string; name: string; count: number }[];
  /** A one-handed weapon in hand with no other hand free to load it (a Shield, two weapons). */
  noHandToLoad: boolean;
}

/** P11: one spellcasting feature (a class, a subclass, or another feature). */
export interface DerivedCaster {
  /** Class id, subclass id, or the effect's caster key. */
  key: string;
  name: string;
  classId?: Id;
  level: number;
  ability: Ability;
  progression: ClassSpellcasting['progression'];
  /** `level`: spells change on level-up (choices); `restLong`: prepared after a Long Rest. */
  preparedChange: 'level' | 'restLong';
  dc: Derived;
  attack: DerivedRoll;
  /** Highest spell level it can prepare, as if single-classed. */
  maxSpellLevel: number;
  cantrips: Id[];
  cantripsMax: number;
  prepared: Id[];
  preparedMax: number;
  /**
   * Long Rest casters: prepared spells that may be replaced after a Long Rest (Paladin and
   * Ranger: 1; omitted: any number), and how many were replaced since the last one.
   */
  swapLimit?: number;
  swapsSinceRest: number;
  /** Always prepared, not counted against the limit (subclass and feature spells). */
  alwaysPrepared: Id[];
  spellbook?: Id[];
  /** Its spell list: filters, plus spells added to it (expanded lists). */
  list: { filters: string[]; ids: Id[] };
}

export interface DerivedSlot {
  level: number;
  max: number;
  used: number;
}

/** A spell granted outside a caster's list: species, feats, gifts, items. */
export interface DerivedGrantedSpell {
  spellId: Id;
  source: Ref;
  sourceName: string;
  mode: SpellGrant['mode'];
  ability?: Ability;
  dc?: number;
  attackBonus?: number;
  uses?: SpellGrant['uses'];
  /** For a counted use: how many, and where spent uses are stored. */
  usesMax?: number;
  usesKey?: string;
  usesUsed?: number;
  /** For uses paid from a resource: which one, and the cost of one cast. */
  resourceKey?: string;
  cost?: number;
  castAtLevel?: number;
}

export interface DerivedSpellcasting {
  casters: DerivedCaster[];
  /** Spell slots, multiclass rules applied; Pact Magic apart. */
  slots: DerivedSlot[];
  pact?: DerivedSlot;
  granted: DerivedGrantedSpell[];
}

/** P6: a counter of uses (Rage, Focus Points, a charm's charges). */
export interface DerivedResource {
  /** Storage key in `state.resourcesUsed`: `<owner ref key>#<resource id>`. */
  key: string;
  resourceId: string;
  name: string;
  source: Ref;
  sourceName: string;
  max: Derived;
  used: number;
  recharge: Recharge;
  /** Each use is a die (Superiority Dice). */
  die?: string;
  /** Spend any amount at once (Lay on Hands). */
  pool: boolean;
  /** Other ways to get uses back. */
  restoreWith: { amount: string; costs: string[] }[];
}

export interface DerivedCost {
  label: string;
  /** For resource costs: which resource and how much. */
  resourceKey?: string;
  /** Uses of the resource, or Hit Dice for a Hit Dice cost. */
  amount?: number;
  /** A spell slot of at least this level (a Pact Magic slot counts). */
  slot?: { minLevel: number };
  /** Hit Dice to spend; `amount` says how many. */
  hitDice?: true;
}

/** P7/P8: what using something does to the character, with formulas already worked out. */
export type DerivedOutcome =
  /** Dice or a number to roll and heal, e.g. `1d8 + 5`. */
  | { heal: string }
  | { tempHp: string }
  | { toggleOn: string }
  | { restore: { resourceKey?: string; label: string; amount: number } }
  | { regainSlot: { maxLevel: number } };

/** P7: something the character can do, with what it costs and what it does. */
export interface DerivedAction {
  id: string;
  name: string;
  actionType: ActionType;
  sourceName: string;
  source?: Ref;
  /** One of the actions everyone has (Attack, Dash… Opportunity Attack). */
  standard?: true;
  costs: DerivedCost[];
  outcomes: DerivedOutcome[];
  /** Attacks it makes (Flurry of Blows: the unarmed strike). */
  attackIds: string[];
  roll?: string;
  saveDc?: number;
  description?: string;
}

/** P8: a stance or form the player switches on and off. */
export interface DerivedToggle {
  toggleId: string;
  name: string;
  source: Ref;
  sourceName: string;
  active: boolean;
  option?: string;
  options: { id: string; name: string }[];
  costs: DerivedCost[];
  onActivate: DerivedOutcome[];
  group?: string;
  endsOn: ('shortRest' | 'longRest')[];
}

export interface DerivedClass {
  classId: Id;
  name: string;
  level: number;
  hitDie: number;
  subclassId?: Id;
  subclassName?: string;
}

export interface DerivedContainer {
  /** Weight of what is inside, nested containers' contents included unless weightless. */
  contents: number;
  /** The most it holds (times the number of containers on the row); missing when unknown. */
  capacity?: number;
  /** Its contents don't count toward the weight carried. */
  weightless: boolean;
  /** Items it holds by count (a Quiver: 20 Arrows): how many are in it. */
  counts?: { itemId: Id; name: string; count: number; max: number }[];
}

export interface DerivedInventory {
  /** Everything carried: items (not those inside weightless containers) and coins. */
  weight: Derived;
  /** The most the character can carry. Drag, lift or push: twice that. */
  carry: Derived;
  dragLiftPush: number;
  /** The size carrying capacity uses (Powerful Build counts one larger). */
  carrySize: Size;
  attuned: number;
  attunementMax: number;
  /** Rows whose Attunement prerequisite the character doesn't meet. */
  unqualified: string[];
  /** Charges of the rows that have them. */
  charges: Record<string, ItemCharges>;
  containers: Record<string, DerivedContainer>;
}

/** Where a feature comes from, for grouping on the Features tab. */
export type FeatureGroup =
  'class' | 'subclass' | 'species' | 'background' | 'feat' | 'optionalFeature' | 'gift' | 'other';

/** One choice a feature offers, with the picks made for it. */
export interface DerivedFeatureChoice {
  /** The encoded choice key. */
  key: string;
  offer: Offer;
  /** Picks the slot allows now. */
  count: number;
  values: string[];
  /** Names at pick time. */
  labels: string[];
  /** Set when the values are entity ids. */
  valueKinds?: EntityKind[];
  /** A class's feat or option progression it belongs to (Fighting Style), and the level. */
  progression?: { name: string; level?: number };
  /** Missing when nothing has been picked yet. */
  status?: RecordStatus;
}

/** Step 3.20: an entity whose effects apply (a class feature, a feat, a gift…). */
export interface DerivedFeature {
  ref: Ref;
  name: string;
  /** Instance number of a feat taken more than once. */
  n?: number;
  group: FeatureGroup;
  classId?: Id;
  subclassId?: Id;
  /** Class level it comes at (class and subclass content). */
  level?: number;
  /** The feature whose text it is written in (`refSubclassFeature`), by ref key. */
  parent?: string;
  /** The feature whose pick or grant brought it in (an Ability Score Improvement's feat). */
  pickedIn?: { ref: Ref; name: string; progression?: string };
  /** Its content isn't loaded; the character's snapshot stands in. */
  fromSnapshot?: boolean;
  /** A gift or other thing granted outright: the encoded key of that record. */
  grantKey?: string;
  choices: DerivedFeatureChoice[];
  /** Its counters, as keys of `DerivedSheet.resources`. */
  resourceKeys: string[];
  /** The log entry its picks belong in (plan §4.4). */
  entryIndex: number;
}

export interface DerivedSheet {
  charLevel: number;
  pb: Derived;
  classes: DerivedClass[];
  abilities: Record<Ability, { score: Derived; mod: number }>;
  saves: Record<Ability, DerivedRoll>;
  /** Plain ability checks (no skill). */
  checks: Record<Ability, DerivedRoll>;
  skills: Record<Skill, DerivedSkill>;
  initiative: DerivedRoll;
  /** Constitution saves to keep concentration. */
  concentration: DerivedRoll;
  deathSave: DerivedRoll;
  passives: Record<'perception' | 'insight' | 'investigation', Derived>;
  ac: Derived & { calculation: string };
  hp: {
    max: Derived;
    current: number;
    temp: number;
    ward?: { name: string; max: Derived; current: number };
  };
  hitDice: { faces: number; total: number; used: number }[];
  speed: Partial<Record<MoveMode, Derived>>;
  senses: SourcedValue<{ sense: string; range: number }>[];
  defenses: {
    resistances: SourcedValue[];
    immunities: SourcedValue[];
    conditionImmunities: SourcedValue[];
  };
  proficiencies: {
    armor: SourcedValue[];
    weapons: SourcedValue[];
    tools: SourcedValue[];
    languages: SourcedValue[];
  };
  size: Size;
  inventory: DerivedInventory;
  attacks: DerivedAttack[];
  /** Attacks per Attack action (Extra Attack). */
  attacksPerAction: Derived;
  /** Base weapon ids whose mastery the character can use. */
  masteries: SourcedValue[];
  spellcasting: DerivedSpellcasting;
  resources: DerivedResource[];
  /** Step 3.20: everything that applies, items aside, in the order collected. */
  features: DerivedFeature[];
  actions: DerivedAction[];
  toggles: DerivedToggle[];
  conditions: Id[];
  exhaustion: number;
  choices: { pending: Pending[]; attention: Reconciled[] };
  issues: RuleIssue[];
}
