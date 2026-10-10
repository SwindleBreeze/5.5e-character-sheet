// Characters on 2014 rules (plan step 8.6): the 2014 Wizard and the 2014 Artificer's own features, and the features of
// its subclasses that a 2024 book reprints. Where a 2024 mapping fits the 2014 rule, the 2014 key
// reuses it.
//
// Wizard (PHB): the eight schools gain their features at 2, 6, 10 and 14; the Bladesinger (TCE)
// and the level-2 entries of War Magic, Chronurgy, Graviturgy and Order of Scribes too (their
// other features are 8.3's, keyed the same). Arcane Recovery, the Abjurer's ward, Sculpt Spells,
// Illusory Reality, Signature Spells and the Bladesinger's Extra Attack and Song of Defense read
// the same in both books and reuse the 2024 mappings. Spell Mastery's free casts need the spell
// prepared on 2014 rules; Portent starts at 2; Empowered Evocation names the 2014 caster.
//
// Artificer (TCE): infusions known come from the class data (its optional feature progression),
// the specialists' spells from the subclass data; Magic Item Adept and Master, Spell-Storing Item
// and several specialist features read as the 2024 Artificer's and reuse those mappings. The
// Experimental Elixir count, the cannon's dice, Flash of Genius and the Armorer's models differ.

import type { AttackFilter, Effect, Predicate } from '../../../schema/index.ts';
import type { FeatureEffectsMap, FeatureMapping } from '../types.ts';
import {
  action,
  AT_TABLE,
  dc,
  fromData,
  NO_CHOICE,
  numbers,
  restoredBy,
  TARGETS,
  text,
  toggled,
  uses,
  when,
} from '../core/helpers.ts';
import { CORE_LEVELS_4_TO_20 } from '../core/levels4to20.ts';
import { WIZARD } from '../core/wizard.ts';
import { SUP_ARTIFICER } from '../supplements/artificer.ts';
import { SUP_ARTIFICER_SUBCLASSES } from '../supplements/artificerSubclasses.ts';
import { SUP_WIZARD } from '../supplements/wizard.ts';

/** A 2024 mapping reused for a 2014 key: the rule reads the same. */
function same(map: FeatureEffectsMap, key: string): FeatureMapping {
  const mapping = map[key as keyof FeatureEffectsMap];
  if (!mapping) throw new Error(`No 2024 mapping to reuse: ${key}`);
  return mapping;
}

// ---- Keys ----
const WIZ = (id: string, level: number, src = 'phb') =>
  `classFeature:${id}|wizard|phb|${level}|${src}` as const;
const SCHOOL = (sub: string, src: string) => (id: string, level: number) =>
  `subclassFeature:${id}|wizard|phb|${sub}|${src}|${level}|${src}` as const;
const ABJ = SCHOOL('abjuration', 'phb');
const CONJ = SCHOOL('conjuration', 'phb');
const DIV = SCHOOL('divination', 'phb');
const ENCH = SCHOOL('enchantment', 'phb');
const EVO = SCHOOL('evocation', 'phb');
const ILL = SCHOOL('illusion', 'phb');
const NEC = SCHOOL('necromancy', 'phb');
const TRANS = SCHOOL('transmutation', 'phb');
const BLADE = SCHOOL('bladesinging', 'tce');

const ART = (id: string, level: number) => `classFeature:${id}|artificer|tce|${level}|tce` as const;
const SPEC = (sub: string) => (id: string, level: number) =>
  `subclassFeature:${id}|artificer|tce|${sub}|tce|${level}|tce` as const;
const ALCH = SPEC('alchemist');
const ARMOR = SPEC('armorer');
const ARTY = SPEC('artillerist');
const SMITH = SPEC('battle smith');

// 2024 keys reused.
const WIZ24 = (id: string, level: number) => `classFeature:${id}|wizard|xphb|${level}|xphb`;
const SCHOOL24 = (sub: string, id: string, level: number) =>
  `subclassFeature:${id}|wizard|xphb|${sub}|xphb|${level}|xphb`;
