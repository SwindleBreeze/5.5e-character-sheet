// Typed effects (plan §4.3). Choice-bearing effects carry a local `slot`; the full ChoiceKey
// is built from the owning entity (plan §4.4). Phase 3 extends this union with the primitives
// listed in plan §8.1.

import type {
  Ability,
  ChoiceSlot,
  EntityKind,
  Formula,
  Id,
  MoveMode,
  Recharge,
  Ref,
  Skill,
} from './common.ts';

export type ProficiencyCategory = 'skill' | 'save' | 'armor' | 'weapon' | 'tool' | 'language';

export type ActionType = 'action' | 'bonus' | 'reaction' | 'other';

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
    | { choose?: string; from?: Id[]; count: number; slot: string }
    /** Every spell matching the filter (expanded spell lists). */
    | { all: string };
  mode: 'known' | 'alwaysPrepared' | 'innate' | 'expanded';
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
  | { type: 'abilityBonus'; ability: Ability; value: number; max?: number }
  | { type: 'abilityChoice'; choice: ChoiceSlot<Ability>; value: number; max?: number }
  | { type: 'proficiency'; category: ProficiencyCategory; value: string }
  | {
      type: 'proficiencyChoice';
      /** Several categories when one pick may come from any of them (skill or tool). */
      category: ProficiencyCategory | ProficiencyCategory[];
      choice: ChoiceSlot<string>;
      /** Narrows `from: 'any'`, e.g. `standard` languages or `artisan` tools. */
      filter?: string;
    }
  | { type: 'expertise'; skill: Skill }
  | { type: 'expertiseChoice'; choice: ChoiceSlot<Skill>; filter?: 'proficient' }
  | { type: 'abilitySet'; ability: Ability; value: number }
  | { type: 'acFormula'; name: string; base: number; addAbilities: Ability[]; shield: boolean }
  | { type: 'acBonus'; value: Formula }
  | { type: 'speed'; mode: MoveMode; value: Formula | 'walk' }
  | { type: 'speedBonus'; value: Formula }
  | { type: 'sense'; sense: string; range: number }
  | { type: 'resistance' | 'immunity' | 'conditionImmunity'; value: string }
  | { type: 'resistanceChoice'; choice: ChoiceSlot<string> }
  | {
      type: 'resource';
      resourceId: string;
      name: string;
      max: Formula;
      recharge: Recharge;
    }
  | { type: 'grantSpells'; spells: SpellGrant[] }
  | { type: 'grantAction'; action: ActionDef }
  | { type: 'extraAttack'; count: number }
  | { type: 'hpBonus'; perLevel?: Formula; flat?: Formula }
  | { type: 'initiativeBonus'; value: Formula }
  | { type: 'weaponMasteryCount'; value: Formula }
  | { type: 'featChoice'; slot: string; categories: string[]; count?: Formula }
  | { type: 'optionalFeatureChoice'; slot: string; featureTypes: string[]; count: Formula }
  | { type: 'grantFeat'; feat: Ref }
  | { type: 'toggle'; toggleId: string; name: string; effects: Effect[] }
  | { type: 'note'; text: string }
  /** Pick one of several named alternatives; `ifChoice` effects depend on the pick. */
  | { type: 'optionChoice'; choice: ChoiceSlot<string>; labels: string[] }
  | { type: 'ifChoice'; slot: string; value: string; effects: Effect[] }
  /** Pick entities offered as options (5etools `type: options` entries, plan P14). */
  | { type: 'featureOptions'; optionKind: EntityKind; choice: ChoiceSlot<Id> }
  /** Effects that start at a level: class level for class content, else character level. */
  | { type: 'atLevel'; level: number; effects: Effect[] };

export type EffectType = Effect['type'];
