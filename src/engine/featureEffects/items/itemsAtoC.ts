// 2024 Dungeon Master's Guide magic items, +1…, A, B and C (plan §10.3, step 7.12), checked
// against the text of each. The data already gives the +N bonuses, the resistances, the giant
// belts' Strength and the items' spells; these add what it leaves out: speeds and senses,
// Stealth advantage, the once-a-dawn properties as counters with their action, the bonuses the
// data puts on the wrong attacks (wraps, bracers), and a few toggles (Metal Shell, flying).
// Consumables, vehicles and properties decided at the table stay text.

import { refKey, type Effect } from '../../../schema/index.ts';
import { action, AT_TABLE, fromData, numbers, text, toggled, uses, when } from '../core/helpers.ts';
import type { FeatureEffectsMap, FeatureMapping } from '../types.ts';

const I = (id: string) => refKey({ kind: 'item', id: `${id}|xdmg` });

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
const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

const stealthAdvantage: Effect = { type: 'rollMode', target: 'skill:stealth', mode: 'advantage' };

/** A property usable once, then again at the next dawn, used with an action. */
function oncePerDawn(
  id: string,
  name: string,
  actionType: 'action' | 'bonus' = 'action',
): Effect[] {
  return [
    uses(id, name, 1, 'dawn'),
    action({ id, name, actionType, costs: [{ resource: id, amount: 1 }] }),
  ];
}

// ---- +1/+2/+3 items ----
/** Rod of the Pact Keeper: the bonuses are data; the once-a-rest slot comes back as an action. */
const pactKeeper = numbers(
  [
    uses('rod-of-the-pact-keeper', 'Rod of the Pact Keeper', 1, 'long'),
    action({
      id: 'rod-of-the-pact-keeper',
      name: 'Rod of the Pact Keeper: Regain a Slot',
      actionType: 'action',
      costs: [{ resource: 'rod-of-the-pact-keeper', amount: 1 }],
      outcomes: [{ regainSlot: { maxLevel: 9 } }],
    }),
  ],
  {
    needs:
      'regainSlot that can restore a Pact Magic slot; an item spell save DC bonus limited to one class',
  },
);

/** Wraps of Unarmed Power: the data bonus is for the item's own attacks, so it moves here. */
function wraps(n: number): FeatureMapping {
  return numbers(
    [
      {
        type: 'attackMod',
        label: `+${n} Wraps of Unarmed Power`,
        filter: { source: ['unarmed'] },
        toHit: n,
        damage: n,
      },
    ],
    { unoffered: AT_TABLE },
  );
}

// ---- Dragon Scale Mail: AC and resistance are data; the dragon sense is once a dawn ----
const dragonScale = numbers(oncePerDawn('dragon-scale-mail', 'Dragon Sense'), {
  notes: 'Advantage on saves against Dragons’ breath weapons is situational.',
});

// ---- Elemental summoners: once a dawn ----
const summoner = (id: string, name: string) => numbers(oncePerDawn(id, name));

// ---- Carpets: vehicles, not the character's speed ----
const carpet = text();