const BLADE24 = (id: string, level: number) =>
  `subclassFeature:${id}|wizard|xphb|bladesinger|frhof|${level}|frhof`;
const ART24 = (id: string, level: number) => `classFeature:${id}|artificer|efa|${level}|efa`;
const SPEC24 = (sub: string, id: string, level: number) =>
  `subclassFeature:${id}|artificer|efa|${sub}|efa|${level}|efa`;

// ---- Shared bits ----
const intUses = 'max(1, mod.int)';
const anySlot = { slot: { minLevel: 1 } };
const spend = (resource: string) => ({ resource, amount: 1 });
const tool = (id: string): Effect => ({ type: 'proficiency', category: 'tool', value: id });

/** Free casts of a spell, on the grant's own counter, cast with Intelligence. */
function freeCasts(id: string, count: string | number, recharge: 'short' | 'long'): Effect {
  return {
    type: 'grantSpells',
    spells: [{ mode: 'innate', ability: 'int', uses: { count, recharge }, spell: { id } }],
  };
}

/** Once per Long Rest, or again when a spell slot is spent, with an action. */
function oncePerRestOrSlot(id: string, name: string): Effect[] {
  return [
    uses(id, name, 1, 'long'),
    restoredBy(id, anySlot),
    action({ id, name, actionType: 'action', costs: [spend(id)] }),
  ];
}

/** The 2014 Ability Score Improvement: its pick (+2, +1/+1 or a feat) comes from the 2014 rules. */
const asi = (): FeatureMapping => ({
  ...fromData(),
  unoffered: 'The 2014 rules offer the pick: +2, +1 and +1, or a feat.',
});

/** Specialist tools: a fallback pick only when the tool is already known. */
const FALLBACK_TOOL =
  "Only when the granted tool is already known: pick another Artisan's Tools at the table.";

// Bladesong: no medium or heavy armor, no shield.
const bladesongArmor: Predicate = {
  all: [{ any: [{ armor: 'none' }, { armor: 'light' }] }, { shield: false }],
};
const bladesong = { toggle: 'bladesong' };

// Armorer: the model is picked when Arcane Armor is switched on.
const model = (option: string) => ({ toggle: 'arcane-armor', option });
const LAUNCHER: AttackFilter = { tags: ['feature:lightning-launcher'] };
const MODEL_ABILITY = "Uses Intelligence instead of Strength or Dexterity when it's better.";

/** Transmuter's Stone benefits (the resistance is picked with the benefit). */
const STONE_RESISTANCES = ['acid', 'cold', 'fire', 'lightning', 'thunder'];

