// Characters on 2014 rules (plan step 8.6): the 2014 Barbarian and Bard's own features, and the
// features of their subclasses that a 2024 book reprints (Berserker, Totem Warrior, Zealot; Lore,
// Valor, Glamour) plus the College of Spirits. Where a 2024 mapping fits the 2014 rule, the 2014
// key reuses it. Rage keeps the core ids (`rage` counter and switch) and Bardic Inspiration its
// counter (`bardic-inspiration`), so the 2014 subclasses mapped in step 8.3 hang off them here too.
// The 2014 Bard table has no die column: the die goes by Bard level (d6, d8 at 5, d10 at 10, d12
// at 15). The 2014 Barbarian table's Rages column reads "Unlimited" at 20, so the counter stops
// at 19 and the switch is free from then on.

import type { Effect, Predicate } from '../../../schema/index.ts';
import { BARBARIAN } from '../core/barbarian.ts';
import { BARD } from '../core/bard.ts';
import {
  action,
  AT_TABLE,
  dc,
  NO_CHOICE,
  notHeavy,
  numbers,
  TARGETS,
  text,
  toggled,
  uses,
  when,
} from '../core/helpers.ts';
import { expertise } from '../core/levels1to3.ts';
import type { FeatureEffectsMap, FeatureMapping } from '../types.ts';

const BARB = (id: string, level: number, src = 'phb') =>
  `classFeature:${id}|barbarian|phb|${level}|${src}` as const;
const PATH = (sub: string, subSrc: string, id: string, level: number, src = subSrc) =>
  `subclassFeature:${id}|barbarian|phb|${sub}|${subSrc}|${level}|${src}` as const;
const BERSERKER = (id: string, level: number) => PATH('berserker', 'phb', id, level);
const TOTEM = (id: string, level: number, src = 'phb') =>
  PATH('totem warrior', 'phb', id, level, src);
const ZEALOT = (id: string, level: number) => PATH('zealot', 'xge', id, level);

const BRD = (id: string, level: number, src = 'phb') =>
  `classFeature:${id}|bard|phb|${level}|${src}` as const;
const COLLEGE = (sub: string, src: string, id: string, level: number) =>
  `subclassFeature:${id}|bard|phb|${sub}|${src}|${level}|${src}` as const;
const LORE = (id: string, level: number) => COLLEGE('lore', 'phb', id, level);
const VALOR = (id: string, level: number) => COLLEGE('valor', 'phb', id, level);
const GLAMOUR = (id: string, level: number) => COLLEGE('glamour', 'xge', id, level);
const SPIRITS = (id: string, level: number) => COLLEGE('spirits', 'vrgr', id, level);

/** The 2024 mapping of a feature whose 2014 rule is the same. */
function same(map: FeatureEffectsMap, key: string): FeatureMapping {
  const mapping = map[key as keyof typeof map];
  if (!mapping) throw new Error(`No 2024 mapping to reuse: ${key}`);
  return mapping;
}
const barbarian2024 = (id: string, level: number) =>
  same(BARBARIAN, `classFeature:${id}|barbarian|xphb|${level}|xphb`);
const bard2024 = (sub: string, id: string, level: number) =>
  same(BARD, `subclassFeature:${id}|bard|xphb|${sub}|xphb|${level}|xphb`);

const raging: Predicate = { toggle: 'rage' };
const unlimitedRage: Predicate = { level: 20, classId: 'barbarian|phb' };
/** A condition by either edition's rule id (a 2014 character may carry the PHB one). */
const condition = (name: string): Predicate => ({
  any: [{ condition: `condition/${name}|xphb` }, { condition: `condition/${name}|phb` }],
});
const inspiration = { resource: 'bardic-inspiration', amount: 1 };
const bardicDie = 'steps(level.bard, 1, 1d6, 5, 1d8, 10, 1d10, 15, 1d12)';
const BRUTAL_NEEDS = 'an extra weapon damage die on critical hits';
const brutal = (dice: string) =>
  text({ notes: `Roll ${dice} on a melee critical hit, by hand.`, needs: BRUTAL_NEEDS });
/** Why the ability increase isn't offered here: the 2014 rules add it to the feature. */
const ASI = 'Offered by the 2014 rules themselves: +2, +1/+1 or a feat.';
const asi = (): FeatureMapping => ({ level: 'A', effects: [], unoffered: ASI });