export const ITEMS_A_TO_C: FeatureEffectsMap = {
  // ---- +N ----
  [I('+1 ammunition')]: fromData(),
  [I('+2 ammunition')]: fromData(),
  [I('+3 ammunition')]: fromData(),
  [I('+1 armor')]: fromData(),
  [I('+2 armor')]: fromData(),
  [I('+3 armor')]: fromData(),
  [I('+1 shield (*)')]: fromData(),
  [I('+2 shield (*)')]: fromData(),
  [I('+3 shield (*)')]: fromData(),
  [I('+1 weapon')]: fromData(),
  [I('+2 weapon')]: fromData(),
  [I('+3 weapon')]: fromData(),
  [I('+1 wand of the war mage')]: fromData(),
  [I('+2 wand of the war mage')]: fromData(),
  [I('+3 wand of the war mage')]: fromData(),
  [I('+1 rod of the pact keeper')]: pactKeeper,
  [I('+2 rod of the pact keeper')]: pactKeeper,
  [I('+3 rod of the pact keeper')]: pactKeeper,
  [I('+1 wraps of unarmed power')]: wraps(1),
  [I('+2 wraps of unarmed power')]: wraps(2),
  [I('+3 wraps of unarmed power')]: wraps(3),

  // ---- A ----
  [I('adamantine armor')]: text(),
  [I('adamantine weapon')]: text(),
  [I('alchemy jug')]: text({ unoffered: AT_TABLE }),
  [I('ammunition of slaying')]: text(),
  [I('amulet of health')]: fromData(),
  [I('amulet of proof against detection and location')]: text(),
  [I('amulet of the planes')]: numbers([
    action({ id: 'amulet-of-the-planes', name: 'Amulet of the Planes', actionType: 'action' }),
  ]),
  [I('animated shield')]: numbers(
    [action({ id: 'animated-shield', name: 'Animate Shield', actionType: 'bonus' })],
    { needs: 'a way to free the hands a held Shield takes while it still counts for AC' },
  ),
  [I('apparatus of kwalish')]: text(),
  [I('armor of acid resistance')]: fromData(),
  [I('armor of cold resistance')]: fromData(),
  [I('armor of fire resistance')]: fromData(),
  [I('armor of force resistance')]: fromData(),
  [I('armor of lightning resistance')]: fromData(),
  [I('armor of necrotic resistance')]: fromData(),
  [I('armor of poison resistance')]: fromData(),
  [I('armor of psychic resistance')]: fromData(),
  [I('armor of radiant resistance')]: fromData(),
  [I('armor of thunder resistance')]: fromData(),
  [I('armor of resistance')]: numbers([
    { type: 'resistanceChoice', choice: { slot: 'damage-type', count: 1, from: DAMAGE_TYPES } },
  ]),
  [I('armor of gleaming')]: text(),
  [I('armor of invulnerability')]: toggled([
    ...(['bludgeoning', 'piercing', 'slashing'] as const).map((value): Effect => ({
      type: 'resistance',
      value,
    })),
    uses('armor-of-invulnerability', 'Metal Shell', 1, 'dawn'),
    {
      type: 'toggle',
      toggleId: 'armor-of-invulnerability',
      name: 'Metal Shell',
      cost: [{ resource: 'armor-of-invulnerability', amount: 1 }, { action: 'action' }],
      effects: (['bludgeoning', 'piercing', 'slashing'] as const).map((value): Effect => ({
        type: 'immunity',
        value,
      })),
    },
  ]),
  // The group entry; each armor's resistance and curse are in its own data.
  [I('armor of vulnerability')]: text(),
  [I('armor of vulnerability (bludgeoning)')]: fromData(),
  [I('armor of vulnerability (piercing)')]: fromData(),
  [I('armor of vulnerability (slashing)')]: fromData(),
  // Its extra AC is against ranged attacks only: off the shown AC, kept as a note.
  [I('arrow-catching shield')]: numbers(
    [
      { type: 'itemBonusOff', bonus: 'ac' },
      action({
        id: 'arrow-catching-shield',
        name: 'Arrow-Catching Shield',
        actionType: 'reaction',
      }),
    ],
    { notes: '+2 AC against ranged attacks (not in the AC shown).' },
  ),
  [I('axe of the dwarvish lords')]: numbers(
    [
      { type: 'sense', sense: 'darkvision', range: 60 },
      { type: 'abilityBonus', ability: 'con', value: 2, max: 20 },
      ...["brewer's supplies|xphb", "mason's tools|xphb", "smith's tools|xphb"].map(
        (value): Effect => ({ type: 'proficiency', category: 'tool', value }),
      ),
      {
        type: 'damageRider',
        id: 'axe-of-the-dwarvish-lords',
        name: 'Ranged hit',
        dice: '1d8',
        damageType: 'force',
        // The sheet lists the axe's attack once, so the thrown hit's extra damage is a tap.
        filter: { itemIds: ['axe of the dwarvish lords|xdmg'] },
        optIn: true,
      },
      ...oncePerDawn('axe-of-the-dwarvish-lords', 'Conjure Earth Elemental'),
    ],
    {
      notes:
        'The extra damage is larger against Giants, and a 20 on the d20 adds more; Travel the Depths waits three days.',
      needs: 'a Darkvision that adds to the range the character already has',
    },
  ),

  // ---- B ----
  [I("baba yaga's dancing broom")]: text(),
  [I('bag of beans')]: text(),
  [I('bag of devouring')]: text(),
  [I('bag of holding')]: text(),
  [I('bag of tricks')]: text(),
  [I('bag of tricks, gray')]: numbers(bagOfTricks()),
  [I('bag of tricks, rust')]: numbers(bagOfTricks()),
  [I('bag of tricks, tan')]: numbers(bagOfTricks()),
  [I('bead of force')]: text(),
  [I('bead of nourishment')]: text(),
  [I('bead of refreshment')]: text(),
  [I('belt of giant strength')]: text(),
  [I('belt of hill giant strength')]: fromData(),
  [I('belt of frost giant strength')]: fromData(),
  [I('belt of stone giant strength')]: fromData(),
  [I('belt of fire giant strength')]: fromData(),
  [I('belt of cloud giant strength')]: fromData(),
  [I('belt of storm giant strength')]: fromData(),
  [I('belt of dwarvenkind')]: numbers(
    [
      { type: 'proficiency', category: 'language', value: 'dwarvish' },
      { type: 'abilityBonus', ability: 'con', value: 2, max: 20 },
      { type: 'sense', sense: 'darkvision', range: 60 },
    ],
    {
      notes:
        'Darkvision and the poison benefits are for wearers who aren’t dwarves or duergar; the advantages are situational.',
    },
  ),
  [I('berserker axe')]: numbers([{ type: 'hpBonus', perLevel: 1 }], {
    notes: 'Cursed: attacks with other weapons have Disadvantage.',
    needs: 'disadvantage on attacks with every weapon but one item',
  }),
  [I('black dragon scale mail')]: dragonScale,
  [I('blue dragon scale mail')]: dragonScale,
  [I('brass dragon scale mail')]: dragonScale,
  [I('bronze dragon scale mail')]: dragonScale,
  [I('blackrazor')]: numbers([
    { type: 'conditionImmunity', value: 'charmed' },
    { type: 'conditionImmunity', value: 'frightened' },
    { type: 'sense', sense: 'blindsight', range: 30 },
  ]),
  [I('book of exalted deeds')]: toggled([
    { type: 'conditionImmunity', value: 'charmed' },
    { type: 'conditionImmunity', value: 'frightened' },
    { type: 'resistance', value: 'psychic' },
    {
      type: 'optionChoice',
      choice: { slot: 'studied', count: 1, from: ['studied'] },
      labels: ['Studied (80 hours)'],
    },
    {
      type: 'ifChoice',
      slot: 'studied',
      value: 'studied',
      effects: [
        { type: 'abilityBonus', ability: 'wis', value: 2, max: 24 },
        {
          type: 'toggle',
          toggleId: 'book-of-exalted-deeds-halo',
          name: 'Halo',
          cost: [{ action: 'bonus' }],
          effects: [{ type: 'rollMode', target: 'skill:persuasion', mode: 'advantage' }],
        },
      ],
    },
  ]),
  [I('book of vile darkness')]: numbers([
    { type: 'conditionImmunity', value: 'exhaustion' },
    {
      type: 'abilityChoice',
      choice: { slot: 'vile-increase', count: 1, from: [...ABILITIES] },
      value: 2,
      max: 24,
    },
    {
      type: 'abilityChoice',
      choice: { slot: 'vile-decrease', count: 1, from: [...ABILITIES] },
      value: -2,
    },
    action({ id: 'vile-speech', name: 'Vile Speech', actionType: 'action', roll: '3d6' }),
  ]),
  [I('boots of elvenkind')]: numbers([stealthAdvantage]),
  [I('boots of false tracks')]: text(),
  [I('boots of levitation')]: fromData(),
  [I('boots of speed')]: toggled(
    [
      uses('boots-of-speed', 'Boots of Speed (minutes)', 10, 'long', { pool: true }),
      {
        type: 'toggle',
        toggleId: 'boots-of-speed',
        name: 'Boots of Speed',
        cost: [{ action: 'bonus' }],
        effects: [
          {
            type: 'note',
            text: 'Speed doubled; Opportunity Attacks against you have Disadvantage.',
          },
        ],
      },
    ],
    { needs: 'a Speed that doubles the current Speed (no formula reads Speed)' },
  ),
  [I('boots of striding and springing')]: numbers([{ type: 'speed', mode: 'walk', value: 30 }], {
    needs: 'ignoring the Speed loss from Heavy Armor and carried weight',
  }),
  [I('boots of the winterlands')]: fromData(),
  [I('bowl of commanding water elementals')]: summoner(
    'bowl-of-commanding-water-elementals',
    'Summon Water Elemental',
  ),
  [I('brazier of commanding fire elementals')]: summoner(
    'brazier-of-commanding-fire-elementals',
    'Summon Fire Elemental',
  ),
  [I('bracers of archery')]: numbers([
    { type: 'proficiency', category: 'weapon', value: 'longbow|xphb' },
    { type: 'proficiency', category: 'weapon', value: 'shortbow|xphb' },
    {
      type: 'attackMod',
      label: 'Bracers of Archery',
      filter: { itemIds: ['longbow|xphb', 'shortbow|xphb'] },
      damage: 2,
    },
  ]),
  // +2 AC only with no armor and no Shield.
  [I('bracers of defense')]: numbers([
    { type: 'itemBonusOff', bonus: 'ac' },
    when({ all: [{ armor: 'none' }, { shield: false }] }, [{ type: 'acBonus', value: 2 }]),
  ]),
  [I('brooch of shielding')]: fromData(),
  [I('broom of flying')]: toggled(
    [
      {
        type: 'toggle',
        toggleId: 'broom-of-flying',
        name: 'Riding the Broom of Flying',
        cost: [{ action: 'action' }],
        effects: [{ type: 'speed', mode: 'fly', value: 50 }],
      },
    ],
    { notes: 'Its Fly Speed drops to 30 feet when it carries more than 200 pounds.' },
  ),

  // ---- C ----
  [I('candle of invocation')]: text(),
  [I('candle of the deep')]: text(),
  [I('cap of water breathing')]: text(),
  [I('cape of the mountebank')]: fromData(),
  [I('carpet of flying')]: carpet,
  [I('carpet of flying, 3 ft. × 5 ft.')]: carpet,
  [I('carpet of flying, 4 ft. × 6 ft.')]: carpet,
  [I('carpet of flying, 5 ft. × 7 ft.')]: carpet,
  [I('carpet of flying, 6 ft. × 9 ft.')]: carpet,
  [I('cast-off armor')]: text(),
  [I('cauldron of rebirth')]: text(),
  [I('censer of controlling air elementals')]: summoner(
    'censer-of-controlling-air-elementals',
    'Summon Air Elemental',
  ),
  [I("charlatan's die")]: text(),
  [I('chime of opening')]: numbers([
    uses('chime-of-opening', 'Chime of Opening', 10, 'none'),
    {
      type: 'grantSpells',
      spells: [
        {
          mode: 'innate',
          spell: { id: 'knock|xphb' },
          uses: { resource: 'chime-of-opening', cost: 1 },
        },
      ],
    },
  ]),
  [I('circlet of blasting')]: fromData(),
  [I('cloak of arachnida')]: numbers([{ type: 'speed', mode: 'climb', value: 'walk' }]),
  [I('cloak of billowing')]: text(),
  [I('cloak of displacement')]: text({
    needs: 'disadvantage on attack rolls made against the character',
  }),
  [I('cloak of elvenkind')]: numbers([stealthAdvantage]),
  [I('cloak of invisibility')]: numbers([
    action({
      id: 'cloak-of-invisibility',
      name: 'Cloak of Invisibility',
      actionType: 'action',
      costs: [{ charges: 1 }],
    }),
  ]),
  [I('cloak of many fashions')]: text(),
  [I('cloak of protection')]: fromData(),
  [I('cloak of the bat')]: toggled(
    [
      stealthAdvantage,
      {
        type: 'toggle',
        toggleId: 'cloak-of-the-bat',
        name: 'Cloak of the Bat: Flying',
        effects: [{ type: 'speed', mode: 'fly', value: 40 }],
      },
    ],
    { notes: 'It flies only in Dim Light or Darkness.' },
  ),
  [I('cloak of the manta ray')]: numbers([{ type: 'speed', mode: 'swim', value: 60 }]),
  [I('clockwork amulet')]: numbers([
    action({
      id: 'clockwork-amulet',
      name: 'Clockwork Amulet',
      actionType: 'other',
      costs: [{ charges: 1 }],
    }),
  ]),
  [I('clothes of mending')]: text(),
  [I('copper dragon scale mail')]: dragonScale,
  [I('crystal ball')]: numbers([innateAtWill(['scrying|xphb'])], {
    notes: 'Its save DC is fixed at 17.',
  }),
  [I('crystal ball of mind reading')]: numbers(
    [innateAtWill(['scrying|xphb', 'detect thoughts|xphb'])],
    { notes: 'Its save DC is fixed at 17; Detect Thoughts works only through the sensor.' },
  ),
  [I('crystal ball of telepathy')]: fromData(),
  [I('crystal ball of true seeing')]: numbers([innateAtWill(['scrying|xphb'])], {
    notes: 'Its save DC is fixed at 17; the Truesight is around the sensor, not you.',
  }),
  [I('cube of force')]: fromData(),
  [I('cube of summoning')]: summoner('cube-of-summoning', 'Cube of Summoning'),
  [I('cubic gate')]: numbers([
    {
      type: 'grantSpells',
      spells: ['gate|xphb', 'plane shift|xphb'].map((id) => ({
        mode: 'innate' as const,
        spell: { id },
        uses: { charges: 1 },
      })),
    },
  ]),
};

function bagOfTricks(): Effect[] {
  return [
    uses('bag-of-tricks', 'Bag of Tricks', 3, 'dawn'),
    action({
      id: 'bag-of-tricks',
      name: 'Bag of Tricks',
      actionType: 'action',
      costs: [{ resource: 'bag-of-tricks', amount: 1 }],
    }),
  ];
}

function innateAtWill(ids: string[]): Effect {
  return {
    type: 'grantSpells',
    spells: ids.map((id) => ({ mode: 'innate' as const, spell: { id }, uses: 'atWill' as const })),
  };
}
