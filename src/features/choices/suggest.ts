// What suits the character's class, as a guide (plan step 4C.3): the options worth a look are
// marked, with why, and nothing is chosen for the player. Rules of thumb in the app's own words:
// the class's primary abilities first, then what the character already carries.

import type { AutoContext } from '../../engine/build/autoChoose.ts';
import { carriedWeapons } from '../../engine/build/autoChoose.ts';
import type { Offer } from '../../engine/collect/types.ts';
import type { ContentIndex } from '../../engine/content/contentIndex.ts';
import {
  ABILITY_NAMES,
  SKILL_ABILITY,
  type Ability,
  type Background,
  type ClassDef,
  type Character,
  type Skill,
  type Species,
} from '../../schema/index.ts';

/** The character's first class and its primary abilities. */
export function classFocus(
  character: Character,
  index: ContentIndex,
): { cls: ClassDef; primary: Set<Ability> } | undefined {
  const ref = character.log[0]?.classRef;
  const cls = ref ? index.get({ kind: 'class', id: ref.id }) : undefined;
  return cls ? { cls, primary: new Set(cls.primaryAbility.flat()) } : undefined;
}

const names = (abilities: readonly Ability[]) =>
  abilities.map((a) => ABILITY_NAMES[a]).join(' or ');

/** Why an option suits the character, or nothing. */
export function suggestion(offer: Offer, value: string, ctx: AutoContext): string | undefined {
  const focus = classFocus(ctx.character, ctx.index);
  switch (offer.kind) {
    case 'backgroundAbility': {
      if (!focus) return undefined;
      // The ability raised by 2 (or, for +1 each, any of them) is a primary one.
      const values = value.split(',') as Ability[];
      const twice = values.find((a, i) => values.indexOf(a) !== i);
      const raised = twice ? [twice] : values;
      const hit = raised.filter((a) => focus.primary.has(a));
      return hit.length
        ? `Raises ${names(hit)}, the ${focus.cls.name}’s primary ability`
        : undefined;
    }
    case 'ability':
      return focus?.primary.has(value as Ability)
        ? `The ${focus.cls.name}’s primary ability`
        : undefined;
    case 'spellAbility': {
      const from = Array.isArray(offer.from) ? (offer.from as Ability[]) : [];
      const best = Math.max(...from.map((a) => ctx.sheet.abilities[a]?.score.value ?? 0));
      return ctx.sheet.abilities[value as Ability]?.score.value === best && from.length > 1
        ? 'Your highest of these'
        : undefined;
    }
    case 'proficiency':
    case 'expertise': {
      const ability = SKILL_ABILITY[value as Skill];
      return ability && focus?.primary.has(ability)
        ? `Uses ${ABILITY_NAMES[ability]}, the ${focus.cls.name}’s primary ability`
        : undefined;
    }
    case 'weaponMastery':
      return carriedWeapons(ctx).has(value) ? 'You start with one' : undefined;
    default:
      return undefined;
  }
}

/** A background or species that can raise the class's primary ability. */
export function originSuggestion(
  entity: Background | Species,
  focus: { cls: ClassDef; primary: Set<Ability> } | undefined,
): string | undefined {
  if (!focus) return undefined;
  const can = new Set<Ability>(
    entity.kind === 'background'
      ? entity.abilityOptions.flatMap((o) => o.from)
      : entity.effects.flatMap((e) =>
          e.type === 'abilityBonus' && typeof e.ability === 'string' ? [e.ability] : [],
        ),
  );
  const hit = [...focus.primary].filter((a) => can.has(a));
  return hit.length ? `Good for a ${focus.cls.name}: raises ${names(hit)}` : undefined;
}
