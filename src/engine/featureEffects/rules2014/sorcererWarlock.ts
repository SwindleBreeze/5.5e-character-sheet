// Characters on 2014 rules (plan step 8.6): the 2014 Sorcerer and Warlock's own features, and the
// features of their subclasses that a 2024 book reprints (Draconic, Wild Magic, Shadow, Aberrant
// Mind, Clockwork Soul; Archfey, Fiend, Great Old One, Celestial, Undead). The other 2014
// subclasses' features share their keys with step 8.3 (`legacy/casters.ts`); only their level-1
// entries are new here. Where a 2024 mapping fits the 2014 rule, the 2014 key reuses it.
// Sorcery Points keep the 2024 resource id, so the subclasses' costs spend the same counter;
// Metamagic, invocation, Pact Boon and Mystic Arcanum picks and the slots come from the data.

import type { Effect, Ref } from '../../../schema/index.ts';
import type { FeatureEffectsMap, FeatureMapping } from '../types.ts';
import {
  action,
  AT_TABLE,
  dc,
  fromData,
  numbers,
  TARGETS,
  text,
  toggled,
  uses,
} from '../core/helpers.ts';
import { SORCERER } from '../core/sorcerer.ts';
import { WARLOCK } from '../core/warlock.ts';
import { SUP_SORCERER } from '../supplements/sorcerer.ts';
import { SUP_WARLOCK } from '../supplements/warlock.ts';

const C = (cls: string, id: string, level: number, src = 'phb') =>
  `classFeature:${id}|${cls}|phb|${level}|${src}` as const;
const SC = (id: string, level: number, src?: string) => C('sorcerer', id, level, src);
const WC = (id: string, level: number, src?: string) => C('warlock', id, level, src);
const S = (cls: string, sub: string, src: string) => (id: string, level: number) =>
  `subclassFeature:${id}|${cls}|phb|${sub}|${src}|${level}|${src}` as const;
const DRACONIC = S('sorcerer', 'draconic', 'phb');
const WILD = S('sorcerer', 'wild', 'phb');
const SHADOW = S('sorcerer', 'shadow', 'xge');
const ABERRANT = S('sorcerer', 'aberrant mind', 'tce');
const CLOCKWORK = S('sorcerer', 'clockwork soul', 'tce');
const ARCHFEY = S('warlock', 'archfey', 'phb');
const FIEND = S('warlock', 'fiend', 'phb');
const GOO = S('warlock', 'great old one', 'phb');
const CELESTIAL = S('warlock', 'celestial', 'xge');
const UNDEAD = S('warlock', 'undead', 'vrgr');

/** A 2024 mapping whose rule the 2014 feature shares; a missing key fails at load. */
function same(map: FeatureEffectsMap, key: string): FeatureMapping {
  const mapping = map[key as keyof typeof map];
  if (!mapping) throw new Error(`rules2014: no 2024 mapping ${key}`);
  return mapping;
}
const SOR24 = (sub: string, id: string, level: number) =>
  same(SORCERER, `subclassFeature:${id}|sorcerer|xphb|${sub}|xphb|${level}|xphb`);
const WAR24 = (sub: string, id: string, level: number) =>
  same(WARLOCK, `subclassFeature:${id}|warlock|xphb|${sub}|xphb|${level}|xphb`);

const points = (amount: number) => ({ resource: 'sorcery-points', amount });

/** Uses per rest, and the action that spends one. */
function usesAction(
  id: string,
  name: string,
  max: string | number,
  recharge: 'short' | 'long' | 'none',
  def: Partial<Parameters<typeof action>[0]> = {},
): Effect[] {
  return [
    uses(id, name, max, recharge),
    action({ id, name, actionType: 'other', costs: [{ resource: id, amount: 1 }], ...def }),
  ];
}

/** The expanded spell list is the subclass data's; the picks are the class's own. */
const EXPANDED = "Expanded spells are picked with the Warlock's own spells.";
/** The 2014 rules give each Ability Score Improvement its pick (`legacyEntityEffects`). */
const ASI: FeatureMapping = {
  ...fromData(),
  unoffered: 'The 2014 rules add its pick (+2, +1/+1 or a feat) when the level is taken.',
};
const MANIFESTATION = 'Its table is flavor: note what you picked in your Description.';

