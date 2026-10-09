// The 2024 supplement feats (plan §10.2, step 6.16): Eberron: Forge of the Artificer (the
// dragonmarks), Heroes of Faerûn, Ravenloft: The Horrors Within (the Dark Gifts), Arcana
// Unleashed, Astarion's Book of Hungers and Lorwyn: First Light. Ability increases,
// proficiencies, resistances and most spells come from the data; these add the uses, the
// actions and reactions that spend them, the d4 check bonuses of the marks, and the numbers
// that hold while Bloodied. Benefits that only say what happens at the table stay unmapped.

import { refKey, type Ability, type ActionDef, type Effect } from '../../../schema/index.ts';
import type { Recharge } from '../../../schema/index.ts';
import {
  action,
  AT_TABLE,
  dc,
  notIncapacitated,
  numbers,
  savesAgainst,
  TARGETS,
  text,
  toggled,
  uses,
  when,
} from '../core/helpers.ts';
import type { FeatureEffectsMap } from '../types.ts';

const F = (id: string) => refKey({ kind: 'feat', id });

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

/** Effects that read the ability this feat increased (the data's `ability` pick). */
function byAbility(from: Ability[], make: (a: Ability) => Effect[]): Effect[] {
  return from.map((a) => ({ type: 'ifChoice', slot: 'ability', value: a, effects: make(a) }));
}
const MENTAL: Ability[] = ['int', 'wis', 'cha'];

/** A d4 (or other die) added to checks with these skills. */
const checkDie = (die: string, ...skills: string[]): Effect[] =>
  skills.map(
    (s) =>
      ({
        type: 'rollBonus',
        target: `skill:${s}` as const,
        value: die,
        id: 'dragonmark',
      }) as Effect,
  );

/** Effects that hold while the character is Bloodied (one toggle every feat shares). */
const bloodied = (effects: Effect[]): Effect => ({
  type: 'toggle',
  toggleId: 'bloodied',
  name: 'Bloodied',
  effects,
});

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

/** The 5etools adapter reads "each spell once a day" as one shared use; the text gives one each. */
const EACH_ONCE: Effect = {
  type: 'resourceModify',
  resourceId: 'spells.0.prepared._.daily.1',
  max: 2,
};
const EACH_ONCE_NOTE = 'The free casts are one per spell, not two of either.';

/** A Greater Mark's Improved Intuition: the mark's check die becomes a d6. */
const greater = (extra: Effect[] = []) =>
  numbers([{ type: 'rollBonusModify', id: 'dragonmark', value: '1d6' }, ...extra]);

