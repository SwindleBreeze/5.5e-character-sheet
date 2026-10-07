// What a pick is for, in a sentence or two, shown right above its options (plan §9.3b, step
// 4B.5): where a newcomer would ask "what does this do?". Written for this app in its own words.

import type { DerivedFeatureChoice } from '../../engine/derive/types.ts';
import { CREATION_LANGUAGES_SLOT } from '../../engine/collect/collect.ts';

export function choiceHelp(c: DerivedFeatureChoice): string | undefined {
  const { offer } = c;
  const e = offer.effect;
  const slot = offer.key.slot;
  switch (offer.kind) {
    case 'backgroundAbility':
      return 'Raise one score by 2 and another by 1, or all three by 1. Best in your class’s primary ability. No score can go above 20.';
    case 'ability':
      return 'Each pick raises that ability score. Every 2 points of a score is +1 to its modifier.';
    case 'spellAbility':
      return 'The ability these spells use for their attack rolls and save DCs. Pick your highest of the three.';
    case 'proficiency': {
      const category = e?.type === 'proficiencyChoice' ? e.category : 'skill';
      const cats = Array.isArray(category) ? category : [category];
      if (slot === CREATION_LANGUAGES_SLOT)
        return 'Every character knows Common and two more languages. Pick the ones your character grew up with or learned.';
      if (cats.includes('language')) return 'Languages you can speak, read and write.';
      if (cats.includes('tool'))
        return 'You add your proficiency bonus (+2 at level 1) to checks made with these tools.';
      if (cats.includes('skill'))
        return 'You add your proficiency bonus (+2 at level 1) to checks with these skills. Pick the ones your character would be good at.';
      return undefined;
    }
    case 'expertise':
      return 'Expertise doubles your proficiency bonus with a skill you are already proficient in.';
    case 'weaponMastery':
      return 'You can use the mastery property of these kinds of weapons: an extra effect when you hit (or miss) with them. Pick the weapons you carry.';
    case 'feat':
      return c.progression
        ? 'A feat from this list: a fighting style or other special talent.'
        : 'A feat is a special talent. Origin feats can be taken at level 1; some have choices of their own, shown below once picked.';
    case 'spell':
      if (slot.startsWith('cantrips.'))
        return 'Cantrips can be cast as often as you like, without a spell slot.';
      if (slot.startsWith('spellbook.'))
        return 'Spells copied into your spellbook. After each Long Rest you prepare some of them to cast.';
      if (slot.startsWith('spells.') && /^spells\.\d+$/.test(slot))
        return 'Spells you know and can cast with your spell slots. You can swap one when you gain a level.';
      return 'Spells this gives you. A level 0 spell is a cantrip, cast at will.';
    case 'option':
      if (offer.key.owner.kind === 'species' && slot === 'size')
        return 'Your size. It changes a few rules, such as how much you can carry and which creatures you can grapple.';
      return undefined;
    case 'resistance':
      return 'You take half damage of the type you pick.';
    case 'optionalFeature':
      return 'Options your class lets you pick from; read each one to compare.';
    default:
      return undefined;
  }
}
