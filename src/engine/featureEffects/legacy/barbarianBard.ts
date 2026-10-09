// 2014 Barbarian paths and Bard colleges on 2024 characters (plan step 8.3): Battlerager,
// Ancestral Guardian, Storm Herald, Beast, Wild Magic and Giant; Swords, Whispers, Creation and
// Eloquence. Their features keep the 2014 keys (`barbarian|phb`, `bard|phb`) but run on the 2024
// class, so they hang off the core Rage switch (`rage`) and spend the core Bardic Inspiration
// counter (`bardic-inspiration`); the 2014 Bard table has no die column, so the die is read from
// the 2024 Bard's (`table.bard.bardic-die`). Spells and options the subclasses' data already
// offer (Consult the Spirits, Giant Power's cantrip, Storm Aura's environments, the Swords
// fighting style) are left to that data.

import type { Effect } from '../../../schema/index.ts';
import type { FeatureEffectsMap } from '../types.ts';
import {
  action,
  AT_TABLE,
  dc,
  NO_CHOICE,
  notIncapacitated,
  numbers,
  restoredBy,
  TARGETS,
  text,
  toggled,
  uses,
  when,
} from '../core/helpers.ts';

const BARB = (sub: string, src: string, id: string, level: number) =>
  `subclassFeature:${id}|barbarian|phb|${sub}|${src}|${level}|${src}` as const;
const BATTLERAGER = (id: string, level: number) => BARB('battlerager', 'scag', id, level);
const GUARDIAN = (id: string, level: number) => BARB('ancestral guardian', 'xge', id, level);
const STORM = (id: string, level: number) => BARB('storm herald', 'xge', id, level);
const BEAST = (id: string, level: number) => BARB('beast', 'tce', id, level);
const WILD = (id: string, level: number) => BARB('wild magic', 'tce', id, level);
const GIANT = (id: string, level: number) => BARB('giant', 'bgg', id, level);

const BARD = (sub: string, src: string, id: string, level: number) =>
  `subclassFeature:${id}|bard|phb|${sub}|${src}|${level}|${src}` as const;
const SWORDS = (id: string, level: number) => BARD('swords', 'xge', id, level);
const WHISPERS = (id: string, level: number) => BARD('whispers', 'xge', id, level);
const CREATION = (id: string, level: number) => BARD('creation', 'tce', id, level);
const ELOQUENCE = (id: string, level: number) => BARD('eloquence', 'tce', id, level);

const raging = { toggle: 'rage' };
const spikedArmor = { itemInUse: ['spiked armor|scag'] };
const inspiration = { resource: 'bardic-inspiration', amount: 1 };
const bardicDie = 'table.bard.bardic-die';
const auraDc = dc('con');
/** The Desert and Tundra aura amount, by Barbarian level. */
const auraAmount = 'steps(level.barbarian, 3, 2, 5, 3, 10, 4, 15, 5, 20, 6)';
const NEEDS_SIZE = 'a reach bonus and a size change while a toggle is on';

/** A counter with one action that spends it. */
function spent(
  id: string,
  name: string,
  max: string | number,
  recharge: 'short' | 'long',
  def: Partial<Parameters<typeof action>[0]> & {
    actionType: Parameters<typeof action>[0]['actionType'];
  },
): Effect[] {
  return [
    uses(id, name, max, recharge),
    action({ id, name, costs: [{ resource: id, amount: 1 }], ...def }),
  ];
}

/** A natural weapon of Form of the Beast: a Strength melee attack, so Rage adds to it. */
function natural(id: string, name: string, damage: string, damageType: string, reach = false) {
  return {
    type: 'attack',
    id,
    name,
    damage,
    damageType,
    range: 'melee',
    distance: reach ? '10 ft.' : '5 ft.',
    abilities: ['str'],
    ...(reach ? { properties: ['R'] } : {}),
  } satisfies Effect;
}

/** A Swords fighting style picked through the college's own data. */
function style(value: string, effects: Effect[]): Effect {
  return {
    type: 'ifChoice',
    owner: { kind: 'subclass', id: 'swords|bard|xphb|xge' },
    slot: 'optfeat.fighting-style.3',
    value,
    effects,
  };
}