/** The 2014 Rage: melee weapon attacks with Strength (unarmed strikes too) get the damage. */
function rageSwitch(cost: NonNullable<Extract<Effect, { type: 'toggle' }>['cost']>): Effect {
  return {
    type: 'toggle',
    toggleId: 'rage',
    name: 'Rage',
    cost,
    endsOn: ['shortRest', 'longRest'],
    effects: [
      when(notHeavy, [
        { type: 'resistance', value: 'bludgeoning' },
        { type: 'resistance', value: 'piercing' },
        { type: 'resistance', value: 'slashing' },
        { type: 'rollMode', target: 'check:str', mode: 'advantage' },
        { type: 'rollMode', target: 'save:str', mode: 'advantage' },
        {
          type: 'attackMod',
          label: 'Rage',
          filter: { range: 'melee', source: ['weapon', 'unarmed'], ability: ['str'] },
          damage: 'table.rage-damage',
        },
      ]),
    ],
  };
}

/** A totem option's effects while raging (and, for some, out of Heavy armor). */
const whileRaging = (effects: Effect[], armor = false) =>
  numbers([when(armor ? { all: [raging, notHeavy] } : raging, effects)]);

export const RULES_2014_BARBARIAN_BARD: FeatureEffectsMap = {
  // ---- Barbarian ----
  [BARB('rage', 1)]: toggled(
    [
      when({ not: unlimitedRage }, [
        uses('rage', 'Rage', 'table.rages', 'long'),
        rageSwitch([{ resource: 'rage', amount: 1 }, { action: 'bonus' }]),
      ]),
      when(unlimitedRage, [rageSwitch([{ action: 'bonus' }])]),
    ],
    { notes: 'Its benefits stop in Heavy armor. No spells or Concentration while it lasts.' },
  ),
  [BARB('unarmored defense', 1)]: barbarian2024('unarmored defense', 1),
  // Only against effects the barbarian can see: listed with the save, not rolled.
  [BARB('danger sense', 2)]: numbers([
    when({ not: { any: ['blinded', 'deafened', 'incapacitated'].map(condition) } }, [
      { type: 'rollMode', target: 'save:dex', mode: 'advantage', against: 'effects you can see' },
    ]),
  ]),
  [BARB('reckless attack', 2)]: toggled([
    {
      type: 'toggle',
      toggleId: 'reckless-attack',
      name: 'Reckless Attack',
      effects: [
        {
          type: 'rollMode',
          target: 'attack:str',
          mode: 'advantage',
          filter: { range: 'melee', source: ['weapon', 'unarmed'] },
        },
        { type: 'attackedMode', mode: 'advantage' },
      ],
    },
  ]),
  [BARB('primal path', 3)]: text(),
  // A skill from the Barbarian's list at 3, and another at 10.
  [BARB('primal knowledge', 3, 'tce')]: numbers([
    {
      type: 'proficiencyChoice',
      category: 'skill',
      choice: {
        slot: 'skills',
        count: 'steps(level.barbarian, 3, 1, 10, 2)',
        from: ['animal handling', 'athletics', 'intimidation', 'nature', 'perception', 'survival'],
      },
    },
  ]),
  [BARB('ability score improvement', 4)]: asi(),
  [BARB('ability score improvement', 8)]: asi(),
  [BARB('ability score improvement', 12)]: asi(),
  [BARB('ability score improvement', 16)]: asi(),
  [BARB('ability score improvement', 19)]: asi(),
  [BARB('extra attack', 5)]: barbarian2024('extra attack', 5),
  [BARB('fast movement', 5)]: barbarian2024('fast movement', 5),
  [BARB('path feature', 6)]: text(),
  [BARB('path feature', 10)]: text(),
  [BARB('path feature', 14)]: text(),
  // Advantage on Initiative; acting while surprised is played at the table.
  [BARB('feral instinct', 7)]: barbarian2024('feral instinct', 7),
  [BARB('instinctive pounce', 7, 'tce')]: barbarian2024('instinctive pounce', 7),
  [BARB('brutal critical (1 die)', 9)]: brutal('one extra weapon die'),
  [BARB('brutal critical (2 dice)', 13)]: brutal('two extra weapon dice'),
  [BARB('brutal critical (3 dice)', 17)]: brutal('three extra weapon dice'),
  [BARB('relentless rage', 11)]: text(),
  [BARB('persistent rage', 15)]: text({ unoffered: NO_CHOICE }),
  [BARB('indomitable might', 18)]: barbarian2024('indomitable might', 18),
  [BARB('primal champion', 20)]: numbers([
    { type: 'abilityBonus', ability: 'str', value: 4, max: 24 },
    { type: 'abilityBonus', ability: 'con', value: 4, max: 24 },
  ]),

  // ---- Path of the Berserker ----
  [BERSERKER('path of the berserker', 3)]: text(),
  // Switched on with the Rage: its bonus-action attack is listed while it lasts.
  [BERSERKER('frenzy', 3)]: toggled(
    [
      when(raging, [
        {
          type: 'toggle',
          toggleId: 'frenzy',
          name: 'Frenzy',
          endsOn: ['shortRest', 'longRest'],
          effects: [action({ id: 'frenzy', name: 'Frenzy Attack', actionType: 'bonus' })],
        },
      ]),
    ],
    {
      unoffered: 'Picked each time Rage starts: switch on Frenzy with it.',
      notes: 'When the Rage ends, add one level of Exhaustion.',
    },
  ),
  [BERSERKER('mindless rage', 6)]: same(
    BARBARIAN,
    'subclassFeature:mindless rage|barbarian|xphb|berserker|xphb|6|xphb',
  ),
  [BERSERKER('intimidating presence', 10)]: numbers(
    [
      action({
        id: 'intimidating-presence',
        name: 'Intimidating Presence',
        actionType: 'action',
        saveDc: dc('cha'),
      }),
    ],
    { unoffered: TARGETS },
  ),
  [BERSERKER('retaliation', 14)]: same(
    BARBARIAN,
    'subclassFeature:retaliation|barbarian|xphb|berserker|xphb|10|xphb',
  ),

  // ---- Path of the Totem Warrior ----
  // The animals are picked through the subclass's data at 3, 6 and 14; the rituals (Beast
  // Sense, Speak with Animals, Commune with Nature) come from its data too.
  [TOTEM('path of the totem warrior', 3)]: text(),
  [TOTEM('spirit seeker', 3)]: text(),
  [TOTEM('totem spirit', 3)]: text(),
  [TOTEM('bear', 3)]: whileRaging(
    [
      'acid',
      'bludgeoning',
      'cold',
      'fire',
      'force',
      'lightning',
      'necrotic',
      'piercing',
      'poison',
      'radiant',
      'slashing',
      'thunder',
    ].map((value): Effect => ({ type: 'resistance', value })),
  ),
  [TOTEM('eagle', 3)]: whileRaging(
    [
      { type: 'attackedMode', mode: 'disadvantage', against: 'opportunity attacks' },
      action({ id: 'eagle-dash', name: 'Dash (Eagle Spirit)', actionType: 'bonus' }),
    ],
    true,
  ),
  [TOTEM('elk', 3, 'scag')]: whileRaging([{ type: 'speedBonus', value: 15 }], true),
  [TOTEM('tiger', 3, 'scag')]: text({ notes: 'Longer jumps while raging, by hand.' }),
  [TOTEM('wolf', 3)]: text(),
  [TOTEM('aspect of the beast', 6)]: text(),
  [TOTEM('bear', 6)]: numbers([
    { type: 'carrySize', steps: 1 },
    {
      type: 'rollMode',
      target: 'check:str',
      mode: 'advantage',
      against: 'pushing, pulling, lifting or breaking objects',
    },
  ]),
  [TOTEM('eagle', 6)]: text(),
  [TOTEM('elk', 6, 'scag')]: text(),
  [TOTEM('tiger', 6, 'scag')]: numbers([
    {
      type: 'proficiencyChoice',
      category: 'skill',
      choice: {
        slot: 'skills',
        count: 2,
        from: ['athletics', 'acrobatics', 'stealth', 'survival'],
      },
    },
  ]),
  [TOTEM('wolf', 6)]: text(),
  [TOTEM('spirit walker', 10)]: text(),
  [TOTEM('totemic attunement', 14)]: text(),
  [TOTEM('bear', 14)]: text(),
  [TOTEM('eagle', 14)]: whileRaging([{ type: 'speed', mode: 'fly', value: 'walk' }]),
  [TOTEM('elk', 14, 'scag')]: whileRaging([
    action({
      id: 'elk-trample',
      name: 'Elk Trample',
      actionType: 'bonus',
      roll: '1d12 + mod.str',
      saveDc: dc('str'),
    }),
  ]),
  [TOTEM('tiger', 14, 'scag')]: whileRaging([
    action({ id: 'tiger-pounce', name: 'Tiger Pounce', actionType: 'bonus' }),
  ]),
  [TOTEM('wolf', 14)]: whileRaging([
    action({ id: 'wolf-knockdown', name: 'Wolf Knockdown', actionType: 'bonus' }),
  ]),

  // ---- Path of the Zealot ----
  [ZEALOT('path of the zealot', 3)]: text(),
  // The damage type is picked once, when the feature is gained.
  [ZEALOT('divine fury', 3)]: numbers([
    {
      type: 'optionChoice',
      choice: { slot: 'damage-type', count: 1, from: ['necrotic', 'radiant'] },
      labels: ['Necrotic', 'Radiant'],
    },
    when(raging, [
      {
        type: 'damageRider',
        id: 'divine-fury',
        name: 'Divine Fury',
        dice: '1d6 + floor(level.barbarian / 2)',
        damageType: { fromChoice: 'damage-type' },
        filter: { source: ['weapon', 'unarmed'] },
        oncePerTurn: true,
        optIn: false,
      },
    ]),
  ]),
  [ZEALOT('warrior of the gods', 3)]: text(),
  [ZEALOT('fanatical focus', 6)]: text(),
  [ZEALOT('zealous presence', 10)]: numbers(
    [
      uses('zealous-presence', 'Zealous Presence', 1, 'long'),
      action({
        id: 'zealous-presence',
        name: 'Zealous Presence',
        actionType: 'bonus',
        costs: [{ resource: 'zealous-presence', amount: 1 }],
      }),
    ],
    { unoffered: TARGETS },
  ),
  [ZEALOT('rage beyond death', 14)]: text(),

  // ---- Bard ----
  [BRD('bardic inspiration', 1)]: numbers([
    uses('bardic-inspiration', 'Bardic Inspiration', 'max(1, mod.cha)', 'long', {
      die: bardicDie,
    }),
    action({
      id: 'bardic-inspiration',
      name: 'Bardic Inspiration',
      actionType: 'bonus',
      costs: [inspiration],
    }),
  ]),
  [BRD('spellcasting', 1)]: text(),
  // Half proficiency on every ability check without it: skills, plain checks and Initiative.
  [BRD('jack of all trades', 2)]: numbers([
    {
      type: 'halfProficiency',
      targets: ['check:str', 'check:dex', 'check:con', 'check:int', 'check:wis', 'check:cha'],
    },
  ]),
  [BRD('song of rest (d6)', 2)]: numbers([
    action({
      id: 'song-of-rest',
      name: 'Song of Rest',
      actionType: 'other',
      roll: 'steps(level.bard, 2, 1d6, 9, 1d8, 13, 1d10, 17, 1d12)',
    }),
  ]),
  [BRD('song of rest (d8)', 9)]: text(),
  [BRD('song of rest (d10)', 13)]: text(),
  [BRD('song of rest (d12)', 17)]: text(),
  [BRD('magical inspiration', 2, 'tce')]: text(),
  [BRD('bard college', 3)]: text(),
  [BRD('expertise', 3)]: numbers([expertise(2)]),
  [BRD('expertise', 10)]: numbers([expertise(2)]),
  [BRD('ability score improvement', 4)]: asi(),
  [BRD('ability score improvement', 8)]: asi(),
  [BRD('ability score improvement', 12)]: asi(),
  [BRD('ability score improvement', 16)]: asi(),
  [BRD('ability score improvement', 19)]: asi(),
  [BRD('bardic versatility', 4, 'tce')]: text(),
  // The die grows through the counter's own formula.
  [BRD('bardic inspiration (d8)', 5)]: text(),
  [BRD('bardic inspiration (d10)', 10)]: text(),
  [BRD('bardic inspiration (d12)', 15)]: text(),
  [BRD('font of inspiration', 5)]: numbers([
    { type: 'resourceModify', resourceId: 'bardic-inspiration', recharge: 'short' },
  ]),
  [BRD('countercharm', 6)]: numbers([
    action({ id: 'countercharm', name: 'Countercharm', actionType: 'action' }),
  ]),
  [BRD('bard college feature', 6)]: text(),
  [BRD('bard college feature', 14)]: text(),
  // The spells are picked through the class's own data (two each at 10, 14 and 18).
  [BRD('magical secrets', 10)]: text(),
  [BRD('magical secrets', 14)]: text(),
  [BRD('magical secrets', 18)]: text(),
  [BRD('superior inspiration', 20)]: text(),

  // ---- College of Lore ----
  [LORE('college of lore', 3)]: text(),
  [LORE('bonus proficiencies', 3)]: bard2024('lore', 'bonus proficiencies', 3),
  [LORE('cutting words', 3)]: numbers(
    [
      action({
        id: 'cutting-words',
        name: 'Cutting Words',
        actionType: 'reaction',
        costs: [inspiration],
        roll: bardicDie,
      }),
    ],
    { unoffered: NO_CHOICE },
  ),
  // Picked through the college's own data (its two spells at level 6).
  [LORE('additional magical secrets', 6)]: text(),
  [LORE('peerless skill', 14)]: numbers(
    [
      action({
        id: 'peerless-skill',
        name: 'Peerless Skill',
        actionType: 'other',
        costs: [inspiration],
        roll: bardicDie,
      }),
    ],
    { unoffered: NO_CHOICE },
  ),

  // ---- College of Valor ----
  [VALOR('college of valor', 3)]: text(),
  [VALOR('bonus proficiencies', 3)]: bard2024('valor', 'martial training', 3),
  [VALOR('combat inspiration', 3)]: text(),
  [VALOR('extra attack', 6)]: bard2024('valor', 'extra attack', 6),
  [VALOR('battle magic', 14)]: bard2024('valor', 'battle magic', 14),

  // ---- College of Glamour ----
  [GLAMOUR('college of glamour', 3)]: text(),
  [GLAMOUR('mantle of inspiration', 3)]: numbers(
    [
      action({
        id: 'mantle-of-inspiration',
        name: 'Mantle of Inspiration',
        actionType: 'bonus',
        costs: [inspiration],
        roll: 'steps(level.bard, 3, 5, 5, 8, 10, 11, 15, 14)',
      }),
    ],
    { unoffered: TARGETS, notes: 'The roll is the Temporary Hit Points each creature gains.' },
  ),
  [GLAMOUR('enthralling performance', 3)]: numbers(
    [
      uses('enthralling-performance', 'Enthralling Performance', 1, 'short'),
      action({
        id: 'enthralling-performance',
        name: 'Enthralling Performance',
        actionType: 'other',
        costs: [{ resource: 'enthralling-performance', amount: 1 }],
        saveDc: dc('cha'),
      }),
    ],
    { unoffered: TARGETS },
  ),
  // Command comes from the college's data; this counter tracks the feature's use.
  [GLAMOUR('mantle of majesty', 6)]: numbers([
    uses('mantle-of-majesty', 'Mantle of Majesty', 1, 'long'),
    action({
      id: 'mantle-of-majesty',
      name: 'Mantle of Majesty',
      actionType: 'bonus',
      costs: [{ resource: 'mantle-of-majesty', amount: 1 }],
    }),
  ]),
  [GLAMOUR('unbreakable majesty', 14)]: {
    ...bard2024('glamour', 'unbreakable majesty', 14),
    unoffered: NO_CHOICE,
  },

  // ---- College of Spirits ----
  [SPIRITS('college of spirits', 3)]: text(),
  // Guidance comes from the college's data.
  [SPIRITS('guiding whispers', 3)]: text({ notes: 'Your Guidance has a range of 60 feet.' }),
  [SPIRITS('spiritual focus', 3)]: text(),
  [SPIRITS('tales from beyond', 3)]: numbers(
    [
      action({
        id: 'tales-from-beyond',
        name: 'Tales from Beyond',
        actionType: 'bonus',
        costs: [inspiration],
        roll: bardicDie,
        saveDc: dc('cha'),
      }),
    ],
    { unoffered: TARGETS, notes: 'The roll picks the tale; the tale held is tracked by hand.' },
  ),
  [SPIRITS('spirit session', 6)]: numbers(
    [
      uses('spirit-session', 'Spirit Session', 1, 'long'),
      action({
        id: 'spirit-session',
        name: 'Spirit Session',
        actionType: 'other',
        costs: [{ resource: 'spirit-session', amount: 1 }],
      }),
    ],
    {
      unoffered: AT_TABLE,
      notes: 'The spell learned until the next Long Rest is added by hand.',
    },
  ),
  [SPIRITS('mystical connection', 14)]: text({ unoffered: AT_TABLE }),
};
