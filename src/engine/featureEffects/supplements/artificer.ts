// Artificer (EFA, 2024) class features (plan §10.2, step 6.16); its subclasses are in
// `artificerSubclasses.ts`. Spell slots, cantrips, prepared spells and the Epic Boon pick come
// from the class data; Ability Score Improvements from their own data. Tinker's Magic, Flash of
// Genius and the Magic Item Tinker options are counters with actions paid from them; the
// attunement limit rises to 4, 5, 6. The magic item plans have no primitive yet (see `needs`).

import type { FeatureEffectsMap } from '../types.ts';
import { action, AT_TABLE, fromData, numbers, text, uses } from '../core/helpers.ts';

const C = (id: string, level: number) => `classFeature:${id}|artificer|efa|${level}|efa` as const;

const intUses = 'max(1, mod.int)';
const flash = { resource: 'flash-of-genius', amount: 1 };

export const SUP_ARTIFICER: FeatureEffectsMap = {
  [C('spellcasting', 1)]: text(),
  // Mending comes from the class data, on top of the class's cantrips; items made from a short
  // list, Int mod per Long Rest.
  [C("tinker's magic", 1)]: numbers(
    [
      uses('tinkers-magic', "Tinker's Magic", intUses, 'long'),
      action({
        id: 'tinkers-magic',
        name: "Tinker's Magic",
        actionType: 'action',
        costs: [{ resource: 'tinkers-magic', amount: 1 }],
      }),
    ],
    { unoffered: AT_TABLE },
  ),
  // Plans come from four level-gated tables, three rows of which are rarity/type filters over
  // all magic items; a pick must be recorded without applying the item's own effects.
  [C('replicate magic item', 2)]: text({
    unoffered:
      'Plans are level-gated and partly open filters (any common, uncommon or rare item of a kind); kept by the player.',
    needs:
      'a magic item plan choice: level-gated item lists and filters, recorded without the items applying',
    notes: 'Plans known and items at once follow the Plans Known and Magic Items table columns.',
  }),
  [C('artificer subclass', 3)]: text(),
  ...Object.fromEntries(
    [4, 8, 12, 16].map((level) => [C('ability score improvement', level), fromData()]),
  ),
  [C('subclass feature', 5)]: text(),
  [C('subclass feature', 9)]: text(),
  [C('subclass feature', 15)]: text(),
  // Charge (a slot, Bonus Action), Drain (once per Long Rest, Bonus Action) and Transmute (once
  // per Long Rest, Magic action). Drain's new slot is not a regained one, so it is left as text.
  [C('magic item tinker', 6)]: numbers(
    [
      action({
        id: 'charge-magic-item',
        name: 'Charge Magic Item',
        actionType: 'bonus',
        costs: [{ slot: { minLevel: 1 } }],
      }),
      uses('drain-magic-item', 'Drain Magic Item', 1, 'long'),
      action({
        id: 'drain-magic-item',
        name: 'Drain Magic Item',
        actionType: 'bonus',
        costs: [{ resource: 'drain-magic-item', amount: 1 }],
      }),
      uses('transmute-magic-item', 'Transmute Magic Item', 1, 'long'),
      action({
        id: 'transmute-magic-item',
        name: 'Transmute Magic Item',
        actionType: 'action',
        costs: [{ resource: 'transmute-magic-item', amount: 1 }],
      }),
    ],
    { needs: 'an outcome that adds a temporary spell slot (until the next Long Rest)' },
  ),
  // Reaction: add Int mod (at least 1) to a failed check or save; Int mod uses per Long Rest.
  [C('flash of genius', 7)]: numbers([
    uses('flash-of-genius', 'Flash of Genius', intUses, 'long'),
    action({
      id: 'flash-of-genius',
      name: 'Flash of Genius',
      actionType: 'reaction',
      roll: intUses,
      costs: [flash],
    }),
  ]),
  [C('magic item adept', 10)]: numbers([{ type: 'attunementMax', value: 4 }]),
  // A stored spell used twice Int mod times (at least twice); stored again after a Long Rest.
  [C('spell-storing item', 11)]: numbers(
    [
      uses('spell-storing-item', 'Spell-Storing Item', 'max(2, 2 * mod.int)', 'long'),
      action({
        id: 'spell-storing-item',
        name: 'Spell-Storing Item',
        actionType: 'action',
        costs: [{ resource: 'spell-storing-item', amount: 1 }],
      }),
    ],
    { unoffered: 'The stored spell is picked after each Long Rest.' },
  ),
  // Magic Item Savant (five attuned items) and Refreshed Genius (one use back on a Short Rest).
  [C('advanced artifice', 14)]: numbers([
    { type: 'attunementMax', value: 5 },
    { type: 'resourceModify', resourceId: 'flash-of-genius', recharge: 'shortOne' },
  ]),
  [C('magic item master', 18)]: numbers([{ type: 'attunementMax', value: 6 }]),
  [C('epic boon', 19)]: text(),
  // Magical Guidance: all Flash of Genius uses back on a Short Rest, which the text ties to
  // being attuned to a magic item. Cheat Death is text.
  [C('soul of artifice', 20)]: numbers(
    [{ type: 'resourceModify', resourceId: 'flash-of-genius', recharge: 'short' }],
    {
      notes: 'Flash of Genius returns fully on a Short Rest only while attuned to a magic item.',
      needs: 'a predicate on being attuned to at least one magic item',
    },
  ),
};
