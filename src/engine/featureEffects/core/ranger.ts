// Ranger and its four XPHB subclasses (plan §10.2, step 6.10), checked against the 2024
// Player's Handbook text of each feature. Favored Enemy's free Hunter's Mark casts come from the
// table; the Primal Companion's stat block is step 7.6. Subclass spells come from their data.
// Weapon Mastery, Deft Explorer and Expertise are in `levels1to3.ts` and `levels4to20.ts`.

import type { Effect } from '../../../schema/index.ts';
import type { FeatureEffectsMap } from '../types.ts';
import { action, dc, fromData, notHeavy, numbers, TARGETS, text, uses, when } from './helpers.ts';

const C = (id: string, level: number) => `classFeature:${id}|ranger|xphb|${level}|xphb` as const;
const S = (sub: string, id: string, level: number) =>
  `subclassFeature:${id}|ranger|xphb|${sub}|xphb|${level}|xphb` as const;

const wisUses = 'max(1, mod.wis)';

/** Free casts of a spell the Ranger has prepared. */
function freeCasts(id: string, count: string | number): Effect {
  return {
    type: 'grantSpells',
    spells: [{ mode: 'innate', ability: 'wis', uses: { count, recharge: 'long' }, spell: { id } }],
  };
}

/** Pick one of two named options, changeable after a Short or Long Rest. */
function either(slot: string, labels: [string, string], effects: [Effect[], Effect[]]): Effect[] {
  const ids = labels.map((l) => l.toLowerCase().replace(/\s+/g, '-'));
  return [
    { type: 'optionChoice', choice: { slot, count: 1, from: ids, retrain: 'shortRest' }, labels },
    ...ids.map((value, i): Effect => ({ type: 'ifChoice', slot, value, effects: effects[i]! })),
  ];
}