export const RULES_2014_WIZARD_ARTIFICER: FeatureEffectsMap = {
  // ======== Wizard (PHB) ========
  [WIZ('arcane recovery', 1)]: same(WIZARD, WIZ24('arcane recovery', 1)),
  [WIZ('spellcasting', 1)]: text(),
  [WIZ('arcane tradition', 2)]: text(),
  [WIZ('cantrip formulas', 3, 'tce')]: text({
    needs: 'a cantrip swap after a Long Rest',
    notes: 'Swap one wizard cantrip after a Long Rest by editing your cantrips.',
  }),
  ...Object.fromEntries(
    [4, 8, 12, 16, 19].map((level) => [WIZ('ability score improvement', level), asi()]),
  ),
  ...Object.fromEntries(
    [6, 10, 14].map((level) => [WIZ('arcane tradition feature', level), text()]),
  ),
  // A level 1 and a level 2 spell cast at their lowest level without a slot, while prepared;
  // changed after 8 hours of study.
  [WIZ('spell mastery', 18)]: numbers(
    [
      {
        type: 'grantSpells',
        spells: [1, 2].map((lvl) => ({
          mode: 'innate' as const,
          ability: 'int' as const,
          spell: {
            choose: `level=${lvl}|class=Wizard`,
            count: 1,
            slot: `mastery.${lvl}`,
            retrain: 'longRest' as const,
          },
          uses: 'atWill' as const,
        })),
      },
    ],
    {
      notes: 'Free only while the spell is prepared; prepare it as usual.',
      needs: 'a free cast that applies only while the spell is prepared',
    },
  ),
  [WIZ('signature spells', 20)]: same(CORE_LEVELS_4_TO_20, WIZ24('signature spells', 20)),

  // ---- School of Abjuration ----
  [ABJ('school of abjuration', 2)]: text(),
  [ABJ('abjuration savant', 2)]: text(),
  [ABJ('arcane ward', 2)]: same(WIZARD, SCHOOL24('abjurer', 'arcane ward', 3)),
  [ABJ('projected ward', 6)]: same(WIZARD, SCHOOL24('abjurer', 'projected ward', 6)),
  [ABJ('improved abjuration', 10)]: text({
    notes: 'Add your Proficiency Bonus to the check by hand.',
  }),
  [ABJ('spell resistance', 14)]: same(WIZARD, SCHOOL24('abjurer', 'spell resistance', 14)),

  // ---- School of Conjuration ----
  [CONJ('school of conjuration', 2)]: text(),
  [CONJ('conjuration savant', 2)]: text(),
  [CONJ('minor conjuration', 2)]: numbers([
    action({ id: 'minor-conjuration', name: 'Minor Conjuration', actionType: 'action' }),
  ]),
  [CONJ('benign transposition', 6)]: numbers(
    [
      uses('benign-transposition', 'Benign Transposition', 1, 'long'),
      restoredBy('benign-transposition', anySlot),
      action({
        id: 'benign-transposition',
        name: 'Benign Transposition',
        actionType: 'action',
        costs: [spend('benign-transposition')],
      }),
    ],
    { notes: 'Only a Conjuration spell cast with a slot restores it.', unoffered: AT_TABLE },
  ),
  [CONJ('focused conjuration', 10)]: toggled(
    [
      {
        type: 'toggle',
        toggleId: 'focused-conjuration',
        name: 'Concentrating on a Conjuration spell',
        effects: [{ type: 'concentrationUnbreakable' }],
      },
    ],
    {
      notes: 'Switch it on while you concentrate on a Conjuration spell.',
      needs: 'a predicate for concentrating on a spell of one school',
    },
  ),
  [CONJ('durable summons', 14)]: text(),

  // ---- School of Divination ----
  [DIV('school of divination', 2)]: text(),
  [DIV('divination savant', 2)]: text(),
  // Two foretelling rolls per Long Rest, three from 14 (Greater Portent).
  [DIV('portent', 2)]: numbers(
    [uses('portent', 'Portent', 'steps(level.wizard, 2, 2, 14, 3)', 'long')],
    { unoffered: AT_TABLE },
  ),
  [DIV('expert divination', 6)]: text({ notes: 'Regain the lower slot by hand.' }),
  // An action; one benefit until a rest or Incapacitated; once per rest.
  [DIV('the third eye', 10)]: toggled(
    [
      uses('the-third-eye', 'The Third Eye', 1, 'short'),
      {
        type: 'toggle',
        toggleId: 'the-third-eye',
        name: 'The Third Eye',
        cost: [spend('the-third-eye'), { action: 'action' }],
        endsOn: ['shortRest', 'longRest'],
        effects: [],
        options: [
          {
            id: 'darkvision',
            name: 'Darkvision',
            effects: [{ type: 'sense', sense: 'darkvision', range: 60 }],
          },
          { id: 'ethereal-sight', name: 'Ethereal Sight', effects: [] },
          { id: 'greater-comprehension', name: 'Greater Comprehension', effects: [] },
          { id: 'see-invisibility', name: 'See Invisibility', effects: [] },
        ],
      },
    ],
    { unoffered: 'Picked each time: switch on The Third Eye with that benefit.' },
  ),
  [DIV('greater portent', 14)]: text(),

  // ---- School of Enchantment ----
  [ENCH('school of enchantment', 2)]: text(),
  [ENCH('enchantment savant', 2)]: text(),
  [ENCH('hypnotic gaze', 2)]: numbers(
    [
      action({
        id: 'hypnotic-gaze',
        name: 'Hypnotic Gaze',
        actionType: 'action',
        saveDc: dc('int'),
      }),
    ],
    { unoffered: TARGETS },
  ),
  [ENCH('instinctive charm', 6)]: numbers(
    [
      action({
        id: 'instinctive-charm',
        name: 'Instinctive Charm',
        actionType: 'reaction',
        saveDc: dc('int'),
      }),
    ],
    { unoffered: TARGETS },
  ),
  [ENCH('split enchantment', 10)]: text(),
  [ENCH('alter memories', 14)]: numbers(
    [
      action({
        id: 'alter-memories',
        name: 'Alter Memories',
        actionType: 'action',
        saveDc: dc('int'),
      }),
    ],
    { unoffered: TARGETS },
  ),

  // ---- School of Evocation ----
  [EVO('school of evocation', 2)]: text(),
  [EVO('evocation savant', 2)]: text(),
  [EVO('sculpt spells', 2)]: same(WIZARD, SCHOOL24('evoker', 'sculpt spells', 6)),
  [EVO('potent cantrip', 6)]: text(),
  [EVO('empowered evocation', 10)]: numbers([
    {
      type: 'spellMod',
      filter: 'school=V|class=Wizard',
      casterKey: 'wizard|phb',
      damageBonus: 'mod.int',
    },
  ]),
  [EVO('overchannel', 14)]: text(),

  // ---- School of Illusion ----
  [ILL('school of illusion', 2)]: text(),
  [ILL('illusion savant', 2)]: text(),
  [ILL('improved minor illusion', 2)]: numbers(
    [
      {
        type: 'grantSpells',
        spells: [{ mode: 'known', ability: 'int', spell: { id: 'minor illusion|phb' } }],
      },
    ],
    {
      unoffered:
        'Only when Minor Illusion is already known: pick another wizard cantrip at the table.',
    },
  ),
  [ILL('malleable illusions', 6)]: text(),
  [ILL('illusory self', 10)]: numbers([
    uses('illusory-self', 'Illusory Self', 1, 'short'),
    action({
      id: 'illusory-self',
      name: 'Illusory Self',
      actionType: 'reaction',
      costs: [spend('illusory-self')],
    }),
  ]),
  [ILL('illusory reality', 14)]: same(WIZARD, SCHOOL24('illusionist', 'illusory reality', 14)),

  // ---- School of Necromancy ----
  [NEC('school of necromancy', 2)]: text(),
  [NEC('necromancy savant', 2)]: text(),
  [NEC('grim harvest', 2)]: text(),
  [NEC('undead thralls', 6)]: numbers(
    [{ type: 'grantSpells', spells: [{ mode: 'spellbook', spell: { id: 'animate dead|phb' } }] }],
    { notes: 'Your undead gain your wizard level in Hit Points and your PB to weapon damage.' },
  ),
  [NEC('inured to undeath', 10)]: numbers([{ type: 'resistance', value: 'necrotic' }]),
  [NEC('command undead', 14)]: numbers(
    [
      action({
        id: 'command-undead',
        name: 'Command Undead',
        actionType: 'action',
        saveDc: dc('int'),
      }),
    ],
    { unoffered: TARGETS },
  ),

  // ---- School of Transmutation ----
  [TRANS('school of transmutation', 2)]: text(),
  [TRANS('transmutation savant', 2)]: text(),
  [TRANS('minor alchemy', 2)]: text(),
  // The stone's benefit applies to whoever carries it; switched on while you carry it, with the
  // benefit picked then (it can change when you cast a Transmutation spell).
  [TRANS("transmuter's stone", 6)]: toggled(
    [
      {
        type: 'toggle',
        toggleId: 'transmuters-stone',
        name: "Carrying your Transmuter's Stone",
        effects: [],
        options: [
          {
            id: 'darkvision',
            name: 'Darkvision',
            effects: [{ type: 'sense', sense: 'darkvision', range: 60 }],
          },
          { id: 'speed', name: 'Speed', effects: [{ type: 'speedBonus', value: 10 }] },
          {
            id: 'constitution',
            name: 'Constitution saves',
            effects: [{ type: 'proficiency', category: 'save', value: 'con' }],
          },
          ...STONE_RESISTANCES.map((type) => ({
            id: `resistance-${type}`,
            name: `Resistance (${type[0]!.toUpperCase()}${type.slice(1)})`,
            effects: [{ type: 'resistance' as const, value: type }],
          })),
        ],
      },
    ],
    {
      unoffered: 'Picked when switching on the stone; changed when you cast a Transmutation spell.',
      notes: 'The Speed benefit only while unencumbered.',
    },
  ),
  // Polymorph in the spellbook, and a free self-only cast per Short or Long Rest.
  [TRANS('shapechanger', 10)]: numbers(
    [
      { type: 'grantSpells', spells: [{ mode: 'spellbook', spell: { id: 'polymorph|phb' } }] },
      freeCasts('polymorph|phb', 1, 'short'),
    ],
    { notes: 'The free cast targets only you: a beast of CR 1 or lower.' },
  ),
  [TRANS('master transmuter', 14)]: numbers(
    [
      uses('master-transmuter', 'Master Transmuter', 1, 'long'),
      action({
        id: 'master-transmuter',
        name: 'Master Transmuter',
        actionType: 'action',
        costs: [spend('master-transmuter')],
      }),
    ],
    { unoffered: AT_TABLE },
  ),

  // ---- War Magic, Chronurgy, Graviturgy, Scribes: the level-2 entries (8.3 maps the rest) ----
  [SCHOOL('war', 'xge')('war magic', 2)]: text(),
  [SCHOOL('chronurgy', 'egw')('chronurgy magic', 2)]: text(),
  [SCHOOL('graviturgy', 'egw')('graviturgy magic', 2)]: text(),
  [SCHOOL('scribes', 'tce')('order of scribes', 2)]: text(),

  // ---- Bladesinging (TCE) ----
  [BLADE('bladesinging', 2)]: text(),
  // Light armor, one one-handed melee weapon, and Performance.
  [BLADE('training in war and song (bladesinging)', 2)]: numbers([
    { type: 'proficiency', category: 'armor', value: 'light' },
    { type: 'proficiency', category: 'skill', value: 'performance' },
    {
      type: 'proficiencyChoice',
      category: 'weapon',
      choice: {
        slot: 'weapon',
        count: 1,
        from: [
          'battleaxe',
          'club',
          'dagger',
          'flail',
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
        ].map((w) => `${w}|phb`),
      },
    },
  ]),
  // PB uses per Long Rest; a Bonus Action; 1 minute.
  [BLADE('bladesong', 2)]: toggled(
    [
      uses('bladesong', 'Bladesong', 'pb', 'long'),
      {
        type: 'toggle',
        toggleId: 'bladesong',
        name: 'Bladesong',
        cost: [spend('bladesong'), { action: 'bonus' }],
        endsOn: ['shortRest', 'longRest'],
        effects: [
          when(bladesongArmor, [
            { type: 'acBonus', value: intUses },
            { type: 'speedBonus', value: 10 },
            { type: 'rollMode', target: 'skill:acrobatics', mode: 'advantage' },
            { type: 'rollBonus', target: 'save:concentration', value: intUses },
          ]),
        ],
      },
    ],
    { notes: 'Ends early if you use two hands to attack with a weapon.', unoffered: NO_CHOICE },
  ),
  [BLADE('bladesinger styles', 2)]: text(),
  [BLADE('extra attack', 6)]: same(SUP_WIZARD, BLADE24('extra attack', 6)),
  [BLADE('song of defense', 10)]: same(SUP_WIZARD, BLADE24('song of defense', 10)),
  [BLADE('song of victory', 14)]: numbers([
    when(bladesong, [
      {
        type: 'attackMod',
        label: 'Song of Victory',
        filter: { source: ['weapon'], range: 'melee' },
        damage: intUses,
      },
    ]),
  ]),

  // ======== Artificer (TCE) ========
  // The class data already gives firearm proficiency.
  [ART('optional rule%3A firearm proficiency', 1)]: text(),
  [ART('magical tinkering', 1)]: numbers(
    [action({ id: 'magical-tinkering', name: 'Magical Tinkering', actionType: 'action' })],
    {
      unoffered: AT_TABLE,
      notes: 'Up to your Intelligence modifier (at least 1) objects at once.',
    },
  ),
  [ART('spellcasting', 1)]: text(),
  // Infusions known are picked from the class data; which item bears each is the player's.
  [ART('infuse item', 2)]: text({
    needs: 'an infusion placed on a chosen inventory item, applying its effects there',
    notes: 'Infused items at once follow the Infused Items column.',
  }),
  [ART('infusions known', 2)]: text(),
  [ART('artificer specialist', 3)]: text(),
  [ART('the right tool for the job', 3)]: text(),
  ...Object.fromEntries(
    [4, 8, 12, 16, 19].map((level) => [ART('ability score improvement', level), asi()]),
  ),
  ...Object.fromEntries(
    [5, 9, 15].map((level) => [ART('artificer specialist feature', level), text()]),
  ),
  [ART('tool expertise', 6)]: text({
    notes: 'Double your Proficiency Bonus on tool checks by hand.',
    needs: 'expertise with tools',
  }),
  // Reaction: add the Intelligence modifier to a check or save; Int mod uses (at least one).
  [ART('flash of genius', 7)]: numbers([
    uses('flash-of-genius', 'Flash of Genius', intUses, 'long'),
    action({
      id: 'flash-of-genius',
      name: 'Flash of Genius',
      actionType: 'reaction',
      roll: 'mod.int',
      costs: [spend('flash-of-genius')],
    }),
  ]),
  [ART('magic item adept', 10)]: same(SUP_ARTIFICER, ART24('magic item adept', 10)),
  [ART('spell-storing item', 11)]: same(SUP_ARTIFICER, ART24('spell-storing item', 11)),
  [ART('magic item savant', 14)]: numbers([{ type: 'attunementMax', value: 5 }]),
  [ART('magic item master', 18)]: same(SUP_ARTIFICER, ART24('magic item master', 18)),
  // +1 to saves per attuned magic item; a reaction at 0 HP that ends an infusion.
  [ART('soul of artifice', 20)]: numbers(
    [action({ id: 'soul-of-artifice', name: 'Soul of Artifice', actionType: 'reaction' })],
    {
      notes: 'Add +1 to saves for each attuned magic item by hand.',
      needs: 'a formula reference to the number of attuned magic items',
    },
  ),

  // ---- Alchemist ----
  [ALCH('alchemist', 3)]: text(),
  [ALCH('tool proficiency', 3)]: numbers([tool("alchemist's supplies|phb")], {
    unoffered: FALLBACK_TOOL,
  }),
  [ALCH('alchemist spells', 3)]: text(),
  // One elixir per Long Rest, two at 6, three at 15; more for a spell slot (picked, not rolled).
  [ALCH('experimental elixir', 3)]: numbers(
    [
      uses(
        'experimental-elixir',
        'Experimental Elixir',
        'steps(level.artificer, 3, 1, 6, 2, 15, 3)',
        'long',
      ),
      restoredBy('experimental-elixir', anySlot),
      action({
        id: 'experimental-elixir',
        name: 'Experimental Elixir',
        actionType: 'action',
        costs: [spend('experimental-elixir')],
        roll: '1d6',
      }),
      action({
        id: 'experimental-elixir-healing',
        name: 'Experimental Elixir: Healing',
        actionType: 'action',
        costs: [spend('experimental-elixir')],
        roll: '2d4 + mod.int',
      }),
    ],
    { unoffered: AT_TABLE },
  ),
  [ALCH('alchemical savant', 5)]: same(
    SUP_ARTIFICER_SUBCLASSES,
    SPEC24('alchemist', 'alchemical savant', 5),
  ),
  // Temporary HP when an elixir is drunk; Lesser Restoration free, Int mod times (at least once).
  [ALCH('restorative reagents', 9)]: numbers([
    action({
      id: 'restorative-reagents',
      name: 'Restorative Reagents',
      actionType: 'other',
      roll: '2d6 + max(1, mod.int)',
    }),
    freeCasts('lesser restoration|phb', intUses, 'long'),
  ]),
  [ALCH('chemical mastery', 15)]: numbers([
    { type: 'resistance', value: 'acid' },
    { type: 'resistance', value: 'poison' },
    { type: 'conditionImmunity', value: 'poisoned' },
    freeCasts('greater restoration|phb', 1, 'long'),
    freeCasts('heal|phb', 1, 'long'),
  ]),

  // ---- Armorer ----
  [ARMOR('armorer', 3)]: text(),
  [ARMOR('tools of the trade', 3)]: numbers(
    [{ type: 'proficiency', category: 'armor', value: 'heavy' }, tool("smith's tools|phb")],
    { unoffered: FALLBACK_TOOL },
  ),
  [ARMOR('armorer spells', 3)]: text(),
  [ARMOR('arcane armor', 3)]: same(SUP_ARTIFICER_SUBCLASSES, SPEC24('armorer', 'arcane armor', 3)),
  // Switched on while wearing the Arcane Armor; its model is picked then.
  [ARMOR('armor model', 3)]: toggled(
    [
      {
        type: 'toggle',
        toggleId: 'arcane-armor',
        name: 'Arcane Armor',
        effects: [],
        options: [
          { id: 'guardian', name: 'Guardian', effects: [] },
          { id: 'infiltrator', name: 'Infiltrator', effects: [] },
        ],
      },
    ],
    { unoffered: 'Picked when switching on Arcane Armor; changed at a Short or Long Rest.' },
  ),
  [ARMOR('thunder gauntlets', 3)]: toggled(
    [
      when(model('guardian'), [
        {
          type: 'attack',
          id: 'thunder-gauntlets',
          name: 'Thunder Gauntlets',
          damage: '1d8',
          damageType: 'thunder',
          range: 'melee',
          distance: '5 ft.',
          abilities: ['str', 'int'],
        },
      ]),
    ],
    { notes: MODEL_ABILITY },
  ),
  [ARMOR('defensive field', 3)]: toggled([
    when(model('guardian'), [
      uses('defensive-field', 'Defensive Field', 'pb', 'long'),
      action({
        id: 'defensive-field',
        name: 'Defensive Field',
        actionType: 'bonus',
        costs: [spend('defensive-field')],
        outcomes: [{ tempHp: 'level.artificer' }],
      }),
    ]),
  ]),
  [ARMOR('lightning launcher', 3)]: toggled(
    [
      when(model('infiltrator'), [
        {
          type: 'attack',
          id: 'lightning-launcher',
          name: 'Lightning Launcher',
          damage: '1d6',
          damageType: 'lightning',
          range: 'ranged',
          distance: '90/300 ft.',
          abilities: ['dex', 'int'],
        },
        {
          type: 'damageRider',
          id: 'lightning-launcher',
          name: 'Lightning Launcher',
          dice: '1d6',
          damageType: 'lightning',
          filter: LAUNCHER,
          oncePerTurn: true,
          optIn: true,
        },
      ]),
    ],
    { notes: MODEL_ABILITY, unoffered: NO_CHOICE },
  ),
  [ARMOR('powered steps', 3)]: toggled([
    when(model('infiltrator'), [{ type: 'speedBonus', value: 5 }]),
  ]),
  [ARMOR('dampening field', 3)]: toggled([
    when(model('infiltrator'), [{ type: 'rollMode', target: 'skill:stealth', mode: 'advantage' }]),
  ]),
  [ARMOR('extra attack', 5)]: same(SUP_ARTIFICER_SUBCLASSES, SPEC24('armorer', 'extra attack', 5)),
  [ARMOR('armor modifications', 9)]: text({
    notes: 'Two more infused items, both parts of your Arcane Armor.',
  }),
  [ARMOR('perfected armor', 15)]: text(),
  // PB uses per Long Rest of the pull (a reaction).
  [ARMOR('guardian', 15)]: toggled(
    [
      when(model('guardian'), [
        uses('guardian-pull', 'Guardian Pull', 'pb', 'long'),
        action({
          id: 'guardian-pull',
          name: 'Guardian Pull',
          actionType: 'reaction',
          costs: [spend('guardian-pull')],
          saveDc: dc('int'),
        }),
      ]),
    ],
    { unoffered: TARGETS },
  ),
  [ARMOR('infiltrator', 15)]: text({
    notes: 'A creature your Lightning Launcher hits glimmers until your next turn.',
  }),

  // ---- Artillerist ----
  [ARTY('artillerist', 3)]: text(),
  [ARTY('tool proficiency', 3)]: numbers([tool("woodcarver's tools|phb")], {
    unoffered: FALLBACK_TOOL,
  }),
  [ARTY('artillerist spells', 3)]: text(),
  // Made once per Long Rest or for a slot; its damage dice grow by 1d8 at 9 (Explosive Cannon),
  // the Protector's temporary HP don't.
  [ARTY('eldritch cannon', 3)]: numbers(
    [
      ...oncePerRestOrSlot('eldritch-cannon', 'Eldritch Cannon'),
      action({
        id: 'cannon-flamethrower',
        name: 'Cannon: Flamethrower',
        actionType: 'bonus',
        saveDc: dc('int'),
        roll: 'steps(level.artificer, 3, 2d8, 9, 3d8)',
      }),
      action({
        id: 'cannon-force-ballista',
        name: 'Cannon: Force Ballista',
        actionType: 'bonus',
        roll: 'steps(level.artificer, 3, 2d8, 9, 3d8)',
      }),
      action({
        id: 'cannon-protector',
        name: 'Cannon: Protector',
        actionType: 'bonus',
        roll: '1d8 + max(1, mod.int)',
      }),
    ],
    { unoffered: 'The cannon type is picked each time it is made.' },
  ),
  [ARTY('arcane firearm', 5)]: same(
    SUP_ARTIFICER_SUBCLASSES,
    SPEC24('artillerist', 'arcane firearm', 5),
  ),
  [ARTY('explosive cannon', 9)]: numbers([
    action({
      id: 'cannon-detonate',
      name: 'Cannon: Detonate',
      actionType: 'action',
      saveDc: dc('int'),
      roll: '3d8',
    }),
  ]),
  [ARTY('fortified position', 15)]: text({
    notes: 'Two cannons at once; half cover within 10 ft. of a cannon.',
  }),

  // ---- Battle Smith ----
  [SMITH('battle smith', 3)]: text(),
  [SMITH('tool proficiency', 3)]: numbers([tool("smith's tools|phb")], {
    unoffered: FALLBACK_TOOL,
  }),
  [SMITH('battle smith spells', 3)]: text(),
  [SMITH('battle ready', 3)]: same(
    SUP_ARTIFICER_SUBCLASSES,
    SPEC24('battle smith', 'battle ready', 3),
  ),
  [SMITH('steel defender', 3)]: same(
    SUP_ARTIFICER_SUBCLASSES,
    SPEC24('battle smith', 'steel defender', 3),
  ),
  [SMITH('extra attack', 5)]: numbers([{ type: 'extraAttack', count: 2 }]),
  [SMITH('arcane jolt', 9)]: same(
    SUP_ARTIFICER_SUBCLASSES,
    SPEC24('battle smith', 'arcane jolt', 9),
  ),
  [SMITH('improved defender', 15)]: same(
    SUP_ARTIFICER_SUBCLASSES,
    SPEC24('battle smith', 'improved defender', 15),
  ),
};