// ---- Draconic Bloodline: the ancestor's damage type is a pick Elemental Affinity reads ----
const DRAGONS = [
  ['black', 'Black', 'acid'],
  ['blue', 'Blue', 'lightning'],
  ['brass', 'Brass', 'fire'],
  ['bronze', 'Bronze', 'lightning'],
  ['copper', 'Copper', 'acid'],
  ['gold', 'Gold', 'fire'],
  ['green', 'Green', 'poison'],
  ['red', 'Red', 'fire'],
  ['silver', 'Silver', 'cold'],
  ['white', 'White', 'cold'],
] as const;
const dragonAncestor: Ref = {
  kind: 'subclassFeature',
  id: 'dragon ancestor|sorcerer|phb|draconic|phb|1|phb',
};

const ALL_DAMAGE = [
  'acid',
  'bludgeoning',
  'cold',
  'fire',
  'force',
  'lightning',
  'necrotic',
  'piercing',
  'poison',
  'psychic',
  'radiant',
  'slashing',
  'thunder',
];
const UMBRAL_RESISTS = ALL_DAMAGE.filter((t) => t !== 'force' && t !== 'radiant');

const dread = { toggle: 'form-of-dread' };

export const RULES_2014_SORCERER_WARLOCK: FeatureEffectsMap = {
  // ---- Sorcerer ----
  [SC('spellcasting', 1)]: text(),
  [SC('sorcerous origin', 1)]: text(),
  // The Sorcery Points counter, as in 2024: the 2014 table has the same column.
  [SC('font of magic', 2)]: same(SORCERER, 'classFeature:font of magic|sorcerer|xphb|2|xphb'),
  [SC('sorcery points', 2)]: text({ notes: 'Tracked with Font of Magic.' }),
  [SC('flexible casting', 2)]: text({
    notes: 'Turning slots into Sorcery Points and back is done at the table.',
    needs: 'an outcome that creates a spell slot, and one that restores points by the slot spent',
  }),
  ...Object.fromEntries([3, 10, 17].map((level) => [SC('metamagic', level), text()])),
  [SC('metamagic options', 3, 'tce')]: text(),
  ...Object.fromEntries(
    [4, 8, 12, 16, 19].map((level) => [SC('ability score improvement', level), ASI]),
  ),
  [SC('sorcerous versatility', 4, 'tce')]: text(),
  [SC('magical guidance', 5, 'tce')]: numbers([
    action({
      id: 'magical-guidance',
      name: 'Magical Guidance',
      actionType: 'other',
      costs: [points(1)],
    }),
  ]),
  ...Object.fromEntries(
    [6, 14, 18].map((level) => [SC('sorcerous origin feature', level), text()]),
  ),
  [SC('sorcerous restoration', 20)]: numbers(
    [
      action({
        id: 'sorcerous-restoration',
        name: 'Sorcerous Restoration',
        actionType: 'other',
        outcomes: [{ restore: { resource: 'sorcery-points', amount: 4 } }],
      }),
    ],
    {
      notes: 'Use it when you finish a Short Rest.',
      needs: 'a Short Rest that restores part of a resource',
    },
  ),

  // ---- Draconic Bloodline ----
  [DRACONIC('draconic bloodline', 1)]: text(),
  [DRACONIC('dragon ancestor', 1)]: numbers(
    [
      {
        type: 'optionChoice',
        choice: { slot: 'ancestor', count: 1, from: DRAGONS.map(([id]) => id) },
        labels: DRAGONS.map(([, name, type]) => `${name} (${type})`),
      },
      { type: 'proficiency', category: 'language', value: 'draconic' },
    ],
    { notes: 'Double your Proficiency Bonus by hand on Charisma checks with dragons.' },
  ),
  // 2014: AC 13 + Dexterity (the 2024 feature adds Charisma instead).
  [DRACONIC('draconic resilience', 1)]: numbers([
    { type: 'hpBonus', flat: 'level.sorcerer' },
    {
      type: 'acFormula',
      name: 'Draconic Resilience',
      base: 13,
      addAbilities: ['dex'],
      shield: true,
    },
  ]),
  [DRACONIC('elemental affinity', 6)]: toggled(
    [
      {
        type: 'toggle',
        toggleId: 'elemental-affinity',
        name: 'Elemental Affinity resistance',
        cost: [points(1)],
        effects: DRAGONS.map(([id, , value]): Effect => ({
          type: 'ifChoice',
          owner: dragonAncestor,
          slot: 'ancestor',
          value: id,
          effects: [{ type: 'resistance', value }],
        })),
      },
    ],
    {
      notes:
        "Add your Charisma modifier to one damage roll of a spell of your ancestor's type by hand. Switch the resistance off after an hour.",
      needs: 'a spell filter by damage type (or healing) for spellMod damage bonuses',
    },
  ),
  [DRACONIC('dragon wings', 14)]: toggled(
    [
      {
        type: 'toggle',
        toggleId: 'dragon-wings',
        name: 'Dragon Wings',
        cost: [{ action: 'bonus' }],
        effects: [{ type: 'speed', mode: 'fly', value: 'walk' }],
      },
    ],
    { notes: 'Armor not made for the wings keeps them from sprouting.' },
  ),
  [DRACONIC('draconic presence', 18)]: numbers([
    action({
      id: 'draconic-presence',
      name: 'Draconic Presence',
      actionType: 'action',
      costs: [points(5)],
      saveDc: dc('cha'),
    }),
  ]),

  // ---- Wild Magic ----
  [WILD('wild magic', 1)]: text(),
  [WILD('wild magic surge', 1)]: SOR24('wild magic', 'wild magic surge', 3),
  [WILD('tides of chaos', 1)]: SOR24('wild magic', 'tides of chaos', 3),
  // 2014: 2 Sorcery Points (1 in 2024).
  [WILD('bend luck', 6)]: numbers([
    action({
      id: 'bend-luck',
      name: 'Bend Luck',
      actionType: 'reaction',
      costs: [points(2)],
      roll: '1d4',
    }),
  ]),
  [WILD('controlled chaos', 14)]: SOR24('wild magic', 'controlled chaos', 14),
  [WILD('spell bombardment', 18)]: text({ unoffered: AT_TABLE }),

  // ---- Shadow Magic ----
  [SHADOW('shadow magic', 1)]: text(),
  [SHADOW('eyes of the dark', 1)]: numbers([
    { type: 'sense', sense: 'darkvision', range: 120 },
    {
      type: 'grantSpells',
      spells: [
        {
          mode: 'innate',
          ability: 'cha',
          atLevel: 3,
          uses: { resourceName: 'Sorcery Points', cost: 2 },
          spell: { id: 'darkness|phb' },
        },
      ],
    },
  ]),
  [SHADOW('strength of the grave', 1)]: numbers(
    usesAction('strength-of-the-grave', 'Strength of the Grave', 1, 'long'),
    { notes: 'The save is a Charisma save against 5 + the damage taken; set 1 Hit Point by hand.' },
  ),
  [SHADOW('hound of ill omen', 6)]: numbers(
    [
      action({
        id: 'hound-of-ill-omen',
        name: 'Hound of Ill Omen',
        actionType: 'bonus',
        costs: [points(3)],
      }),
    ],
    { notes: "The hound isn't tracked: note its Hit Points.", unoffered: TARGETS },
  ),
  [SHADOW('shadow walk', 14)]: same(
    SUP_SORCERER,
    'subclassFeature:shadow walk|sorcerer|xphb|shadow|rhw|14|rhw',
  ),
  // 2014: only for Sorcery Points (no free use).
  [SHADOW('umbral form', 18)]: toggled([
    {
      type: 'toggle',
      toggleId: 'umbral-form',
      name: 'Umbral Form',
      cost: [points(6), { action: 'bonus' }],
      endsOn: ['shortRest', 'longRest'],
      effects: UMBRAL_RESISTS.map((value): Effect => ({ type: 'resistance', value })),
    },
  ]),

  // ---- Aberrant Mind ----
  [ABERRANT('aberrant mind', 1)]: text(),
  [ABERRANT('psionic spells', 1)]: text(),
  [ABERRANT('telepathic speech', 1)]: SOR24('aberrant', 'telepathic speech', 3),
  [ABERRANT('psionic sorcery', 6)]: text(),
  [ABERRANT('psychic defenses', 6)]: SOR24('aberrant', 'psychic defenses', 6),
  [ABERRANT('revelation in flesh', 14)]: SOR24('aberrant', 'revelation in flesh', 14),
  [ABERRANT('warping implosion', 18)]: SOR24('aberrant', 'warping implosion', 18),

  // ---- Clockwork Soul ----
  [CLOCKWORK('clockwork soul', 1)]: text(),
  [CLOCKWORK('clockwork magic', 1)]: text({ unoffered: MANIFESTATION }),
  [CLOCKWORK('restore balance', 1)]: SOR24('clockwork', 'restore balance', 3),
  [CLOCKWORK('bastion of law', 6)]: SOR24('clockwork', 'bastion of law', 6),
  [CLOCKWORK('trance of order', 14)]: SOR24('clockwork', 'trance of order', 14),
  [CLOCKWORK('clockwork cavalcade', 18)]: SOR24('clockwork', 'clockwork cavalcade', 18),

  // ---- The other 2014 origins: their level-1 entry (the rest is step 8.3's) ----
  [S('sorcerer', 'pyromancer (psk)', 'psk')('pyromancer (psk)', 1)]: text(),
  [S('sorcerer', 'divine soul', 'xge')('divine soul', 1)]: text(),
  [S('sorcerer', 'storm', 'xge')('storm sorcery', 1)]: text(),
  [S('sorcerer', 'lunar', 'dsotdq')('lunar sorcery', 1)]: text(),

  // ---- Warlock ----
  [WC('pact magic', 1)]: text(),
  [WC('otherworldly patron', 1)]: text(),
  [WC('eldritch invocations', 2)]: text(),
  [WC('pact boon', 3)]: text(),
  ...Object.fromEntries(
    [4, 8, 12, 16, 19].map((level) => [WC('ability score improvement', level), ASI]),
  ),
  [WC('eldritch versatility', 4, 'tce')]: text(),
  ...Object.fromEntries(
    [6, 10, 14].map((level) => [WC('otherworldly patron feature', level), text()]),
  ),
  ...Object.fromEntries(
    [6, 7, 8, 9].map((spell) => [WC(`mystic arcanum (${spell}th level)`, 2 * spell - 1), text()]),
  ),
  // Every Pact Magic slot back: a Warlock 20 has four.
  [WC('eldritch master', 20)]: numbers(
    usesAction('eldritch-master', 'Eldritch Master', 1, 'long', {
      outcomes: Array.from({ length: 4 }, () => ({ regainSlot: { maxLevel: 5, pact: true } })),
    }),
  ),

  // ---- The Archfey ----
  [ARCHFEY('the archfey', 1)]: text({ unoffered: EXPANDED }),
  [ARCHFEY('fey presence', 1)]: numbers(
    usesAction('fey-presence', 'Fey Presence', 1, 'short', {
      actionType: 'action',
      saveDc: dc('cha'),
    }),
  ),
  [ARCHFEY('misty escape', 6)]: numbers(
    usesAction('misty-escape', 'Misty Escape', 1, 'short', { actionType: 'reaction' }),
  ),
  // 2014: no uses (the 2024 feature has one per Long Rest).
  [ARCHFEY('beguiling defenses', 10)]: numbers([
    { type: 'conditionImmunity', value: 'charmed' },
    action({
      id: 'beguiling-defenses',
      name: 'Beguiling Defenses',
      actionType: 'reaction',
      saveDc: dc('cha'),
    }),
  ]),
  [ARCHFEY('dark delirium', 14)]: numbers(
    usesAction('dark-delirium', 'Dark Delirium', 1, 'short', {
      actionType: 'action',
      saveDc: dc('cha'),
    }),
    { unoffered: TARGETS },
  ),

  // ---- The Fiend ----
  [FIEND('the fiend', 1)]: text({ unoffered: EXPANDED }),
  [FIEND("dark one's blessing", 1)]: WAR24('fiend', "dark one's blessing", 3),
  // 2014: once per Short Rest.
  [FIEND("dark one's own luck", 6)]: numbers(
    usesAction('dark-ones-own-luck', "Dark One's Own Luck", 1, 'short', { roll: '1d10' }),
  ),
  // 2014: any damage type.
  [FIEND('fiendish resilience', 10)]: numbers(
    [
      {
        type: 'resistanceChoice',
        choice: { slot: 'resilience', count: 1, from: ALL_DAMAGE, retrain: 'shortRest' },
      },
    ],
    {
      notes: 'Magical and silvered weapons ignore this resistance.',
      needs: 'a resistance that magical and silvered weapons ignore',
    },
  ),
  // 2014: 10d10, once per Long Rest.
  [FIEND('hurl through hell', 14)]: numbers(
    usesAction('hurl-through-hell', 'Hurl Through Hell', 1, 'long', { roll: '10d10' }),
  ),

  // ---- The Great Old One ----
  [GOO('the great old one', 1)]: text({ unoffered: EXPANDED }),
  [GOO('awakened mind', 1)]: text(),
  [GOO('entropic ward', 6)]: numbers(
    usesAction('entropic-ward', 'Entropic Ward', 1, 'short', { actionType: 'reaction' }),
  ),
  [GOO('thought shield', 10)]: WAR24('great old one', 'thought shield', 10),
  [GOO('create thrall', 14)]: text(),

  // ---- The Celestial ----
  [CELESTIAL('the celestial', 1)]: text({ unoffered: EXPANDED }),
  [CELESTIAL('bonus cantrips', 1)]: text(),
  [CELESTIAL('healing light', 1)]: WAR24('celestial', 'healing light', 3),
  [CELESTIAL('radiant soul', 6)]: WAR24('celestial', 'radiant soul', 6),
  [CELESTIAL('celestial resilience', 10)]: WAR24('celestial', 'celestial resilience', 10),
  [CELESTIAL('searing vengeance', 14)]: WAR24('celestial', 'searing vengeance', 14),

  // ---- The Undead ----
  [UNDEAD('the undead', 1)]: text({ unoffered: EXPANDED }),
  // 2014: Proficiency Bonus uses (the 2024 feature has Charisma modifier uses).
  [UNDEAD('form of dread', 1)]: toggled(
    [
      uses('form-of-dread', 'Form of Dread', 'pb', 'long'),
      {
        type: 'toggle',
        toggleId: 'form-of-dread',
        name: 'Form of Dread',
        cost: [{ resource: 'form-of-dread', amount: 1 }, { action: 'bonus' }],
        onActivate: [{ tempHp: '1d10 + level.warlock' }],
        endsOn: ['shortRest', 'longRest'],
        effects: [{ type: 'conditionImmunity', value: 'frightened' }],
      },
    ],
    {
      notes: 'Frightening a creature you hit (a Wisdom save, once a turn) is rolled at the table.',
      unoffered: TARGETS,
    },
  ),
  [UNDEAD('grave touched', 6)]: same(
    SUP_WARLOCK,
    'subclassFeature:grave touched|warlock|xphb|undead|rhw|6|rhw',
  ),
  // 2014: no save, and the use comes back after 1d4 Long Rests.
  [UNDEAD('necrotic husk', 10)]: numbers(
    [
      { type: 'resistance', value: 'necrotic' },
      { type: 'when', when: dread, effects: [{ type: 'immunity', value: 'necrotic' }] },
      ...usesAction('necrotic-husk', 'Necrotic Husk', 1, 'none', {
        roll: '2d10 + level.warlock',
      }),
    ],
    {
      notes:
        'Set 1 Hit Point and add the Exhaustion level by hand; restore the use once its Long Rests have passed.',
      needs: 'a recharge over several rests',
      unoffered: TARGETS,
    },
  ),
  [UNDEAD('spirit projection', 14)]: toggled(
    [
      uses('spirit-projection', 'Spirit Projection', 1, 'long'),
      {
        type: 'toggle',
        toggleId: 'spirit-projection',
        name: 'Spirit Projection',
        cost: [{ resource: 'spirit-projection', amount: 1 }, { action: 'action' }],
        endsOn: ['longRest'],
        effects: ['bludgeoning', 'piercing', 'slashing'].map((value): Effect => ({
          type: 'resistance',
          value,
        })),
      },
    ],
    { notes: 'Healing from the necrotic damage you deal is added by hand.' },
  ),

  // ---- The other 2014 patrons: their level-1 entry (the rest is step 8.3's) ----
  [S('warlock', 'undying', 'scag')('the undying', 1)]: text({ unoffered: EXPANDED }),
  [S('warlock', 'hexblade', 'xge')('the hexblade', 1)]: text({ unoffered: EXPANDED }),
  [S('warlock', 'fathomless', 'tce')('the fathomless', 1)]: text({ unoffered: EXPANDED }),
  [S('warlock', 'genie', 'tce')('the genie', 1)]: text({
    unoffered: `The kind is the subclass's own pick, with its spells. ${EXPANDED}`,
  }),
};