export const RANGER: FeatureEffectsMap = {
  [C('spellcasting', 1)]: text(),
  [C('favored enemy', 1)]: numbers([freeCasts("hunter's mark|xphb", 'table.favored-enemy')]),
  [C('fighting style', 2)]: text(),
  [C('ranger subclass', 3)]: text(),
  ...Object.fromEntries(
    [4, 8, 12, 16].map((level) => [C('ability score improvement', level), fromData()]),
  ),
  [C('extra attack', 5)]: numbers([{ type: 'extraAttack', count: 2 }]),
  [C('roving', 6)]: numbers([
    when(notHeavy, [{ type: 'speedBonus', value: 10 }]),
    { type: 'speed', mode: 'climb', value: 'walk' },
    { type: 'speed', mode: 'swim', value: 'walk' },
  ]),
  [C('subclass feature', 7)]: text(),
  [C('subclass feature', 11)]: text(),
  [C('subclass feature', 15)]: text(),
  [C('tireless', 10)]: numbers([
    uses('tireless', 'Tireless', wisUses, 'long'),
    action({
      id: 'tireless',
      name: 'Tireless',
      actionType: 'action',
      costs: [{ resource: 'tireless', amount: 1 }],
      outcomes: [{ tempHp: '1d8 + mod.wis' }],
    }),
  ]),
  [C('relentless hunter', 13)]: text(),
  [C("nature's veil", 14)]: numbers([
    uses('natures-veil', "Nature's Veil", wisUses, 'long'),
    action({
      id: 'natures-veil',
      name: "Nature's Veil",
      actionType: 'bonus',
      costs: [{ resource: 'natures-veil', amount: 1 }],
    }),
  ]),
  [C('precise hunter', 17)]: text(),
  [C('feral senses', 18)]: numbers([{ type: 'sense', sense: 'blindsight', range: 30 }]),
  [C('epic boon', 19)]: text(),
  [C('foe slayer', 20)]: text(),

  // ---- Beast Master ----
  [S('beast master', 'beast master', 3)]: text(),
  [S('beast master', 'primal companion', 3)]: text({
    unoffered: 'The beast isn’t tracked by the app yet: note its stat block and kind.',
  }),
  [S('beast master', 'exceptional training', 7)]: text(),
  [S('beast master', 'bestial fury', 11)]: text(),
  [S('beast master', 'share spells', 15)]: text(),

  // ---- Fey Wanderer ----
  [S('fey wanderer', 'fey wanderer', 3)]: text(),
  [S('fey wanderer', 'dreadful strikes', 3)]: numbers([
    {
      type: 'damageRider',
      id: 'dreadful-strikes',
      name: 'Dreadful Strikes',
      dice: 'steps(level.ranger, 3, 1d4, 11, 1d6)',
      damageType: 'psychic',
      filter: { source: ['weapon'] },
      oncePerTurn: true,
      optIn: true,
    },
  ]),
  [S('fey wanderer', 'fey wanderer spells', 3)]: text({
    unoffered: 'Its Feywild gift is flavor: note it in your Description.',
  }),
  [S('fey wanderer', 'otherworldly glamour', 3)]: numbers([
    { type: 'rollBonus', target: 'check:cha', value: wisUses },
    {
      type: 'proficiencyChoice',
      category: 'skill',
      choice: { slot: 'skills', count: 1, from: ['deception', 'performance', 'persuasion'] },
    },
  ]),
  [S('fey wanderer', 'beguiling twist', 7)]: numbers([
    action({
      id: 'beguiling-twist',
      name: 'Beguiling Twist',
      actionType: 'reaction',
      saveDc: dc('wis'),
    }),
  ]),
  [S('fey wanderer', 'fey reinforcements', 11)]: numbers([freeCasts('summon fey|xphb', 1)]),
  [S('fey wanderer', 'misty wanderer', 15)]: numbers([freeCasts('misty step|xphb', wisUses)], {
    unoffered: TARGETS,
  }),

  // ---- Gloom Stalker ----
  [S('gloom stalker', 'gloom stalker', 3)]: text(),
  [S('gloom stalker', 'dread ambusher', 3)]: numbers([
    uses('dreadful-strike', 'Dreadful Strike', wisUses, 'long'),
    {
      type: 'damageRider',
      id: 'dreadful-strike',
      name: 'Dreadful Strike',
      dice: 'steps(level.ranger, 3, 2d6, 11, 2d8)',
      damageType: 'psychic',
      filter: { source: ['weapon'] },
      oncePerTurn: true,
      cost: { resource: 'dreadful-strike', amount: 1 },
      optIn: true,
    },
    { type: 'initiativeBonus', value: 'mod.wis' },
  ]),
  [S('gloom stalker', 'gloom stalker spells', 3)]: text(),
  [S('gloom stalker', 'umbral sight', 3)]: numbers([
    { type: 'sense', sense: 'darkvision', range: 60 },
  ]),
  [S('gloom stalker', 'iron mind', 7)]: numbers([
    { type: 'proficiency', category: 'save', value: 'wis' },
  ]),
  [S('gloom stalker', "stalker's flurry", 11)]: text(),
  [S('gloom stalker', 'shadowy dodge', 15)]: numbers([
    action({ id: 'shadowy-dodge', name: 'Shadowy Dodge', actionType: 'reaction' }),
  ]),

  // ---- Hunter ----
  [S('hunter', 'hunter', 3)]: text(),
  [S('hunter', "hunter's prey", 3)]: numbers(
    either(
      'prey',
      ['Colossus Slayer', 'Horde Breaker'],
      [
        [
          {
            type: 'damageRider',
            id: 'colossus-slayer',
            name: 'Colossus Slayer',
            dice: '1d8',
            filter: { source: ['weapon'] },
            oncePerTurn: true,
            optIn: true,
          },
        ],
        [],
      ],
    ),
  ),
  [S('hunter', "hunter's lore", 3)]: text(),
  [S('hunter', 'defensive tactics', 7)]: numbers(
    either('tactics', ['Escape the Horde', 'Multiattack Defense'], [[], []]),
  ),
  [S('hunter', "superior hunter's prey", 11)]: text(),
  [S('hunter', "superior hunter's defense", 15)]: numbers([
    action({
      id: 'superior-hunters-defense',
      name: "Superior Hunter's Defense",
      actionType: 'reaction',
    }),
  ]),
};
