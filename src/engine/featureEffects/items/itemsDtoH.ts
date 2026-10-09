// 2024 Dungeon Master's Guide magic items, D to H (plan §10.3, step 7.12), checked against the
// text of each. Resistances, ability scores, item spells and the +N bonuses come from the data;
// these add what the data leaves out: riders on the item's own attacks, senses and speeds,
// languages, daily uses and the actions that spend them or the item's charges. Consumables,
// summoned creatures and situational benefits stay text.

import { refKey, type Effect } from '../../../schema/index.ts';
import {
  action,
  AT_TABLE,
  fromData,
  numbers,
  savesAgainst,
  TARGETS,
  text,
  toggled,
  uses,
} from '../core/helpers.ts';
import type { FeatureEffectsMap, FeatureMapping } from '../types.ts';

const I = (name: string) => refKey({ kind: 'item', id: `${name}|xdmg` });
/** Attacks made with this item. */
const own = (name: string) => ({ itemIds: [`${name}|xdmg`] });

/**
 * A magic variant (Flame Tongue, Holy Avenger…) sits on its base weapon's inventory row, and
 * attack filters see only the base weapon's id, so a filter on the variant's id never matches.
 */

/** Extra damage on hits with this item, added when the player taps it (the target's kind). */
function rider(name: string, dice: string, damageType?: string, optIn = true): Effect {
  return {
    type: 'damageRider',
    id: name.replace(/[^a-z]+/g, '-'),
    name: titleOf(name),
    dice,
    ...(damageType ? { damageType } : {}),
    filter: own(name),
    optIn,
  };
}

const titleOf = (name: string) => name.replace(/(^|\s)\S/g, (m) => m.toUpperCase());

/** A spell bound into the item when it is made, cast for 1 charge (Enspelled …). */
/** An Enspelled item's save DC and attack bonus, by its spell's level. */
const ENSPELLED_NUMBERS = [13, 13, 13, 15, 15, 17, 17, 18, 18];

function enspelled(kind: string, schools: string): Record<string, FeatureMapping> {
  const out: Record<string, FeatureMapping> = {};
  for (let level = 0; level <= 8; level++) {
    const dc = ENSPELLED_NUMBERS[level]!;
    const tier = level === 0 ? 'cantrip' : `level ${level}`;
    out[I(`enspelled ${kind} (${tier})`)] = numbers([
      {
        type: 'grantSpells',
        spells: [
          {
            mode: 'innate',
            spell: { choose: `level=${level}|school=${schools}`, count: 1, slot: 'spell' },
            uses: { charges: 1 },
            fixed: { dc, attackBonus: dc - 8 },
          },
        ],
      },
    ]);
  }
  return out;
}

const DRAGON_SCALE = (color: string) =>
  numbers([
    uses(`${color}-dragon-scale-mail`, `${titleOf(color)} Dragon Scale Mail`, 1, 'dawn'),
    action({
      id: `${color}-dragon-scale-mail`,
      name: `${titleOf(color)} Dragon Scale Mail`,
      actionType: 'action',
      costs: [{ resource: `${color}-dragon-scale-mail`, amount: 1 }],
    }),
    savesAgainst('the breath weapons of Dragons'),
  ]);

const VECNA_TOUCH: Effect = {
  type: 'damageRider',
  id: 'hand-of-vecna',
  name: 'Hand of Vecna',
  dice: '2d8',
  damageType: 'cold',
  filter: { range: 'melee', source: ['weapon', 'spell'] },
  optIn: true,
};

const FIGURINES = [
  'bronze griffon',
  'ebony fly',
  'golden lions',
  'ivory goats',
  'marble elephant',
  'obsidian steed',
  'onyx dog',
  'serpentine owl',
  'silver raven',
];

