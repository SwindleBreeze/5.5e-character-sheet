// Wizard and its four XPHB subclasses (plan §10.2, step 6.14), checked against the 2024
// Player's Handbook text of each feature. Spellbook, preparation and the savants' free spells
// come from the data (steps 3.7, 5.6); Scholar, Spell Mastery and Signature Spells are in
// `levels1to3.ts` and `levels4to20.ts`. Arcane Ward is a ward (P12); Portent a counter.

import type { Effect } from '../../../schema/index.ts';
import type { FeatureEffectsMap } from '../types.ts';
import {
  action,
  AT_TABLE,
  fromData,
  numbers,
  restoredBy,
  savesAgainst,
  TARGETS,
  text,
  toggled,
  uses,
} from './helpers.ts';

const C = (id: string, level: number) => `classFeature:${id}|wizard|xphb|${level}|xphb` as const;
const S = (sub: string, id: string, level: number) =>
  `subclassFeature:${id}|wizard|xphb|${sub}|xphb|${level}|xphb` as const;

/** Free casts of a spell the Wizard already has prepared, once per Long Rest. */
function freeCast(id: string): Effect {
  return {
    type: 'grantSpells',
    spells: [
      { mode: 'innate', ability: 'int', uses: { count: 1, recharge: 'long' }, spell: { id } },
    ],
  };
}

export const WIZARD: FeatureEffectsMap = {
  [C('spellcasting', 1)]: text(),
  [C('ritual adept', 1)]: text(),
  [C('arcane recovery', 1)]: numbers([
    uses('arcane-recovery', 'Arcane Recovery', 1, 'long'),
    action({
      id: 'arcane-recovery',
      name: 'Arcane Recovery',
      actionType: 'other',
      costs: [{ resource: 'arcane-recovery', amount: 1 }],
      outcomes: [{ regainSlot: { maxLevel: 'ceil(level.wizard / 2)' } }],
    }),
  ]),
  [C('wizard subclass', 3)]: text(),
  ...Object.fromEntries(
    [4, 8, 12, 16].map((level) => [C('ability score improvement', level), fromData()]),
  ),
  [C('memorize spell', 5)]: text(),
  [C('subclass feature', 6)]: text(),
  [C('subclass feature', 10)]: text(),
  [C('subclass feature', 14)]: text(),
  [C('epic boon', 19)]: text(),

  // ---- Abjurer ----
  [S('abjurer', 'abjurer', 3)]: text(),
  [S('abjurer', 'abjuration savant', 3)]: text(),
  [S('abjurer', 'arcane ward', 3)]: numbers([
    { type: 'ward', name: 'Arcane Ward', max: '2 * level.wizard + mod.int' },
  ]),
  [S('abjurer', 'projected ward', 6)]: numbers([
    action({ id: 'projected-ward', name: 'Projected Ward', actionType: 'reaction' }),
  ]),
  [S('abjurer', 'spell breaker', 10)]: text(),
  [S('abjurer', 'spell resistance', 14)]: numbers([savesAgainst('spells')], {
    notes: 'Resistance to the damage of spells is applied when the damage is.',
  }),

  // ---- Diviner ----
  [S('diviner', 'diviner', 3)]: text(),
  [S('diviner', 'divination savant', 3)]: text(),
  [S('diviner', 'portent', 3)]: numbers([
    uses('portent', 'Portent', 'steps(level.wizard, 3, 2, 14, 3)', 'long'),
  ]),
  [S('diviner', 'expert divination', 6)]: text(),
  [S('diviner', 'the third eye', 10)]: toggled(
    [
      uses('the-third-eye', 'The Third Eye', 1, 'short'),
      {
        type: 'toggle',
        toggleId: 'the-third-eye',
        name: 'The Third Eye',
        cost: [{ resource: 'the-third-eye', amount: 1 }, { action: 'bonus' }],
        endsOn: ['shortRest', 'longRest'],
        effects: [],
        options: [
          {
            id: 'darkvision',
            name: 'Darkvision',
            effects: [{ type: 'sense', sense: 'darkvision', range: 120 }],
          },
          { id: 'greater-comprehension', name: 'Greater Comprehension', effects: [] },
          { id: 'see-invisibility', name: 'See Invisibility', effects: [] },
        ],
      },
    ],
    { unoffered: 'Picked each time: switch on The Third Eye with that benefit.' },
  ),
  [S('diviner', 'greater portent', 14)]: text(),

  // ---- Evoker ----
  [S('evoker', 'evoker', 3)]: text(),
  [S('evoker', 'evocation savant', 3)]: text(),
  [S('evoker', 'potent cantrip', 3)]: text(),
  [S('evoker', 'sculpt spells', 6)]: text({ unoffered: TARGETS }),
  [S('evoker', 'empowered evocation', 10)]: numbers([
    {
      type: 'spellMod',
      filter: 'school=V|class=Wizard',
      casterKey: 'wizard|xphb',
      damageBonus: 'mod.int',
    },
  ]),
  [S('evoker', 'overchannel', 14)]: text(),

  // ---- Illusionist ----
  [S('illusionist', 'illusionist', 3)]: text(),
  [S('illusionist', 'illusion savant', 3)]: text(),
  [S('illusionist', 'improved illusions', 3)]: text(),
  [S('illusionist', 'phantasmal creatures', 6)]: numbers([
    freeCast('summon beast|xphb'),
    freeCast('summon fey|xphb'),
  ]),
  [S('illusionist', 'illusory self', 10)]: numbers([
    uses('illusory-self', 'Illusory Self', 1, 'short'),
    restoredBy('illusory-self', { slot: { minLevel: 2 } }),
    action({
      id: 'illusory-self',
      name: 'Illusory Self',
      actionType: 'reaction',
      costs: [{ resource: 'illusory-self', amount: 1 }],
    }),
  ]),
  [S('illusionist', 'illusory reality', 14)]: text({ unoffered: AT_TABLE }),
};
