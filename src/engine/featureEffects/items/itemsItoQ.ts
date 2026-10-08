// 2024 Dungeon Master's Guide magic items, I to Q (plan §10.3, step 7.12), checked against the
// text of each. Spells, bonuses and resistances come from the item's data; these add what the
// sheet shows while the item is in use: Ioun Stone scores and advantages, daily uses (Pearl of
// Power, Periapt of Health, Javelin of Lightning), actions paid in charges (Mace of Terror,
// Pipes of Haunting), damage riders on the item's own attacks and a Swim Speed. Potions, oils,
// tokens and other single-use items are never in use, so their text says it all.

import { refKey, type Ability, type Effect } from '../../../schema/index.ts';
import type { FeatureEffectsMap, FeatureMapping } from '../types.ts';
import {
  action,
  AT_TABLE,
  fromData,
  numbers,
  savesAgainst,
  TARGETS,
  text,
  uses,
  when,
} from '../core/helpers.ts';

const I = (name: string) => refKey({ kind: 'item', id: `${name}|xdmg` });
const own = (name: string) => ({ itemIds: [`${name}|xdmg`] });

const vsPoisoned = savesAgainst('being Poisoned');
/** Variant weapons are rows of their base weapon, so a filter can only name the base. */

/** An Ioun Stone that raises one score by 2, to at most 20. */
const iounScore = (ability: Ability): FeatureMapping =>
  numbers([{ type: 'abilityBonus', ability, value: 2, max: 20 }]);

/** An Ioun Stone that cancels spells up to a level, 20 spell levels in all. */
const iounAbsorption = (id: string, name: string): FeatureMapping =>
  numbers(
    [
      uses(id, `${name} (spell levels left)`, 20, 'none', { pool: true }),
      action({ id, name, actionType: 'reaction' }),
    ],
    { notes: 'Spend the canceled spell’s level; the stone is spent at 20.' },
  );

/** A magic action that spends one of the item's charges. */
const chargeAction = (
  id: string,
  name: string,
  more: { actionType?: 'action' | 'bonus'; saveDc?: string } = {},
): Effect =>
  action({
    id,
    name,
    actionType: more.actionType ?? 'action',
    costs: [{ charges: 1 }],
    ...(more.saveDc ? { saveDc: more.saveDc } : {}),
  });

/** Single-use items and items with nothing for the sheet to track. */
const TEXT_ONLY = [
  'immovable rod',
  'instrument of illusions',
  'ioun stone',
  'ioun stone, regeneration',
  'ioun stone, sustenance',
  'iron flask',
  "keoghtom's ointment",
  'lantern of revealing',
  'lock of trickery',
  'manual of clay golems',
  'manual of flesh golems',
  'manual of golems',
  'manual of iron golems',
  'manual of stone golems',
  'mirror of life trapping',
  'moon-touched sword',
  'mystery key',
  'necklace of fireballs',
  "nolzur's marvelous pigments",
  'oil of etherealness',
  'oil of sharpness',
  'oil of slipperiness',
  'orb of direction',
  'orb of time',
  'perfume of bewitching',
  'philter of love',
  'pipe of smoke monsters',
  'pole of angling',
  'pole of collapsing',
  'portable hole',
  'pot of awakening',
  'potion of acid resistance',
  'potion of animal friendship',
  'potion of clairvoyance',
  'potion of climbing',
  'potion of cloud giant strength',
  'potion of cold resistance',
  'potion of comprehension',
  'potion of diminution',
  'potion of fire breath',
  'potion of fire giant strength',
  'potion of fire resistance',
  'potion of flying',
  'potion of force resistance',
  'potion of frost giant strength',
  'potion of gaseous form',
  'potion of giant strength',
  'potion of greater healing',
  'potion of greater invisibility',
  'potion of growth',
  'potion of healing',
  'potion of heroism',
  'potion of hill giant strength',
  'potion of invisibility',
  'potion of invulnerability',
  'potion of lightning resistance',
  'potion of longevity',
  'potion of mind reading',
  'potion of necrotic resistance',
  'potion of poison',
  'potion of poison resistance',
  'potion of psychic resistance',
  'potion of pugilism',
  'potion of radiant resistance',
  'potion of speed',
  'potion of stone giant strength',
  'potion of storm giant strength',
  'potion of superior healing',
  'potion of supreme healing',
  'potion of thunder resistance',
  'potion of vitality',
  'potion of water breathing',
  'potions of healing',
  'prosthetic limb',
  "quaal's feather token, anchor",
  "quaal's feather token, bird",
  "quaal's feather token, fan",
  "quaal's feather token, swan boat",
  "quaal's feather token, tree",
  "quaal's feather token, whip",
  'quiver of ehlonna',
];

