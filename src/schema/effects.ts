// Typed effects (plan §4.3). Choice-bearing effects carry a local `slot`; the full ChoiceKey
// is built from the owning entity (plan §4.4). The phase 3 primitives (plan §8.1, P1–P12) are
// wrappers or new members, so effects stored before phase 3 stay valid (plan §9.1).

import type {
  Ability,
  ChoiceSlot,
  EntityKind,
  Formula,
  Id,
  MoveMode,
  Recharge,
  Ref,
  Retrain,
  Skill,
} from './common.ts';
import type { ClassSpellcasting } from './content.ts';

export type ProficiencyCategory = 'skill' | 'save' | 'armor' | 'weapon' | 'tool' | 'language';

export type ActionType = 'action' | 'bonus' | 'reaction' | 'other';

/** P10: a value picked in one of the owning entity's choice slots. */
export type Bound<T> = T | { fromChoice: string };

/**
 * P1: a condition on static state only (plan §8.2 rule 1): what is worn and held, active
 * toggles, conditions and levels. Never a derived number.
 */
export type Predicate =
  | { armor: 'none' | 'light' | 'medium' | 'heavy' | 'notHeavy' | 'any' }
  | { shield: boolean }
  /** At least this many hands free. */
  | { freeHands: number }
  /** Holding a weapon that matches. */
  | { wielding: AttackFilter }
  | { toggle: string; option?: string }
  /** A condition rule id, e.g. `condition/raging|tst` or `condition/prone|xphb`. */
  | { condition: Id }
  /** Class level when `classId` is set, else character level. */
  | { level: number; classId?: Id }
  | { all: Predicate[] }
  | { any: Predicate[] }
  | { not: Predicate };

/** A kind of weapon: its category, and melee (`true`) or ranged (`false`). */
export interface WeaponKind {
  category?: 'simple' | 'martial';
  melee?: boolean;
}

/** P3/P4: which attacks a modifier or rider applies to. Every field given must match. */
export interface AttackFilter {
  range?: 'melee' | 'ranged';
  source?: ('weapon' | 'unarmed' | 'spell' | 'natural')[];
  weaponCategory?: 'simple' | 'martial';
  /** All of these item-property abbreviations (`F`, `L`, `2H`…). */
  properties?: string[];
  /** None of these item-property abbreviations. */
  notProperties?: string[];
  /** The attack uses one of these abilities. */
  ability?: Ability[];
  itemIds?: Id[];
  /** Derived tags, e.g. `monkWeapon`, `pactWeapon`, `offHand`. */
  tags?: string[];
  /** At least one of these filters matches too (Sneak Attack: a Finesse or a Ranged weapon). */
  any?: AttackFilter[];
}

/** P9: what a roll modifier applies to. `attack:<tag>` narrows to attacks with that tag. */
export type RollTarget =
  | `save:${Ability}`
  | 'save:all'
  | 'save:concentration'
  | 'save:death'
  | `check:${Ability}`
  | `skill:${Skill}`
  | 'initiative'
  | 'attack:all'
  | `attack:${string}`;

/** P6/P7/P8: what using something spends. */
export type Cost =
  | { resource: string; amount: Formula }
  | { slot: { minLevel: number } }
  | { hitDice: Formula }
  | { action: ActionType };

/** P7/P8: what happens to the character when something is used. */
export type SelfOutcome =
  | { heal: Formula }
  | { tempHp: Formula }
  | { toggleOn: string }
  | { restore: { resource: string; amount: Formula } }
  | { regainSlot: { maxLevel: Formula } };

export interface ActionDef {
  id: string;
  name: string;
  actionType: ActionType;
  resourceId?: string;
  /** Dice expression or formula, e.g. `1d10 + level.fighter`. */
  roll?: Formula;
  /** Save DC formula, e.g. `8 + mod.str + pb`. */
  saveDc?: Formula;
  description?: string;
  /** P7: what using it spends. */
  costs?: Cost[];
  /** P7: the attacks it makes (Flurry of Blows: unarmed strikes). */
  attack?: AttackFilter;
  /** P7: applied to the character when used (Second Wind heals). */
  outcomes?: SelfOutcome[];
}

/** P8: one form of a toggle, picked when it is switched on (Starry Form: Archer, Chalice…). */
export interface ToggleOption {
  id: string;
  name: string;
  effects: Effect[];
}

/**
 * A spell granted outside normal class preparation (from 5etools `additionalSpells`).
 * `expanded` adds the spell to the class's list rather than granting it.
 */
