// The derived sheet (plan §9.2, step 3.5): every number the sheet shows, each with the parts
// that make it up, so tapping a number can explain it (plan §8.2 rule 3).

import type {
  Ability,
  ActionType,
  ClassSpellcasting,
  Id,
  MoveMode,
  Recharge,
  Ref,
  Size,
  Skill,
  SpellGrant,
} from '../../schema/index.ts';
import type { Pending, Reconciled } from '../choices/reconcile.ts';

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
  cost?: string;
}

/** P3: one way to attack, with everything needed to roll it. */
export interface DerivedAttack {
  /** Stable within the sheet: `item:<row uid>`, `unarmed`, `spell:<caster>:<spell id>`. */
  id: string;
  name: string;
  kind: 'weapon' | 'unarmed' | 'spell';
  /** Inventory row, for weapons. */
  rowUid?: string;
  itemRef?: Ref;
  spellRef?: Ref;
  /** In hand (weapons), so the attack is ready; carried weapons are listed after. */
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
  /** Damage with both hands, when the weapon is Versatile and that is not already used. */
  versatileDice?: string;
  critRange: number;
  mastery?: { id: Id; name: string };
  riders: DerivedRider[];
  /** Property names and other reminders. */
  notes: string[];
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
  amount?: number;
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
  attacks: DerivedAttack[];
  /** Attacks per Attack action (Extra Attack). */
  attacksPerAction: Derived;
  /** Base weapon ids whose mastery the character can use. */
  masteries: SourcedValue[];
  spellcasting: DerivedSpellcasting;
  resources: DerivedResource[];
  actions: DerivedAction[];
  toggles: DerivedToggle[];
  conditions: Id[];
  exhaustion: number;
  choices: { pending: Pending[]; attention: Reconciled[] };
  issues: RuleIssue[];
}
