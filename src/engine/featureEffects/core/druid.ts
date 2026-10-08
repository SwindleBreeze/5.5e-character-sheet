// Druid and its four XPHB circles (plan §10.2, step 6.6), checked against the 2024 Player's
// Handbook text of each feature. Wild Shape is a counter and a switch; the forms themselves are
// step 7.6. Circle features that work "while in your Wild Shape form" or "while your Starry
// Form is active" hang off those switches. Circle spells come from the subclasses' own data.

import type { Effect } from '../../../schema/index.ts';
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
  toggled,
  uses,
  when,
} from './helpers.ts';

const C = (id: string, level: number) => `classFeature:${id}|druid|xphb|${level}|xphb` as const;
const S = (sub: string, id: string, level: number) =>
  `subclassFeature:${id}|druid|xphb|${sub}|xphb|${level}|xphb` as const;

const wildShape = { resource: 'wild-shape', amount: 1 };
const wisUses = 'max(1, mod.wis)';
const resist = (...types: string[]): Effect[] =>
  types.map((value) => ({ type: 'resistance', value }));

export const DRUID: FeatureEffectsMap = {
  [C('druidic', 1)]: numbers([{ type: 'proficiency', category: 'language', value: 'druidic' }]),
  [C('primal order', 1)]: fromData(),
  [C('magician', 1)]: numbers([
    {
      type: 'grantSpells',
      spells: [
        {
          mode: 'known',
          ability: 'wis',
          spell: { choose: 'level=0|class=Druid', count: 1, slot: 'cantrip', retrain: 'levelUp' },
        },
      ],
    },
    { type: 'rollBonus', target: 'skill:arcana', value: wisUses },
    { type: 'rollBonus', target: 'skill:nature', value: wisUses },
  ]),
  [C('warden', 1)]: numbers([
    { type: 'proficiency', category: 'weapon', value: 'martial' },
    { type: 'proficiency', category: 'armor', value: 'medium' },
  ]),
  [C('spellcasting', 1)]: text(),
  [C('wild companion', 2)]: text(),
  [C('wild shape', 2)]: toggled(
    [
      uses('wild-shape', 'Wild Shape', 'table.wild-shape', 'shortOne'),
      {
        type: 'toggle',
        toggleId: 'wild-shape',
        name: 'Wild Shape',
        cost: [wildShape, { action: 'bonus' }],
        endsOn: ['longRest'],
        effects: [],
      },
    ],
    { unoffered: 'Its Beast forms aren’t tracked by the app yet: keep them in your notes.' },
  ),
  [C('druid subclass', 3)]: text(),
  [C('ability score improvement', 4)]: fromData(),
  [C('ability score improvement', 8)]: fromData(),
  [C('ability score improvement', 12)]: fromData(),
  [C('ability score improvement', 16)]: fromData(),
  [C('wild resurgence', 5)]: text(),
  [C('subclass feature', 6)]: text(),
  [C('subclass feature', 10)]: text(),
  [C('subclass feature', 14)]: text(),
  [C('elemental fury', 7)]: fromData(),
  [C('potent spellcasting', 7)]: numbers([
    {
      type: 'spellMod',
      filter: 'level=0|class=Druid',
      casterKey: 'druid|xphb',
      damageBonus: 'mod.wis',
    },
  ]),
  [C('primal strike', 7)]: numbers(
    [
      {
        type: 'damageRider',
        id: 'primal-strike',
        name: 'Primal Strike (Cold, Fire, Lightning or Thunder)',
        dice: 'steps(level.druid, 7, 1d8, 15, 2d8)',
        filter: { source: ['weapon', 'natural'] },
        oncePerTurn: true,
        optIn: true,
      },
    ],
    { unoffered: AT_TABLE },
  ),
  [C('improved elemental fury', 15)]: text(),
  [C('beast spells', 18)]: text(),
  [C('epic boon', 19)]: text(),
  [C('archdruid', 20)]: text({ unoffered: AT_TABLE }),

  // ---- Circle of the Land ----
  [S('land', 'circle of the land', 3)]: text(),
  [S('land', 'circle of the land spells', 3)]: text({
    unoffered: 'Picked through the circle’s own land choice.',
  }),
  [S('land', "land's aid", 3)]: numbers(
    [
      action({
        id: 'lands-aid',
        name: "Land's Aid",
        actionType: 'action',
        costs: [wildShape],
        roll: 'dice(steps(level.druid, 3, 2, 10, 3, 14, 4), 6)',
        saveDc: dc('wis'),
      }),
    ],
    { unoffered: TARGETS },
  ),
  [S('land', 'natural recovery', 6)]: numbers(
    [
      uses('natural-recovery', 'Natural Recovery', 1, 'long'),
      action({
        id: 'natural-recovery',
        name: 'Natural Recovery',
        actionType: 'other',
        costs: [{ resource: 'natural-recovery', amount: 1 }],
        outcomes: [{ regainSlot: { maxLevel: 'ceil(level.druid / 2)' } }],
      }),
    ],
    { unoffered: AT_TABLE },
  ),
  [S('land', "nature's ward", 10)]: numbers([{ type: 'conditionImmunity', value: 'poisoned' }], {
    notes: 'Its Resistance follows the land you picked: add it yourself.',
  }),
  [S('land', "nature's sanctuary", 14)]: numbers([
    action({
      id: 'natures-sanctuary',
      name: "Nature's Sanctuary",
      actionType: 'action',
      costs: [wildShape],
    }),
  ]),

  // ---- Circle of the Moon ----
  [S('moon', 'circle of the moon', 3)]: text(),
  [S('moon', 'circle of the moon spells', 3)]: text(),
  [S('moon', 'circle forms', 3)]: numbers(
    [
      action({
        id: 'circle-forms',
        name: 'Circle Forms',
        actionType: 'other',
        outcomes: [{ tempHp: '3 * level.druid' }],
      }),
    ],
    { notes: 'In a form, your AC is 13 + your Wisdom modifier if that beats the Beast’s.' },
  ),
  [S('moon', 'improved circle forms', 6)]: numbers([
    when({ toggle: 'wild-shape' }, [{ type: 'rollBonus', target: 'save:con', value: 'mod.wis' }]),
  ]),
  [S('moon', 'moonlight step', 10)]: numbers([
    uses('moonlight-step', 'Moonlight Step', wisUses, 'long'),
    restoredBy('moonlight-step', { slot: { minLevel: 2 } }),
    action({
      id: 'moonlight-step',
      name: 'Moonlight Step',
      actionType: 'bonus',
      costs: [{ resource: 'moonlight-step', amount: 1 }],
    }),
  ]),
  [S('moon', 'lunar form', 14)]: text(),

  // ---- Circle of the Sea ----
  [S('sea', 'circle of the sea', 3)]: text(),
  [S('sea', 'circle of the sea spells', 3)]: text(),
  [S('sea', 'wrath of the sea', 3)]: toggled(
    [
      {
        type: 'toggle',
        toggleId: 'wrath-of-the-sea',
        name: 'Wrath of the Sea',
        cost: [wildShape, { action: 'bonus' }],
        endsOn: ['shortRest', 'longRest'],
        effects: [],
      },
      action({
        id: 'wrath-of-the-sea',
        name: 'Wrath of the Sea',
        actionType: 'bonus',
        roll: 'dice(max(1, mod.wis), 6)',
        saveDc: dc('wis'),
      }),
    ],
    { unoffered: TARGETS },
  ),
  [S('sea', 'aquatic affinity', 6)]: numbers([{ type: 'speed', mode: 'swim', value: 'walk' }]),
  [S('sea', 'stormborn', 10)]: numbers([
    when({ toggle: 'wrath-of-the-sea' }, [
      { type: 'speed', mode: 'fly', value: 'walk' },
      ...resist('cold', 'lightning', 'thunder'),
    ]),
  ]),
  [S('sea', 'oceanic gift', 14)]: text(),

  // ---- Circle of the Stars ----
  [S('stars', 'circle of the stars', 3)]: text(),
  [S('stars', 'star map', 3)]: numbers([
    {
      type: 'grantSpells',
      spells: [
        {
          mode: 'innate',
          ability: 'wis',
          uses: { count: wisUses, recharge: 'long' },
          spell: { id: 'guiding bolt|xphb' },
        },
      ],
    },
  ]),
  [S('stars', 'starry form', 3)]: toggled(
    [
      {
        type: 'toggle',
        toggleId: 'starry-form',
        name: 'Starry Form',
        cost: [wildShape, { action: 'bonus' }],
        endsOn: ['shortRest', 'longRest'],
        effects: [],
        options: [
          {
            id: 'archer',
            name: 'Archer',
            effects: [
              action({
                id: 'starry-archer',
                name: 'Archer',
                actionType: 'bonus',
                roll: 'steps(level.druid, 3, 1d8, 10, 2d8) + mod.wis',
              }),
            ],
          },
          {
            id: 'chalice',
            name: 'Chalice',
            effects: [
              action({
                id: 'starry-chalice',
                name: 'Chalice',
                actionType: 'other',
                roll: 'steps(level.druid, 3, 1d8, 10, 2d8) + mod.wis',
              }),
            ],
          },
          {
            id: 'dragon',
            name: 'Dragon',
            effects: [
              { type: 'rollFloor', target: 'check:int', value: 10 },
              { type: 'rollFloor', target: 'check:wis', value: 10 },
              { type: 'rollFloor', target: 'save:concentration', value: 10 },
              when({ level: 10, classId: 'druid|xphb' }, [
                { type: 'speed', mode: 'fly', value: 20 },
              ]),
            ],
          },
        ],
      },
    ],
    { unoffered: 'Picked each time: switch on Starry Form with that constellation.' },
  ),
  [S('stars', 'archer', 3)]: text(),
  [S('stars', 'chalice', 3)]: text(),
  [S('stars', 'dragon', 3)]: text(),
  [S('stars', 'cosmic omen', 6)]: numbers([
    uses('cosmic-omen', 'Cosmic Omen', wisUses, 'long'),
    action({
      id: 'cosmic-omen',
      name: 'Cosmic Omen',
      actionType: 'reaction',
      costs: [{ resource: 'cosmic-omen', amount: 1 }],
      roll: '1d6',
    }),
  ]),
  [S('stars', 'twinkling constellations', 10)]: text(),
  [S('stars', 'full of stars', 14)]: numbers([
    when({ toggle: 'starry-form' }, resist('bludgeoning', 'piercing', 'slashing')),
  ]),
};
