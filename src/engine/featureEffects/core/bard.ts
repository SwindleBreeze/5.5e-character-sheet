// Bard and its four XPHB colleges (plan §10.2, step 6.4), checked against the 2024 Player's
// Handbook text of each feature. Bardic Inspiration is a counter with its die from the table;
// the college features that spend it are actions paid from it. Expertise and Magical Secrets
// are in `levels1to3.ts` and `levels4to20.ts`.

import { SKILLS } from '../../../schema/index.ts';
import type { FeatureEffectsMap } from '../types.ts';
import {
  action,
  AT_TABLE,
  dc,
  fromData,
  numbers,
  restoredBy,
  TARGETS,
  text,
  uses,
  when,
} from './helpers.ts';

const C = (id: string, level: number) => `classFeature:${id}|bard|xphb|${level}|xphb` as const;
const S = (sub: string, id: string, level: number) =>
  `subclassFeature:${id}|bard|xphb|${sub}|xphb|${level}|xphb` as const;

const inspiration = { resource: 'bardic-inspiration', amount: 1 };
const unarmored = { all: [{ armor: 'none' as const }, { shield: false }] };

export const BARD: FeatureEffectsMap = {
  [C('bardic inspiration', 1)]: numbers([
    uses('bardic-inspiration', 'Bardic Inspiration', 'max(1, mod.cha)', 'long', {
      die: 'table.bardic-die',
    }),
    action({
      id: 'bardic-inspiration',
      name: 'Bardic Inspiration',
      actionType: 'bonus',
      costs: [inspiration],
    }),
  ]),
  [C('spellcasting', 1)]: text(),
  [C('jack of all trades', 2)]: numbers([
    { type: 'halfProficiency', targets: SKILLS.map((s) => `skill:${s}` as const) },
  ]),
  [C('bard subclass', 3)]: text(),
  [C('ability score improvement', 4)]: fromData(),
  [C('ability score improvement', 8)]: fromData(),
  [C('ability score improvement', 12)]: fromData(),
  [C('ability score improvement', 16)]: fromData(),
  [C('font of inspiration', 5)]: numbers([
    { type: 'resourceModify', resourceId: 'bardic-inspiration', recharge: 'short' },
    restoredBy('bardic-inspiration', { slot: { minLevel: 1 } }),
  ]),
  [C('subclass feature', 6)]: text(),
  [C('subclass feature', 14)]: text(),
  [C('countercharm', 7)]: text(),
  [C('superior inspiration', 18)]: text(),
  [C('epic boon', 19)]: text(),
  // Its spells come from the class's own data.
  [C('words of creation', 20)]: text(),

  // ---- College of Dance ----
  [S('dance', 'college of dance', 3)]: text(),
  [S('dance', 'dazzling footwork', 3)]: text(),
  [S('dance', 'dance virtuoso', 3)]: text(),
  [S('dance', 'unarmored defense', 3)]: numbers([
    {
      type: 'acFormula',
      name: 'Unarmored Defense',
      base: 10,
      addAbilities: ['dex', 'cha'],
      shield: false,
    },
  ]),
  [S('dance', 'agile strikes', 3)]: text(),
  [S('dance', 'bardic damage', 3)]: numbers([
    when(unarmored, [
      {
        type: 'attackMod',
        label: 'Bardic Damage',
        filter: { source: ['unarmed'] },
        abilities: ['str', 'dex'],
        damageDie: 'table.bardic-die',
      },
    ]),
  ]),
  [S('dance', 'inspiring movement', 6)]: numbers(
    [
      action({
        id: 'inspiring-movement',
        name: 'Inspiring Movement',
        actionType: 'reaction',
        costs: [inspiration],
      }),
    ],
    { unoffered: TARGETS },
  ),
  [S('dance', 'tandem footwork', 6)]: numbers([
    action({
      id: 'tandem-footwork',
      name: 'Tandem Footwork',
      actionType: 'other',
      costs: [inspiration],
      roll: 'table.bardic-die',
    }),
  ]),
  [S('dance', 'leading evasion', 14)]: text(),

  // ---- College of Glamour ----
  [S('glamour', 'college of glamour', 3)]: text(),
  [S('glamour', 'beguiling magic', 3)]: numbers(
    [
      uses('beguiling-magic', 'Beguiling Magic', 1, 'long'),
      restoredBy('beguiling-magic', inspiration),
      action({
        id: 'beguiling-magic',
        name: 'Beguiling Magic',
        actionType: 'other',
        costs: [{ resource: 'beguiling-magic', amount: 1 }],
        saveDc: dc('cha'),
      }),
    ],
    { unoffered: AT_TABLE },
  ),
  [S('glamour', 'mantle of inspiration', 3)]: numbers(
    [
      action({
        id: 'mantle-of-inspiration',
        name: 'Mantle of Inspiration',
        actionType: 'bonus',
        costs: [inspiration],
        roll: 'table.bardic-die',
      }),
    ],
    { unoffered: TARGETS },
  ),
  [S('glamour', 'mantle of majesty', 6)]: numbers([
    uses('mantle-of-majesty', 'Mantle of Majesty', 1, 'long'),
    restoredBy('mantle-of-majesty', { slot: { minLevel: 3 } }),
    action({
      id: 'mantle-of-majesty',
      name: 'Mantle of Majesty',
      actionType: 'bonus',
      costs: [{ resource: 'mantle-of-majesty', amount: 1 }],
    }),
  ]),
  [S('glamour', 'unbreakable majesty', 14)]: numbers([
    uses('unbreakable-majesty', 'Unbreakable Majesty', 1, 'short'),
    action({
      id: 'unbreakable-majesty',
      name: 'Unbreakable Majesty',
      actionType: 'bonus',
      costs: [{ resource: 'unbreakable-majesty', amount: 1 }],
      saveDc: dc('cha'),
    }),
  ]),

  // ---- College of Lore ----
  [S('lore', 'college of lore', 3)]: text(),
  [S('lore', 'bonus proficiencies', 3)]: numbers([
    {
      type: 'proficiencyChoice',
      category: 'skill',
      choice: { slot: 'skills', count: 3, from: 'any' },
    },
  ]),
  [S('lore', 'cutting words', 3)]: numbers([
    action({
      id: 'cutting-words',
      name: 'Cutting Words',
      actionType: 'reaction',
      costs: [inspiration],
      roll: 'table.bardic-die',
    }),
  ]),
  // Picked through the college's own data (its two spells at level 6).
  [S('lore', 'magical discoveries', 6)]: text(),
  [S('lore', 'peerless skill', 14)]: numbers([
    action({
      id: 'peerless-skill',
      name: 'Peerless Skill',
      actionType: 'other',
      costs: [inspiration],
      roll: 'table.bardic-die',
    }),
  ]),

  // ---- College of Valor ----
  [S('valor', 'college of valor', 3)]: text(),
  [S('valor', 'combat inspiration', 3)]: text(),
  [S('valor', 'martial training', 3)]: numbers([
    { type: 'proficiency', category: 'weapon', value: 'martial' },
    { type: 'proficiency', category: 'armor', value: 'medium' },
    { type: 'proficiency', category: 'armor', value: 'shield' },
  ]),
  [S('valor', 'extra attack', 6)]: numbers([{ type: 'extraAttack', count: 2 }]),
  [S('valor', 'battle magic', 14)]: text(),
};
