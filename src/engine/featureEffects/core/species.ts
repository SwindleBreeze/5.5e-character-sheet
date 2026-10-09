// The 2024 Player's Handbook species (plan §10.2, step 6.15), checked against the text of each.
// Speed, senses, resistances and spells come from the data; these add the traits with uses or
// numbers: Breath Weapon and Draconic Flight, Healing Hands and Celestial Revelation, Dwarven
// Toughness and Stonecunning, Gnomish Cunning, Giant Ancestry and Large Form, Adrenaline Rush
// and Relentless Endurance. A species chosen by its lineage or ancestry (`dragonborn (red)`,
// `goliath; fire giant ancestry`) is its own entity, so each gets the shared traits too.

import { refKey, type Effect } from '../../../schema/index.ts';
import type { FeatureEffectsMap, FeatureMapping } from '../types.ts';
import { action, numbers, savesAgainst, text, toggled, uses, when } from './helpers.ts';

const SP = (id: string) => refKey({ kind: 'species', id: `${id}|xphb` });
const atLevel = (level: number) => ({ level });

// ---- Aasimar ----
const AASIMAR = toggled([
  uses('healing-hands', 'Healing Hands', 1, 'long'),
  action({
    id: 'healing-hands',
    name: 'Healing Hands',
    actionType: 'action',
    costs: [{ resource: 'healing-hands', amount: 1 }],
    roll: 'dice(pb, 4)',
  }),
  when(atLevel(3), [
    uses('celestial-revelation', 'Celestial Revelation', 1, 'long'),
    {
      type: 'toggle',
      toggleId: 'celestial-revelation',
      name: 'Celestial Revelation',
      cost: [{ resource: 'celestial-revelation', amount: 1 }, { action: 'bonus' }],
      endsOn: ['shortRest', 'longRest'],
      effects: [],
      options: [
        {
          id: 'heavenly-wings',
          name: 'Heavenly Wings',
          effects: [{ type: 'speed', mode: 'fly', value: 'walk' }, revelationRider('radiant')],
        },
        { id: 'inner-radiance', name: 'Inner Radiance', effects: [revelationRider('radiant')] },
        { id: 'necrotic-shroud', name: 'Necrotic Shroud', effects: [revelationRider('necrotic')] },
      ],
    },
  ]),
]);

function revelationRider(damageType: string): Effect {
  return {
    type: 'damageRider',
    id: 'celestial-revelation',
    name: 'Celestial Revelation',
    dice: 'pb',
    damageType,
    filter: {},
    oncePerTurn: true,
    optIn: true,
  };
}

// ---- Dragonborn ----
function dragonborn(damageType?: string): FeatureMapping {
  return toggled([
    uses('breath-weapon', 'Breath Weapon', 'pb', 'long'),
    action({
      id: 'breath-weapon',
      name: damageType ? `Breath Weapon (${damageType})` : 'Breath Weapon',
      actionType: 'other',
      costs: [{ resource: 'breath-weapon', amount: 1 }],
      roll: 'dice(steps(level, 1, 1, 5, 2, 11, 3, 17, 4), 10)',
      saveDc: '8 + mod.con + pb',
    }),
    when(atLevel(5), [
      uses('draconic-flight', 'Draconic Flight', 1, 'long'),
      {
        type: 'toggle',
        toggleId: 'draconic-flight',
        name: 'Draconic Flight',
        cost: [{ resource: 'draconic-flight', amount: 1 }, { action: 'bonus' }],
        endsOn: ['shortRest', 'longRest'],
        effects: [{ type: 'speed', mode: 'fly', value: 'walk' }],
      },
    ]),
  ]);
}
const DRAGONS: Record<string, string> = {
  black: 'Acid',
  blue: 'Lightning',
  brass: 'Fire',
  bronze: 'Lightning',
  copper: 'Acid',
  gold: 'Fire',
  green: 'Poison',
  red: 'Fire',
  silver: 'Cold',
  white: 'Cold',
};

