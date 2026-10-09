// 2014 options on 2024 characters (plan step 8.3): the 2014 Monk traditions and Paladin oaths
// that have no 2024 reprint. Ki spends the 2024 Focus Points (`focus-points`), so the 2014 ki
// save DC is the Monk's own (8 + Wisdom + Proficiency Bonus) and the Martial Arts die is the
// 2024 table's. Channel Divinity options spend the core `channel-divinity` counter; oath spells
// and Sun Soul's Burning Hands come from the subclass data.

import type { Effect, Formula } from '../../../schema/index.ts';
import type { FeatureEffectsMap } from '../types.ts';
import {
  action,
  AT_TABLE,
  attacksAgainst,
  dc,
  NO_CHOICE,
  notIncapacitated,
  numbers,
  restoredBy,
  savesAgainst,
  TARGETS,
  text,
  toggled,
  uses,
  when,
} from '../core/helpers.ts';

const M = (sub: string, src: string, id: string, level: number) =>
  `subclassFeature:${id}|monk|phb|${sub}|${src}|${level}|${src}` as const;
const P = (sub: string, src: string, id: string, level: number) =>
  `subclassFeature:${id}|paladin|phb|${sub}|${src}|${level}|${src}` as const;

const focus = (amount: Formula = 1) => ({ resource: 'focus-points', amount });
const divinity = { resource: 'channel-divinity', amount: 1 };
const MA = 'table.martial-arts';
const kiDc = dc('wis');
const chaMin1 = 'max(1, mod.cha)';
const resist = (values: string[]) => values.map((value): Effect => ({ type: 'resistance', value }));
const BPS = ['bludgeoning', 'piercing', 'slashing'];
const ALL_DAMAGE = [
  'acid',
  ...BPS,
  'cold',
  'fire',
  'force',
  'lightning',
  'necrotic',
  'poison',
  'psychic',
  'radiant',
  'thunder',
];
const DRAGON = ['acid', 'cold', 'fire', 'lightning', 'poison'];
const title = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/** Kensei weapons: 2024 Simple and Martial weapons without Heavy, and the Longbow. */
const KENSEI_MELEE = [
  'battleaxe',
  'club',
  'dagger',
  'flail',
  'greatclub',
  'handaxe',
  'javelin',
  'light hammer',
  'longsword',
  'mace',
  'morningstar',
  'quarterstaff',
  'rapier',
  'scimitar',
  'shortsword',
  'sickle',
  'spear',
  'trident',
  'war pick',
  'warhammer',
  'whip',
].map((w) => `${w}|xphb`);
const KENSEI_RANGED = [
  'blowgun',
  'dart',
  'hand crossbow',
  'light crossbow',
  'longbow',
  'musket',
  'pistol',
  'shortbow',
  'sling',
].map((w) => `${w}|xphb`);
const kenseiWeapon = (slot: string, from: string[]): Effect => ({
  type: 'proficiencyChoice',
  category: 'weapon',
  choice: { slot, count: 1, from },
});

/** A once-per-Long-Rest switch paid with its own use and an action (a 2014 capstone). */
function capstone(
  id: string,
  name: string,
  actionType: 'action' | 'bonus',
  effects: Effect[],
): Effect[] {
  return [
    uses(id, name, 1, 'long'),
    {
      type: 'toggle',
      toggleId: id,
      name,
      cost: [{ resource: id, amount: 1 }, { action: actionType }],
      endsOn: ['shortRest', 'longRest'],
      effects,
    },
  ];
}

const ARMS = 'arms-of-the-astral-self';
const VISAGE = 'visage-of-the-astral-self';

