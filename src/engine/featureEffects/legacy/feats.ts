// 2014 feats on 2024 characters (plan step 8.3): every 2014 feat no 2024 reprint hides, from
// every book, offered as a General feat. Ability increases, proficiencies, resistances and most
// spells come from the data; these add the uses and the actions or reactions that spend them,
// the save DCs worked out from the ability each feat increased (or the one picked for the feat
// it builds on), the damage riders, Dragon Hide's Armor Class and claws, and the switches that
// change numbers while on. Benefits that only happen at the table stay text.

import {
  refKey,
  type Ability,
  type ActionDef,
  type AttackFilter,
  type Effect,
  type Recharge,
  type Ref,
} from '../../../schema/index.ts';
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
  when,
} from '../core/helpers.ts';
import type { FeatureEffectsMap, FeatureMapping } from '../types.ts';

const F = (id: string) => refKey({ kind: 'feat', id });

/** Partly worked out (level B): what the sheet can't follow is in the notes. */
const partly = (effects: Effect[], extra: Partial<FeatureMapping> = {}): FeatureMapping => ({
  level: 'B',
  effects,
  ...extra,
});

/** A benefit with uses: its counter, and the action (or reaction…) that spends one. */
function limited(
  id: string,
  name: string,
  max: string | number,
  recharge: Recharge,
  actionType: ActionDef['actionType'],
  more: Partial<ActionDef> = {},
): Effect[] {
  const { costs = [], ...rest } = more;
  return [
    uses(id, name, max, recharge),
    action({
      id,
      name,
      actionType,
      costs: [{ resource: id, amount: 1 }, ...costs],
      ...rest,
    }),
  ];
}

const MENTAL: Ability[] = ['int', 'wis', 'cha'];

/** Effects that read an ability picked in one of the feat's own slots (by default, the increase). */
function byAbility(from: Ability[], make: (a: Ability) => Effect[], slot = 'ability'): Effect[] {
  return from.map((a) => ({ type: 'ifChoice', slot, value: a, effects: make(a) }));
}

/** A use counter and the action that spends it, with a save DC from the ability increased. */
function limitedByAbility(
  id: string,
  name: string,
  from: Ability[],
  actionType: ActionDef['actionType'],
  more: (a: Ability) => Partial<ActionDef> = (a) => ({ saveDc: dc(a) }),
): Effect[] {
  return [
    uses(id, name, 'pb', 'long'),
    ...byAbility(from, (a) => [
      action({ id, name, actionType, costs: [{ resource: id, amount: 1 }], ...more(a) }),
    ]),
  ];
}

/** The spellcasting ability picked for Scion of the Outer Planes (its plane's spell slot). */
const SCION: Ref = { kind: 'feat', id: 'scion of the outer planes|sato' };
function scionAbility(make: (a: Ability) => Effect[]): Effect[] {
  return [0, 1, 2, 3, 4].flatMap((i) =>
    MENTAL.map((a): Effect => ({
      type: 'ifChoice',
      owner: SCION,
      slot: `spells.${i}.ability`,
      value: a,
      effects: make(a),
    })),
  );
}

/** Extra damage, once per turn, that spends a use (tapped on the attack it applies to). */
function rider(
  id: string,
  name: string,
  dice: string,
  damageType: string | undefined,
  filter: AttackFilter,
  resource: string,
): Effect {
  return {
    type: 'damageRider',
    id,
    name,
    dice,
    ...(damageType ? { damageType } : {}),
    filter,
    oncePerTurn: true,
    cost: { resource, amount: 1 },
    optIn: true,
  };
}

/** A save DC shown on its own, for a benefit the sheet spends elsewhere (a rider, a switch). */
const saveDcLine = (id: string, name: string, saveDc: string) =>
  action({ id, name: `${name} save DC`, actionType: 'other', saveDc });

