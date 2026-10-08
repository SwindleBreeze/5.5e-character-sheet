// Sorcerer and its four XPHB subclasses (plan §10.2, step 6.12), checked against the 2024
// Player's Handbook text of each feature. Sorcery Points are a counter the Metamagic options'
// own data spends; converting them to and from spell slots is done at the table. Innate Sorcery
// is a switch. Subclass spells and the Metamagic picks come from the data.

import { ABILITIES, type Effect } from '../../../schema/index.ts';
import type { FeatureEffectsMap } from '../types.ts';
import {
  action,
  AT_TABLE,
  dc,
  fromData,
  numbers,
  restoredBy,
  savesAgainst,
  TARGETS,
  text,
  toggled,
  uses,
} from './helpers.ts';

const C = (id: string, level: number) => `classFeature:${id}|sorcerer|xphb|${level}|xphb` as const;
const S = (sub: string, id: string, level: number) =>
  `subclassFeature:${id}|sorcerer|xphb|${sub}|xphb|${level}|xphb` as const;

const points = (amount: number) => ({ resource: 'sorcery-points', amount });

/** Once per Long Rest, or again for some Sorcery Points. */
function onceOr(id: string, name: string, cost: number): Effect[] {
  return [uses(id, name, 1, 'long'), restoredBy(id, points(cost))];
}

const MANIFESTATION = 'Its table is flavor: note what you picked in your Description.';

