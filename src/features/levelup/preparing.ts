// Prepared spells on a level-up (plan §9.4): which casters gain from the level.

import type { LevelUpPlan } from '../../engine/build/levelUp.ts';
import type { DerivedSheet } from '../../engine/derive/types.ts';

const ordinal = (n: number) => ['', '1st', '2nd', '3rd'][n] ?? `${n}th`;

/**
 * Casters that prepare from their list after a Long Rest and gain from this level: room to
 * prepare more, spells of a higher level, or different spell slots (a multiclass's shared slots).
 */
export function preparingCasters(plan: LevelUpPlan, before: DerivedSheet) {
  const slotText = (s: DerivedSheet) =>
    s.spellcasting.slots.map((x) => `${ordinal(x.level)} ${x.max}`).join(' · ');
  const slotsBefore = slotText(before);
  const slotsAfter = slotText(plan.sheet);
  return plan.sheet.spellcasting.casters
    .filter((c) => c.preparedChange !== 'level' && c.preparedMax > 0)
    .map((c) => {
      const was = before.spellcasting.casters.find((x) => x.key === c.key);
      return {
        caster: c,
        room: Math.max(0, c.preparedMax - c.prepared.length),
        higher: !!was && c.maxSpellLevel > was.maxSpellLevel,
        slots: slotsBefore !== slotsAfter ? { before: slotsBefore, after: slotsAfter } : undefined,
      };
    })
    .filter((x) => x.room > 0 || x.higher || x.slots);
}