// ---- Strike of the Giants: one benefit, picked on the feat or as its own version ----
const GIANT_ATTACK: AttackFilter = {
  source: ['weapon'],
  any: [{ range: 'melee' }, { properties: ['T'] }],
};
const GIANT_USES = 'strike-of-the-giants';
const GIANT_DC = '8 + max(mod.str, mod.con) + pb';
const STRIKES: { id: string; name: string; dice: string; type?: string; save: boolean }[] = [
  { id: 'cloud', name: 'Cloud Strike', dice: '1d4', type: 'thunder', save: true },
  { id: 'fire', name: 'Fire Strike', dice: '1d10', type: 'fire', save: false },
  { id: 'frost', name: 'Frost Strike', dice: '1d6', type: 'cold', save: true },
  // The weapon's own damage type.
  { id: 'hill', name: 'Hill Strike', dice: '1d6', save: true },
  { id: 'stone', name: 'Stone Strike', dice: '1d6', type: 'force', save: true },
  { id: 'storm', name: 'Storm Strike', dice: '1d6', type: 'lightning', save: true },
];
const giantUses = uses(GIANT_USES, 'Strike of the Giants', 'pb', 'long');
function giantStrike(strike: (typeof STRIKES)[number]): Effect[] {
  const id = `${strike.id}-strike`;
  return [
    rider(id, strike.name, strike.dice, strike.type, GIANT_ATTACK, GIANT_USES),
    ...(strike.save ? [saveDcLine(id, strike.name, GIANT_DC)] : []),
  ];
}
const giantVersion = (id: string) =>
  numbers([giantUses, ...giantStrike(STRIKES.find((s) => s.id === id)!)]);

// ---- Rune Shaper's runes ----
const RUNES = [
  'Cloud',
  'Death',
  'Dragon',
  'Enemy',
  'Fire',
  'Friend',
  'Frost',
  'Hill',
  'Journey',
  'King',
  'Mountain',
  'Stone',
  'Storm',
];

const DOUBLE_SCIMITAR = 'double-bladed scimitar|erlw';
const CHROMATIC = ['acid', 'cold', 'fire', 'lightning', 'poison'];
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