// ---- Dwarf, Elf, Gnome, Orc ----
const ELF = numbers([savesAgainst('being Charmed')]);
const DWARF = numbers([
  savesAgainst('being Poisoned'),
  { type: 'hpBonus', perLevel: 1 },
  uses('stonecunning', 'Stonecunning', 'pb', 'long'),
  action({
    id: 'stonecunning',
    name: 'Stonecunning',
    actionType: 'bonus',
    costs: [{ resource: 'stonecunning', amount: 1 }],
  }),
]);
const GNOME = numbers(
  (['int', 'wis', 'cha'] as const).map((a): Effect => ({
    type: 'rollMode',
    target: `save:${a}`,
    mode: 'advantage',
  })),
);
const ORC = numbers([
  uses('adrenaline-rush', 'Adrenaline Rush', 'pb', 'short'),
  action({
    id: 'adrenaline-rush',
    name: 'Adrenaline Rush',
    actionType: 'bonus',
    costs: [{ resource: 'adrenaline-rush', amount: 1 }],
    outcomes: [{ tempHp: 'pb' }],
  }),
  uses('relentless-endurance', 'Relentless Endurance', 1, 'long'),
  action({
    id: 'relentless-endurance',
    name: 'Relentless Endurance',
    actionType: 'other',
    costs: [{ resource: 'relentless-endurance', amount: 1 }],
  }),
]);

// ---- Goliath ----
function goliath(benefit?: { name: string; effect: Effect }): FeatureMapping {
  return toggled([
    uses('giant-ancestry', benefit?.name ?? 'Giant Ancestry', 'pb', 'long'),
    ...(benefit ? [benefit.effect] : []),
    when(atLevel(5), [
      uses('large-form', 'Large Form', 1, 'long'),
      {
        type: 'toggle',
        toggleId: 'large-form',
        name: 'Large Form',
        cost: [{ resource: 'large-form', amount: 1 }, { action: 'bonus' }],
        endsOn: ['shortRest', 'longRest'],
        effects: [
          { type: 'rollMode', target: 'check:str', mode: 'advantage' },
          { type: 'speedBonus', value: 10 },
        ],
      },
    ]),
  ]);
}
const ancestry = { resource: 'giant-ancestry', amount: 1 };
const giantRider = (id: string, name: string, dice: string, damageType: string): Effect => ({
  type: 'damageRider',
  id,
  name,
  dice,
  damageType,
  filter: {},
  cost: ancestry,
  optIn: true,
});
const GIANTS: Record<string, { name: string; effect: Effect }> = {
  cloud: {
    name: "Cloud's Jaunt",
    effect: action({
      id: 'clouds-jaunt',
      name: "Cloud's Jaunt",
      actionType: 'bonus',
      costs: [ancestry],
    }),
  },
  fire: { name: "Fire's Burn", effect: giantRider('fires-burn', "Fire's Burn", '1d10', 'fire') },
  frost: {
    name: "Frost's Chill",
    effect: giantRider('frosts-chill', "Frost's Chill", '1d6', 'cold'),
  },
  hill: {
    name: "Hill's Tumble",
    effect: action({
      id: 'hills-tumble',
      name: "Hill's Tumble",
      actionType: 'other',
      costs: [ancestry],
    }),
  },
  stone: {
    name: "Stone's Endurance",
    effect: action({
      id: 'stones-endurance',
      name: "Stone's Endurance",
      actionType: 'reaction',
      costs: [ancestry],
      roll: '1d12 + mod.con',
    }),
  },
  storm: {
    name: "Storm's Thunder",
    effect: action({
      id: 'storms-thunder',
      name: "Storm's Thunder",
      actionType: 'reaction',
      costs: [ancestry],
      roll: '1d8',
    }),
  },
};

export const SPECIES: FeatureEffectsMap = {
  [SP('aasimar')]: AASIMAR,
  [SP('dragonborn')]: dragonborn(),
  ...Object.fromEntries(
    Object.entries(DRAGONS).map(([color, type]) => [SP(`dragonborn (${color})`), dragonborn(type)]),
  ),
  [SP('dwarf')]: DWARF,
  [SP('elf')]: ELF,
  [SP('elf; drow lineage')]: ELF,
  [SP('elf; high elf lineage')]: ELF,
  [SP('elf; wood elf lineage')]: ELF,
  [SP('gnome')]: GNOME,
  [SP('gnome; forest gnome lineage')]: GNOME,
  [SP('gnome; rock gnome lineage')]: GNOME,
  [SP('goliath')]: goliath(),
  ...Object.fromEntries(
    Object.entries(GIANTS).map(([giant, benefit]) => [
      SP(`goliath; ${giant} giant ancestry`),
      goliath(benefit),
    ]),
  ),
  [SP('halfling')]: numbers([savesAgainst('being Frightened')]),
  [SP('human')]: text(),
  [SP('orc')]: ORC,
  [SP('tiefling')]: text(),
  [SP('tiefling; abyssal legacy')]: text(),
  [SP('tiefling; chthonic legacy')]: text(),
  [SP('tiefling; infernal legacy')]: text(),
};