export const ITEMS_D_TO_H: FeatureEffectsMap = {
  [I("daern's instant fortress")]: text(),
  [I('dagger of venom')]: numbers([
    uses('dagger-of-venom', 'Dagger of Venom', 1, 'dawn'),
    action({
      id: 'dagger-of-venom',
      name: 'Dagger of Venom',
      actionType: 'bonus',
      costs: [{ resource: 'dagger-of-venom', amount: 1 }],
      roll: '2d10',
      saveDc: 15,
    }),
  ]),
  [I('dancing sword')]: numbers(
    [action({ id: 'dancing-sword', name: 'Dancing Sword', actionType: 'bonus' })],
    { unoffered: TARGETS },
  ),
  [I('dark shard amulet')]: numbers([
    uses('dark-shard-amulet', 'Dark Shard Amulet', 1, 'long'),
    action({
      id: 'dark-shard-amulet',
      name: 'Dark Shard Amulet',
      actionType: 'action',
      costs: [{ resource: 'dark-shard-amulet', amount: 1 }],
    }),
  ]),
  [I('decanter of endless water')]: text({ unoffered: TARGETS }),
  [I('deck of illusions')]: text(),
  [I('deck of many things')]: text({ unoffered: AT_TABLE }),
  // The share moved to AC is picked each turn; the attack side waits on variant filters.
  [I('defender')]: toggled([
    {
      type: 'toggle',
      toggleId: 'defender',
      name: 'Defender',
      effects: [],
      options: [1, 2, 3].map((n) => ({
        id: `ac-${n}`,
        name: `+${n} AC`,
        effects: [
          { type: 'acBonus', value: n },
          {
            type: 'attackMod',
            filter: own('defender'),
            label: 'Defender',
            toHit: -n,
            damage: -n,
          },
        ],
      })),
    },
  ]),
  [I('demon armor')]: numbers(
    [
      { type: 'proficiency', category: 'language', value: 'abyssal' },
      {
        type: 'attackMod',
        filter: { source: ['unarmed'] },
        label: 'Demon Armor',
        toHit: 1,
        damage: 1,
        damageDie: '1d8',
      },
    ],
    {
      notes:
        'Unarmed Strikes deal Slashing damage; the curse’s Disadvantage against demons is applied at the table.',
      needs: "changing an attack's damage type",
    },
  ),
  [I('demonomicon of iggwilv')]: numbers([
    uses('demonomicon-containment', 'Containment', 1, 'dawn'),
    action({
      id: 'demonomicon-containment',
      name: 'Containment',
      actionType: 'action',
      costs: [{ resource: 'demonomicon-containment', amount: 1 }],
      saveDc: 20,
    }),
  ]),
  [I('dimensional shackles')]: text(),
  [I('dragon scale mail')]: text(),
  [I('dragon slayer')]: numbers([rider('dragon slayer', '3d6')]),
  [I('dread helm')]: text(),
  [I('driftglobe')]: fromData(),
  [I('dust of disappearance')]: text(),
  [I('dust of dryness')]: text(),
  [I('dust of sneezing and choking')]: text(),
  [I('dwarven plate')]: numbers([
    action({ id: 'dwarven-plate', name: 'Dwarven Plate', actionType: 'reaction' }),
  ]),
  // Thrown, it adds Force damage (more against a Giant): tapped on the thrown attack.
  [I('dwarven thrower')]: numbers([rider('dwarven thrower', '1d8', 'force')]),

  [I('ear horn of hearing')]: text(),
  [I('efreeti bottle')]: text(),
  [I('efreeti chain')]: numbers([
    { type: 'proficiency', category: 'language', value: 'primordial' },
  ]),
  [I('elemental gem')]: text(),
  [I('elemental gem, blue sapphire')]: text(),
  [I('elemental gem, emerald')]: text(),
  [I('elemental gem, red corundum')]: text(),
  [I('elemental gem, yellow diamond')]: text(),
  [I('elixir of health')]: text(),
  // Training with this armor only; it is the armor worn while the item is in use.
  [I('elven chain')]: numbers(
    [
      { type: 'proficiency', category: 'armor', value: 'medium' },
      { type: 'proficiency', category: 'armor', value: 'heavy' },
    ],
    { notes: 'The training covers this armor only.' },
  ),
  [I('enduring spellbook')]: text(),
  [I('energy bow')]: text({ needs: "changing an attack's damage type" }),
  [I('enspelled armor')]: text(),
  ...enspelled('armor', 'A;I'),
  [I('enspelled staff')]: text(),
  ...enspelled('staff', 'A;C;D;E;V;I;N;T'),
  [I('enspelled weapon')]: text(),
  ...enspelled('weapon', 'C;D;V;N;T'),
  [I('ersatz eye')]: text(),
  [I('eversmoking bottle')]: text(),
  [I("executioner's axe")]: numbers([rider("executioner's axe", '2d6', 'slashing')], {
    notes: 'Temporary Hit Points equal to the extra damage are added at the table.',
  }),
  [I('eye and hand of vecna')]: numbers(
    [
      { type: 'sense', sense: 'truesight', range: 240 },
      VECNA_TOUCH,
      { type: 'rollMode', target: 'initiative', mode: 'advantage' },
      { type: 'immunity', value: 'poison' },
      { type: 'conditionImmunity', value: 'poisoned' },
      action({
        id: 'necrotic-reduction',
        name: 'Necrotic Reduction',
        actionType: 'action',
        roll: '7d6',
        saveDc: 18,
      }),
    ],
    { notes: 'Regeneration and the Wish every 30 days are tracked at the table.' },
  ),
  [I('eye of vecna')]: numbers([{ type: 'sense', sense: 'truesight', range: 240 }]),
  [I('eyes of charming')]: fromData(),
  [I('eyes of minute seeing')]: text(),
  [I('eyes of the eagle')]: text(),

  [I('figurine of wondrous power')]: text(),
  ...Object.fromEntries(FIGURINES.map((f) => [I(`figurine of wondrous power, ${f}`), text()])),
  [I('flame tongue')]: toggled([
    {
      type: 'toggle',
      toggleId: 'flame-tongue',
      name: 'Flame Tongue',
      cost: [{ action: 'bonus' }],
      effects: [rider('flame tongue', '2d6', 'fire', false)],
    },
  ]),
  [I('folding boat')]: text(),
  [I('frost brand')]: numbers([
    { type: 'resistance', value: 'fire' },
    rider('frost brand', '1d6', 'cold', false),
  ]),

  [I('gauntlets of ogre power')]: fromData(),
  [I('gem of brightness')]: numbers([
    action({
      id: 'gem-of-brightness-beam',
      name: 'Gem of Brightness (beam)',
      actionType: 'action',
      costs: [{ charges: 1 }],
      saveDc: 15,
    }),
    action({
      id: 'gem-of-brightness-flare',
      name: 'Gem of Brightness (flare)',
      actionType: 'action',
      costs: [{ charges: 5 }],
      saveDc: 15,
    }),
  ]),
  [I('gem of seeing')]: toggled([
    {
      type: 'toggle',
      toggleId: 'gem-of-seeing',
      name: 'Gem of Seeing',
      cost: [{ charges: 1 }, { action: 'action' }],
      effects: [{ type: 'sense', sense: 'truesight', range: 120 }],
    },
  ]),
  [I('giant slayer')]: numbers([rider('giant slayer', '2d6')]),
  [I('glamoured studded leather')]: fromData(),
  [I('gloves of missile snaring')]: numbers([
    {
      type: 'when',
      when: { freeHands: 1 },
      effects: [
        action({
          id: 'gloves-of-missile-snaring',
          name: 'Gloves of Missile Snaring',
          actionType: 'reaction',
          roll: '1d10 + mod.dex',
        }),
      ],
    },
  ]),
  [I('gloves of swimming and climbing')]: numbers(
    [
      { type: 'speed', mode: 'climb', value: 'walk' },
      { type: 'speed', mode: 'swim', value: 'walk' },
    ],
    { notes: 'The +5 to Athletics applies only to checks to climb or swim.' },
  ),
  [I('gloves of thievery')]: numbers([
    { type: 'rollBonus', target: 'skill:sleight of hand', value: 5 },
  ]),
  [I('goggles of night')]: numbers([
    { type: 'sense', sense: 'darkvision', range: 60, stack: true },
  ]),
  [I('gold dragon scale mail')]: DRAGON_SCALE('gold'),
  [I('green dragon scale mail')]: DRAGON_SCALE('green'),

  [I('hag eye')]: fromData(),
  [I('hammer of thunderbolts')]: numbers(
    [
      action({
        id: 'hammer-of-thunderbolts',
        name: 'Hammer of Thunderbolts',
        actionType: 'other',
        costs: [{ charges: 1 }],
        saveDc: 17,
      }),
    ],
    {
      notes: "Giant's Bane needs a Belt of Giant Strength or Gauntlets of Ogre Power in use too.",
      needs: 'a predicate on another item being in use (Might of Giants)',
    },
  ),
  [I('hand of vecna')]: numbers([VECNA_TOUCH]),
  [I('hat of disguise')]: fromData(),
  [I('hat of many spells')]: numbers(
    [uses('hat-of-many-spells', 'Hat of Many Spells', 1, 'short')],
    {
      notes: 'Spent only when the check succeeds.',
      unoffered: AT_TABLE,
    },
  ),
  [I('hat of vermin')]: text({ unoffered: AT_TABLE }),
  [I('hat of wizardry')]: numbers([
    uses('hat-of-wizardry', 'Hat of Wizardry', 1, 'long'),
    action({
      id: 'hat-of-wizardry',
      name: 'Hat of Wizardry',
      actionType: 'action',
      costs: [{ resource: 'hat-of-wizardry', amount: 1 }],
    }),
  ]),
  [I('headband of intellect')]: fromData(),
  [I('helm of brilliance')]: toggled(
    [
      {
        type: 'toggle',
        toggleId: 'helm-of-brilliance',
        name: 'Helm of Brilliance (fire opal)',
        cost: [{ action: 'action' }],
        effects: [
          {
            type: 'damageRider',
            id: 'helm-of-brilliance',
            name: 'Helm of Brilliance',
            dice: '1d6',
            damageType: 'fire',
            filter: { source: ['weapon'] },
            optIn: false,
          },
        ],
      },
    ],
    { notes: 'Its gems are counted at the table.' },
  ),
  [I('helm of comprehending languages')]: fromData(),
  [I('helm of telepathy')]: numbers([{ type: 'sense', sense: 'telepathy', range: 30 }]),
  [I('helm of teleportation')]: fromData(),
  [I("heward's handy haversack")]: text(),
  [I("heward's handy spice pouch")]: text(),
  [I('holy avenger')]: numbers([
    rider('holy avenger', '2d10', 'radiant'),
    savesAgainst('spells and other magical effects (the aura, while the sword is drawn)'),
  ]),
  [I('horn of blasting')]: numbers([
    action({
      id: 'horn-of-blasting',
      name: 'Horn of Blasting',
      actionType: 'action',
      roll: '5d8',
      saveDc: 15,
    }),
  ]),
  [I('horn of silent alarm')]: text({ unoffered: TARGETS }),
  [I('horn of valhalla')]: text({ unoffered: 'Each kind of horn is its own item.' }),
  [I('horn of valhalla, brass')]: text(),
  [I('horn of valhalla, bronze')]: text(),
  [I('horn of valhalla, iron')]: text(),
  [I('horn of valhalla, silver')]: text(),
  [I('horseshoes of a zephyr')]: text(),
  [I('horseshoes of speed')]: text(),
};
