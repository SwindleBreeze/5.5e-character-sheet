// Characters on 2014 rules (plan step 8.6): the 2014 Monk and Rogue's own features, and the
// features of their subclasses that a 2024 book reprints. Where a 2024 mapping fits the 2014
// rule, the 2014 key reuses it.
//
// Ki is the counter the 2014 Monk traditions mapped in step 8.3 already spend (`focus-points`),
// named "Ki" so the data's spells paid in Ki (Shadow Arts, Searing Arc Strike) find it; it equals
// the Monk level and comes back on a Short Rest. The ki save DC is 8 + Wisdom + Proficiency
// Bonus. 2014 Monk weapons are Shortswords and Simple Melee weapons without Two-Handed or Heavy,
// read from the weapon itself (the derived `monkWeapon` tag is the 2024 definition). The
// Martial Arts, Unarmored Movement and Sneak Attack columns are named as in 2024.

import { refKey, type AttackFilter, type Effect, type Formula } from '../../../schema/index.ts';
import { MONK } from '../core/monk.ts';
import { ROGUE } from '../core/rogue.ts';
import { SUP_ROGUE } from '../supplements/rogue.ts';
import { expertise } from '../core/levels1to3.ts';
import type { FeatureEffectsMap, FeatureMapping } from '../types.ts';
import {
  action,
  AT_TABLE,
  attacksAgainst,
  dc,
  fromData,
  NO_CHOICE,
  numbers,
  TARGETS,
  text,
  toggled,
  uses,
  when,
} from '../core/helpers.ts';

const MC = (id: string, level: number, src = 'phb') =>
  refKey({ kind: 'classFeature', id: `${id}|monk|phb|${level}|${src}` });
const MS = (sub: string, src: string, id: string, level: number) =>
  refKey({ kind: 'subclassFeature', id: `${id}|monk|phb|${sub}|${src}|${level}|${src}` });
const RC = (id: string, level: number, src = 'phb') =>
  refKey({ kind: 'classFeature', id: `${id}|rogue|phb|${level}|${src}` });
const RS = (sub: string, src: string, id: string, level: number) =>
  refKey({ kind: 'subclassFeature', id: `${id}|rogue|phb|${sub}|${src}|${level}|${src}` });

/** The 2024 mapping of a feature whose rule the 2014 one shares. */
function reuse(map: FeatureEffectsMap, kind: 'classFeature' | 'subclassFeature', id: string) {
  const mapping: FeatureMapping | undefined = map[refKey({ kind, id })];
  if (!mapping) throw new Error(`No 2024 mapping to reuse: ${id}`);
  return mapping;
}
const monk2024 = (id: string, level: number) =>
  reuse(MONK, 'classFeature', `${id}|monk|xphb|${level}|xphb`);
const monkSub2024 = (sub: string, id: string, level: number) =>
  reuse(MONK, 'subclassFeature', `${id}|monk|xphb|${sub}|xphb|${level}|xphb`);
const rogue2024 = (id: string, level: number) =>
  reuse(ROGUE, 'classFeature', `${id}|rogue|xphb|${level}|xphb`);
const rogueSub2024 = (sub: string, id: string, level: number) =>
  reuse(ROGUE, 'subclassFeature', `${id}|rogue|xphb|${sub}|xphb|${level}|xphb`);
const phantom2024 = (id: string, level: number) =>
  reuse(SUP_ROGUE, 'subclassFeature', `${id}|rogue|xphb|phantom|rhw|${level}|rhw`);

const ki = (amount: Formula = 1) => ({ resource: 'focus-points', amount });
const kiDc = dc('wis');
const MA = 'table.martial-arts';
const unarmored = { all: [{ armor: 'none' as const }, { shield: false }] };
/** 2014 Monk weapons, and unarmed strikes. */
const MONK_ATTACKS: AttackFilter[] = [
  { source: ['unarmed'] },
  { source: ['weapon'], range: 'melee', weaponCategory: 'simple', notProperties: ['2H', 'H'] },
  { source: ['weapon'], itemIds: ['shortsword|phb', 'shortsword|xphb'] },
];
const ALL_BUT_FORCE = [
  'acid',
  'bludgeoning',
  'cold',
  'fire',
  'lightning',
  'necrotic',
  'piercing',
  'poison',
  'psychic',
  'radiant',
  'slashing',
  'thunder',
];

