// 2024 supplements (plan §10.2, step 6.16): the Oath of the Noble Genies (FRHoF). Its Elemental
// Smite options spend the core Paladin's Channel Divinity; Genie Spells come from the data.

import { refKey, type Effect } from '../../../schema/index.ts';
import type { FeatureEffectsMap } from '../types.ts';
import {
  action,
  dc,
  notIncapacitated,
  numbers,
  restoredBy,
  TARGETS,
  text,
  toggled,
  uses,
  when,
} from '../core/helpers.ts';

const S = (id: string, level: number) =>
  refKey({
    kind: 'subclassFeature',
    id: `${id}|paladin|xphb|noble genies|frhof|${level}|frhof`,
  });

const divinity = { resource: 'channel-divinity', amount: 1 };
const chaMin1 = 'max(1, mod.cha)';
const ELEMENTS = ['acid', 'cold', 'fire', 'lightning', 'thunder'];
const title = (s: string) => s[0]!.toUpperCase() + s.slice(1);

export const SUP_PALADIN: FeatureEffectsMap = {
  [S('oath of the noble genies', 3)]: text(),
  // The parent of the four options below; each spends Channel Divinity on its own.
  [S('elemental smite', 3)]: text(),
  [S("dao's crush", 3)]: numbers([
    action({
      id: 'daos-crush',
      name: "Dao's Crush",
      actionType: 'other',
      costs: [divinity],
      saveDc: dc('cha'),
    }),
  ]),
  // A short semi-incorporeal form after a teleport: a switch for its defenses.
  [S("djinni's escape", 3)]: toggled([
    {
      type: 'toggle',
      toggleId: 'djinnis-escape',
      name: "Djinni's Escape",
      cost: [divinity],
      endsOn: ['shortRest', 'longRest'],
      effects: [
        ...['bludgeoning', 'piercing', 'slashing'].map((value): Effect => ({
          type: 'resistance',
          value,
        })),
        ...['grappled', 'prone', 'restrained'].map((value): Effect => ({
          type: 'conditionImmunity',
          value,
        })),
      ],
    },
  ]),
  [S("efreeti's fury", 3)]: numbers([
    action({
      id: 'efreetis-fury',
      name: "Efreeti's Fury",
      actionType: 'other',
      costs: [divinity],
      roll: '2d4',
    }),
  ]),
  [S("marid's surge", 3)]: numbers(
    [
      action({
        id: 'marids-surge',
        name: "Marid's Surge",
        actionType: 'other',
        costs: [divinity],
        saveDc: dc('cha'),
      }),
    ],
    { unoffered: TARGETS },
  ),
  [S('genie spells', 3)]: text(),
  [S("genie's splendor", 3)]: numbers([
    {
      type: 'acFormula',
      name: "Genie's Splendor",
      base: 10,
      addAbilities: ['dex', 'cha'],
      shield: true,
    },
    {
      type: 'proficiencyChoice',
      category: 'skill',
      choice: {
        slot: 'skill',
        count: 1,
        from: ['acrobatics', 'intimidation', 'performance', 'persuasion'],
      },
    },
  ]),
  // The type can change every turn, so it is a switch with one form per type.
  [S('aura of elemental shielding', 7)]: toggled(
    [
      {
        type: 'toggle',
        toggleId: 'elemental-shielding',
        name: 'Aura of Elemental Shielding',
        effects: [],
        options: ELEMENTS.map((value) => ({
          id: value,
          name: title(value),
          effects: [when(notIncapacitated, [{ type: 'resistance', value }])],
        })),
      },
    ],
    { unoffered: 'Picked as the switch’s form; it may change at the start of each turn.' },
  ),
  [S('elemental rebuke', 15)]: numbers([
    uses('elemental-rebuke', 'Elemental Rebuke', chaMin1, 'long'),
    action({
      id: 'elemental-rebuke',
      name: 'Elemental Rebuke',
      actionType: 'reaction',
      costs: [{ resource: 'elemental-rebuke', amount: 1 }],
      roll: '2d10 + mod.cha',
      saveDc: dc('cha'),
    }),
  ]),
  // Once per Long Rest, or again for a level 5 slot; its Minor Wish reaction is the player's.
  [S('noble scion', 20)]: toggled([
    uses('noble-scion', 'Noble Scion', 1, 'long'),
    restoredBy('noble-scion', { slot: { minLevel: 5 } }),
    {
      type: 'toggle',
      toggleId: 'noble-scion',
      name: 'Noble Scion',
      cost: [{ resource: 'noble-scion', amount: 1 }, { action: 'bonus' }],
      endsOn: ['shortRest', 'longRest'],
      effects: [{ type: 'speed', mode: 'fly', value: 60 }],
    },
  ]),
};