export const SORCERER: FeatureEffectsMap = {
  [C('spellcasting', 1)]: text(),
  [C('innate sorcery', 1)]: toggled([
    uses('innate-sorcery', 'Innate Sorcery', 2, 'long'),
    {
      type: 'toggle',
      toggleId: 'innate-sorcery',
      name: 'Innate Sorcery',
      cost: [{ resource: 'innate-sorcery', amount: 1 }, { action: 'bonus' }],
      endsOn: ['shortRest', 'longRest'],
      effects: [
        // No filter: the Sorcerer caster's own DC.
        { type: 'spellMod', filter: '', casterKey: 'sorcerer|xphb', dcBonus: 1 },
        {
          type: 'rollMode',
          target: 'attack:spell',
          mode: 'advantage',
          note: 'Innate Sorcery (Sorcerer spells)',
        },
      ],
    },
  ]),
  [C('font of magic', 2)]: numbers([
    uses('sorcery-points', 'Sorcery Points', 'table.sorcery-points', 'long'),
  ]),
  [C('metamagic', 2)]: text(),
  [C('metamagic', 10)]: text(),
  [C('metamagic', 17)]: text(),
  [C('metamagic options', 2)]: text(),
  [C('sorcerer subclass', 3)]: text(),
  ...Object.fromEntries(
    [4, 8, 12, 16].map((level) => [C('ability score improvement', level), fromData()]),
  ),
  [C('sorcerous restoration', 5)]: numbers([
    uses('sorcerous-restoration', 'Sorcerous Restoration', 1, 'long'),
    action({
      id: 'sorcerous-restoration',
      name: 'Sorcerous Restoration',
      actionType: 'other',
      costs: [{ resource: 'sorcerous-restoration', amount: 1 }],
      outcomes: [{ restore: { resource: 'sorcery-points', amount: 'floor(level.sorcerer / 2)' } }],
    }),
  ]),
  [C('subclass feature', 6)]: text(),
  [C('subclass feature', 14)]: text(),
  [C('subclass feature', 18)]: text(),
  [C('sorcery incarnate', 7)]: numbers([restoredBy('innate-sorcery', points(2))]),
  [C('epic boon', 19)]: text(),
  [C('arcane apotheosis', 20)]: text(),

  // ---- Aberrant Sorcery ----
  [S('aberrant', 'aberrant sorcery', 3)]: text(),
  [S('aberrant', 'psionic spells', 3)]: text(),
  [S('aberrant', 'telepathic speech', 3)]: numbers(
    [action({ id: 'telepathic-speech', name: 'Telepathic Speech', actionType: 'bonus' })],
    { unoffered: TARGETS },
  ),
  [S('aberrant', 'psionic sorcery', 6)]: text(),
  [S('aberrant', 'psychic defenses', 6)]: numbers([
    { type: 'resistance', value: 'psychic' },
    savesAgainst('being Charmed or Frightened'),
  ]),
  [S('aberrant', 'revelation in flesh', 14)]: numbers(
    [
      action({
        id: 'revelation-in-flesh',
        name: 'Revelation in Flesh',
        actionType: 'bonus',
        costs: [points(1)],
      }),
    ],
    { unoffered: AT_TABLE },
  ),
  [S('aberrant', 'warping implosion', 18)]: numbers([
    ...onceOr('warping-implosion', 'Warping Implosion', 5),
    action({
      id: 'warping-implosion',
      name: 'Warping Implosion',
      actionType: 'action',
      costs: [{ resource: 'warping-implosion', amount: 1 }],
      roll: '3d10',
      saveDc: dc('cha'),
    }),
  ]),

  // ---- Clockwork Sorcery ----
  [S('clockwork', 'clockwork sorcery', 3)]: text(),
  [S('clockwork', 'clockwork spells', 3)]: text({ unoffered: MANIFESTATION }),
  [S('clockwork', 'restore balance', 3)]: numbers([
    uses('restore-balance', 'Restore Balance', 'max(1, mod.cha)', 'long'),
    action({
      id: 'restore-balance',
      name: 'Restore Balance',
      actionType: 'reaction',
      costs: [{ resource: 'restore-balance', amount: 1 }],
    }),
  ]),
  [S('clockwork', 'bastion of law', 6)]: numbers([
    action({
      id: 'bastion-of-law',
      name: 'Bastion of Law',
      actionType: 'action',
      costs: [points(1)],
    }),
  ]),
  [S('clockwork', 'trance of order', 14)]: toggled([
    ...onceOr('trance-of-order', 'Trance of Order', 5),
    {
      type: 'toggle',
      toggleId: 'trance-of-order',
      name: 'Trance of Order',
      cost: [{ resource: 'trance-of-order', amount: 1 }, { action: 'bonus' }],
      endsOn: ['shortRest', 'longRest'],
      effects: [
        ...(['save:all', 'attack:all', 'initiative'] as const).map((target): Effect => ({
          type: 'rollFloor',
          target,
          value: 10,
        })),
        ...ABILITIES.map((a): Effect => ({ type: 'rollFloor', target: `check:${a}`, value: 10 })),
      ],
    },
  ]),
  [S('clockwork', 'clockwork cavalcade', 18)]: numbers(
    [
      ...onceOr('clockwork-cavalcade', 'Clockwork Cavalcade', 7),
      action({
        id: 'clockwork-cavalcade',
        name: 'Clockwork Cavalcade',
        actionType: 'action',
        costs: [{ resource: 'clockwork-cavalcade', amount: 1 }],
      }),
    ],
    { unoffered: TARGETS },
  ),

  // ---- Draconic Sorcery ----
  [S('draconic', 'draconic sorcery', 3)]: text(),
  [S('draconic', 'draconic resilience', 3)]: numbers([
    { type: 'hpBonus', flat: 'level.sorcerer' },
    {
      type: 'acFormula',
      name: 'Draconic Resilience',
      base: 10,
      addAbilities: ['dex', 'cha'],
      shield: true,
    },
  ]),
  [S('draconic', 'draconic spells', 3)]: text(),
  [S('draconic', 'elemental affinity', 6)]: numbers([
    {
      type: 'resistanceChoice',
      choice: { slot: 'affinity', count: 1, from: ['acid', 'cold', 'fire', 'lightning', 'poison'] },
    },
  ]),
  [S('draconic', 'dragon wings', 14)]: toggled([
    ...onceOr('dragon-wings', 'Dragon Wings', 3),
    {
      type: 'toggle',
      toggleId: 'dragon-wings',
      name: 'Dragon Wings',
      cost: [{ resource: 'dragon-wings', amount: 1 }, { action: 'bonus' }],
      endsOn: ['shortRest', 'longRest'],
      effects: [{ type: 'speed', mode: 'fly', value: 60 }],
    },
  ]),
  [S('draconic', 'dragon companion', 18)]: numbers([
    {
      type: 'grantSpells',
      spells: [
        {
          mode: 'innate',
          ability: 'cha',
          uses: { count: 1, recharge: 'long' },
          spell: { id: 'summon dragon|xphb' },
        },
      ],
    },
  ]),

  // ---- Wild Magic Sorcery ----
  [S('wild magic', 'wild magic sorcery', 3)]: text(),
  [S('wild magic', 'wild magic surge', 3)]: text({
    unoffered: 'Rolled at the table on its own surge table.',
  }),
  [S('wild magic', 'tides of chaos', 3)]: numbers([
    uses('tides-of-chaos', 'Tides of Chaos', 1, 'long'),
    action({
      id: 'tides-of-chaos',
      name: 'Tides of Chaos',
      actionType: 'other',
      costs: [{ resource: 'tides-of-chaos', amount: 1 }],
    }),
  ]),
  [S('wild magic', 'bend luck', 6)]: numbers([
    action({
      id: 'bend-luck',
      name: 'Bend Luck',
      actionType: 'reaction',
      costs: [points(1)],
      roll: '1d4',
    }),
  ]),
  [S('wild magic', 'controlled chaos', 14)]: text(),
  [S('wild magic', 'tamed surge', 18)]: numbers(
    [
      uses('tamed-surge', 'Tamed Surge', 1, 'long'),
      action({
        id: 'tamed-surge',
        name: 'Tamed Surge',
        actionType: 'other',
        costs: [{ resource: 'tamed-surge', amount: 1 }],
      }),
    ],
    { unoffered: AT_TABLE },
  ),
};
