// 2024 Dungeon Master's Guide magic items, R to Z (plan §10.3, step 7.12). Resistances, item
// bonuses and item spells come from the data; these add speeds, senses, advantage, daily uses,
// actions paid in charges and damage riders on an item's own attacks. Consumables (scrolls,
// glue, solvent), group headers and what is decided at the table stay text.

import { refKey, type ActionDef, type Effect } from '../../../schema/index.ts';
import {
  action,
  AT_TABLE,
  fromData,
  numbers,
  onlyThisWeapon,
  savesAgainst,
  text,
  toggled,
  uses,
} from '../core/helpers.ts';
import type { FeatureEffectsMap, FeatureMapping } from '../types.ts';

const I = (name: string) => refKey({ kind: 'item', id: `${name}|xdmg` });
const own = (name: string) => [`${name}|xdmg`];

/** A Magic action (an action in the sheet's terms). */
const magic = (id: string, name: string, more: Partial<ActionDef> = {}): Effect =>
  action({ id, name, actionType: 'action', ...more });

/** An action paid in the item's own charges. */
const charged = (
  id: string,
  name: string,
  actionType: ActionDef['actionType'],
  charges: number,
  more: Partial<ActionDef> = {},
): Effect => action({ id, name, actionType, costs: [{ charges }], ...more });

/** A property usable once, back at dawn: its counter and the action that spends it. */
function daily(
  id: string,
  name: string,
  actionType: ActionDef['actionType'],
  more: Partial<ActionDef> = {},
): Effect[] {
  return [
    uses(id, name, 1, 'dawn'),
    action({ id, name, actionType, costs: [{ resource: id, amount: 1 }], ...more }),
  ];
}

/** Extra damage on the item's own hits. */
function rider(
  item: string,
  id: string,
  name: string,
  dice: string,
  damageType: string,
  more: Partial<Extract<Effect, { type: 'damageRider' }>> = {},
): Effect {
  return {
    type: 'damageRider',
    id,
    name,
    dice,
    damageType,
    filter: { itemIds: own(item) },
    optIn: false,
    ...more,
  };
}

// ---- Dragon Scale Mail: sensing the nearest dragon of its kind, once a day ----
function dragonScale(color: string): FeatureMapping {
  return numbers([
    ...daily(`${color}-dragon-scale-mail`, 'Dragon Scale Mail: Sense Dragon', 'action'),
    savesAgainst('the breath weapons of Dragons'),
  ]);
}

// ---- Rings of Elemental Command: the plane's language and movement, and Compulsion ----
function elementalRing(language: string, extra: Effect[] = []): FeatureMapping {
  return numbers([
    { type: 'proficiency', category: 'language', value: language },
    ...extra,
    magic('elemental-compulsion', 'Elemental Compulsion', { saveDc: 18 }),
    { type: 'rollMode', target: 'attack:all', mode: 'advantage', against: 'Elementals' },
  ]);
}

