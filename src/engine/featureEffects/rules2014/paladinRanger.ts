// Characters on 2014 rules (plan step 8.6): the 2014 Paladin and Ranger's own features, and the features of
// its subclasses that a 2024 book reprints. Where a 2024 mapping fits the 2014 rule, the 2014 key
// reuses it.
//
// Paladin: Divine Smite is a rider per slot level (the bigger slots give the same 5d8), Channel
// Divinity one use a Short Rest (the 8.3 oaths spend the same `channel-divinity` counter), the
// capstones once a Long Rest without the 2024 slot refill. Oath spells come from the data.
// Ranger: the Tasha's optional features that replace a Player's Handbook one (Favored Foe, Deft
// Explorer, Primal Awareness, Nature's Veil) each carry a pick between the two, and only the
// picked one's numbers and choices apply. Favored enemies and terrains are picks, kept for the
// player to read; what they change at the table stays text.

import { refKey, type Effect, type Ref } from '../../../schema/index.ts';
import type { FeatureEffectsMap } from '../types.ts';
import { PALADIN } from '../core/paladin.ts';
import { RANGER } from '../core/ranger.ts';
import { ROGUE } from '../core/rogue.ts';
import {
  action,
  AT_TABLE,
  attacksAgainst,
  dc,
  fromData,
  NO_CHOICE,
  numbers,
  savesAgainst,
  TARGETS,
  text,
  toggled,
  uses,
} from '../core/helpers.ts';
import { expertise } from '../core/levels1to3.ts';

const key = (kind: 'classFeature' | 'subclassFeature', id: string) => refKey({ kind, id });
const PC = (id: string, level: number, src = 'phb') =>
  key('classFeature', `${id}|paladin|phb|${level}|${src}`);
const RC = (id: string, level: number, src = 'phb') =>
  key('classFeature', `${id}|ranger|phb|${level}|${src}`);
const PS = (sub: string, src: string, id: string, level: number) =>
  key('subclassFeature', `${id}|paladin|phb|${sub}|${src}|${level}|${src}`);
const RS = (sub: string, src: string, id: string, level: number, featureSrc = src) =>
  key('subclassFeature', `${id}|ranger|phb|${sub}|${src}|${level}|${featureSrc}`);
const XP = (id: string, level: number) => `classFeature:${id}|paladin|xphb|${level}|xphb` as const;
const XPS = (sub: string, id: string, level: number) =>
  `subclassFeature:${id}|paladin|xphb|${sub}|xphb|${level}|xphb` as const;
const XRS = (sub: string, id: string, level: number) =>
  `subclassFeature:${id}|ranger|xphb|${sub}|xphb|${level}|xphb` as const;

const divinity = { resource: 'channel-divinity', amount: 1 };
const chaMin1 = 'max(1, mod.cha)';
const wisUses = 'max(1, mod.wis)';
/** 2014 languages: any but the secret ones (Druidic, Thieves' Cant). */
const LANGUAGES_2014 = 'standard|exotic|rare';

/** A counter and the action that spends one use of it. */
function limited(
  id: string,
  name: string,
  max: string | number,
  recharge: 'short' | 'long',
  actionType: 'action' | 'bonus' | 'reaction' | 'other',
): Effect[] {
  return [
    uses(id, name, max, recharge),
    action({ id, name, actionType, costs: [{ resource: id, amount: 1 }] }),
  ];
}

/** A Channel Divinity option: an action that spends the counter. */
function channel(id: string, name: string, actionType: 'action' | 'bonus', save = false): Effect {
  return action({
    id,
    name,
    actionType,
    costs: [divinity],
    ...(save ? { saveDc: dc('cha') } : {}),
  });
}

/** A 2014 capstone: an action switching on a form once per Long Rest. */
function capstone(id: string, name: string, effects: Effect[]): Effect[] {
  return [
    uses(id, name, 1, 'long'),
    {
      type: 'toggle',
      toggleId: id,
      name,
      cost: [{ resource: id, amount: 1 }, { action: 'action' }],
      endsOn: ['shortRest', 'longRest'],
      effects,
    },
  ];
}