export const SUP_FEATS: FeatureEffectsMap = {
  // ---- Dragonmarks (EFA) ----
  [F('aberrant dragonmark|efa')]: numbers([
    uses('aberrant-fortitude', 'Aberrant Fortitude', 1, 'long', { die: 'd4' }),
    action({
      id: 'aberrant-fortitude',
      name: 'Aberrant Fortitude',
      actionType: 'reaction',
      costs: [{ resource: 'aberrant-fortitude', amount: 1 }],
    }),
  ]),
  [F('mark of detection|efa')]: numbers([
    ...checkDie('1d4', 'investigation', 'insight'),
    // The data leaves out the second Magical Detection spell.
    {
      type: 'grantSpells',
      spells: [
        {
          mode: 'alwaysPrepared',
          uses: { count: 1, recharge: 'long' },
          spell: { id: 'detect poison and disease|xphb' },
        },
      ],
    },
  ]),
  [F('mark of finding|efa')]: numbers(checkDie('1d4', 'perception', 'survival')),
  [F('mark of handling|efa')]: numbers(
    [...checkDie('1d4', 'nature', 'animal handling'), EACH_ONCE],
    { notes: EACH_ONCE_NOTE },
  ),
  [F('mark of healing|efa')]: numbers(checkDie('1d4', 'medicine'), {
    notes: 'The mark’s die also adds to Herbalism Kit checks.',
  }),
  [F('mark of hospitality|efa')]: numbers([...checkDie('1d4', 'persuasion'), EACH_ONCE], {
    notes: `The mark’s die also adds to Brewer’s Supplies and Cook’s Utensils checks. ${EACH_ONCE_NOTE}`,
  }),
  [F('mark of making|efa')]: numbers(checkDie('1d4', 'arcana'), {
    notes: 'The mark’s die also adds to Artisan’s Tools checks.',
  }),
  [F('mark of passage|efa')]: numbers([
    { type: 'speedBonus', value: 5 },
    ...checkDie('1d4', 'athletics', 'acrobatics'),
  ]),
  [F('mark of scribing|efa')]: numbers(checkDie('1d4', 'history'), {
    notes: 'The mark’s die also adds to Calligrapher’s Supplies checks.',
  }),
  [F('mark of sentinel|efa')]: numbers([
    ...checkDie('1d4', 'insight', 'perception'),
    ...limited('vigilant-guardian', 'Vigilant Guardian', 'pb', 'long', 'reaction'),
  ]),
  [F('mark of shadow|efa')]: numbers(checkDie('1d4', 'stealth', 'performance')),
  [F('mark of storm|efa')]: numbers(checkDie('1d4', 'acrobatics'), {
    notes: 'The mark’s die also adds to Navigator’s Tools checks.',
  }),
  [F('mark of warding|efa')]: numbers([...checkDie('1d4', 'investigation'), EACH_ONCE], {
    notes: `The mark’s die also adds to Thieves’ Tools checks. ${EACH_ONCE_NOTE}`,
  }),

  [F('greater aberrant mark|efa')]: numbers([
    { type: 'resourceModify', resourceId: 'aberrant-fortitude', die: 'd6', recharge: 'short' },
    ...limited('mark-of-inspiration', 'Mark of Inspiration', 'pb', 'long', 'other', {
      costs: [{ hitDice: 1 }],
    }),
  ]),
  [F('greater mark of detection|efa')]: greater(),
  [F('greater mark of finding|efa')]: greater(),
  [F('greater mark of handling|efa')]: greater(
    limited('subdue-animal', 'Subdue Animal', 'pb', 'long', 'action', { saveDc: dc('wis') }),
  ),
  [F('greater mark of healing|efa')]: greater([
    // Used in place of Healing Touch's single free cast.
    uses('improved-healing', 'Improved Healing', 'pb', 'long'),
  ]),
  [F('greater mark of hospitality|efa')]: greater([
    uses('improved-hospitality', 'Improved Hospitality', 1, 'long'),
  ]),
  [F('greater mark of making|efa')]: greater(),
  [F('greater mark of passage|efa')]: greater(),
  [F('greater mark of scribing|efa')]: greater([
    uses('inspired-scribing', 'Inspired Scribing', 1, 'long'),
  ]),
  [F('greater mark of sentinel|efa')]: greater(),
  [F('greater mark of shadow|efa')]: greater(),
  [F('greater mark of storm|efa')]: {
    ...greater([
      {
        type: 'toggle',
        toggleId: 'improved-storm',
        name: 'Improved Storm',
        effects: [{ type: 'speed', mode: 'fly', value: 60 }],
      },
    ]),
    level: 'B',
  },
  [F('greater mark of warding|efa')]: greater(
    limited('improved-warding', 'Improved Warding', 'pb', 'long', 'reaction'),
  ),
  [F('potent dragonmark|efa')]: numbers(
    [uses('dragonmark-slot', 'Dragonmark Spell Slot', 1, 'short')],
    {
      notes: 'The slot is half your level (round up), level 5 at most, for dragonmark spells only.',
      needs: 'spells always prepared from another feat’s expanded list',
    },
  ),

  // ---- Origin feats ----
  [F('arcane artist|au')]: numbers([uses('inspiring-magic', 'Inspiring Magic', 1, 'long')]),
  [F('arcane eloquence|au')]: numbers(checkDie('1d4', 'deception', 'intimidation', 'persuasion')),
  [F('arcane infiltrator|au')]: numbers(
    limited('cunning-diversion', 'Cunning Diversion', 'pb', 'long', 'bonus'),
  ),
  [F('arcane omens|au')]: numbers(
    limited('helpful-premonition', 'Helpful Premonition', 'pb', 'long', 'reaction', {
      roll: '1d4',
    }),
  ),
  [F('arcane overload|au')]: numbers(
    limited('power-surge', 'Power Surge', 1, 'long', 'other', { roll: 'pb' }),
  ),
  [F('arcane safeguard|au')]: numbers(
    limited('arcane-safeguard', 'Resistance (Bonus Action)', 'pb', 'long', 'bonus'),
  ),
  [F('arcane undertaker|au')]: numbers([
    ...checkDie('1d4', 'history', 'medicine'),
    uses('understanding-of-death', 'Understanding of Death', 1, 'long'),
  ]),
  [F('cult of the dragon initiate|frhof')]: numbers([
    action({
      id: 'dragons-terror',
      name: 'Dragon’s Terror',
      actionType: 'action',
      saveDc: dc('wis'),
    }),
    uses('inspired-by-fear', 'Inspired by Fear', 1, 'short'),
  ]),
  [F('familiar friend|au')]: numbers(
    limited('helpful-friend', 'Helpful Friend', 'pb', 'long', 'other'),
  ),
  [F("lords' alliance agent|frhof")]: text({ unoffered: TARGETS }),
  [F('portal jumper|au')]: numbers(limited('portal-step', 'Portal Step', 'pb', 'long', 'other')),
  [F('purple dragon rook|frhof')]: numbers([uses('rallying-cry', 'Rallying Cry', 1, 'long')]),
  [F('sharp eye|rhw')]: numbers(limited('sharp-eye', 'Sharp Eye', 'pb', 'long', 'other')),
  [F('spellfire spark|frhof')]: numbers([
    action({ id: 'magic-absorption', name: 'Magic Absorption', actionType: 'other', roll: '1d4' }),
    ...limited('spellfire-flame', 'Spellfire Flame', 'pb', 'long', 'bonus'),
  ]),
  [F('survivor|rhw')]: numbers(
    limited('steel-yourself', 'Steel Yourself', 1, 'long', 'reaction', { roll: 'pb' }),
    { needs: 'a reroll of a low Initiative d20' },
  ),
  [F('tireless reveler|abh')]: numbers([
    uses('tireless-reveler', 'Tireless Reveler', 'pb', 'short'),
  ]),
  [F('transmuted anatomy|au')]: numbers([
    { type: 'speedBonus', value: 5 },
    savesAgainst('effects that would force you to shape-shift'),
    ...limited('resilient-anatomy', 'Resilient Anatomy', 'pb', 'long', 'reaction', {
      roll: '1d4',
    }),
  ]),
  [F('tyro of the gauntlet|frhof')]: numbers([
    action({ id: 'stand-as-one', name: 'Stand as One', actionType: 'reaction' }),
  ]),
  [F('vampire hunter|abh')]: numbers(
    limited('vitality-ward', 'Vitality Ward', 1, 'short', 'reaction', { roll: 'dice(pb, 6)' }),
  ),
  [F("vampire's plaything|abh")]: numbers(
    limited('timely-retreat', 'Timely Retreat', 'pb', 'long', 'bonus'),
    { unoffered: AT_TABLE },
  ),

  // ---- General feats ----
  [F('bloodlust|abh')]: numbers([
    { type: 'hitDieHealing', floor: 3 },
    ...limited('sanguine-feast', 'Sanguine Feast', 'pb', 'long', 'other', {
      costs: [{ hitDice: 1 }],
    }),
  ]),
  [F('cloying mists|abh')]: numbers([uses('arise-fog', 'Arise, Fog', 1, 'long')], {
    notes: 'One free cast of Fog Cloud.',
  }),
  [F('conjuration adept|au')]: toggled([
    {
      type: 'toggle',
      toggleId: 'persistent-conjuration',
      name: 'Concentrating on a Conjuration spell',
      effects: byAbility(MENTAL, (a) => [
        { type: 'rollBonus', target: 'save:concentration', value: `mod.${a}` },
      ]),
    },
  ]),
  [F('delicious pain|abh')]: toggled([
    uses('toughened-flesh', 'Toughened Flesh', 1, 'short'),
    {
      type: 'toggle',
      toggleId: 'toughened-flesh',
      name: 'Toughened Flesh',
      cost: [{ resource: 'toughened-flesh', amount: 1 }, { action: 'reaction' }],
      effects: ['bludgeoning', 'piercing', 'slashing'].map((value): Effect => ({
        type: 'resistance',
        value,
      })),
    },
  ]),
  [F('divination adept|au')]: numbers([
    ...limited('prescient-intervention', 'Prescient Intervention', 1, 'long', 'reaction'),
    {
      type: 'restoreWith',
      resourceId: 'prescient-intervention',
      amount: 1,
      costs: [{ slot: { minLevel: 1 } }],
    },
  ]),
  [F('dragonscarred|frhof')]: numbers([
    action({
      id: 'fearsome-power',
      name: 'Fearsome Power',
      actionType: 'bonus',
      saveDc: dc('wis'),
    }),
  ]),
  [F('elemental familiar|au')]: numbers([
    action({ id: 'energy-pulse', name: 'Energy Pulse', actionType: 'bonus', roll: '2d4' }),
  ]),
  [F('fairy trickster|frhof')]: numbers([
    uses('flustering-strike', 'Flustering Strike', 'pb', 'long'),
    ...byAbility(['dex', 'cha'], (a) => [
      action({
        id: 'flustering-strike',
        name: 'Flustering Strike',
        actionType: 'other',
        costs: [{ resource: 'flustering-strike', amount: 1 }],
        saveDc: dc(a),
      }),
    ]),
  ]),
  [F('genie magic|frhof')]: numbers(
    [
      uses('wish-magic', 'Wish Magic', 1, 'long'),
      ...byAbility(MENTAL, (a) => [
        action({
          id: 'wish-magic',
          name: 'Wish Magic',
          actionType: 'action',
          costs: [{ resource: 'wish-magic', amount: 1 }],
          saveDc: dc(a),
        }),
      ]),
    ],
    { unoffered: AT_TABLE },
  ),
  [F('light bringer|abh')]: numbers([
    uses('solar-luminance', 'Solar Luminance', 1, 'long'),
    ...limited('suns-healing', 'Sun’s Healing', 1, 'short', 'bonus', { costs: [{ hitDice: 1 }] }),
  ]),
  [F('lordly resolve|frhof')]: numbers(
    limited('standard-bearer', 'Standard Bearer', 1, 'long', 'bonus'),
  ),
  [F('love bites|abh')]: numbers(limited('endearing-pain', 'Endearing Pain', 1, 'short', 'bonus')),
  [F('mythal touched|frhof')]: numbers([
    uses('mythal-ward', 'Mythal Ward', 'pb', 'long'),
    ...byAbility(MENTAL, (a) => [
      action({
        id: 'mythal-ward',
        name: 'Mythal Ward',
        actionType: 'reaction',
        costs: [{ resource: 'mythal-ward', amount: 1 }],
        roll: '1d20',
        saveDc: dc(a),
      }),
    ]),
  ]),
  [F("order's resilience|frhof")]: toggled([
    {
      type: 'toggle',
      toggleId: 'stronger-together',
      name: 'Ally within 5 feet',
      effects: [
        when(notIncapacitated, [{ type: 'rollMode', target: 'save:str', mode: 'advantage' }]),
      ],
    },
  ]),
  [F('purple dragon commandant|frhof')]: toggled([
    uses('encourage-ally', 'Encourage Ally', 'pb', 'long'),
    ...byAbility(['str', 'dex'], (a) => [
      action({
        id: 'encourage-ally',
        name: 'Encourage Ally',
        actionType: 'bonus',
        costs: [{ resource: 'encourage-ally', amount: 1 }],
        roll: `2d6 + mod.${a}`,
      }),
    ]),
    bloodied([{ type: 'rollMode', target: 'attack:all', mode: 'advantage', note: 'Last Stand' }]),
  ]),
  [F('putrefy|abh')]: numbers([uses('necrosis', 'Necrosis', 1, 'short')]),
  [F('rebuke|abh')]: numbers([uses('radiant-strike', 'Radiant Strike', 1, 'short')]),
  [F('spell resistant|au')]: numbers(
    limited('magic-resistant', 'Magic Resistant', 'pb', 'long', 'other', { roll: '1d6' }),
  ),
  [F('spell subterfuge|au')]: numbers([
    ...byAbility(MENTAL, (a) => [
      uses('shrouding-spells', 'Shrouding Spells', `max(0, mod.${a})`, 'long'),
    ]),
    action({
      id: 'shrouding-spells',
      name: 'Shrouding Spells',
      actionType: 'bonus',
      costs: [{ resource: 'shrouding-spells', amount: 1 }],
    }),
  ]),
  [F('treacherous allure|abh')]: numbers(
    [uses('enchanting-presence', 'Enchanting Presence', 1, 'long')],
    { notes: 'One free cast of Charm Person.' },
  ),
  [F('vampire touched|abh')]: numbers([
    uses('vampire-magic-climb', 'Vampire Magic (Spider Climb)', 1, 'long'),
    uses('vampire-magic-spell', 'Vampire Magic (level 1 spell)', 1, 'long'),
  ]),
  [F('zhentarim tactics|frhof')]: numbers([
    action({ id: 'retaliate', name: 'Retaliate', actionType: 'reaction' }),
    {
      type: 'expertiseChoice',
      choice: { slot: 'versatile-merc', count: 1, from: 'any', retrain: 'longRest' },
      filter: 'proficient',
    },
  ]),

  // ---- Dark Gifts (RHW) ----
  [F('echoing soul|rhw')]: numbers(
    [
      // The data offers one of the two skills.
      {
        type: 'proficiencyChoice',
        category: 'skill',
        choice: { slot: 'skills-2', count: 1, from: 'any' },
      },
    ],
    { notes: 'The Expertise pick can change after each Long Rest.' },
  ),
  [F('gathered whispers|rhw')]: numbers(
    limited('unearthly-scream', 'Unearthly Scream', 'pb', 'long', 'reaction', { roll: 'pb' }),
  ),
  [F('living shadow|rhw')]: numbers(
    limited('lengthened-strike', 'Lengthened Strike', 'pb', 'long', 'other'),
  ),
  [F('mist walker|rhw')]: numbers(limited('mist-walk', 'Mist Walk', 'pb', 'long', 'reaction')),
  [F('symbiotic being|rhw')]: numbers(
    limited('sustained-symbiosis', 'Sustained Symbiosis', 'pb', 'long', 'reaction', {
      costs: [{ hitDice: 1 }],
    }),
  ),
  [F('touch of death|rhw')]: numbers([
    { type: 'rollMode', target: 'save:death', mode: 'disadvantage' },
  ]),

  // ---- Epic Boons ----
  [F('boon of bloodshed|frhof')]: toggled([
    bloodied([
      {
        type: 'damageRider',
        id: 'power-from-pain',
        name: 'Power from Pain',
        dice: 'pb',
        filter: {},
        oncePerTurn: true,
        optIn: true,
      },
    ]),
  ]),
  [F('boon of bountiful health|frhof')]: numbers([
    { type: 'tempHpBonus', value: 5 },
    { type: 'hitDieHealing', max: true },
  ]),
  [F('boon of communication|frhof')]: numbers([{ type: 'sense', sense: 'telepathy', range: 120 }]),
  [F('boon of desperate resilience|frhof')]: toggled([
    bloodied(ALL_BUT_FORCE.map((value): Effect => ({ type: 'resistance', value }))),
  ]),
  [F('boon of erupting spellpower|au')]: numbers(
    limited('spell-overload', 'Spell Overload', 1, 'short', 'other'),
    { notes: 'Also back when you roll Initiative.' },
  ),
  [F('boon of exquisite radiance|frhof')]: numbers(
    limited('powerful-radiance', 'Powerful Radiance', 1, 'long', 'other'),
  ),
  [F('boon of fluid forms|frhof')]: numbers(
    limited('shapechanger', 'Shapechanger', 1, 'long', 'action'),
  ),
  [F("boon of fortune's favor|frhof")]: numbers([
    action({ id: 'saving-throw-reroll', name: 'Saving Throw Reroll', actionType: 'other' }),
  ]),
  [F('boon of looming shadows|abh')]: numbers([
    action({ id: 'dancing-silhouette', name: 'Dancing Silhouette', actionType: 'bonus' }),
  ]),
  [F('boon of revelry|frhof')]: numbers([uses('inspire-dance', 'Inspire Dance', 1, 'long')], {
    notes: 'One free cast of Otto’s Irresistible Dance.',
  }),
  [F('boon of siberys|efa')]: text({
    needs:
      'a different recharge for a data spell grant (its free cast returns on a Short Rest too)',
  }),
  [F('boon of terror|frhof')]: numbers(
    limited('flee-fools', 'Flee, Fools!', 1, 'short', 'reaction', { saveDc: dc('cha') }),
  ),
  [F('boon of the bright sun|frhof')]: toggled([
    {
      type: 'toggle',
      toggleId: 'daylight-presence',
      name: 'Daylight Presence',
      cost: [{ action: 'bonus' }],
      effects: [],
    },
  ]),
  [F('boon of the furious storm|frhof')]: toggled([
    bloodied([
      { type: 'immunity', value: 'lightning' },
      { type: 'immunity', value: 'thunder' },
    ]),
  ]),
  [F('boon of the iron mind|au')]: numbers([{ type: 'concentrationUnbreakable' }]),
  [F('boon of the soul drinker|frhof')]: numbers(
    limited('siphon-life', 'Siphon Life', 1, 'short', 'reaction', { outcomes: [{ heal: 50 }] }),
  ),
};