/** Soulknife's Psionic Energy die: d6, d8 at Rogue 5, d10 at 11, d12 at 17. */
const PSI_DIE = 'steps(level.rogue, 3, d6, 5, d8, 11, d10, 17, d12)';
const PSI_ROLL = 'steps(level.rogue, 3, 1d6, 5, 1d8, 11, 1d10, 17, 1d12)';
const psionic = { resource: 'psionic-energy', amount: 1 };
/** Half the Sneak Attack dice, rounded up (Wails from the Grave). */
const WAILS_ROLL = 'dice(ceil(ceil(level.rogue / 2) / 2), 6)';
const trinket = { resource: 'soul-trinkets', amount: 1 };
const THIEVES_TOOLS_EXPERTISE = "expertise with a tool (thieves' tools)";

/** A Soulknife option's id, as the data's pick stores it. */
const SK = (id: string, level: number) => `${id}|rogue|phb|soulknife|tce|${level}|tce`;
const KNACK = [
  action({
    id: 'psi-bolstered-knack',
    name: 'Psi-Bolstered Knack',
    actionType: 'other',
    roll: PSI_ROLL,
  }),
];
const WHISPERS = [
  action({
    id: 'psychic-whispers',
    name: 'Psychic Whispers',
    actionType: 'action',
    roll: PSI_ROLL,
  }),
];
const HOMING = [
  action({ id: 'homing-strikes', name: 'Homing Strikes', actionType: 'other', roll: PSI_ROLL }),
];
const TELEPORT = [
  action({
    id: 'psychic-teleportation',
    name: 'Psychic Teleportation',
    actionType: 'bonus',
    costs: [psionic],
    roll: PSI_ROLL,
  }),
];

/**
 * A pick-one options block whose options all apply (the data asks for one pick): each option's
 * own mapping gives it, and the feature gives the one not picked.
 */
function bothOptions(slot: string, a: [string, Effect[]], b: [string, Effect[]]): Effect[] {
  return [
    { type: 'ifChoice', slot, value: a[0], effects: b[1] },
    { type: 'ifChoice', slot, value: b[0], effects: a[1] },
  ];
}

/** The 2014 Ability Score Improvement: its pick (+2, +1/+1 or a feat) comes from the 2014 rules. */
const ASI_2014 = 'The 2014 rules offer this pick (+2, +1/+1 or a feat) at the class level.';
const asi = (levels: number[], key: (level: number) => string) =>
  Object.fromEntries(levels.map((level) => [key(level), { ...fromData(), unoffered: ASI_2014 }]));