export const LEGACY_MONK_PALADIN: FeatureEffectsMap = {
  // ---- Way of the Long Death (SCAG) ----
  [M('long death', 'scag', 'way of the long death', 3)]: text(),
  [M('long death', 'scag', 'touch of death', 3)]: numbers(
    [
      action({
        id: 'touch-of-death',
        name: 'Touch of Death',
        actionType: 'other',
        outcomes: [{ tempHp: 'max(1, mod.wis + level.monk)' }],
      }),
    ],
    { unoffered: NO_CHOICE },
  ),
  [M('long death', 'scag', 'hour of reaping', 6)]: numbers([
    action({ id: 'hour-of-reaping', name: 'Hour of Reaping', actionType: 'action', saveDc: kiDc }),
  ]),
  [M('long death', 'scag', 'mastery of death', 11)]: numbers([
    action({
      id: 'mastery-of-death',
      name: 'Mastery of Death',
      actionType: 'other',
      costs: [focus()],
      outcomes: [{ heal: 1 }],
    }),
  ]),
  [M('long death', 'scag', 'touch of the long death', 17)]: numbers(
    [
      action({
        id: 'touch-of-the-long-death',
        name: 'Touch of the Long Death',
        actionType: 'action',
        costs: [focus()],
        roll: '2d10',
        saveDc: kiDc,
      }),
    ],
    { notes: 'Spend 1 to 10 Focus Points: 2d10 per point; the extra points come off by hand.' },
  ),

  // ---- Way of the Drunken Master (XGE) ----
  [M('drunken master', 'xge', 'way of the drunken master', 3)]: text(),
  [M('drunken master', 'xge', 'bonus proficiencies', 3)]: numbers(
    [
      { type: 'proficiency', category: 'skill', value: 'performance' },
      { type: 'proficiency', category: 'tool', value: "brewer's supplies|xphb" },
    ],
    { unoffered: NO_CHOICE },
  ),
  [M('drunken master', 'xge', 'drunken technique', 3)]: text(),
  // The data asks for one of the two benefits, but both apply: Redirect Attack lives here.
  [M('drunken master', 'xge', 'tipsy sway', 6)]: numbers(
    [
      action({
        id: 'redirect-attack',
        name: 'Redirect Attack',
        actionType: 'reaction',
        costs: [focus()],
      }),
    ],
    {
      notes: 'Both benefits apply whichever one is picked.',
      needs: 'an options block whose every option is granted (the data asks for one pick)',
    },
  ),
  [M('drunken master', 'xge', 'leap to your feet', 6)]: text(),
  [M('drunken master', 'xge', 'redirect attack', 6)]: text({ unoffered: TARGETS }),
  [M('drunken master', 'xge', "drunkard's luck", 11)]: numbers([
    action({
      id: 'drunkards-luck',
      name: "Drunkard's Luck",
      actionType: 'other',
      costs: [focus(2)],
    }),
  ]),
  [M('drunken master', 'xge', 'intoxicated frenzy', 17)]: text(),

  // ---- Way of the Kensei (XGE) ----
  [M('kensei', 'xge', 'way of the kensei', 3)]: text(),
  // Kensei weapons are picked as proficiencies; Agile Parry and Kensei's Shot both apply, so
  // they live here whichever one the data's pick names.
  [M('kensei', 'xge', 'path of the kensei', 3)]: toggled(
    [
      kenseiWeapon('kensei-melee', KENSEI_MELEE),
      kenseiWeapon('kensei-ranged', KENSEI_RANGED),
      ...[6, 11, 17].map((level): Effect => ({
        type: 'atLevel',
        level,
        effects: [kenseiWeapon(`kensei-${level}`, [...KENSEI_MELEE, ...KENSEI_RANGED])],
      })),
      {
        type: 'proficiencyChoice',
        category: 'tool',
        choice: {
          slot: 'brush',
          count: 1,
          from: ["calligrapher's supplies|xphb", "painter's supplies|xphb"],
        },
      },
      {
        type: 'toggle',
        toggleId: 'agile-parry',
        name: 'Agile Parry',
        effects: [when(notIncapacitated, [{ type: 'acBonus', value: 2 }])],
      },
      {
        type: 'damageRider',
        id: 'kensei-shot',
        name: "Kensei's Shot",
        dice: '1d4',
        filter: { range: 'ranged', source: ['weapon'] },
        optIn: true,
      },
    ],
    {
      notes: 'Both benefits apply whichever one is picked; use them with kensei weapons only.',
      needs: 'a picked weapon counted as a Monk weapon, and attack filters bound to picked weapons',
    },
  ),
  [M('kensei', 'xge', 'agile parry', 3)]: text(),
  [M('kensei', 'xge', "kensei's shot", 3)]: text(),
  [M('kensei', 'xge', 'one with the blade', 6)]: numbers(
    [
      {
        type: 'damageRider',
        id: 'deft-strike',
        name: 'Deft Strike',
        dice: MA,
        filter: { source: ['weapon'] },
        oncePerTurn: true,
        cost: focus(),
        optIn: true,
      },
    ],
    { notes: 'Use it with kensei weapons only.' },
  ),
  // One switch per amount spent; only one can be on.
  [M('kensei', 'xge', 'sharpen the blade', 11)]: toggled(
    [1, 2, 3].map((n): Effect => ({
      type: 'toggle',
      toggleId: `sharpen-the-blade-${n}`,
      name: `Sharpen the Blade (+${n})`,
      group: 'sharpen-the-blade',
      cost: [focus(n), { action: 'bonus' }],
      endsOn: ['shortRest', 'longRest'],
      effects: [
        {
          type: 'attackMod',
          label: 'Sharpen the Blade',
          filter: { source: ['weapon'], magic: false },
          toHit: n,
          damage: n,
        },
      ],
    })),
    { notes: 'The bonus shows on every nonmagical weapon; it counts for one kensei weapon.' },
  ),
  [M('kensei', 'xge', 'unerring accuracy', 17)]: text(),

  // ---- Way of the Sun Soul (XGE) ----
  [M('sun soul', 'xge', 'way of the sun soul', 3)]: text(),
  [M('sun soul', 'xge', 'radiant sun bolt', 3)]: numbers(
    [
      {
        type: 'attack',
        id: 'radiant-sun-bolt',
        name: 'Radiant Sun Bolt',
        damage: MA,
        damageType: 'radiant',
        range: 'ranged',
        distance: '30 ft.',
        abilities: ['dex'],
      },
      action({
        id: 'radiant-sun-bolt',
        name: 'Radiant Sun Bolt (Bonus Action)',
        actionType: 'bonus',
        costs: [focus()],
        attack: { tags: ['feature:radiant-sun-bolt'] },
      }),
    ],
    { unoffered: NO_CHOICE },
  ),
  // The data's Burning Hands names "Ki", which no counter is called: the action spends it.
  [M('sun soul', 'xge', 'searing arc strike', 6)]: numbers(
    [
      action({
        id: 'searing-arc-strike',
        name: 'Searing Arc Strike',
        actionType: 'bonus',
        costs: [focus(2)],
        saveDc: kiDc,
      }),
    ],
    {
      notes: 'Each Focus Point beyond 2 (up to half your Monk level in all) is spent by hand.',
      needs: 'a 5etools spell cost in "Ki" read as Focus Points',
    },
  ),
  [M('sun soul', 'xge', 'searing sunburst', 11)]: numbers(
    [
      action({
        id: 'searing-sunburst',
        name: 'Searing Sunburst',
        actionType: 'action',
        roll: '2d6',
        saveDc: kiDc,
      }),
    ],
    { unoffered: AT_TABLE, notes: 'Up to 3 more Focus Points, 2d6 each, are spent by hand.' },
  ),
  [M('sun soul', 'xge', 'sun shield', 17)]: numbers([
    action({ id: 'sun-shield', name: 'Sun Shield', actionType: 'reaction', roll: '5 + mod.wis' }),
  ]),

  // ---- Way of the Astral Self (TCE) ----
  [M('astral self', 'tce', 'way of the astral self', 3)]: text(),
  [M('astral self', 'tce', 'forms of your astral self', 3)]: text(),
  [M('astral self', 'tce', 'arms of the astral self', 3)]: toggled(
    [
      {
        type: 'toggle',
        toggleId: ARMS,
        name: 'Arms of the Astral Self',
        cost: [focus(), { action: 'bonus' }],
        endsOn: ['shortRest', 'longRest'],
        effects: [
          {
            type: 'attackMod',
            label: 'Arms of the Astral Self',
            filter: { source: ['unarmed'] },
            abilities: ['str', 'dex', 'wis'],
            damageType: 'force',
          },
        ],
      },
      action({
        id: 'arms-of-the-astral-self',
        name: 'Arms of the Astral Self (summoning)',
        actionType: 'other',
        roll: `2 * ${MA}`,
        saveDc: kiDc,
      }),
    ],
    {
      unoffered: TARGETS,
      needs: 'Wisdom in place of Strength for checks and saves, and a reach bonus',
    },
  ),
  [M('astral self', 'tce', 'visage of the astral self', 6)]: toggled(
    [
      {
        type: 'toggle',
        toggleId: VISAGE,
        name: 'Visage of the Astral Self',
        cost: [focus(), { action: 'bonus' }],
        endsOn: ['shortRest', 'longRest'],
        effects: [
          { type: 'sense', sense: 'darkvision', range: 120 },
          { type: 'rollMode', target: 'skill:insight', mode: 'advantage' },
          { type: 'rollMode', target: 'skill:intimidation', mode: 'advantage' },
        ],
      },
    ],
    { unoffered: TARGETS },
  ),
  [M('astral self', 'tce', 'body of the astral self', 11)]: toggled([
    when({ all: [{ toggle: ARMS }, { toggle: VISAGE }] }, [
      action({
        id: 'deflect-energy',
        name: 'Deflect Energy',
        actionType: 'reaction',
        roll: '1d10 + mod.wis',
      }),
      {
        type: 'damageRider',
        id: 'empowered-arms',
        name: 'Empowered Arms',
        dice: MA,
        filter: { source: ['unarmed'] },
        oncePerTurn: true,
        optIn: true,
      },
    ]),
  ]),
  [M('astral self', 'tce', 'awakened astral self', 17)]: toggled([
    {
      type: 'toggle',
      toggleId: 'awakened-astral-self',
      name: 'Awakened Astral Self',
      cost: [focus(5), { action: 'bonus' }],
      onActivate: [{ toggleOn: ARMS }, { toggleOn: VISAGE }],
      endsOn: ['shortRest', 'longRest'],
      effects: [
        { type: 'acBonus', value: 2 },
        {
          type: 'attackMod',
          label: 'Astral Barrage',
          filter: { source: ['unarmed'] },
          extraAttacks: 3,
        },
      ],
    },
  ]),

  // ---- Way of the Ascendant Dragon (FTD) ----
  [M('ascendant dragon', 'ftd', 'way of the ascendant dragon', 3)]: text(),
  [M('ascendant dragon', 'ftd', 'draconic disciple', 3)]: numbers(
    [
      uses('draconic-presence', 'Draconic Presence', 1, 'long'),
      action({
        id: 'draconic-presence',
        name: 'Draconic Presence',
        actionType: 'reaction',
        costs: [{ resource: 'draconic-presence', amount: 1 }],
      }),
      {
        type: 'proficiencyChoice',
        category: 'language',
        choice: { slot: 'language', count: 1, from: 'any' },
      },
    ],
    { notes: 'The use is spent only when the reroll succeeds; the damage type is picked per hit.' },
  ),
  [M('ascendant dragon', 'ftd', 'breath of the dragon', 3)]: numbers(
    [
      uses('breath-of-the-dragon', 'Breath of the Dragon', 'pb', 'long'),
      restoredBy('breath-of-the-dragon', focus(2)),
      action({
        id: 'breath-of-the-dragon',
        name: 'Breath of the Dragon',
        actionType: 'other',
        costs: [{ resource: 'breath-of-the-dragon', amount: 1 }],
        roll: `steps(level.monk, 3, 2, 11, 3) * ${MA}`,
        saveDc: kiDc,
      }),
    ],
    { unoffered: AT_TABLE },
  ),
  [M('ascendant dragon', 'ftd', 'wings unfurled', 6)]: toggled([
    uses('wings-unfurled', 'Wings Unfurled', 'pb', 'long'),
    {
      type: 'toggle',
      toggleId: 'wings-unfurled',
      name: 'Wings Unfurled',
      cost: [{ resource: 'wings-unfurled', amount: 1 }],
      effects: [{ type: 'speed', mode: 'fly', value: 'walk' }],
    },
  ]),
  // The aura's effect is the switch's form: Frightful Presence, or a damage type to resist.
  [M('ascendant dragon', 'ftd', 'aspect of the wyrm', 11)]: toggled(
    [
      uses('aspect-of-the-wyrm', 'Aspect of the Wyrm', 1, 'long'),
      restoredBy('aspect-of-the-wyrm', focus(3)),
      {
        type: 'toggle',
        toggleId: 'aspect-of-the-wyrm',
        name: 'Aspect of the Wyrm',
        cost: [{ resource: 'aspect-of-the-wyrm', amount: 1 }, { action: 'bonus' }],
        endsOn: ['shortRest', 'longRest'],
        effects: [],
        options: [
          {
            id: 'frightful-presence',
            name: 'Frightful Presence',
            effects: [
              action({
                id: 'frightful-presence',
                name: 'Frightful Presence',
                actionType: 'bonus',
                saveDc: kiDc,
              }),
            ],
          },
          ...DRAGON.map((value) => ({
            id: value,
            name: `Resistance: ${title(value)}`,
            effects: resist([value]),
          })),
        ],
      },
    ],
    { unoffered: 'Picked as the switch’s form when it is switched on.' },
  ),
  [M('ascendant dragon', 'ftd', 'ascendant aspect', 17)]: numbers(
    [
      action({
        id: 'augment-breath',
        name: 'Augment Breath',
        actionType: 'other',
        costs: [focus()],
        roll: `4 * ${MA}`,
        saveDc: kiDc,
      }),
      { type: 'sense', sense: 'blindsight', range: 10 },
      action({
        id: 'explosive-fury',
        name: 'Explosive Fury',
        actionType: 'other',
        roll: '3d10',
        saveDc: kiDc,
      }),
    ],
    { unoffered: AT_TABLE },
  ),

  // ---- Oathbreaker (DMG) ----
  [P('oathbreaker', 'dmg', 'oathbreaker', 3)]: text(),
  [P('oathbreaker', 'dmg', 'oathbreaker spells', 3)]: text(),
  [P('oathbreaker', 'dmg', 'channel divinity', 3)]: text(),
  [P('oathbreaker', 'dmg', 'control undead', 3)]: numbers([
    action({
      id: 'control-undead',
      name: 'Control Undead',
      actionType: 'action',
      costs: [divinity],
      saveDc: dc('cha'),
    }),
  ]),
  [P('oathbreaker', 'dmg', 'dreadful aspect', 3)]: numbers([
    action({
      id: 'dreadful-aspect',
      name: 'Dreadful Aspect',
      actionType: 'action',
      costs: [divinity],
      saveDc: dc('cha'),
    }),
  ]),
  [P('oathbreaker', 'dmg', 'aura of hate', 7)]: numbers(
    [
      {
        type: 'attackMod',
        label: 'Aura of Hate',
        filter: { range: 'melee', source: ['weapon'] },
        damage: chaMin1,
      },
    ],
    { notes: 'Fiends and Undead near you add it themselves.' },
  ),
  [P('oathbreaker', 'dmg', 'supernatural resistance', 15)]: text({
    needs: 'resistance to damage from nonmagical weapons only',
  }),
  [P('oathbreaker', 'dmg', 'dread lord', 20)]: toggled(
    capstone('dread-lord', 'Dread Lord', 'action', [
      action({
        id: 'dread-lord-shadows',
        name: 'Dread Lord: Shadow Attack',
        actionType: 'bonus',
        roll: '3d10 + mod.cha',
      }),
    ]),
  ),

  // ---- Oath of the Crown (SCAG) ----
  [P('crown', 'scag', 'oath of the crown', 3)]: text(),
  [P('crown', 'scag', 'tenets of the crown', 3)]: text(),
  [P('crown', 'scag', 'oath spells', 3)]: text(),
  [P('crown', 'scag', 'channel divinity', 3)]: text(),
  [P('crown', 'scag', 'champion challenge', 3)]: numbers(
    [
      action({
        id: 'champion-challenge',
        name: 'Champion Challenge',
        actionType: 'bonus',
        costs: [divinity],
        saveDc: dc('cha'),
      }),
    ],
    { unoffered: TARGETS },
  ),
  [P('crown', 'scag', 'turn the tide', 3)]: numbers(
    [
      action({
        id: 'turn-the-tide',
        name: 'Turn the Tide',
        actionType: 'bonus',
        costs: [divinity],
        roll: `1d6 + ${chaMin1}`,
      }),
    ],
    { unoffered: TARGETS },
  ),
  [P('crown', 'scag', 'divine allegiance', 7)]: numbers([
    action({ id: 'divine-allegiance', name: 'Divine Allegiance', actionType: 'reaction' }),
  ]),
  [P('crown', 'scag', 'unyielding spirit', 15)]: numbers([
    savesAgainst('being Paralyzed or Stunned'),
  ]),
  [P('crown', 'scag', 'exalted champion', 20)]: toggled(
    capstone('exalted-champion', 'Exalted Champion', 'action', [
      ...resist(BPS),
      { type: 'rollMode', target: 'save:wis', mode: 'advantage' },
    ]),
    {
      notes: 'The resistances hold against nonmagical weapons only; allies’ Advantage is theirs.',
      needs: 'resistance to damage from nonmagical weapons only',
    },
  ),

  // ---- Oath of Conquest (XGE) ----
  [P('conquest', 'xge', 'oath of conquest', 3)]: text(),
  [P('conquest', 'xge', 'tenets of conquest', 3)]: text(),
  [P('conquest', 'xge', 'oath spells', 3)]: text(),
  [P('conquest', 'xge', 'channel divinity', 3)]: text(),
  [P('conquest', 'xge', 'conquering presence', 3)]: numbers(
    [
      action({
        id: 'conquering-presence',
        name: 'Conquering Presence',
        actionType: 'action',
        costs: [divinity],
        saveDc: dc('cha'),
      }),
    ],
    { unoffered: TARGETS },
  ),
  [P('conquest', 'xge', 'guided strike', 3)]: numbers([
    action({
      id: 'guided-strike',
      name: 'Guided Strike',
      actionType: 'other',
      costs: [divinity],
      roll: 10,
    }),
  ]),
  [P('conquest', 'xge', 'aura of conquest', 7)]: numbers([
    action({
      id: 'aura-of-conquest',
      name: 'Aura of Conquest',
      actionType: 'other',
      roll: 'floor(level.paladin / 2)',
    }),
  ]),
  [P('conquest', 'xge', 'scornful rebuke', 15)]: numbers([
    action({ id: 'scornful-rebuke', name: 'Scornful Rebuke', actionType: 'other', roll: chaMin1 }),
  ]),
  [P('conquest', 'xge', 'invincible conqueror', 20)]: toggled(
    capstone('invincible-conqueror', 'Invincible Conqueror', 'action', [
      ...resist(ALL_DAMAGE),
      {
        type: 'attackMod',
        label: 'Invincible Conqueror',
        filter: { source: ['weapon', 'unarmed'] },
        extraAttacks: 3,
      },
      {
        type: 'attackMod',
        label: 'Invincible Conqueror',
        filter: { range: 'melee', source: ['weapon'] },
        critRange: 19,
      },
    ]),
  ),

  // ---- Oath of Redemption (XGE) ----
  [P('redemption', 'xge', 'oath of redemption', 3)]: text(),
  [P('redemption', 'xge', 'tenets of redemption', 3)]: text(),
  [P('redemption', 'xge', 'oath spells', 3)]: text(),
  [P('redemption', 'xge', 'channel divinity', 3)]: text(),
  [P('redemption', 'xge', 'emissary of peace', 3)]: toggled([
    {
      type: 'toggle',
      toggleId: 'emissary-of-peace',
      name: 'Emissary of Peace',
      cost: [divinity, { action: 'bonus' }],
      endsOn: ['shortRest', 'longRest'],
      effects: [{ type: 'rollBonus', target: 'skill:persuasion', value: 5 }],
    },
  ]),
  [P('redemption', 'xge', 'rebuke the violent', 3)]: numbers([
    action({
      id: 'rebuke-the-violent',
      name: 'Rebuke the Violent',
      actionType: 'reaction',
      costs: [divinity],
      saveDc: dc('cha'),
    }),
  ]),
  [P('redemption', 'xge', 'aura of the guardian', 7)]: numbers([
    action({ id: 'aura-of-the-guardian', name: 'Aura of the Guardian', actionType: 'reaction' }),
  ]),
  [P('redemption', 'xge', 'protective spirit', 15)]: numbers([
    action({
      id: 'protective-spirit',
      name: 'Protective Spirit',
      actionType: 'other',
      outcomes: [{ heal: '1d6 + floor(level.paladin / 2)' }],
    }),
  ]),
  [P('redemption', 'xge', 'emissary of redemption', 20)]: toggled(resist(ALL_DAMAGE), {
    notes: 'The resistances are always listed; whether they hold against a creature is yours.',
  }),

  // ---- Oath of the Watchers (TCE) ----
  [P('watchers', 'tce', 'oath of the watchers', 3)]: text(),
  [P('watchers', 'tce', 'tenets of the watchers', 3)]: text(),
  [P('watchers', 'tce', 'oath spells', 3)]: text(),
  [P('watchers', 'tce', 'channel divinity', 3)]: text(),
  [P('watchers', 'tce', "watcher's will", 3)]: toggled(
    [
      {
        type: 'toggle',
        toggleId: 'watchers-will',
        name: "Watcher's Will",
        cost: [divinity, { action: 'action' }],
        endsOn: ['shortRest', 'longRest'],
        effects: (['int', 'wis', 'cha'] as const).map((a): Effect => ({
          type: 'rollMode',
          target: `save:${a}`,
          mode: 'advantage',
        })),
      },
    ],
    { unoffered: TARGETS },
  ),
  [P('watchers', 'tce', 'abjure the extraplanar', 3)]: numbers([
    action({
      id: 'abjure-the-extraplanar',
      name: 'Abjure the Extraplanar',
      actionType: 'action',
      costs: [divinity],
      saveDc: dc('cha'),
    }),
  ]),
  [P('watchers', 'tce', 'aura of the sentinel', 7)]: numbers(
    [when(notIncapacitated, [{ type: 'initiativeBonus', value: 'pb' }])],
    { unoffered: TARGETS },
  ),
  [P('watchers', 'tce', 'vigilant rebuke', 15)]: numbers([
    action({
      id: 'vigilant-rebuke',
      name: 'Vigilant Rebuke',
      actionType: 'reaction',
      roll: '2d8 + mod.cha',
    }),
  ]),
  [P('watchers', 'tce', 'mortal bulwark', 20)]: toggled([
    ...capstone('mortal-bulwark', 'Mortal Bulwark', 'bonus', [
      { type: 'sense', sense: 'truesight', range: 120 },
      attacksAgainst('Aberrations, Celestials, Elementals, Fey and Fiends'),
      action({
        id: 'mortal-bulwark-banish',
        name: 'Mortal Bulwark: Banish',
        actionType: 'other',
        saveDc: dc('cha'),
      }),
    ]),
    restoredBy('mortal-bulwark', { slot: { minLevel: 5 } }),
  ]),
};