/** Free casts of a spell once per Long Rest, the spell known too. */
function knownWithFreeCast(id: string, atLevel?: number): Effect {
  const at = atLevel ? { atLevel } : {};
  return {
    type: 'grantSpells',
    spells: [
      { mode: 'known', ...at, spell: { id } },
      {
        mode: 'innate',
        ability: 'wis',
        ...at,
        uses: { count: 1, recharge: 'long' },
        spell: { id },
      },
    ],
  };
}

// ---- Tasha's optional features that replace a Player's Handbook one ----

/** The Tasha's feature that carries the pick between it and the feature it replaces. */
const variantOwner = (id: string): Ref => ({ kind: 'classFeature', id: `${id}|ranger|phb|1|tce` });
const FAVORED_FOE = variantOwner('favored foe');
const DEFT_EXPLORER = variantOwner('deft explorer');
const PRIMAL_AWARENESS: Ref = {
  kind: 'classFeature',
  id: 'primal awareness|ranger|phb|3|tce',
};
const NATURES_VEIL: Ref = { kind: 'classFeature', id: "nature's veil|ranger|phb|10|tce" };

/** The pick on a Tasha's optional feature: keep the Player's Handbook one, or use this. */
function variantPick(phb: string, tce: string, effects: Effect[]): Effect[] {
  return [
    {
      type: 'optionChoice',
      choice: { slot: 'variant', count: 1, from: ['phb', 'tce'] },
      labels: [`${phb} (Player’s Handbook)`, `${tce} (Tasha’s optional rule)`],
    },
    { type: 'ifChoice', slot: 'variant', value: 'tce', effects },
  ];
}

/** Effects of a Player's Handbook feature that apply unless its Tasha's replacement is picked. */
const unlessReplaced = (owner: Ref, effects: Effect[]): Effect => ({
  type: 'ifChoice',
  owner,
  slot: 'variant',
  value: 'phb',
  effects,
});

const ENEMIES = [
  'aberrations',
  'beasts',
  'celestials',
  'constructs',
  'dragons',
  'elementals',
  'fey',
  'fiends',
  'giants',
  'monstrosities',
  'oozes',
  'plants',
  'undead',
  'humanoids',
];
const ENEMY_LABELS = [
  ...ENEMIES.slice(0, -1).map((e) => e[0]!.toUpperCase() + e.slice(1)),
  'Two kinds of humanoid',
];
const TERRAINS = [
  'arctic',
  'coast',
  'desert',
  'forest',
  'grassland',
  'mountain',
  'swamp',
  'underdark',
];
const TERRAIN_LABELS = [
  'Arctic',
  'Coast',
  'Desert',
  'Forest',
  'Grassland',
  'Mountain',
  'Swamp',
  'The Underdark',
];

/** One more favored enemy and a language its kind speaks. */
function favoredEnemy(): Effect[] {
  return [
    {
      type: 'optionChoice',
      choice: { slot: 'enemy', count: 1, from: ENEMIES },
      labels: ENEMY_LABELS,
    },
    {
      type: 'proficiencyChoice',
      category: 'language',
      choice: { slot: 'language', count: 1, from: 'any' },
      filter: LANGUAGES_2014,
    },
  ];
}

/** One more favored terrain. */
const favoredTerrain = (): Effect => ({
  type: 'optionChoice',
  choice: { slot: 'terrain', count: 1, from: TERRAINS },
  labels: TERRAIN_LABELS,
});

/** A 2014 Ability Score Improvement: its pick (+2, +1/+1 or a feat) is added by the engine. */
const ASI = {
  ...fromData(),
  unoffered: 'Offered by the app’s own 2014 pick: +2, +1/+1 or a feat.',
};

/** Divine Smite: a slot's level gives 2d8, a d8 more a level, to 5d8 (a level 4 slot). */
const SMITE_SLOTS: [slot: number, paladinLevel: number][] = [
  [1, 2],
  [2, 5],
  [3, 9],
  [4, 13],
];