export const RULES_2014_MONK_ROGUE: FeatureEffectsMap = {
  // ======== Monk ========
  [MC('unarmored defense', 1)]: monk2024('unarmored defense', 1),
  // Dexterity, the Martial Arts die and the bonus unarmed strike, with 2014 Monk weapons.
  [MC('martial arts', 1)]: numbers([
    when(
      unarmored,
      MONK_ATTACKS.map((filter): Effect => ({
        type: 'attackMod',
        label: 'Martial Arts',
        filter,
        abilities: ['str', 'dex'],
        damageDie: MA,
      })),
    ),
    action({
      id: 'martial-arts-strike',
      name: 'Martial Arts (Bonus Unarmed Strike)',
      actionType: 'bonus',
      attack: { source: ['unarmed'] },
    }),
  ]),
  [MC('ki', 2)]: numbers([uses('focus-points', 'Ki', 'level.monk', 'short')]),
  [MC('flurry of blows', 2)]: monk2024('flurry of blows', 2),
  [MC('patient defense', 2)]: monk2024('patient defense', 2),
  [MC('step of the wind', 2)]: monk2024('step of the wind', 2),
  [MC('dedicated weapon', 2, 'tce')]: text({
    notes: 'Martial Arts doesn’t reach the chosen weapon on the sheet: add its die by hand.',
    needs: 'a picked weapon counted as a Monk weapon',
  }),
  [MC('unarmored movement', 2)]: monk2024('unarmored movement', 2),
  [MC('deflect missiles', 3)]: numbers([
    action({
      id: 'deflect-missiles',
      name: 'Deflect Missiles',
      actionType: 'reaction',
      roll: '1d10 + mod.dex + level.monk',
    }),
    action({
      id: 'deflect-missiles-throw',
      name: 'Deflect Missiles (Throw Back)',
      actionType: 'other',
      costs: [ki()],
    }),
  ]),
  [MC('monastic tradition', 3)]: text(),
  [MC('ki-fueled attack', 3, 'tce')]: numbers([
    action({
      id: 'ki-fueled-attack',
      name: 'Ki-Fueled Attack',
      actionType: 'bonus',
      attack: { any: MONK_ATTACKS },
    }),
  ]),
  ...asi([4, 8, 12, 16, 19], (level) => MC('ability score improvement', level)),
  [MC('slow fall', 4)]: monk2024('slow fall', 4),
  [MC('quickened healing', 4, 'tce')]: numbers([
    action({
      id: 'quickened-healing',
      name: 'Quickened Healing',
      actionType: 'action',
      costs: [ki(2)],
      outcomes: [{ heal: `${MA} + pb` }],
    }),
  ]),
  [MC('extra attack', 5)]: monk2024('extra attack', 5),
  [MC('stunning strike', 5)]: monk2024('stunning strike', 5),
  [MC('focused aim', 5, 'tce')]: numbers(
    [
      action({
        id: 'focused-aim',
        name: 'Focused Aim (+2 per Ki)',
        actionType: 'other',
        costs: [ki()],
      }),
    ],
    { notes: 'Spend up to 3 Ki: the extra points come off by hand.' },
  ),
  [MC('ki-empowered strikes', 6)]: text(),
  ...Object.fromEntries(
    [6, 11, 17].map((level) => [MC('monastic tradition feature', level), text()]),
  ),
  [MC('evasion', 7)]: text(),
  [MC('stillness of mind', 7)]: numbers([
    action({ id: 'stillness-of-mind', name: 'Stillness of Mind', actionType: 'action' }),
  ]),
  [MC('unarmored movement improvement', 9)]: text(),
  [MC('purity of body', 10)]: numbers([
    { type: 'immunity', value: 'poison' },
    { type: 'conditionImmunity', value: 'poisoned' },
    { type: 'conditionImmunity', value: 'disease' },
  ]),
  [MC('tongue of the sun and moon', 13)]: text(),
  // Every saving throw proficiency, as the 2024 Disciplined Survivor; the reroll spends Ki.
  [MC('diamond soul', 14)]: numbers([
    ...monk2024('disciplined survivor', 14).effects,
    action({
      id: 'diamond-soul',
      name: 'Diamond Soul (Reroll)',
      actionType: 'other',
      costs: [ki()],
    }),
  ]),
  [MC('timeless body', 15)]: text(),
  [MC('empty body', 18)]: toggled([
    {
      type: 'toggle',
      toggleId: 'empty-body',
      name: 'Empty Body',
      cost: [ki(4), { action: 'action' }],
      endsOn: ['shortRest', 'longRest'],
      effects: ALL_BUT_FORCE.map((value): Effect => ({ type: 'resistance', value })),
    },
    action({
      id: 'empty-body-astral-projection',
      name: 'Empty Body (Astral Projection)',
      actionType: 'other',
      costs: [ki(8)],
    }),
  ]),
  [MC('perfect self', 20)]: numbers([
    action({
      id: 'perfect-self',
      name: 'Perfect Self',
      actionType: 'other',
      outcomes: [{ restore: { resource: 'focus-points', amount: 4 } }],
    }),
  ]),

  // ---- Way of Shadow ----
  [MS('shadow', 'phb', 'way of shadow', 3)]: text(),
  // The spells, paid in Ki, and Minor Illusion come from the subclass data.
  [MS('shadow', 'phb', 'shadow arts', 3)]: fromData(),
  [MS('shadow', 'phb', 'shadow step', 6)]: monkSub2024('shadow', 'shadow step', 6),
  [MS('shadow', 'phb', 'cloak of shadows', 11)]: numbers([
    action({ id: 'cloak-of-shadows', name: 'Cloak of Shadows', actionType: 'action' }),
  ]),
  [MS('shadow', 'phb', 'opportunist', 17)]: numbers([
    action({
      id: 'opportunist',
      name: 'Opportunist',
      actionType: 'reaction',
      attack: { range: 'melee' },
    }),
  ]),

  // ---- Way of the Four Elements ----
  [MS('four elements', 'phb', 'way of the four elements', 3)]: text(),
  // The disciplines are picked through the subclass's own choice; this is their save DC.
  [MS('four elements', 'phb', 'disciple of the elements', 3)]: numbers(
    [
      action({
        id: 'elemental-discipline',
        name: 'Elemental Discipline',
        actionType: 'other',
        saveDc: kiDc,
      }),
    ],
    { notes: 'Most Ki for one discipline spell: 3 at Monk 5, 4 at 9, 5 at 13, 6 at 17.' },
  ),
  [MS('four elements', 'phb', 'elemental disciplines', 3)]: text(),
  ...Object.fromEntries(
    [6, 11, 17].map((level) => [
      MS('four elements', 'phb', 'extra elemental discipline', level),
      text(),
    ]),
  ),

  // ---- Way of the Open Hand ----
  [MS('open hand', 'phb', 'way of the open hand', 3)]: text(),
  [MS('open hand', 'phb', 'open hand technique', 3)]: monkSub2024(
    'open hand',
    'open hand technique',
    3,
  ),
  [MS('open hand', 'phb', 'wholeness of body', 6)]: numbers([
    uses('wholeness-of-body', 'Wholeness of Body', 1, 'long'),
    action({
      id: 'wholeness-of-body',
      name: 'Wholeness of Body',
      actionType: 'action',
      costs: [{ resource: 'wholeness-of-body', amount: 1 }],
      outcomes: [{ heal: '3 * level.monk' }],
    }),
  ]),
  // Sanctuary at the end of each Long Rest comes from the subclass data (Wisdom DC).
  [MS('open hand', 'phb', 'tranquility', 11)]: fromData(),
  [MS('open hand', 'phb', 'quivering palm', 17)]: numbers(
    [
      action({
        id: 'quivering-palm',
        name: 'Quivering Palm',
        actionType: 'other',
        costs: [ki(3)],
        roll: '10d10',
        saveDc: kiDc,
      }),
    ],
    { unoffered: AT_TABLE },
  ),

  // ---- Way of Mercy (TCE) ----
  [MS('mercy', 'tce', 'way of mercy', 3)]: text(),
  [MS('mercy', 'tce', 'implements of mercy', 3)]: numbers([
    { type: 'proficiency', category: 'skill', value: 'insight' },
    { type: 'proficiency', category: 'skill', value: 'medicine' },
    { type: 'proficiency', category: 'tool', value: 'herbalism kit|phb' },
  ]),
  [MS('mercy', 'tce', 'hand of healing', 3)]: monkSub2024('mercy', 'hand of healing', 3),
  [MS('mercy', 'tce', 'hand of harm', 3)]: monkSub2024('mercy', 'hand of harm', 3),
  [MS('mercy', 'tce', "physician's touch", 6)]: text(),
  // No limit on uses in the 2014 version: it changes what Flurry of Blows does.
  [MS('mercy', 'tce', 'flurry of healing and harm', 11)]: text(),
  [MS('mercy', 'tce', 'hand of ultimate mercy', 17)]: monkSub2024(
    'mercy',
    'hand of ultimate mercy',
    17,
  ),

  // ======== Rogue ========
  [RC('expertise', 1)]: numbers([expertise(2)], { needs: THIEVES_TOOLS_EXPERTISE }),
  [RC('sneak attack', 1)]: rogue2024('sneak attack', 1),
  [RC("thieves' cant", 1)]: numbers([
    { type: 'proficiency', category: 'language', value: "thieves' cant" },
  ]),
  [RC('cunning action', 2)]: rogue2024('cunning action', 2),
  [RC('roguish archetype', 3)]: text(),
  [RC('steady aim', 3, 'tce')]: rogue2024('steady aim', 3),
  ...asi([4, 8, 10, 12, 16, 19], (level) => RC('ability score improvement', level)),
  [RC('uncanny dodge', 5)]: rogue2024('uncanny dodge', 5),
  [RC('expertise', 6)]: numbers([expertise(2)], { needs: THIEVES_TOOLS_EXPERTISE }),
  [RC('evasion', 7)]: text(),
  ...Object.fromEntries(
    [9, 13, 17].map((level) => [RC('roguish archetype feature', level), text()]),
  ),
  [RC('reliable talent', 11)]: rogue2024('reliable talent', 7),
  [RC('blindsense', 14)]: text(),
  [RC('slippery mind', 15)]: numbers([{ type: 'proficiency', category: 'save', value: 'wis' }]),
  [RC('elusive', 18)]: text(),
  [RC('stroke of luck', 20)]: rogue2024('stroke of luck', 20),

  // ---- Arcane Trickster ----
  [RS('arcane trickster', 'phb', 'arcane trickster', 3)]: text(),
  // Spell slots, cantrips and spells known come from the subclass data.
  [RS('arcane trickster', 'phb', 'spellcasting', 3)]: text(),
  [RS('arcane trickster', 'phb', 'mage hand legerdemain', 3)]: text(),
  [RS('arcane trickster', 'phb', 'magical ambush', 9)]: text(),
  [RS('arcane trickster', 'phb', 'versatile trickster', 13)]: numbers([
    action({ id: 'versatile-trickster', name: 'Versatile Trickster', actionType: 'bonus' }),
  ]),
  [RS('arcane trickster', 'phb', 'spell thief', 17)]: rogueSub2024(
    'arcane trickster',
    'spell thief',
    17,
  ),

  // ---- Assassin ----
  [RS('assassin', 'phb', 'assassin', 3)]: text(),
  [RS('assassin', 'phb', 'assassinate', 3)]: numbers([
    attacksAgainst('creatures that haven’t taken a turn yet'),
  ]),
  [RS('assassin', 'phb', 'bonus proficiencies', 3)]: numbers(
    [
      { type: 'proficiency', category: 'tool', value: 'disguise kit|phb' },
      { type: 'proficiency', category: 'tool', value: "poisoner's kit|phb" },
    ],
    { unoffered: NO_CHOICE },
  ),
  [RS('assassin', 'phb', 'infiltration expertise', 9)]: text(),
  [RS('assassin', 'phb', 'impostor', 13)]: numbers([
    {
      type: 'rollMode',
      target: 'skill:deception',
      mode: 'advantage',
      against: 'avoiding detection in a mimicked identity',
    },
  ]),
  [RS('assassin', 'phb', 'death strike', 17)]: rogueSub2024('assassin', 'death strike', 17),

  // ---- Thief ----
  [RS('thief', 'phb', 'thief', 3)]: text(),
  [RS('thief', 'phb', 'fast hands', 3)]: rogueSub2024('thief', 'fast hands', 3),
  [RS('thief', 'phb', 'second-story work', 3)]: numbers(
    rogueSub2024('thief', 'second-story work', 3).effects,
    { notes: 'Running jumps go Dexterity modifier feet farther.', unoffered: NO_CHOICE },
  ),
  [RS('thief', 'phb', 'supreme sneak', 9)]: numbers([
    {
      type: 'rollMode',
      target: 'skill:stealth',
      mode: 'advantage',
      against: 'moving no more than half your Speed that turn',
    },
  ]),
  [RS('thief', 'phb', 'use magic device', 13)]: text(),
  [RS('thief', 'phb', "thief's reflexes", 17)]: text(),

  // ---- Phantom (TCE) ----
  [RS('phantom', 'tce', 'phantom', 3)]: text(),
  [RS('phantom', 'tce', 'whispers of the dead', 3)]: phantom2024('whispers of the dead', 3),
  [RS('phantom', 'tce', 'wails from the grave', 3)]: numbers([
    uses('wails-from-the-grave', 'Wails from the Grave', 'pb', 'long'),
    action({
      id: 'wails-from-the-grave',
      name: 'Wails from the Grave',
      actionType: 'other',
      costs: [{ resource: 'wails-from-the-grave', amount: 1 }],
      roll: WAILS_ROLL,
    }),
  ]),
  // Up to Proficiency Bonus soul trinkets, gained one at a time.
  [RS('phantom', 'tce', 'tokens of the departed', 9)]: numbers([
    uses('soul-trinkets', 'Soul Trinkets', 'pb', 'none'),
    action({
      id: 'gain-soul-trinket',
      name: 'Gain a Soul Trinket',
      actionType: 'reaction',
      outcomes: [{ restore: { resource: 'soul-trinkets', amount: 1 } }],
    }),
    action({
      id: 'wails-from-the-grave-trinket',
      name: 'Wails from the Grave (Soul Trinket)',
      actionType: 'other',
      costs: [trinket],
      roll: WAILS_ROLL,
    }),
    action({
      id: 'spirit-question',
      name: 'Question a Spirit',
      actionType: 'action',
      costs: [trinket],
    }),
    {
      type: 'rollMode',
      target: 'save:con',
      mode: 'advantage',
      note: 'Tokens of the Departed (while you hold a soul trinket)',
    },
    {
      type: 'rollMode',
      target: 'save:death',
      mode: 'advantage',
      note: 'Tokens of the Departed (while you hold a soul trinket)',
    },
  ]),
  [RS('phantom', 'tce', 'ghost walk', 13)]: phantom2024('ghost walk', 13),
  [RS('phantom', 'tce', "death's friend", 17)]: text(),

  // ---- Soulknife (TCE) ----
  [RS('soulknife', 'tce', 'soulknife', 3)]: text(),
  // Both powers of each block apply: the picked one's own mapping gives it, the feature the
  // other.
  [RS('soulknife', 'tce', 'psionic power', 3)]: numbers(
    [
      uses('psionic-energy', 'Psionic Energy Dice', '2 * pb', 'long', { die: PSI_DIE }),
      uses('psionic-recovery', 'Psionic Power (Regain a Die)', 1, 'short'),
      action({
        id: 'psionic-recovery',
        name: 'Psionic Power (Regain a Die)',
        actionType: 'bonus',
        costs: [{ resource: 'psionic-recovery', amount: 1 }],
        outcomes: [{ restore: { resource: 'psionic-energy', amount: 1 } }],
      }),
      ...bothOptions(
        'options.0',
        [SK('psi-bolstered knack', 3), KNACK],
        [SK('psychic whispers', 3), WHISPERS],
      ),
    ],
    { notes: 'Both powers apply whichever one is picked.' },
  ),
  [RS('soulknife', 'tce', 'psi-bolstered knack', 3)]: numbers(KNACK),
  [RS('soulknife', 'tce', 'psychic whispers', 3)]: numbers(WHISPERS, { unoffered: TARGETS }),
  [RS('soulknife', 'tce', 'psychic blades', 3)]: numbers([
    {
      type: 'attack',
      id: 'psychic-blade',
      name: 'Psychic Blade',
      damage: '1d6',
      damageType: 'psychic',
      range: 'melee',
      distance: '5 ft. or 60 ft.',
      abilities: ['str', 'dex'],
      properties: ['F', 'T'],
    },
    {
      type: 'attack',
      id: 'psychic-blade-bonus',
      name: 'Psychic Blade (Bonus Action)',
      damage: '1d4',
      damageType: 'psychic',
      range: 'melee',
      distance: '5 ft. or 60 ft.',
      abilities: ['str', 'dex'],
      properties: ['F', 'T'],
    },
    action({
      id: 'psychic-blade-bonus',
      name: 'Psychic Blade (Second Blade)',
      actionType: 'bonus',
      attack: { tags: ['feature:psychic-blade-bonus'] },
    }),
  ]),
  [RS('soulknife', 'tce', 'soul blades', 9)]: numbers(
    bothOptions(
      'options.0',
      [SK('homing strikes', 9), HOMING],
      [SK('psychic teleportation', 9), TELEPORT],
    ),
    { notes: 'Both powers apply whichever one is picked.' },
  ),
  [RS('soulknife', 'tce', 'homing strikes', 9)]: numbers(HOMING),
  [RS('soulknife', 'tce', 'psychic teleportation', 9)]: numbers(TELEPORT),
  [RS('soulknife', 'tce', 'psychic veil', 13)]: rogueSub2024('soulknife', 'psychic veil', 13),
  [RS('soulknife', 'tce', 'rend mind', 17)]: rogueSub2024('soulknife', 'rend mind', 17),
};