export const LEGACY_BARBARIAN_BARD: FeatureEffectsMap = {
  // ---- Path of the Battlerager ----
  [BATTLERAGER('path of the battlerager', 3)]: text(),
  [BATTLERAGER('restriction—dwarves only', 3)]: text({
    notes: 'The sheet does not check the species.',
  }),
  // The spikes are an attack while raging in Spiked Armor; the grapple damage is added by hand.
  [BATTLERAGER('battlerager armor', 3)]: numbers(
    [
      when({ all: [raging, spikedArmor] }, [
        natural('armor-spikes', 'Armor Spikes', '1d4', 'piercing'),
        action({
          id: 'armor-spikes',
          name: 'Armor Spikes',
          actionType: 'bonus',
          attack: { tags: ['feature:armor-spikes'] },
        }),
      ]),
    ],
    { unoffered: NO_CHOICE, notes: 'A successful grapple deals 3 Piercing damage, by hand.' },
  ),
  [BATTLERAGER('reckless abandon', 6)]: numbers([
    when(raging, [
      action({
        id: 'reckless-abandon',
        name: 'Reckless Abandon',
        actionType: 'other',
        outcomes: [{ tempHp: 'max(1, mod.con)' }],
      }),
    ]),
  ]),
  [BATTLERAGER('battlerager charge', 10)]: numbers([
    when(raging, [
      action({ id: 'battlerager-charge', name: 'Battlerager Charge', actionType: 'bonus' }),
    ]),
  ]),
  [BATTLERAGER('spiked retribution', 14)]: numbers([
    when({ all: [raging, spikedArmor, notIncapacitated] }, [
      action({
        id: 'spiked-retribution',
        name: 'Spiked Retribution',
        actionType: 'other',
        roll: 3,
      }),
    ]),
  ]),

  // ---- Path of the Ancestral Guardian ----
  [GUARDIAN('path of the ancestral guardian', 3)]: text(),
  [GUARDIAN('ancestral protectors', 3)]: text({
    unoffered: NO_CHOICE,
    notes: 'Which creature the spirits hinder is tracked at the table.',
  }),
  [GUARDIAN('spirit shield', 6)]: numbers([
    when(raging, [
      action({
        id: 'spirit-shield',
        name: 'Spirit Shield',
        actionType: 'reaction',
        roll: 'steps(level.barbarian, 6, 2d6, 10, 3d6, 14, 4d6)',
      }),
    ]),
  ]),
  // Augury and Clairvoyance come from the subclass's data; this counter tracks their free cast.
  [GUARDIAN('consult the spirits', 10)]: numbers(
    spent('consult-the-spirits', 'Consult the Spirits', 1, 'short', { actionType: 'other' }),
    { notes: 'Either spell spends the use; Wisdom is their casting ability.' },
  ),
  [GUARDIAN('vengeful ancestors', 14)]: text({
    notes: 'The attacker takes the Spirit Shield roll as Force damage, by hand.',
  }),

  // ---- Path of the Storm Herald ----
  // The environment is picked through the data at levels 3, 6 and 14: pick the same one each time.
  [STORM('path of the storm herald', 3)]: text(),
  [STORM('storm aura', 3)]: text({
    notes: 'The aura starts with Rage; its action is listed under the environment picked.',
  }),
  [STORM('desert', 3)]: numbers([
    when(raging, [
      action({
        id: 'storm-aura-desert',
        name: 'Storm Aura (Desert)',
        actionType: 'bonus',
        roll: auraAmount,
      }),
    ]),
  ]),
  [STORM('sea', 3)]: numbers(
    [
      when(raging, [
        action({
          id: 'storm-aura-sea',
          name: 'Storm Aura (Sea)',
          actionType: 'bonus',
          roll: 'steps(level.barbarian, 3, 1d6, 10, 2d6, 15, 3d6, 20, 4d6)',
          saveDc: auraDc,
        }),
      ]),
    ],
    { unoffered: TARGETS },
  ),
  [STORM('tundra', 3)]: numbers(
    [
      when(raging, [
        action({
          id: 'storm-aura-tundra',
          name: 'Storm Aura (Tundra)',
          actionType: 'bonus',
          roll: auraAmount,
        }),
      ]),
    ],
    { unoffered: TARGETS },
  ),
  [STORM('storm soul', 6)]: text(),
  [STORM('desert', 6)]: numbers([{ type: 'resistance', value: 'fire' }], {
    notes: 'Setting an object alight is done at the table.',
  }),
  [STORM('sea', 6)]: numbers([
    { type: 'resistance', value: 'lightning' },
    { type: 'speed', mode: 'swim', value: 30 },
  ]),
  [STORM('tundra', 6)]: numbers([{ type: 'resistance', value: 'cold' }], {
    notes: 'Freezing water is done at the table.',
  }),
  [STORM('shielding storm', 10)]: text({ unoffered: TARGETS }),
  [STORM('raging storm', 14)]: text(),
  [STORM('desert', 14)]: numbers([
    when(raging, [
      action({
        id: 'raging-storm-desert',
        name: 'Raging Storm (Desert)',
        actionType: 'reaction',
        roll: 'floor(level.barbarian / 2)',
        saveDc: auraDc,
      }),
    ]),
  ]),
  [STORM('sea', 14)]: numbers([
    when(raging, [
      action({
        id: 'raging-storm-sea',
        name: 'Raging Storm (Sea)',
        actionType: 'reaction',
        saveDc: auraDc,
      }),
    ]),
  ]),
  // Rides on each Storm Aura activation.
  [STORM('tundra', 14)]: numbers(
    [
      when(raging, [
        action({
          id: 'raging-storm-tundra',
          name: 'Raging Storm (Tundra)',
          actionType: 'other',
          saveDc: auraDc,
        }),
      ]),
    ],
    { unoffered: TARGETS },
  ),

  // ---- Path of the Beast ----
  [BEAST('path of the beast', 3)]: text({ unoffered: 'A story pick (or roll) with no rules.' }),
  // Each form is a natural weapon attack while the form is on; the Claws' extra attack is taken
  // at the table.
  [BEAST('form of the beast', 3)]: toggled(
    [
      when(raging, [
        {
          type: 'toggle',
          toggleId: 'form-of-the-beast',
          name: 'Form of the Beast',
          effects: [],
          options: [
            {
              id: 'bite',
              name: 'Bite',
              effects: [
                natural('beast-bite', 'Bite', '1d8', 'piercing'),
                action({
                  id: 'beast-bite-healing',
                  name: 'Bite (Regain Hit Points)',
                  actionType: 'other',
                  outcomes: [{ heal: 'pb' }],
                }),
              ],
            },
            {
              id: 'claws',
              name: 'Claws',
              effects: [natural('beast-claws', 'Claws', '1d6', 'slashing')],
            },
            {
              id: 'tail',
              name: 'Tail',
              effects: [
                natural('beast-tail', 'Tail', '1d8', 'piercing', true),
                action({
                  id: 'beast-tail-swipe',
                  name: 'Tail Swipe',
                  actionType: 'reaction',
                  roll: '1d8',
                }),
              ],
            },
          ],
        },
      ]),
    ],
    { unoffered: 'Picked each time Rage starts: switch on Form of the Beast with that form.' },
  ),
  [BEAST('bestial soul', 6)]: numbers(
    [
      {
        type: 'optionChoice',
        choice: {
          slot: 'adaptation',
          count: 1,
          from: ['swim', 'climb', 'jump'],
          retrain: 'shortRest',
        },
        labels: ['Swimming', 'Climbing', 'Jumping'],
      },
      {
        type: 'ifChoice',
        slot: 'adaptation',
        value: 'swim',
        effects: [{ type: 'speed', mode: 'swim', value: 'walk' }],
      },
      {
        type: 'ifChoice',
        slot: 'adaptation',
        value: 'climb',
        effects: [{ type: 'speed', mode: 'climb', value: 'walk' }],
      },
    ],
    { notes: 'The natural weapons count as magical; the jump check is made at the table.' },
  ),
  [BEAST('infectious fury', 10)]: numbers(
    spent('infectious-fury', 'Infectious Fury', 'pb', 'long', {
      actionType: 'other',
      saveDc: dc('con'),
      roll: '2d12',
    }),
    { unoffered: AT_TABLE },
  ),
  [BEAST('call the hunt', 14)]: numbers(
    spent('call-the-hunt', 'Call the Hunt', 'pb', 'long', { actionType: 'other', roll: '1d6' }),
    { unoffered: TARGETS, notes: 'The 5 Temporary Hit Points per creature are added by hand.' },
  ),

  // ---- Path of Wild Magic ----
  [WILD('path of wild magic', 3)]: text(),
  [WILD('magic awareness', 3)]: numbers(
    spent('magic-awareness', 'Magic Awareness', 'pb', 'long', { actionType: 'action' }),
  ),
  [WILD('wild surge', 3)]: numbers(
    [
      when(raging, [
        action({
          id: 'wild-surge',
          name: 'Wild Surge',
          actionType: 'other',
          roll: '1d8',
          saveDc: dc('con'),
        }),
      ]),
    ],
    { unoffered: 'Rolled on the table each time Rage starts.' },
  ),
  [WILD('bolstering magic', 6)]: numbers(
    spent('bolstering-magic', 'Bolstering Magic', 'pb', 'long', {
      actionType: 'action',
      roll: '1d3',
    }),
    { unoffered: AT_TABLE },
  ),
  [WILD('unstable backlash', 10)]: numbers([
    when(raging, [
      action({
        id: 'unstable-backlash',
        name: 'Unstable Backlash',
        actionType: 'reaction',
        roll: '1d8',
      }),
    ]),
  ]),
  [WILD('controlled surge', 14)]: text({ unoffered: AT_TABLE }),

  // ---- Path of the Giant ----
  [GIANT('path of the giant', 3)]: text(),
  [GIANT('giant power', 3)]: numbers(
    [{ type: 'proficiency', category: 'language', value: 'giant' }],
    {
      unoffered: "The cantrip is picked through the subclass's data.",
      notes: 'Already knowing Giant: add another language by hand.',
    },
  ),
  // The 2024 Rage already adds its damage to Strength thrown attacks.
  [GIANT("giant's havoc", 3)]: text({
    notes: 'Reach and size while raging are changed by hand.',
    needs: NEEDS_SIZE,
  }),
  // The extra die is 2d6 from level 14 (Demiurgic Colossus).
  [GIANT('elemental cleaver', 6)]: numbers(
    [
      when(raging, [
        {
          type: 'damageRider',
          id: 'elemental-cleaver',
          name: 'Elemental Cleaver',
          dice: 'steps(level.barbarian, 6, 1d6, 14, 2d6)',
          filter: { source: ['weapon'] },
          optIn: true,
        },
        action({ id: 'elemental-cleaver', name: 'Elemental Cleaver', actionType: 'bonus' }),
      ]),
    ],
    {
      unoffered: AT_TABLE,
      notes: "The infused weapon's damage type and Thrown property are tracked by hand.",
    },
  ),
  [GIANT('mighty impel', 10)]: numbers(
    [
      when(raging, [
        action({
          id: 'mighty-impel',
          name: 'Mighty Impel',
          actionType: 'bonus',
          saveDc: dc('str'),
        }),
      ]),
    ],
    { unoffered: TARGETS },
  ),
  [GIANT('demiurgic colossus', 14)]: text({
    notes: 'Reach and size while raging are changed by hand.',
    needs: NEEDS_SIZE,
  }),

  // ---- College of Swords ----
  [SWORDS('college of swords', 3)]: text(),
  [SWORDS('bonus proficiencies', 3)]: numbers(
    [
      { type: 'proficiency', category: 'armor', value: 'medium' },
      { type: 'proficiency', category: 'weapon', value: 'scimitar|xphb' },
    ],
    { notes: 'A melee weapon used as a spellcasting focus is handled at the table.' },
  ),
  // The style is picked through the college's data (2014 Dueling or Two-Weapon Fighting).
  [SWORDS('fighting style', 3)]: numbers([
    style('dueling|phb', [
      {
        type: 'attackMod',
        label: 'Dueling',
        filter: { range: 'melee', source: ['weapon'], notProperties: ['2H'], tags: ['onlyWeapon'] },
        damage: 2,
      },
    ]),
    style('two-weapon fighting|phb', [
      {
        type: 'attackMod',
        label: 'Two-Weapon Fighting',
        filter: { tags: ['offHand'] },
        offHandAbility: true,
      },
    ]),
  ]),
  // The data asks for one flourish, but the sheet lists all three here, whichever is picked.
  [SWORDS('blade flourish', 3)]: numbers(
    [
      ['defensive-flourish', 'Defensive Flourish'],
      ['slashing-flourish', 'Slashing Flourish'],
      ['mobile-flourish', 'Mobile Flourish'],
    ].map(([id, name]) =>
      action({ id: id!, name: name!, actionType: 'other', costs: [inspiration], roll: bardicDie }),
    ),
    { notes: 'The extra 10 feet of Speed and the AC bonus are applied by hand.' },
  ),
  [SWORDS('defensive flourish', 3)]: text(),
  [SWORDS('slashing flourish', 3)]: text({ unoffered: TARGETS }),
  [SWORDS('mobile flourish', 3)]: text(),
  [SWORDS('extra attack', 6)]: numbers([{ type: 'extraAttack', count: 2 }]),
  [SWORDS("master's flourish", 14)]: numbers([
    action({ id: 'masters-flourish', name: "Master's Flourish", actionType: 'other', roll: '1d6' }),
  ]),

  // ---- College of Whispers ----
  [WHISPERS('college of whispers', 3)]: text(),
  [WHISPERS('psychic blades', 3)]: numbers([
    {
      type: 'damageRider',
      id: 'psychic-blades',
      name: 'Psychic Blades',
      dice: 'steps(level.bard, 3, 2d6, 5, 3d6, 10, 5d6, 15, 8d6)',
      damageType: 'psychic',
      filter: { source: ['weapon'] },
      oncePerTurn: true,
      cost: inspiration,
      optIn: true,
    },
  ]),
  [WHISPERS('words of terror', 3)]: numbers(
    spent('words-of-terror', 'Words of Terror', 1, 'short', {
      actionType: 'other',
      saveDc: dc('cha'),
    }),
    { unoffered: TARGETS },
  ),
  // Capturing a shadow spends the counter; wearing it is an action.
  [WHISPERS('mantle of whispers', 6)]: numbers([
    ...spent('mantle-of-whispers', 'Mantle of Whispers', 1, 'short', { actionType: 'reaction' }),
    action({ id: 'mantle-of-whispers-disguise', name: 'Assume Shadow', actionType: 'action' }),
    {
      type: 'rollNote',
      target: 'skill:deception',
      text: '+5 against Insight to see through a Mantle of Whispers disguise',
    },
  ]),
  [WHISPERS('shadow lore', 14)]: numbers(
    spent('shadow-lore', 'Shadow Lore', 1, 'long', { actionType: 'action', saveDc: dc('cha') }),
    { unoffered: TARGETS },
  ),

  // ---- College of Creation ----
  [CREATION('college of creation', 3)]: text(),
  // Rides on Bardic Inspiration: the mote's effect depends on the roll it is added to.
  [CREATION('mote of potential', 3)]: numbers(
    [
      action({
        id: 'mote-of-potential',
        name: 'Mote of Potential',
        actionType: 'other',
        saveDc: dc('cha'),
      }),
    ],
    { unoffered: TARGETS },
  ),
  [CREATION('performance of creation', 3)]: numbers(
    [
      ...spent('performance-of-creation', 'Performance of Creation', 1, 'long', {
        actionType: 'action',
      }),
      restoredBy('performance-of-creation', { slot: { minLevel: 2 } }),
    ],
    { unoffered: AT_TABLE, notes: "The item's value and size limits are checked by hand." },
  ),
  [CREATION('animating performance', 6)]: numbers(
    [
      ...spent('animating-performance', 'Animating Performance', 1, 'long', {
        actionType: 'action',
      }),
      restoredBy('animating-performance', { slot: { minLevel: 3 } }),
    ],
    { notes: "The animated item's stat block is kept by hand." },
  ),
  [CREATION('creative crescendo', 14)]: text({ unoffered: AT_TABLE }),

  // ---- College of Eloquence ----
  [ELOQUENCE('college of eloquence', 3)]: text(),
  [ELOQUENCE('silver tongue', 3)]: numbers([
    { type: 'rollFloor', target: 'skill:persuasion', value: 10 },
    { type: 'rollFloor', target: 'skill:deception', value: 10 },
  ]),
  [ELOQUENCE('unsettling words', 3)]: numbers(
    [
      action({
        id: 'unsettling-words',
        name: 'Unsettling Words',
        actionType: 'bonus',
        costs: [inspiration],
        roll: bardicDie,
      }),
    ],
    { unoffered: TARGETS },
  ),
  [ELOQUENCE('unfailing inspiration', 6)]: text(),
  [ELOQUENCE('universal speech', 6)]: numbers(
    [
      ...spent('universal-speech', 'Universal Speech', 1, 'long', { actionType: 'action' }),
      restoredBy('universal-speech', { slot: { minLevel: 1 } }),
    ],
    { unoffered: TARGETS },
  ),
  [ELOQUENCE('infectious inspiration', 14)]: numbers(
    spent('infectious-inspiration', 'Infectious Inspiration', 'max(1, mod.cha)', 'long', {
      actionType: 'reaction',
    }),
    { unoffered: TARGETS },
  ),
};
