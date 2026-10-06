// Typed effects (plan §4.3). Choice-bearing effects carry a local `slot`; the full ChoiceKey
// is built from the owning entity (plan §4.4). Phase 3 extends this union with the primitives
// listed in plan §8.1.

import type { Ability, ChoiceSlot, Formula, Id, MoveMode, Recharge, Ref, Skill } from './common.ts';

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

/** A spell granted outside normal class preparation (from 5etools `additionalSpells`). */
export interface SpellGrant {
  /** Fixed spell, or a choice of spells matching a filter. */
  spell: { id: Id } | { choose: string; count: number; slot: string };
  mode: 'known' | 'alwaysPrepared' | 'innate';
  /** Character level at which the grant applies. */
  atLevel?: number;
  uses?: { count: Formula; recharge: Recharge };
  ability?: Ability | { slot: string; from: Ability[] };
}

export type Effect =
  | { type: 'abilityBonus'; ability: Ability; value: number; max?: number }
  | { type: 'abilityChoice'; choice: ChoiceSlot<Ability>; value: number; max?: number }
  | { type: 'proficiency'; category: ProficiencyCategory; value: string }
  | { type: 'proficiencyChoice'; category: ProficiencyCategory; choice: ChoiceSlot<string> }
  | { type: 'expertise'; skill: Skill }
  | { type: 'expertiseChoice'; choice: ChoiceSlot<Skill> }
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
  | { type: 'featChoice'; slot: string; categories: string[] }
  | { type: 'optionalFeatureChoice'; slot: string; featureTypes: string[]; count: Formula }
  | { type: 'grantFeat'; feat: Ref }
  | { type: 'toggle'; toggleId: string; name: string; effects: Effect[] }
  | { type: 'note'; text: string };

export type EffectType = Effect['type'];