export const LEGACY_FEATS: FeatureEffectsMap = {
  // ---- Dragonlance (DSotDQ) ----
  [F('initiate of high sorcery|dsotdq')]: fromData(),
  [F('adept of the black robes|dsotdq')]: partly(
    [action({ id: 'life-channel', name: 'Life Channel', actionType: 'other' })],
    {
      notes: 'The Hit Dice it spends depend on the spell’s level; spend them by hand.',
      needs: 'a Hit Dice cost that scales with the level of the spell cast',
    },
  ),
  [F('adept of the red robes|dsotdq')]: numbers(
    limited('magical-balance', 'Magical Balance', 'pb', 'long', 'other'),
  ),
  [F('adept of the white robes|dsotdq')]: partly(
    byAbility(
      MENTAL,
      (a) => [
        action({
          id: 'protective-ward',
          name: 'Protective Ward',
          actionType: 'reaction',
          costs: [{ slot: { minLevel: 1 } }],
          roll: `1d6 + mod.${a}`,
        }),
      ],
      'spells.0.ability',
    ),
    {
      notes: 'The roll shows a level 1 slot; add a d6 for each slot level above 1.',
      needs: 'dice that scale with the level of the spell slot spent',
    },
  ),
  [F('divinely favored|dsotdq')]: fromData(),
  [F('squire of solamnia|dsotdq')]: numbers([
    uses('precise-strike', 'Precise Strike', 'pb', 'long'),
    rider(
      'precise-strike',
      'Precise Strike',
      '1d8',
      undefined,
      { source: ['weapon'] },
      'precise-strike',
    ),
  ]),
  [F('knight of the crown|dsotdq')]: numbers(
    limited('commanding-rally', 'Commanding Rally', 'pb', 'long', 'bonus', { roll: '1d8' }),
  ),
  [F('knight of the rose|dsotdq')]: numbers(
    limitedByAbility(
      'bolstering-rally',
      'Bolstering Rally',
      ['con', 'wis', 'cha'],
      'bonus',
      (a) => ({
        roll: `1d8 + pb + mod.${a}`,
      }),
    ),
    { unoffered: TARGETS },
  ),
  [F('knight of the sword|dsotdq')]: numbers(
    limitedByAbility('demoralizing-strike', 'Demoralizing Strike', MENTAL, 'other'),
  ),

  // ---- Planescape (SatO) ----
  [F('scion of the outer planes|sato')]: fromData(),
  [F('agent of order|sato')]: numbers([
    uses('stasis-strike', 'Stasis Strike', 'pb', 'long'),
    rider('stasis-strike', 'Stasis Strike', '1d8', 'force', {}, 'stasis-strike'),
    ...scionAbility((a) => [saveDcLine('stasis-strike', 'Stasis Strike', dc(a))]),
  ]),
  [F('baleful scion|sato')]: numbers(
    [
      uses('grasp-of-avarice', 'Grasp of Avarice', 'pb', 'long'),
      rider('grasp-of-avarice', 'Grasp of Avarice', '1d6 + pb', 'necrotic', {}, 'grasp-of-avarice'),
    ],
    { notes: 'Add the Hit Points it restores by hand.' },
  ),
  [F('cohort of chaos|sato')]: text({ unoffered: TARGETS }),
  [F('outlands envoy|sato')]: partly([], {
    notes:
      'Its free casts use the spellcasting ability picked for Scion of the Outer Planes, which the sheet doesn’t carry over.',
    needs: 'a spell grant whose ability is another feat’s pick',
  }),
  [F('planar wanderer|sato')]: numbers([
    {
      type: 'resistanceChoice',
      choice: {
        slot: 'planar-adaptation',
        count: 1,
        from: ['acid', 'cold', 'fire'],
        retrain: 'longRest',
      },
    },
    ...limited('portal-sense', 'Portal Sense', 1, 'long', 'action'),
  ]),
  [F('righteous heritor|sato')]: numbers(
    limited('soothe-pain', 'Soothe Pain', 'pb', 'long', 'reaction', { roll: '1d10 + pb' }),
  ),

  // ---- Giants (BGG) ----
  [F('strike of the giants|bgg')]: numbers([
    giantUses,
    {
      type: 'optionChoice',
      choice: { slot: 'strike', count: 1, from: STRIKES.map((s) => s.id) },
      labels: STRIKES.map((s) => s.name),
    },
    ...STRIKES.map((s): Effect => ({
      type: 'ifChoice',
      slot: 'strike',
      value: s.id,
      effects: giantStrike(s),
    })),
  ]),
  [F('strike of the giants; cloud|bgg')]: giantVersion('cloud'),
  [F('strike of the giants; fire|bgg')]: giantVersion('fire'),
  [F('strike of the giants; frost|bgg')]: giantVersion('frost'),
  [F('strike of the giants; hill|bgg')]: giantVersion('hill'),
  [F('strike of the giants; stone|bgg')]: giantVersion('stone'),
  [F('strike of the giants; storm|bgg')]: giantVersion('storm'),
  [F('ember of the fire giant|bgg')]: numbers(
    limitedByAbility(
      'searing-ignition',
      'Searing Ignition',
      ['str', 'con', 'wis'],
      'other',
      (a) => ({
        roll: '1d8 + pb',
        saveDc: dc(a),
      }),
    ),
    { unoffered: TARGETS },
  ),
  [F('fury of the frost giant|bgg')]: numbers(
    limitedByAbility(
      'frigid-retaliation',
      'Frigid Retaliation',
      ['str', 'con', 'wis'],
      'reaction',
      (a) => ({
        roll: '1d8 + pb',
        saveDc: dc(a),
      }),
    ),
  ),
  [F('guile of the cloud giant|bgg')]: numbers(
    limited('cloudy-escape', 'Cloudy Escape', 'pb', 'long', 'reaction'),
  ),
  [F('keenness of the stone giant|bgg')]: numbers([
    { type: 'sense', sense: 'darkvision', range: 60, stack: true },
    uses('stone-throw', 'Stone Throw', 'pb', 'long'),
    ...byAbility(['str', 'con', 'wis'], (a) => [
      {
        type: 'attack',
        id: 'stone-throw',
        name: 'Stone Throw',
        damage: '1d10',
        damageType: 'force',
        damageAbility: 'none',
        range: 'ranged',
        distance: '60 ft.',
        abilities: [a],
      },
      action({
        id: 'stone-throw',
        name: 'Stone Throw',
        actionType: 'bonus',
        costs: [{ resource: 'stone-throw', amount: 1 }],
        saveDc: dc(a),
      }),
    ]),
  ]),
  [F('soul of the storm giant|bgg')]: toggled([
    uses('maelstrom-aura', 'Maelstrom Aura', 'pb', 'long'),
    {
      type: 'toggle',
      toggleId: 'maelstrom-aura',
      name: 'Maelstrom Aura',
      cost: [{ resource: 'maelstrom-aura', amount: 1 }, { action: 'bonus' }],
      effects: [
        { type: 'resistance', value: 'lightning' },
        { type: 'resistance', value: 'thunder' },
        { type: 'attackedMode', mode: 'disadvantage' },
      ],
    },
    ...byAbility(['str', 'wis', 'cha'], (a) => [
      saveDcLine('maelstrom-aura', 'Maelstrom Aura', dc(a)),
    ]),
  ]),
  [F('vigor of the hill giant|bgg')]: partly(
    [action({ id: 'bulwark', name: 'Bulwark', actionType: 'reaction' })],
    {
      notes: 'Add the extra healing to Hit Point Dice spent after a meal by hand.',
      needs: 'a flat bonus to Hit Point Dice healing',
    },
  ),
  [F('rune shaper|bgg')]: partly(
    [
      {
        type: 'optionChoice',
        choice: {
          slot: 'runes',
          count: 'floor(pb / 2)',
          from: RUNES.map((r) => r.toLowerCase()),
          retrain: 'levelUp',
        },
        labels: RUNES,
      },
    ],
    {
      notes:
        'The data lists every rune’s spell with a free cast; only the runes picked here count. The spellcasting ability is noted by hand.',
      needs: 'a data spell grant narrowed to the runes picked',
    },
  ),

  // ---- Fizban's (FTD) ----
  [F('gift of the chromatic dragon|ftd')]: toggled(
    [
      uses('chromatic-infusion', 'Chromatic Infusion', 1, 'long'),
      {
        type: 'toggle',
        toggleId: 'chromatic-infusion',
        name: 'Chromatic Infusion',
        cost: [{ resource: 'chromatic-infusion', amount: 1 }, { action: 'bonus' }],
        effects: [],
        options: CHROMATIC.map((t) => ({
          id: t,
          name: cap(t),
          effects: [
            {
              type: 'damageRider',
              id: 'chromatic-infusion',
              name: 'Chromatic Infusion',
              dice: '1d4',
              damageType: t,
              filter: { source: ['weapon'] },
              optIn: false,
            },
          ],
        })),
      },
      ...limited('reactive-resistance', 'Reactive Resistance', 'pb', 'long', 'reaction'),
    ],
    { notes: 'The extra die is shown on every weapon; only the weapon touched has it.' },
  ),
  [F('gift of the gem dragon|ftd')]: numbers(
    limitedByAbility('telekinetic-reprisal', 'Telekinetic Reprisal', MENTAL, 'reaction', (a) => ({
      roll: '2d8',
      saveDc: dc(a),
    })),
  ),
  [F('gift of the metallic dragon|ftd')]: numbers(
    limited('protective-wings', 'Protective Wings', 'pb', 'long', 'reaction', { roll: 'pb' }),
  ),

  // ---- Racial feats (XGE, MTF, ERLW, PSX) ----
  [F('bountiful luck|xge')]: numbers([
    action({ id: 'bountiful-luck', name: 'Bountiful Luck', actionType: 'reaction' }),
  ]),
  [F('dragon fear|xge')]: numbers(
    [
      action({
        id: 'dragon-fear',
        name: 'Dragon Fear',
        actionType: 'action',
        costs: [{ resource: 'breath-weapon', amount: 1 }],
        saveDc: dc('cha'),
      }),
    ],
    { unoffered: TARGETS },
  ),
  [F('dragon hide|xge')]: numbers([
    { type: 'acFormula', name: 'Dragon Hide', base: 13, addAbilities: ['dex'], shield: true },
    {
      type: 'attackMod',
      label: 'Dragon Hide claws',
      filter: { source: ['unarmed'] },
      damageDie: '1d4',
      damageType: 'slashing',
    },
  ]),
  [F('drow high magic|xge')]: fromData(),
  [F('dwarven fortitude|xge')]: numbers([
    action({
      id: 'dwarven-fortitude',
      name: 'Dwarven Fortitude',
      actionType: 'other',
      costs: [{ hitDice: 1 }],
    }),
  ]),
  [F('elven accuracy|xge')]: text(),
  [F('fade away|xge')]: numbers(limited('fade-away', 'Fade Away', 1, 'short', 'reaction')),
  [F('fey teleportation|xge')]: partly([], {
    notes: 'The free Misty Step also comes back on a Short Rest; restore it by hand.',
    needs:
      'a different recharge for a data spell grant (its free cast returns on a Short Rest too)',
  }),
  [F('flames of phlegethos|xge')]: text(),
  [F('infernal constitution|xge')]: numbers([savesAgainst('being Poisoned')]),
  [F('orcish fury|xge')]: numbers([
    ...limited('orcish-fury', 'Orcish Fury', 1, 'short', 'other'),
    action({ id: 'orcish-fury-attack', name: 'Orcish Fury attack', actionType: 'reaction' }),
  ]),
  [F('prodigy|xge')]: fromData(),
  [F('second chance|xge')]: numbers(
    limited('second-chance', 'Second Chance', 1, 'short', 'reaction'),
    { notes: 'Also back when you roll Initiative.' },
  ),
  [F('squat nimbleness|xge')]: numbers([
    { type: 'speedBonus', value: 5 },
    {
      type: 'rollMode',
      target: 'skill:athletics',
      mode: 'advantage',
      against: 'escaping a grapple',
    },
    {
      type: 'rollMode',
      target: 'skill:acrobatics',
      mode: 'advantage',
      against: 'escaping a grapple',
    },
  ]),
  [F('wood elf magic|xge')]: fromData(),
  [F('svirfneblin magic|mtf')]: fromData(),
  [F('revenant blade|erlw')]: numbers([
    when({ wielding: { itemIds: [DOUBLE_SCIMITAR] } }, [{ type: 'acBonus', value: 1 }]),
    {
      type: 'attackMod',
      label: 'Revenant Blade',
      filter: { itemIds: [DOUBLE_SCIMITAR] },
      abilities: ['str', 'dex'],
    },
  ]),
  [F('vampiric exultation|psx')]: toggled([
    uses('vampiric-exultation', 'Vampiric Exultation', 1, 'short'),
    {
      type: 'toggle',
      toggleId: 'vampiric-exultation',
      name: 'Vampiric Exultation',
      cost: [{ resource: 'vampiric-exultation', amount: 1 }, { action: 'action' }],
      effects: [{ type: 'speed', mode: 'fly', value: 30 }],
    },
  ]),

  // ---- Player's Handbook (2014) and Tasha's ----
  [F('dungeon delver|phb')]: partly(
    [
      savesAgainst('traps'),
      {
        type: 'rollMode',
        target: 'skill:perception',
        mode: 'advantage',
        against: 'finding secret doors',
      },
      {
        type: 'rollMode',
        target: 'skill:investigation',
        mode: 'advantage',
        against: 'finding secret doors',
      },
    ],
    {
      notes: 'Resistance to trap damage is applied by hand.',
      needs: 'a resistance to damage from one kind of source (traps)',
    },
  ),
  [F('linguist|phb')]: fromData(),
  [F('martial adept|phb')]: numbers(
    [
      uses('martial-adept', 'Superiority Dice', 1, 'short', { die: 'd6' }),
      action({
        id: 'maneuver-dc',
        name: 'Maneuver save DC',
        actionType: 'other',
        saveDc: '8 + max(mod.str, mod.dex) + pb',
      }),
    ],
    {
      notes: 'With Battle Master dice too, this d6 is its own counter.',
      needs: 'a die of another size added to another feature’s pool',
    },
  ),
  [F('artificer initiate|tce')]: fromData(),
  [F('eldritch adept|tce')]: {
    ...fromData(),
    notes: 'The invocation’s spellcasting ability is noted by hand.',
  },
  [F('fighting initiate|tce')]: fromData(),
  [F('gunner|tce')]: fromData(),
  [F('metamagic adept|tce')]: numbers([uses('metamagic-adept', 'Sorcery Points', 2, 'long')], {
    notes: 'These points are for Metamagic only; a Sorcerer has them as a second counter.',
  }),

  // ---- Strixhaven (SCC), Kaladesh (PSK), The Book of Many Things (BMT) ----
  [F('strixhaven initiate|scc')]: fromData(),
  [F('strixhaven mascot|scc')]: numbers([
    ...limited('mascot-teleport', 'Mascot Teleport', 1, 'long', 'action'),
    restoredBy('mascot-teleport', { slot: { minLevel: 2 } }),
  ]),
  [F('quicksmithing|psk')]: { ...fromData(), unoffered: AT_TABLE },
  [F('servo crafting|psk')]: fromData(),
  [F('cartomancer|bmt')]: numbers(limited('hidden-ace', 'Hidden Ace', 1, 'long', 'bonus'), {
    unoffered: 'The imbued spell is picked at the table at each Long Rest.',
  }),
};
