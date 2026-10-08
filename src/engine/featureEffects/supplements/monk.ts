// 2024 supplement monk subclass (plan §10.2, step 6.16): Warrior of the Mystic Arts. Its
// spellcasting (slots, prepared Sorcerer spells, cantrips) comes from the subclass's data;
// Mystic Focus trades spell slots and the core Focus Points (`focus-points`) both ways.

import type { Effect } from '../../../schema/index.ts';
import type { FeatureEffectsMap } from '../types.ts';
import { action, numbers, text } from '../core/helpers.ts';

const S = (id: string, level: number) =>
  `subclassFeature:${id}|monk|xphb|mystic arts|au|${level}|au` as const;

/** Slot level, Focus Point cost to recover it, and the Monk level that allows it. */
const RECOVERY = [
  [1, 2, 6],
  [2, 3, 7],
  [3, 5, 13],
  [4, 6, 19],
] as const;

export const SUP_MONK: FeatureEffectsMap = {
  [S('warrior of the mystic arts', 3)]: text(),
  [S('spellcasting', 3)]: text(),
  [S('mystic fighting style', 6)]: text(),
  // A spent slot gives back Focus Points equal to its level; Focus Points buy back a slot after
  // a Short Rest or Uncanny Metabolism.
  [S('mystic focus', 6)]: numbers(
    RECOVERY.map(([slot, cost, level]): Effect => ({
      type: 'atLevel',
      level,
      effects: [
        {
          type: 'restoreWith',
          resourceId: 'focus-points',
          amount: slot,
          costs: [{ slot: { minLevel: slot } }],
        },
        action({
          id: `mystic-focus-${slot}`,
          name: `Recover Level ${slot} Slot`,
          actionType: 'other',
          costs: [{ resource: 'focus-points', amount: cost }],
          outcomes: [{ regainSlot: { maxLevel: slot } }],
        }),
      ],
    })),
  ),
  [S('focused strike', 11)]: text(),
  [S('improved mystic fighting style', 17)]: text(),
};