export interface SpellGrant {
  /**
   * Fixed spell, or a choice: `choose` is a 5etools spell filter (`level=0|class=Wizard`),
   * `from` a fixed list of spell ids.
   */
  spell:
    | { id: Id }
    | { choose?: string; from?: Id[]; count: number; slot: string; retrain?: Retrain }
    /** Every spell matching the filter (expanded spell lists). */
    | { all: string };
  /** `spellbook`: added to a spellbook to prepare from (plan §9.1). */
  mode: 'known' | 'alwaysPrepared' | 'innate' | 'expanded' | 'spellbook';
  /** Level at which the grant applies: class level for class content, else character level. */
  atLevel?: number;
  /** Applies once the character can cast spells of this level (5etools `s<N>` keys). */
  atSpellLevel?: number;
  /**
   * Free casts. Omitted means the spell is cast normally.
   * - `count` and `recharge`: the grant's own counter.
   * - `resource` and `cost`: paid from a `resource` effect of the same entity: a charm's
   *   charges, or one counter several spells share ("cast one of these once").
   * - `resourceName` and `cost`: paid from a resource defined elsewhere, e.g. Focus Points.
   */
  uses?:
    | { count: Formula; recharge: Recharge }
    | { resource: string; cost: number }
    | { resourceName: string; cost: number }
    | 'atWill'
    | 'ritual';
  /** The spell is cast at this level (5etools `#3` suffix). */
  castAtLevel?: number;
  /** Spellcasting ability: fixed, a choice, or the ability this entity increased. */
  ability?: Ability | { slot: string; from: Ability[] } | 'inherit';
}