export const RULES_2014_PALADIN_RANGER: FeatureEffectsMap = {
  // ---- Paladin ----
  [PC('divine sense', 1)]: numbers(
    limited('divine-sense', 'Divine Sense', 'max(0, 1 + mod.cha)', 'long', 'action'),
  ),
  [PC('lay on hands', 1)]: numbers([
    uses('lay-on-hands', 'Lay on Hands', '5 * level.paladin', 'long', { pool: true }),
    action({ id: 'lay-on-hands', name: 'Lay on Hands', actionType: 'action' }),
  ]),
  [PC('divine smite', 2)]: numbers(
    [
      ...SMITE_SLOTS.map(([slot, level]): Effect => ({
        type: 'atLevel',
        level,
        effects: [
          {
            type: 'damageRider',
            id: `divine-smite-${slot}`,
            name: `Divine Smite (level ${slot === 4 ? '4+' : slot} slot)`,
            dice: `${slot + 1}d8`,
            damageType: 'radiant',
            filter: { range: 'melee', source: ['weapon'] },
            cost: { slot: { minLevel: slot } },
            optIn: true,
          },
        ],
      })),
      {
        type: 'damageRider',
        id: 'divine-smite-undead',
        name: 'Divine Smite: Undead or Fiend',
        dice: '1d8',
        damageType: 'radiant',
        filter: { range: 'melee', source: ['weapon'] },
        optIn: true,
      },
    ],
    { notes: 'Tap one smite chip per hit; add the Undead or Fiend die along with it.' },
  ),
  [PC('fighting style', 2)]: text(),
  [PC('spellcasting', 2)]: text(),
  [PC('divine health', 3)]: numbers([{ type: 'conditionImmunity', value: 'disease' }]),
  [PC('sacred oath', 3)]: text(),
  [PC('channel divinity', 3)]: numbers([uses('channel-divinity', 'Channel Divinity', 1, 'short')], {
    unoffered: AT_TABLE,
  }),
  [key('classFeature', 'channel divinity: harness divine power|paladin|phb|3|tce')]: numbers(
    [
      uses(
        'harness-divine-power',
        'Harness Divine Power',
        'steps(level.paladin, 3, 1, 7, 2, 15, 3)',
        'long',
      ),
      action({
        id: 'harness-divine-power',
        name: 'Harness Divine Power',
        actionType: 'bonus',
        costs: [divinity, { resource: 'harness-divine-power', amount: 1 }],
        outcomes: [{ regainSlot: { maxLevel: 'ceil(pb / 2)' } }],
      }),
    ],
    { notes: 'A Tasha’s optional rule: leave it unused if your table doesn’t allow it.' },
  ),
  ...Object.fromEntries(
    [4, 8, 12, 16, 19].map((level) => [PC('ability score improvement', level), ASI]),
  ),
  [PC('martial versatility', 4, 'tce')]: text(),
  [PC('extra attack', 5)]: PALADIN[XP('extra attack', 5)]!,
  // The bonus is the same; its range (10 ft., 30 ft. from 18) is the player's to apply.
  [PC('aura of protection', 6)]: PALADIN[XP('aura of protection', 6)]!,
  [PC('sacred oath feature', 7)]: text(),
  [PC('sacred oath feature', 15)]: text(),
  [PC('sacred oath feature', 20)]: text(),
  [PC('aura of courage', 10)]: PALADIN[XP('aura of courage', 10)]!,
  [PC('improved divine smite', 11)]: numbers([
    {
      type: 'damageRider',
      id: 'improved-divine-smite',
      name: 'Improved Divine Smite',
      dice: '1d8',
      damageType: 'radiant',
      filter: { range: 'melee', source: ['weapon'] },
      optIn: false,
    },
  ]),
  [PC('cleansing touch', 14)]: numbers(
    limited('cleansing-touch', 'Cleansing Touch', chaMin1, 'long', 'action'),
  ),
  [PC('aura improvements', 18)]: text(),

  // ---- Oath of Devotion ----
  [PS('devotion', 'phb', 'oath of devotion', 3)]: text(),
  [PS('devotion', 'phb', 'tenets of devotion', 3)]: text(),
  [PS('devotion', 'phb', 'oath spells', 3)]: text(),
  [PS('devotion', 'phb', 'channel divinity', 3)]: text(),
  [PS('devotion', 'phb', 'sacred weapon', 3)]: toggled([
    {
      type: 'toggle',
      toggleId: 'sacred-weapon',
      name: 'Sacred Weapon',
      cost: [divinity, { action: 'action' }],
      endsOn: ['shortRest', 'longRest'],
      effects: [
        {
          type: 'attackMod',
          label: 'Sacred Weapon',
          filter: { source: ['weapon'] },
          toHit: chaMin1,
        },
      ],
    },
  ]),
  [PS('devotion', 'phb', 'turn the unholy', 3)]: numbers([
    channel('turn-the-unholy', 'Turn the Unholy', 'action', true),
  ]),
  [PS('devotion', 'phb', 'aura of devotion', 7)]: PALADIN[XPS('devotion', 'aura of devotion', 7)]!,
  [PS('devotion', 'phb', 'purity of spirit', 15)]: text(),
  [PS('devotion', 'phb', 'holy nimbus', 20)]: toggled(
    capstone('holy-nimbus', 'Holy Nimbus', [savesAgainst('spells cast by Fiends or Undead')]),
  ),

  // ---- Oath of the Ancients ----
  [PS('ancients', 'phb', 'oath of the ancients', 3)]: text(),
  [PS('ancients', 'phb', 'tenets of the ancients', 3)]: text(),
  [PS('ancients', 'phb', 'oath spells', 3)]: text(),
  [PS('ancients', 'phb', 'channel divinity', 3)]: text(),
  [PS('ancients', 'phb', "nature's wrath", 3)]: numbers([
    channel('natures-wrath', "Nature's Wrath", 'action', true),
  ]),
  [PS('ancients', 'phb', 'turn the faithless', 3)]: numbers([
    channel('turn-the-faithless', 'Turn the Faithless', 'action', true),
  ]),
  [PS('ancients', 'phb', 'aura of warding', 7)]: text({
    notes: 'Halve the damage you take from spells by hand.',
    needs: 'resistance to damage from spells',
  }),
  [PS('ancients', 'phb', 'undying sentinel', 15)]: numbers(
    limited('undying-sentinel', 'Undying Sentinel', 1, 'long', 'other'),
    { unoffered: AT_TABLE },
  ),
  [PS('ancients', 'phb', 'elder champion', 20)]: toggled(
    capstone('elder-champion', 'Elder Champion', [
      action({
        id: 'elder-champion-heal',
        name: 'Elder Champion: Start of Turn',
        actionType: 'other',
        outcomes: [{ heal: 10 }],
      }),
    ]),
    { unoffered: 'The look is flavor: note it in your Description.' },
  ),

  // ---- Oath of Vengeance ----
  [PS('vengeance', 'phb', 'oath of vengeance', 3)]: text(),
  [PS('vengeance', 'phb', 'tenets of vengeance', 3)]: text({ unoffered: NO_CHOICE }),
  [PS('vengeance', 'phb', 'oath spells', 3)]: text(),
  [PS('vengeance', 'phb', 'channel divinity', 3)]: text(),
  [PS('vengeance', 'phb', 'abjure enemy', 3)]: numbers(
    [channel('abjure-enemy', 'Abjure Enemy', 'action', true)],
    { unoffered: TARGETS },
  ),
  [PS('vengeance', 'phb', 'vow of enmity', 3)]: numbers([
    channel('vow-of-enmity', 'Vow of Enmity', 'bonus'),
    attacksAgainst('the target of your Vow of Enmity'),
  ]),
  [PS('vengeance', 'phb', 'relentless avenger', 7)]: text(),
  [PS('vengeance', 'phb', 'soul of vengeance', 15)]: numbers([
    action({ id: 'soul-of-vengeance', name: 'Soul of Vengeance', actionType: 'reaction' }),
  ]),
  [PS('vengeance', 'phb', 'avenging angel', 20)]: toggled(
    capstone('avenging-angel', 'Avenging Angel', [
      { type: 'speed', mode: 'fly', value: 60 },
      action({
        id: 'avenging-angel-menace',
        name: 'Avenging Angel: Aura of Menace',
        actionType: 'other',
        saveDc: dc('cha'),
      }),
    ]),
  ),

  // ---- Oath of Glory (Tasha's; the 2024 one keeps its numbers) ----
  [PS('glory', 'tce', 'oath of glory', 3)]: text(),
  [PS('glory', 'tce', 'tenets of glory', 3)]: text(),
  [PS('glory', 'tce', 'oath spells', 3)]: text(),
  [PS('glory', 'tce', 'channel divinity', 3)]: text(),
  [PS('glory', 'tce', 'peerless athlete', 3)]: PALADIN[XPS('glory', 'peerless athlete', 3)]!,
  [PS('glory', 'tce', 'inspiring smite', 3)]: numbers(
    [
      action({
        id: 'inspiring-smite',
        name: 'Inspiring Smite',
        actionType: 'bonus',
        costs: [divinity],
        roll: '2d8 + level.paladin',
      }),
    ],
    { unoffered: TARGETS },
  ),
  [PS('glory', 'tce', 'aura of alacrity', 7)]: PALADIN[XPS('glory', 'aura of alacrity', 7)]!,
  [PS('glory', 'tce', 'glorious defense', 15)]: PALADIN[XPS('glory', 'glorious defense', 15)]!,
  [PS('glory', 'tce', 'living legend', 20)]: PALADIN[XPS('glory', 'living legend', 20)]!,

  // ---- Ranger ----
  [RC('favored enemy', 1)]: numbers([
    unlessReplaced(FAVORED_FOE, [
      ...favoredEnemy(),
      {
        type: 'rollMode',
        target: 'skill:survival',
        mode: 'advantage',
        against: 'tracking your favored enemies',
      },
      {
        type: 'rollMode',
        target: 'check:int',
        mode: 'advantage',
        against: 'recalling information about your favored enemies',
      },
    ]),
  ]),
  [RC('favored foe', 1, 'tce')]: numbers(
    variantPick('Favored Enemy', 'Favored Foe', [
      ...limited('favored-foe', 'Favored Foe', 'pb', 'long', 'other'),
      {
        type: 'damageRider',
        id: 'favored-foe',
        name: 'Favored Foe',
        dice: 'steps(level.ranger, 1, 1d4, 6, 1d6, 14, 1d8)',
        filter: {},
        oncePerTurn: true,
        optIn: true,
      },
    ]),
  ),
  [RC('natural explorer', 1)]: numbers([unlessReplaced(DEFT_EXPLORER, [favoredTerrain()])]),
  [RC('deft explorer', 1, 'tce')]: numbers(
    variantPick('Natural Explorer', 'Deft Explorer', [
      expertise(1),
      {
        type: 'proficiencyChoice',
        category: 'language',
        choice: { slot: 'languages', count: 2, from: 'any' },
        filter: LANGUAGES_2014,
      },
    ]),
  ),
  [RC('fighting style', 2)]: text(),
  [RC('spellcasting', 2)]: text(),
  [RC('spellcasting focus', 2, 'tce')]: text(),
  [RC('ranger archetype', 3)]: text(),
  [RC('primeval awareness', 3)]: numbers([
    unlessReplaced(PRIMAL_AWARENESS, [
      action({
        id: 'primeval-awareness',
        name: 'Primeval Awareness',
        actionType: 'action',
        costs: [{ slot: { minLevel: 1 } }],
      }),
    ]),
  ]),
  [RC('primal awareness', 3, 'tce')]: numbers(
    variantPick(
      'Primeval Awareness',
      'Primal Awareness',
      (
        [
          [3, 'speak with animals|phb'],
          [5, 'beast sense|phb'],
          [9, 'speak with plants|phb'],
          [13, 'locate creature|phb'],
          [17, 'commune with nature|phb'],
        ] as const
      ).map(([level, id]) => knownWithFreeCast(id, level)),
    ),
  ),
  ...Object.fromEntries(
    [4, 8, 12, 16, 19].map((level) => [RC('ability score improvement', level), ASI]),
  ),
  [RC('martial versatility', 4, 'tce')]: text(),
  [RC('extra attack', 5)]: RANGER['classFeature:extra attack|ranger|xphb|5|xphb']!,
  [RC('favored enemy and natural explorer improvements', 6)]: numbers([
    unlessReplaced(FAVORED_FOE, favoredEnemy()),
    unlessReplaced(DEFT_EXPLORER, [favoredTerrain()]),
  ]),
  [RC('deft explorer improvement', 6, 'tce')]: numbers([
    {
      type: 'ifChoice',
      owner: DEFT_EXPLORER,
      slot: 'variant',
      value: 'tce',
      effects: [
        { type: 'speedBonus', value: 5 },
        { type: 'speed', mode: 'climb', value: 'walk' },
        { type: 'speed', mode: 'swim', value: 'walk' },
      ],
    },
  ]),
  [RC('ranger archetype feature', 7)]: text(),
  [RC('ranger archetype feature', 11)]: text(),
  [RC('ranger archetype feature', 15)]: text(),
  [RC("land's stride", 8)]: numbers([
    savesAgainst('plants magically created or manipulated to impede movement'),
  ]),
  [RC('hide in plain sight', 10)]: toggled([
    unlessReplaced(NATURES_VEIL, [
      {
        type: 'toggle',
        toggleId: 'hide-in-plain-sight',
        name: 'Hide in Plain Sight',
        effects: [{ type: 'rollBonus', target: 'skill:stealth', value: 10 }],
      },
    ]),
  ]),
  [RC("nature's veil", 10, 'tce')]: numbers(
    variantPick(
      'Hide in Plain Sight',
      "Nature's Veil",
      limited('natures-veil', "Nature's Veil", 'pb', 'long', 'bonus'),
    ),
  ),
  [RC('natural explorer improvement', 10)]: numbers([
    unlessReplaced(DEFT_EXPLORER, [favoredTerrain()]),
  ]),
  [RC('deft explorer improvement', 10, 'tce')]: numbers([
    {
      type: 'ifChoice',
      owner: DEFT_EXPLORER,
      slot: 'variant',
      value: 'tce',
      effects: [
        uses('tireless', 'Tireless', 'pb', 'long'),
        action({
          id: 'tireless',
          name: 'Tireless',
          actionType: 'action',
          costs: [{ resource: 'tireless', amount: 1 }],
          outcomes: [{ tempHp: 'max(1, 1d8 + mod.wis)' }],
        }),
      ],
    },
  ]),
  [RC('vanish', 14)]: numbers(
    [action({ id: 'vanish', name: 'Vanish: Hide', actionType: 'bonus' })],
    { unoffered: AT_TABLE },
  ),
  [RC('favored enemy improvement', 14)]: numbers([unlessReplaced(FAVORED_FOE, favoredEnemy())]),
  [RC('feral senses', 18)]: text(),
  [RC('foe slayer', 20)]: numbers(
    [
      {
        type: 'damageRider',
        id: 'foe-slayer',
        name: 'Foe Slayer (favored enemy)',
        dice: 'mod.wis',
        filter: {},
        oncePerTurn: true,
        optIn: true,
      },
    ],
    { unoffered: AT_TABLE, notes: 'Or add it to the attack roll instead, by hand.' },
  ),

  // ---- Beast Master ----
  [RS('beast master', 'phb', 'beast master', 3)]: text(),
  [RS('beast master', 'phb', "ranger's companion", 3)]: text({
    unoffered: 'The beast is added on the Extras tab.',
  }),
  [RS('beast master', 'phb', 'primal companion', 3, 'tce')]:
    RANGER[XRS('beast master', 'primal companion', 3)]!,
  [RS('beast master', 'phb', 'exceptional training', 7)]: text(),
  [RS('beast master', 'phb', 'bestial fury', 11)]: text(),
  [RS('beast master', 'phb', 'share spells', 15)]: text(),

  // ---- Hunter ----
  [RS('hunter', 'phb', 'hunter', 3)]: text(),
  [RS('hunter', 'phb', "hunter's prey", 3)]: text(),
  [RS('hunter', 'phb', 'colossus slayer', 3)]: numbers([
    {
      type: 'damageRider',
      id: 'colossus-slayer',
      name: 'Colossus Slayer',
      dice: '1d8',
      filter: { source: ['weapon'] },
      oncePerTurn: true,
      optIn: true,
    },
  ]),
  [RS('hunter', 'phb', 'giant killer', 3)]: numbers([
    action({ id: 'giant-killer', name: 'Giant Killer', actionType: 'reaction' }),
  ]),
  [RS('hunter', 'phb', 'horde breaker', 3)]: text(),
  [RS('hunter', 'phb', 'defensive tactics', 7)]: text(),
  [RS('hunter', 'phb', 'escape the horde', 7)]: text(),
  [RS('hunter', 'phb', 'multiattack defense', 7)]: text(),
  [RS('hunter', 'phb', 'steel will', 7)]: numbers([savesAgainst('being Frightened')]),
  [RS('hunter', 'phb', 'multiattack', 11)]: text(),
  [RS('hunter', 'phb', 'volley', 11)]: numbers([
    action({ id: 'volley', name: 'Volley', actionType: 'action' }),
  ]),
  [RS('hunter', 'phb', 'whirlwind attack', 11)]: numbers([
    action({ id: 'whirlwind-attack', name: 'Whirlwind Attack', actionType: 'action' }),
  ]),
  [RS('hunter', 'phb', "superior hunter's defense", 15)]: text(),
  [RS('hunter', 'phb', 'evasion', 15)]: ROGUE['classFeature:evasion|rogue|xphb|7|xphb']!,
  [RS('hunter', 'phb', 'stand against the tide', 15)]: numbers(
    [
      action({
        id: 'stand-against-the-tide',
        name: 'Stand Against the Tide',
        actionType: 'reaction',
      }),
    ],
    { unoffered: TARGETS },
  ),
  [RS('hunter', 'phb', 'uncanny dodge', 15)]:
    ROGUE['classFeature:uncanny dodge|rogue|xphb|5|xphb']!,

  // ---- Gloom Stalker (Xanathar's) ----
  [RS('gloom stalker', 'xge', 'gloom stalker', 3)]: text(),
  [RS('gloom stalker', 'xge', 'gloom stalker magic', 3)]: text(),
  [RS('gloom stalker', 'xge', 'dread ambusher', 3)]: numbers([
    { type: 'initiativeBonus', value: 'mod.wis' },
    {
      type: 'damageRider',
      id: 'dread-ambusher',
      name: 'Dread Ambusher (first turn’s extra attack)',
      dice: '1d8',
      filter: { source: ['weapon'] },
      oncePerTurn: true,
      optIn: true,
    },
  ]),
  // Darkvision 60 ft., or 30 ft. more than the species gives.
  [RS('gloom stalker', 'xge', 'umbral sight', 3)]: numbers([
    { type: 'sense', sense: 'darkvision', range: 30 },
    { type: 'sense', sense: 'darkvision', range: 30, stack: true },
  ]),
  [RS('gloom stalker', 'xge', 'iron mind', 7)]: RANGER[XRS('gloom stalker', 'iron mind', 7)]!,
  [RS('gloom stalker', 'xge', "stalker's flurry", 11)]: text(),
  [RS('gloom stalker', 'xge', 'shadowy dodge', 15)]:
    RANGER[XRS('gloom stalker', 'shadowy dodge', 15)]!,

  // ---- Fey Wanderer (Tasha's) ----
  [RS('fey wanderer', 'tce', 'fey wanderer', 3)]: text(),
  [RS('fey wanderer', 'tce', 'dreadful strikes', 3)]:
    RANGER[XRS('fey wanderer', 'dreadful strikes', 3)]!,
  [RS('fey wanderer', 'tce', 'fey wanderer magic', 3)]:
    RANGER[XRS('fey wanderer', 'fey wanderer spells', 3)]!,
  [RS('fey wanderer', 'tce', 'otherworldly glamour', 3)]:
    RANGER[XRS('fey wanderer', 'otherworldly glamour', 3)]!,
  [RS('fey wanderer', 'tce', 'beguiling twist', 7)]:
    RANGER[XRS('fey wanderer', 'beguiling twist', 7)]!,
  [RS('fey wanderer', 'tce', 'fey reinforcements', 11)]: numbers([
    knownWithFreeCast('summon fey|tce'),
  ]),
  [RS('fey wanderer', 'tce', 'misty wanderer', 15)]: numbers(
    [
      {
        type: 'grantSpells',
        spells: [
          {
            mode: 'innate',
            ability: 'wis',
            uses: { count: wisUses, recharge: 'long' },
            spell: { id: 'misty step|phb' },
          },
        ],
      },
    ],
    { unoffered: TARGETS },
  ),
};