/** Spells (and bonuses) from the data do it all. */
const FROM_DATA = [
  'instrument of the bards',
  'instrument of the bards, anstruth harp',
  'instrument of the bards, canaith mandolin',
  'instrument of the bards, cli lyre',
  'instrument of the bards, doss lute',
  'instrument of the bards, fochlucan bandore',
  'instrument of the bards, mac-fuirmidh cittern',
  'instrument of the bards, ollamh harp',
  'ioun stone, protection',
  'medallion of thoughts',
  'orb of dragonkind',
  'plate armor of etherealness (*)',
];

/** Reading the manual raises a score for good; the sheet's score is edited by hand. */
const MANUAL = text({ notes: 'Once studied, add the increase to the ability score itself.' });

export const ITEMS_I_TO_Q: FeatureEffectsMap = {
  ...Object.fromEntries(TEXT_ONLY.map((n) => [I(n), text()])),
  ...Object.fromEntries(FROM_DATA.map((n) => [I(n), fromData()])),

  [I('instrument of scribing')]: numbers([
    chargeAction('instrument-of-scribing', 'Scribe Message'),
  ]),

  // ---- Ioun Stones ----
  [I('ioun stone, absorption')]: iounAbsorption('ioun-absorption', 'Ioun Stone of Absorption'),
  [I('ioun stone, greater absorption')]: iounAbsorption(
    'ioun-greater-absorption',
    'Ioun Stone of Greater Absorption',
  ),
  [I('ioun stone, agility')]: iounScore('dex'),
  [I('ioun stone, fortitude')]: iounScore('con'),
  [I('ioun stone, insight')]: iounScore('wis'),
  [I('ioun stone, intellect')]: iounScore('int'),
  [I('ioun stone, leadership')]: iounScore('cha'),
  [I('ioun stone, strength')]: iounScore('str'),
  [I('ioun stone, awareness')]: numbers([
    { type: 'rollMode', target: 'initiative', mode: 'advantage' },
    { type: 'rollMode', target: 'skill:perception', mode: 'advantage' },
  ]),
  [I('ioun stone, mastery')]: text({ needs: 'a bonus to the Proficiency Bonus' }),
  [I('ioun stone, reserve')]: numbers(
    [uses('ioun-reserve', 'Ioun Stone of Reserve (stored levels)', 4, 'none', { pool: true })],
    { notes: 'Tracks the stored spell levels; which spells are stored is kept by hand.' },
  ),

  // ---- Weapons ----
  [I('javelin of lightning')]: numbers([
    uses('javelin-of-lightning', 'Lightning Bolt', 1, 'dawn'),
    action({
      id: 'javelin-of-lightning',
      name: 'Lightning Bolt',
      actionType: 'action',
      costs: [{ resource: 'javelin-of-lightning', amount: 1 }],
      roll: '4d6',
      saveDc: '13',
    }),
  ]),
  [I('lute of thunderous thumping')]: numbers([
    {
      type: 'damageRider',
      id: 'lute-of-thunderous-thumping',
      name: 'Lute of Thunderous Thumping',
      dice: '2d8',
      damageType: 'thunder',
      filter: own('lute of thunderous thumping'),
      optIn: false,
    },
    when({ level: 1, classId: 'bard|xphb' }, [
      {
        type: 'attackMod',
        filter: { ...own('lute of thunderous thumping'), range: 'melee' },
        label: 'Sing and Swing',
        abilities: ['cha'],
      },
    ]),
  ]),
  [I('mace of disruption')]: numbers([
    {
      type: 'damageRider',
      id: 'mace-of-disruption',
      name: 'Mace of Disruption (Fiend or Undead)',
      dice: '2d6',
      damageType: 'radiant',
      filter: own('mace of disruption'),
      optIn: true,
    },
  ]),
  [I('mace of smiting')]: numbers(
    [
      {
        type: 'damageRider',
        id: 'mace-of-smiting-construct',
        name: 'Mace of Smiting (Construct)',
        dice: '2',
        damageType: 'bludgeoning',
        filter: own('mace of smiting'),
        optIn: true,
      },
      {
        type: 'damageRider',
        id: 'mace-of-smiting-20',
        name: 'Mace of Smiting (rolled a 20)',
        dice: '7',
        damageType: 'bludgeoning',
        filter: own('mace of smiting'),
        optIn: true,
      },
    ],
    { notes: 'Against a Construct the attack roll is 2 higher too, and a 20 deals 14.' },
  ),
  [I('mace of terror')]: numbers(
    [chargeAction('mace-of-terror', 'Wave of Terror', { saveDc: '15' })],
    { unoffered: TARGETS },
  ),
  [I('luck blade')]: numbers([uses('luck-blade', 'Luck Blade: Luck', 1, 'dawn')]),
  [I('moonblade')]: text({ unoffered: 'The DM picks the property each rune grants.' }),
  [I('nine lives stealer')]: text(),
  [I('oathbow')]: numbers(
    [
      {
        type: 'damageRider',
        id: 'oathbow',
        name: 'Oathbow (sworn enemy)',
        dice: '3d6',
        damageType: 'piercing',
        filter: { itemIds: ['oathbow|xdmg'] },
        optIn: true,
      },
    ],
    {
      notes:
        'Advantage against the sworn enemy, and Disadvantage with other weapons while it lives.',
      unoffered: AT_TABLE,
    },
  ),
  [I('quarterstaff of the acrobat')]: numbers(
    [
      { type: 'rollMode', target: 'skill:acrobatics', mode: 'advantage' },
      uses('acrobat-deflection', 'Attack Deflection', 1, 'short'),
      action({
        id: 'acrobat-deflection',
        name: 'Attack Deflection',
        actionType: 'reaction',
        costs: [{ resource: 'acrobat-deflection', amount: 1 }],
      }),
    ],
    { notes: 'The Advantage is lost in rod form; the +5 AC is against one attack only.' },
  ),

  // ---- Armor and worn items ----
  [I("mariner's armor")]: numbers([
    { type: 'speed', mode: 'swim', value: 'walk' },
    uses('mariners-armor', "Mariner's Armor: Healing", 1, 'dawn'),
  ]),
  [I('mithral armor')]: text({
    needs: "a way to waive worn armor's Strength requirement and Stealth Disadvantage",
  }),
  [I('mantle of spell resistance')]: numbers([savesAgainst('spells')]),
  [I("nature's mantle")]: numbers([
    action({ id: 'natures-mantle', name: "Hide (Nature's Mantle)", actionType: 'bonus' }),
  ]),
  [I('necklace of adaptation')]: numbers([vsPoisoned]),
  [I('necklace of prayer beads')]: text({ unoffered: 'The DM picks each bead’s type.' }),
  [I('pearl of power')]: numbers([
    uses('pearl-of-power', 'Pearl of Power', 1, 'dawn'),
    action({
      id: 'pearl-of-power',
      name: 'Pearl of Power',
      actionType: 'action',
      costs: [{ resource: 'pearl-of-power', amount: 1 }],
      outcomes: [{ regainSlot: { maxLevel: 3 } }],
    }),
  ]),
  [I('periapt of health')]: numbers([
    uses('periapt-of-health', 'Periapt of Health', 1, 'dawn'),
    action({
      id: 'periapt-of-health',
      name: 'Periapt of Health',
      actionType: 'action',
      costs: [{ resource: 'periapt-of-health', amount: 1 }],
      roll: '2d4 + 2',
      outcomes: [{ heal: '2d4 + 2' }],
    }),
    vsPoisoned,
  ]),
  [I('periapt of proof against poison')]: numbers([
    { type: 'conditionImmunity', value: 'poisoned' },
  ]),
  [I('periapt of wound closure')]: numbers(
    [{ type: 'rollFloor', target: 'save:death', value: 10 }],
    { needs: 'doubled healing from Hit Point Dice' },
  ),

  // ---- Charged instruments ----
  [I('pipes of haunting')]: numbers(
    [chargeAction('pipes-of-haunting', 'Pipes of Haunting', { saveDc: '15' })],
    { unoffered: TARGETS },
  ),
  [I('pipes of the sewers')]: numbers(
    [chargeAction('pipes-of-the-sewers', 'Call a Swarm of Rats', { actionType: 'bonus' })],
    { notes: 'One charge per swarm, up to three.' },
  ),

  [I('iron bands of bilarro')]: numbers(
    [
      uses('iron-bands-of-bilarro', 'Iron Bands of Bilarro', 1, 'dawn'),
      action({
        id: 'iron-bands-of-bilarro',
        name: 'Iron Bands of Bilarro',
        actionType: 'action',
        costs: [{ resource: 'iron-bands-of-bilarro', amount: 1 }],
      }),
    ],
    { notes: 'The attack bonus is the Dexterity modifier plus Proficiency Bonus.' },
  ),
  [I('manual of bodily health')]: MANUAL,
  [I('manual of gainful exercise')]: MANUAL,
  [I('manual of quickness of action')]: MANUAL,
  [I("quaal's feather token")]: text({ unoffered: 'The DM picks the kind of token.' }),
  [I('potion of resistance')]: text({ unoffered: 'The DM picks the damage type.' }),
};
