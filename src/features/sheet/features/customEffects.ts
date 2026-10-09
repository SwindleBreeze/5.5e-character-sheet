// The effects a player can add to a feature (plan step 7.5): a counter, a bonus to a number on
// the sheet, a resistance or a proficiency. Built from the form's fields, and described back in
// plain words.

import {
  ABILITIES,
  ABILITY_NAMES,
  SKILLS,
  type Ability,
  type Effect,
  type ProficiencyCategory,
  type Recharge,
  type Skill,
} from '../../../schema/index.ts';
import { RECHARGE_TEXT } from '../actions/labels.ts';
import { skillName, titleCase } from '../components/format.ts';

export type CustomKind = 'counter' | 'bonus' | 'resistance' | 'proficiency';

/** What a bonus is to: a number the sheet shows. */
export type BonusTarget =
  | 'ac'
  | 'initiative'
  | 'speed'
  | 'hp'
  | 'attack'
  | 'damage'
  | 'save:all'
  | `save:${Ability}`
  | `skill:${Skill}`;

export const BONUS_TARGETS: { value: BonusTarget; label: string }[] = [
  { value: 'ac', label: 'Armor Class' },
  { value: 'initiative', label: 'Initiative' },
  { value: 'speed', label: 'Speed (feet)' },
  { value: 'hp', label: 'Hit Point maximum' },
  { value: 'attack', label: 'Attack rolls' },
  { value: 'damage', label: 'Damage rolls' },
  { value: 'save:all', label: 'Every saving throw' },
  ...ABILITIES.map((a) => ({
    value: `save:${a}` as const,
    label: `${ABILITY_NAMES[a]} saving throw`,
  })),
  ...SKILLS.map((s) => ({ value: `skill:${s}` as const, label: skillName(s) })),
];

export const RECHARGES: Recharge[] = ['short', 'long', 'dawn', 'none'];

export const DAMAGE_TYPES = [
  'acid',
  'bludgeoning',
  'cold',
  'fire',
  'force',
  'lightning',
  'necrotic',
  'piercing',
  'poison',
  'psychic',
  'radiant',
  'slashing',
  'thunder',
];

export const PROFICIENCY_KINDS: { value: ProficiencyCategory; label: string }[] = [
  { value: 'skill', label: 'Skill' },
  { value: 'save', label: 'Saving throw' },
  { value: 'tool', label: 'Tool' },
  { value: 'language', label: 'Language' },
  { value: 'armor', label: 'Armor' },
  { value: 'weapon', label: 'Weapons' },
];

export const ARMOR_VALUES = ['light', 'medium', 'heavy', 'shield'];
export const WEAPON_VALUES = ['simple', 'martial'];

export interface CustomFields {
  kind: CustomKind;
  name: string;
  uses: number;
  recharge: Recharge;
  target: BonusTarget;
  amount: number;
  damageType: string;
  category: ProficiencyCategory;
  value: string;
}

/** The effect the fields describe, or why they don't make one yet. */
export function buildCustomEffect(
  f: CustomFields,
  uid: string,
): { effect: Effect } | { problem: string } {
  switch (f.kind) {
    case 'counter':
      if (!f.name.trim()) return { problem: 'Give the counter a name.' };
      if (!Number.isInteger(f.uses) || f.uses < 1) return { problem: 'Uses must be 1 or more.' };
      return {
        effect: {
          type: 'resource',
          resourceId: `custom-${uid}`,
          name: f.name.trim(),
          max: f.uses,
          recharge: f.recharge,
        },
      };
    case 'bonus': {
      if (!Number.isInteger(f.amount) || f.amount === 0)
        return { problem: 'The bonus must be a whole number other than 0.' };
      const n = f.amount;
      const t = f.target;
      if (t === 'ac') return { effect: { type: 'acBonus', value: n } };
      if (t === 'initiative') return { effect: { type: 'initiativeBonus', value: n } };
      if (t === 'speed') return { effect: { type: 'speedBonus', value: n } };
      if (t === 'hp') return { effect: { type: 'hpBonus', flat: n } };
      if (t === 'attack' || t === 'damage') {
        return {
          effect: {
            type: 'attackMod',
            label: f.name.trim() || 'Your bonus',
            filter: {},
            ...(t === 'attack' ? { toHit: n } : { damage: n }),
          },
        };
      }
      return { effect: { type: 'rollBonus', target: t, value: n } };
    }
    case 'resistance':
      return { effect: { type: 'resistance', value: f.damageType } };
    case 'proficiency':
      if (!f.value.trim()) return { problem: 'Say what the proficiency is in.' };
      return { effect: { type: 'proficiency', category: f.category, value: f.value.trim() } };
  }
}

const signed = (n: number) => (n < 0 ? `${n}` : `+${n}`);

/** One of the player's effects in plain words: "+1 to Armor Class", "Resistance to Fire". */
export function describeCustomEffect(e: Effect): string {
  switch (e.type) {
    case 'resource':
      return `${e.name}: ${e.max} ${Number(e.max) === 1 ? 'use' : 'uses'} (recharge: ${RECHARGE_TEXT[e.recharge]})`;
    case 'acBonus':
      return `${signed(Number(e.value))} to Armor Class`;
    case 'initiativeBonus':
      return `${signed(Number(e.value))} to Initiative`;
    case 'speedBonus':
      return `${signed(Number(e.value))} ft. Speed`;
    case 'hpBonus':
      return `${signed(Number(e.flat ?? 0))} Hit Point maximum`;
    case 'attackMod':
      return e.toHit !== undefined
        ? `${signed(Number(e.toHit))} to attack rolls`
        : `${signed(Number(e.damage ?? 0))} to damage rolls`;
    case 'rollBonus': {
      const label = BONUS_TARGETS.find((t) => t.value === e.target)?.label ?? e.target;
      return `${signed(Number(e.value))} to ${label}`;
    }
    case 'resistance':
      return `Resistance to ${titleCase(String(e.value))} damage`;
    case 'proficiency': {
      const what =
        e.category === 'skill'
          ? skillName(e.value as Skill)
          : e.category === 'save'
            ? `${ABILITY_NAMES[e.value as Ability] ?? e.value} saving throws`
            : titleCase(String(e.value));
      return `Proficiency: ${what}`;
    }
    default:
      return e.type;
  }
}