export type Effect =
  | { type: 'abilityBonus'; ability: Bound<Ability>; value: number; max?: number }
  | { type: 'abilityChoice'; choice: ChoiceSlot<Ability>; value: number; max?: number }
  | { type: 'proficiency'; category: ProficiencyCategory; value: Bound<string> }
  | {
      type: 'proficiencyChoice';
      /** Several categories when one pick may come from any of them (skill or tool). */
      category: ProficiencyCategory | ProficiencyCategory[];
      choice: ChoiceSlot<string>;
      /**
       * Narrows `from: 'any'`, e.g. `standard` languages or `artisan` tools; several kinds are
       * joined with `|` (`artisan|instrument`).
       */
      filter?: string;
    }
  | { type: 'expertise'; skill: Bound<Skill> }
  | { type: 'expertiseChoice'; choice: ChoiceSlot<Skill>; filter?: 'proficient' }
  | { type: 'abilitySet'; ability: Ability; value: number }
  /**
   * An Armor Class calculation for when no body armor is worn (Unarmored Defense). `shield`:
   * whether it still works with a shield. The best available calculation wins.
   */
  | { type: 'acFormula'; name: string; base: number; addAbilities: Ability[]; shield: boolean }
  | { type: 'acBonus'; value: Formula }
  | { type: 'speed'; mode: MoveMode; value: Formula | 'walk' }
  | { type: 'speedBonus'; value: Formula; mode?: MoveMode }
  | { type: 'sense'; sense: string; range: number }
  | { type: 'resistance' | 'immunity' | 'conditionImmunity'; value: Bound<string> }
  | { type: 'resistanceChoice'; choice: ChoiceSlot<string> }
  | {
      type: 'resource';
      resourceId: string;
      name: string;
      max: Formula;
      recharge: Recharge;
      /** P6: each use is a die of this size (Superiority Dice: `d8`, or `table.<key>`). */
      die?: Formula;
      /** P6: spend any amount at once (Lay on Hands). */
      pool?: boolean;
    }
  | { type: 'grantSpells'; spells: SpellGrant[] }
  | { type: 'grantAction'; action: ActionDef }
  | { type: 'extraAttack'; count: number }
  | { type: 'hpBonus'; perLevel?: Formula; flat?: Formula }
  | { type: 'initiativeBonus'; value: Formula }
  /**
   * Pick weapons (by base item id) whose mastery property you can use. `kinds` narrows the
   * options to any of these kinds of weapon (Barbarian: Simple, or Martial Melee).
   */
  | { type: 'weaponMasteryChoice'; choice: ChoiceSlot<Id>; kinds?: WeaponKind[] }
  | { type: 'featChoice'; slot: string; categories: string[]; count?: Formula }
  | { type: 'optionalFeatureChoice'; slot: string; featureTypes: string[]; count: Formula }
  | { type: 'grantFeat'; feat: Ref }
  | {
      type: 'toggle';
      toggleId: string;
      name: string;
      /** Applied while the toggle is on. */
      effects: Effect[];
      /** P8: spent to switch it on. */
      cost?: Cost[];
      /** P8: applied once when it is switched on. */
      onActivate?: SelfOutcome[];
      /** P8: forms to pick from when switching on. */
      options?: ToggleOption[];
      /** P8: only one toggle of a group can be on. */
      group?: string;
      /** P8: rests that switch it off. */
      endsOn?: ('shortRest' | 'longRest')[];
    }
  | { type: 'note'; text: string }
  /** Pick one of several named alternatives; `ifChoice` effects depend on the pick. */
  | { type: 'optionChoice'; choice: ChoiceSlot<string>; labels: string[] }
  | { type: 'ifChoice'; slot: string; value: string; effects: Effect[] }
  /** Pick entities offered as options (5etools `type: options` entries, plan P14). */
  | { type: 'featureOptions'; optionKind: EntityKind; choice: ChoiceSlot<Id> }
  /** Effects that start at a level: class level for class content, else character level. */
  | { type: 'atLevel'; level: number; effects: Effect[] }
  /** P1: effects that apply only while the predicate holds. */
  | { type: 'when'; when: Predicate; effects: Effect[] }
  /** P3: changes attacks that match the filter. */
  | {
      type: 'attackMod';
      filter: AttackFilter;
      label: string;
      toHit?: Formula;
      damage?: Formula;
      /** Abilities the attack may use; the best one is taken. */
      abilities?: Ability[];
      /** The larger of the weapon's die and this one is used (Martial Arts). */
      damageDie?: Formula;
      critRange?: number;
      /** Attacks per Attack action, counting the first: the largest wins. */
      extraAttacks?: number;
    }
  /** P4: extra damage listed under matching attacks. */
  | {
      type: 'damageRider';
      id: string;
      name: string;
      dice: Formula;
      damageType?: Bound<string>;
      filter: AttackFilter;
      oncePerTurn?: boolean;
      cost?: Cost;
      /** Added only when the player taps it; otherwise always included. */
      optIn: boolean;
    }
  /** P9: advantage or disadvantage on a roll. */
  | { type: 'rollMode'; target: RollTarget; mode: 'advantage' | 'disadvantage'; note?: string }
  /** P9: a bonus to a roll. */
  | { type: 'rollBonus'; target: RollTarget; value: Formula; note?: string }
  /** P9: half proficiency on these rolls when not proficient (Jack of All Trades). */
  | { type: 'halfProficiency'; targets: RollTarget[] }
  /**
   * P9: a d20 roll below this counts as this (Reliable Talent: 10). `proficientOnly`: only on
   * rolls the character is proficient in.
   */
  | { type: 'rollFloor'; target: RollTarget; value: number; proficientOnly?: boolean }
  /** P6: a later feature changes a resource. */
  | {
      type: 'resourceModify';
      resourceId: string;
      max?: Formula;
      recharge?: Recharge;
      die?: Formula;
    }
  /** P6: another way to get uses of a resource back. */
  | { type: 'restoreWith'; resourceId: string; amount: Formula; costs: Cost[] }
  /** P11: a spellcasting feature that is not a class's own (a subclass, a feat). */
  | {
      type: 'spellcasting';
      casterKey: string;
      ability: Bound<Ability>;
      /** Spell list: a 5etools spell filter, e.g. `class=Wizard`. */
      list: string;
      progression: ClassSpellcasting['progression'];
      /** Whose table holds its `cantrips` / `prepared-spells` columns. */
      tableOwner?: Ref;
    }
  /** P11: changes spells that match a 5etools spell filter. */
  | {
      type: 'spellMod';
      filter: string;
      casterKey?: string;
      dcBonus?: Formula;
      attackBonus?: Formula;
      damageBonus?: Formula;
      /** Spells matching the filter count as spells of this caster. */
      countsAsClassSpell?: boolean;
    }
  /** P12: hit points that absorb damage after temporary HP (Arcane Ward). */
  | { type: 'ward'; name: string; max: Formula }
  /**
   * P15: an attack a feature gives, made like a weapon attack without an item (Psychic Blade).
   * `properties` are item-property abbreviations (`F`, `T`); `abilities`, the best one is used.
   */
  | {
      type: 'attack';
      id: string;
      name: string;
      damage: Formula;
      damageType: string;
      range: 'melee' | 'ranged';
      distance: string;
      abilities: Ability[];
      properties?: string[];
    }
  /** Count as `steps` sizes larger when determining carrying capacity (Powerful Build). */
  | { type: 'carrySize'; steps: number };

export type EffectType = Effect['type'];