const DAMAGE_TYPES = [
  'acid',
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

/** Weapon variants: the engine can't aim a rider at the weapon a variant is applied to. */

export const ITEMS_R_TO_Z: FeatureEffectsMap = {
  [I('red dragon scale mail')]: dragonScale('red'),
  [I('silver dragon scale mail')]: dragonScale('silver'),
  [I('white dragon scale mail')]: dragonScale('white'),

  // ---- Rings ----
  [I('ring of acid resistance')]: fromData(),
  [I('ring of cold resistance')]: fromData(),
  [I('ring of fire resistance')]: fromData(),
  [I('ring of force resistance')]: fromData(),
  [I('ring of lightning resistance')]: fromData(),
  [I('ring of necrotic resistance')]: fromData(),
  [I('ring of poison resistance')]: fromData(),
  [I('ring of psychic resistance')]: fromData(),
  [I('ring of radiant resistance')]: fromData(),
  [I('ring of thunder resistance')]: fromData(),
  [I('ring of resistance')]: numbers([
    { type: 'resistanceChoice', choice: { slot: 'damage-type', count: 1, from: DAMAGE_TYPES } },
  ]),
  [I('ring of animal influence')]: fromData(),
  [I('ring of djinni summoning')]: numbers([magic('summon-djinni', 'Summon Djinni')], {
    notes: 'Once the djinni leaves, it returns only after 24 hours.',
  }),
  [I('ring of elemental command')]: text(),
  [I('ring of elemental command (air)')]: elementalRing('auran', [
    { type: 'speed', mode: 'fly', value: 'walk' },
  ]),
  [I('ring of elemental command (earth)')]: elementalRing('terran'),
  [I('ring of elemental command (fire)')]: elementalRing('ignan'),
  [I('ring of elemental command (water)')]: elementalRing('aquan', [
    { type: 'speed', mode: 'swim', value: 60 },
  ]),
  [I('ring of evasion')]: numbers([charged('ring-of-evasion', 'Ring of Evasion', 'reaction', 1)]),
  [I('ring of feather falling')]: text(),
  [I('ring of free action')]: text(),
  [I('ring of invisibility')]: numbers([magic('ring-of-invisibility', 'Ring of Invisibility')]),
  [I('ring of jumping')]: fromData(),
  [I('ring of mind shielding')]: text(),
  [I('ring of protection')]: fromData(),
  [I('ring of regeneration')]: text(),
  [I('ring of shooting stars')]: numbers(
    [
      charged('lightning-spheres', 'Lightning Spheres', 'action', 2, { saveDc: 15 }),
      charged('shooting-stars', 'Shooting Stars', 'action', 1, { saveDc: 15, roll: '5d4' }),
    ],
    { notes: 'Shooting Stars takes 1 to 3 charges, one mote each.' },
  ),
  [I('ring of spell storing')]: text(),
  [I('ring of spell turning')]: numbers([
    action({ id: 'spell-turning', name: 'Spell Turning', actionType: 'reaction' }),
    savesAgainst('spells'),
  ]),
  [I('ring of swimming')]: numbers([{ type: 'speed', mode: 'swim', value: 40 }]),
  [I('ring of telekinesis')]: fromData(),
  [I('ring of the ram')]: numbers(
    [charged('ring-of-the-ram', 'Ring of the Ram', 'action', 1, { roll: '2d10' })],
    { notes: 'Spend 1 to 3 charges: 2d10 per charge.' },
  ),
  [I('ring of three wishes')]: fromData(),
  [I('ring of warmth')]: fromData(),
  [I('ring of water walking')]: fromData(),
  [I('ring of x-ray vision')]: numbers([magic('x-ray-vision', 'X-ray Vision')]),
  [I('rival coin')]: numbers([charged('rival-coin', 'Rival Coin', 'action', 1, { saveDc: 13 })]),

  // ---- Robes ----
  [I('robe of eyes')]: numbers([
    { type: 'sense', sense: 'darkvision', range: 120 },
    { type: 'sense', sense: 'truesight', range: 120 },
    {
      type: 'rollMode',
      target: 'skill:perception',
      mode: 'advantage',
      note: 'Robe of Eyes (checks that rely on sight)',
    },
  ]),
  [I('robe of scintillating colors')]: numbers([
    charged('scintillating-colors', 'Scintillating Colors', 'action', 1, { saveDc: 15 }),
  ]),
  [I('robe of stars')]: numbers([magic('robe-of-stars-astral', 'Robe of Stars: Astral Plane')]),
  [I('robe of the archmagi')]: numbers([
    {
      type: 'acFormula',
      name: 'Robe of the Archmagi',
      base: 15,
      addAbilities: ['dex'],
      shield: true,
    },
    savesAgainst('spells and other magical effects'),
  ]),
  [I('robe of useful items')]: text(),

  // ---- Rods ----
  [I('rod of absorption')]: numbers(
    [action({ id: 'rod-of-absorption', name: 'Rod of Absorption', actionType: 'reaction' })],
    { notes: 'The stored spell levels are tracked by hand.' },
  ),
  // Its +1 to AC and saves comes only from the planted aura, not from holding the rod.
  [I('rod of alertness')]: numbers(
    [
      { type: 'itemBonusOff', bonus: 'ac' },
      { type: 'itemBonusOff', bonus: 'savingThrow' },
      { type: 'rollMode', target: 'skill:perception', mode: 'advantage' },
      { type: 'rollMode', target: 'initiative', mode: 'advantage' },
      ...daily('protective-aura', 'Protective Aura', 'action'),
    ],
    { notes: 'In the aura it plants: +1 AC and saving throws (not in the numbers shown).' },
  ),
  [I('rod of lordly might')]: numbers(
    [
      action({
        id: 'lordly-might-buttons',
        name: 'Rod of Lordly Might: Button',
        actionType: 'bonus',
      }),
      ...daily('lordly-might-drain-life', 'Drain Life', 'other', { roll: '4d6', saveDc: 17 }),
      ...daily('lordly-might-paralyze', 'Paralyze', 'other', { saveDc: 17 }),
      ...daily('lordly-might-terrify', 'Terrify', 'action', { saveDc: 17 }),
    ],
    {
      unoffered: AT_TABLE,
      needs: 'the rod as a weapon: it has no weapon data, so its Mace attack and forms are missing',
    },
  ),
  [I('rod of resurrection')]: fromData(),
  [I('rod of rulership')]: numbers(
    daily('rod-of-rulership', 'Rod of Rulership', 'action', { saveDc: 15 }),
  ),
  [I('rod of security')]: numbers([magic('rod-of-security', 'Rod of Security')], {
    notes: 'Usable again only after 10 days.',
  }),
  [I('rod of the pact keeper')]: text(),
  [I('tentacle rod')]: numbers([
    magic('tentacle-rod', 'Tentacle Rod', { roll: '1d6', saveDc: 15 }),
  ]),

  // ---- Ropes and other gear ----
  [I('rope of climbing')]: text(),
  [I('rope of entanglement')]: numbers([
    magic('rope-of-entanglement', 'Rope of Entanglement', { saveDc: 15 }),
  ]),
  [I('rope of mending')]: text(),
  [I('ruby of the war mage')]: text(),
  [I('saddle of the cavalier')]: text(),
  [I('scarab of protection')]: numbers([
    charged('scarab-preservation', 'Scarab: Preservation', 'reaction', 1),
    savesAgainst('spells'),
  ]),
  [I('sending stones')]: fromData(),
  [I('slippers of spider climbing')]: numbers([{ type: 'speed', mode: 'climb', value: 'walk' }]),
  [I('sovereign glue')]: text(),
  [I('sphere of annihilation')]: text(),
  [I('spirit board')]: fromData(),
  [I('stone of controlling earth elementals')]: numbers(
    daily('earth-elemental-stone', 'Summon Earth Elemental', 'action'),
  ),
  [I('stone of good luck')]: fromData(),
  [I('talisman of pure good')]: numbers([
    charged('pure-rebuke', 'Pure Rebuke', 'action', 1, { saveDc: 20 }),
  ]),
  [I('talisman of the sphere')]: text(),
  [I('talisman of ultimate evil')]: numbers([
    charged('ultimate-end', 'Ultimate End', 'action', 1, { saveDc: 20 }),
  ]),
  [I('talking doll')]: text(),
  [I('tankard of sobriety')]: text(),
  [I('tome of clear thought')]: text(),
  [I('tome of leadership and influence')]: text(),
  [I('tome of understanding')]: text(),
  [I('tome of the stilled tongue')]: numbers(
    daily('stilled-tongue', 'Tome of the Stilled Tongue', 'bonus'),
  ),
  [I('universal solvent')]: text(),
  [I("veteran's cane")]: text(),
  [I('well of many worlds')]: text(),
  [I('wind fan')]: fromData(),
  [I('winged boots')]: toggled([
    {
      type: 'toggle',
      toggleId: 'winged-boots',
      name: 'Winged Boots',
      cost: [{ charges: 1 }, { action: 'action' }],
      effects: [{ type: 'speed', mode: 'fly', value: 30 }],
    },
  ]),
  [I('wings of flying')]: toggled(
    [
      {
        type: 'toggle',
        toggleId: 'wings-of-flying',
        name: 'Wings of Flying',
        cost: [{ action: 'action' }],
        effects: [{ type: 'speed', mode: 'fly', value: 60 }],
      },
    ],
    { notes: 'Once the wings vanish, they can be used again only after 1d12 hours.' },
  ),
  [I('wraps of unarmed power')]: text(),

  // ---- Scrolls (consumables) ----
  [I('scroll of protection')]: text(),
  [I('scroll of protection (aberrations)')]: text(),
  [I('scroll of protection (beasts)')]: text(),
  [I('scroll of protection (celestials)')]: text(),
  [I('scroll of protection (constructs)')]: text(),
  [I('scroll of protection (dragons)')]: text(),
  [I('scroll of protection (elementals)')]: text(),
  [I('scroll of protection (fey)')]: text(),
  [I('scroll of protection (fiends)')]: text(),
  [I('scroll of protection (giants)')]: text(),
  [I('scroll of protection (humanoids)')]: text(),
  [I('scroll of protection (monstrosities)')]: text(),
  [I('scroll of protection (oozes)')]: text(),
  [I('scroll of protection (plants)')]: text(),
  [I('scroll of protection (undead)')]: text(),
  [I('scroll of titan summoning')]: text(),
  [I('scroll of titan summoning (animal lord)')]: text(),
  [I('scroll of titan summoning (blob of annihilation)')]: text(),
  [I('scroll of titan summoning (colossus)')]: text(),
  [I('scroll of titan summoning (elemental cataclysm)')]: text(),
  [I('scroll of titan summoning (empyrean)')]: text(),
  [I('scroll of titan summoning (kraken)')]: text(),
  [I('scroll of titan summoning (tarrasque)')]: text(),
  [I('spell scroll')]: text(),
  [I('spell scroll (cantrip)')]: text(),
  [I('spell scroll (level 1)')]: text(),
  [I('spell scroll (level 2)')]: text(),
  [I('spell scroll (level 3)')]: text(),
  [I('spell scroll (level 4)')]: text(),
  [I('spell scroll (level 5)')]: text(),
  [I('spell scroll (level 6)')]: text(),
  [I('spell scroll (level 7)')]: text(),
  [I('spell scroll (level 8)')]: text(),
  [I('spell scroll (level 9)')]: text(),

  // ---- Shields ----
  [I('sentinel shield')]: numbers([
    { type: 'rollMode', target: 'initiative', mode: 'advantage' },
    { type: 'rollMode', target: 'skill:perception', mode: 'advantage' },
  ]),
  [I('shield of expression')]: text(),
  [I('shield of missile attraction')]: text({
    needs: 'resistance to damage from Ranged weapon attacks only',
  }),
  [I('shield of the cavalier')]: numbers(
    daily('protective-field', 'Protective Field', 'reaction'),
    {
      needs:
        'an attack a feature gives with a flat damage bonus (Forceful Bash adds 2 to 2d6 + Str)',
    },
  ),
  [I('spellguard shield')]: numbers([
    savesAgainst('spells and other magical effects'),
    { type: 'attackedMode', mode: 'disadvantage', against: 'spell attacks' },
  ]),

  // ---- Staffs ----
  [I('staff of adornment')]: text(),
  [I('staff of birdcalls')]: text(),
  [I('staff of flowers')]: text(),
  [I('staff of charming')]: numbers([
    charged('reflect-enchantment', 'Reflect Enchantment', 'reaction', 1),
    ...daily('resist-enchantment', 'Resist Enchantment', 'other'),
  ]),
  [I('staff of fire')]: fromData(),
  [I('staff of frost')]: fromData(),
  [I('staff of healing')]: fromData(),
  [I('staff of power')]: numbers([magic('staff-of-power-retributive', 'Retributive Strike')]),
  [I('staff of striking')]: numbers(
    [1, 2, 3].map((n) =>
      rider(
        'staff of striking',
        `staff-of-striking-${n}`,
        `Staff of Striking (${n} charge${n > 1 ? 's' : ''})`,
        `${n}d6`,
        'force',
        {
          filter: { itemIds: own('staff of striking'), range: 'melee' },
          optIn: true,
          cost: { charges: n },
        },
      ),
    ),
  ),
  [I('staff of swarming insects')]: numbers([charged('insect-cloud', 'Insect Cloud', 'action', 1)]),
  [I('staff of the adder')]: numbers(
    [action({ id: 'adder-head', name: 'Staff of the Adder: Snake Head', actionType: 'bonus' })],
    {
      needs:
        'an attack a feature gives with Wisdom to hit and no modifier to damage (the snake head: 1d6 piercing and 3d6 poison)',
    },
  ),
  [I('staff of the magi')]: numbers([
    action({ id: 'magi-absorption', name: 'Spell Absorption', actionType: 'reaction' }),
    magic('staff-of-the-magi-retributive', 'Retributive Strike'),
    savesAgainst('spells'),
  ]),
  [I('staff of the python')]: numbers([magic('staff-of-the-python', 'Staff of the Python')]),
  [I('staff of the woodlands')]: numbers([charged('tree-form', 'Tree Form', 'action', 1)]),
  [I('staff of thunder and lightning')]: numbers([
    uses('staff-lightning', 'Lightning', 1, 'dawn'),
    rider('staff of thunder and lightning', 'staff-lightning', 'Lightning', '2d6', 'lightning', {
      filter: { itemIds: own('staff of thunder and lightning'), range: 'melee' },
      optIn: true,
      cost: { resource: 'staff-lightning', amount: 1 },
    }),
    ...daily('staff-thunder', 'Thunder', 'other', { saveDc: 17 }),
    ...daily('staff-thunder-and-lightning', 'Thunder and Lightning', 'bonus', { saveDc: 17 }),
    ...daily('staff-lightning-strike', 'Lightning Strike', 'action', { roll: '9d6', saveDc: 17 }),
    ...daily('staff-thunderclap', 'Thunderclap', 'action', { roll: '2d6', saveDc: 17 }),
  ]),
  [I('staff of withering')]: numbers([
    rider('staff of withering', 'staff-of-withering', 'Staff of Withering', '2d10', 'necrotic', {
      optIn: true,
      cost: { charges: 1 },
    }),
  ]),

  // ---- Weapons ----
  [I('scimitar of speed')]: numbers([
    action({
      id: 'scimitar-of-speed',
      name: 'Scimitar of Speed',
      actionType: 'bonus',
      attack: { itemIds: own('scimitar of speed') },
    }),
  ]),
  [I('sun blade')]: numbers([
    rider('sun blade', 'sun-blade-undead', 'Sun Blade (Undead)', '1d8', 'radiant', { optIn: true }),
    action({ id: 'sun-blade', name: 'Sun Blade: Blade of Radiance', actionType: 'bonus' }),
  ]),
  [I('sword of answering')]: numbers([
    action({
      id: 'sword-of-answering',
      name: 'Sword of Answering',
      actionType: 'reaction',
      attack: { itemIds: own('sword of answering') },
    }),
  ]),
  [I('sword of kas')]: numbers(
    [
      {
        type: 'attackMod',
        label: 'Sword of Kas',
        filter: { itemIds: own('sword of kas') },
        critRange: 19,
      },
      rider('sword of kas', 'sword-of-kas-undead', 'Sword of Kas (Undead)', '2d10', 'slashing', {
        optIn: true,
      }),
      { type: 'rollBonus', target: 'initiative', value: '1d10' },
      { type: 'resistance', value: 'necrotic' },
    ],
    { notes: 'Its random properties are decided at the table.', unoffered: AT_TABLE },
  ),
  [I('sword of life stealing')]: text(),
  [I('sword of sharpness')]: text(),
  [I('sword of vengeance')]: numbers(
    onlyThisWeapon('sword of vengeance|xdmg', 'Sword of Vengeance'),
  ),
  [I('sword of wounding')]: text(),
  [I('vicious weapon')]: text(),
  [I('vorpal sword')]: text(),
  [I('silvered weapon')]: text(),
  [I('smoldering armor')]: text(),
  [I('sylvan talon')]: fromData(),
  [I('thunderous greatclub')]: numbers([
    { type: 'abilitySet', ability: 'str', value: 20 },
    rider('thunderous greatclub', 'thunderous-greatclub', 'Thunderous Greatclub', '1d8', 'thunder'),
    magic('clap-of-thunder', 'Clap of Thunder', { saveDc: 15 }),
    ...daily('greatclub-earthquake', 'Earthquake', 'action', { saveDc: 20 }),
  ]),
  [I('trident of fish command')]: fromData(),
  [I('walloping ammunition')]: text(),
  [I('wand of orcus')]: numbers(
    [
      rider('wand of orcus', 'wand-of-orcus', 'Wand of Orcus', '2d12', 'necrotic'),
      ...daily('call-undead', 'Call Undead', 'action'),
    ],
    { notes: 'Its random properties are decided at the table.', unoffered: AT_TABLE },
  ),
  [I('wave')]: numbers(
    [
      { type: 'rollMode', target: 'initiative', mode: 'advantage' },
      {
        type: 'grantSpells',
        spells: [
          {
            mode: 'innate',
            spell: { id: 'globe of invulnerability|xphb' },
            castAtLevel: 9,
            uses: { count: 1, recharge: 'dawn' },
          },
        ],
      },
    ],
    { notes: 'The extra damage on a roll of 20 is added by hand.' },
  ),
  [I('weapon of warning')]: numbers([
    { type: 'rollMode', target: 'initiative', mode: 'advantage' },
  ]),
  [I('whelm')]: numbers([
    rider('whelm', 'whelm-hurl', 'Whelm (thrown)', '1d8', 'force', { optIn: true }),
    ...daily('whelm-shock-wave', 'Shock Wave', 'action', { saveDc: 20 }),
  ]),

  // ---- Wands ----
  [I('wand of binding')]: fromData(),
  [I('wand of conducting')]: text(),
  [I('wand of enemy detection')]: numbers([
    charged('enemy-detection', 'Wand of Enemy Detection', 'action', 1),
  ]),
  [I('wand of fear')]: fromData(),
  [I('wand of fireballs')]: fromData(),
  [I('wand of lightning bolts')]: fromData(),
  [I('wand of magic detection')]: fromData(),
  [I('wand of magic missiles')]: fromData(),
  [I('wand of paralysis')]: numbers([
    charged('wand-of-paralysis', 'Wand of Paralysis', 'action', 1, { saveDc: 15 }),
  ]),
  [I('wand of polymorph')]: fromData(),
  [I('wand of pyrotechnics')]: text(),
  [I('wand of secrets')]: text(),
  [I('wand of the war mage')]: text(),
  [I('wand of web')]: fromData(),
  [I('wand of wonder')]: fromData(),
};
