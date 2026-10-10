// Characters on 2014 rules (plan step 8.6): the 2014 Druid and Fighter's own features, and the features of
// its subclasses that a 2024 book reprints. Where a 2024 mapping fits the 2014 rule, the 2014 key
// reuses it.
//
// Wild Shape is two uses per Short Rest with no temporary HP (the Beast's own HP are the
// player's); its `wild-shape` counter and switch are the ones the 2014 circles mapped in 8.3
// (Spores, Wildfire) and the Circle of the Stars spend. Second Wind is once per Short Rest; Action
// Surge, Indomitable, Extra Attack and the Battle Master's Superiority Dice count the same as in
// 2024. The Psi Warrior's Psionic Energy Dice are twice the Proficiency Bonus, all back on a Long
// Rest. Circle spells, maneuvers, Arcane Shot options and the Eldritch Knight's spellcasting
// come from the subclasses' own data.

import { DRUID } from '../core/druid.ts';
import { FIGHTER } from '../core/fighter.ts';
import {
  action,
  AT_TABLE,
  dc,
  NO_CHOICE,
  numbers,
  savesAgainst,
  TARGETS,
  text,
  toggled,
  uses,
  when,
} from '../core/helpers.ts';
import { SUP_FIGHTER } from '../supplements/fighter.ts';
import type { FeatureEffectsMap, FeatureMapping } from '../types.ts';

const DC = (id: string, level: number, src = 'phb') =>
  `classFeature:${id}|druid|phb|${level}|${src}` as const;
const FC = (id: string, level: number, src = 'phb') =>
  `classFeature:${id}|fighter|phb|${level}|${src}` as const;
const DS = (sub: string, src: string, id: string, level: number, featSrc = src) =>
  `subclassFeature:${id}|druid|phb|${sub}|${src}|${level}|${featSrc}` as const;
const FS = (sub: string, src: string, id: string, level: number, featSrc = src) =>
  `subclassFeature:${id}|fighter|phb|${sub}|${src}|${level}|${featSrc}` as const;
const LAND = (id: string, level: number) => DS('land', 'phb', id, level);
const MOON = (id: string, level: number) => DS('moon', 'phb', id, level);
const STARS = (id: string, level: number) => DS('stars', 'tce', id, level);
const BM = (id: string, level: number, featSrc = 'phb') =>
  FS('battle master', 'phb', id, level, featSrc);
const CHAMP = (id: string, level: number) => FS('champion', 'phb', id, level);
const EK = (id: string, level: number) => FS('eldritch knight', 'phb', id, level);
const PDK = (id: string, level: number) => FS('purple dragon knight (banneret)', 'scag', id, level);
const AA = (id: string, level: number) => FS('arcane archer', 'xge', id, level);
const PSI = (id: string, level: number) => FS('psi warrior', 'tce', id, level);

/** The 2024 mapping of a feature whose 2014 rule is the same. */
function same(map: FeatureEffectsMap, key: string): FeatureMapping {
  const mapping = map[key];
  if (!mapping) throw new Error(`no 2024 mapping to reuse: ${key}`);
  return mapping;
}
const druid2024 = (id: string, level: number) =>
  same(DRUID, `classFeature:${id}|druid|xphb|${level}|xphb`);
const druidSub2024 = (sub: string, id: string, level: number) =>
  same(DRUID, `subclassFeature:${id}|druid|xphb|${sub}|xphb|${level}|xphb`);
const fighter2024 = (id: string, level: number) =>
  same(FIGHTER, `classFeature:${id}|fighter|xphb|${level}|xphb`);
const fighterSub2024 = (sub: string, id: string, level: number) =>
  same(FIGHTER, `subclassFeature:${id}|fighter|xphb|${sub}|xphb|${level}|xphb`);

/** A 2014 Ability Score Improvement: the 2014 rules give its choice (`legacyEntityEffects`). */
const asi: FeatureMapping = {
  effects: [],
  level: 'A',
  unoffered: 'Offered by the 2014 rules: +2 to one score, +1 to two, or a feat.',
};

const wildShape = { resource: 'wild-shape', amount: 1 };

/** Starry Form's Archer and Chalice: 1d8, 2d8 from Druid 10 (Twinkling Constellations). */
const starDice = 'steps(level.druid, 1, 1d8, 10, 2d8) + mod.wis';

/** The Psi Warrior's Psionic Energy die: d6, then d8, d10 and d12 at Fighter 5, 11 and 17. */
const psiDie = (n: string) =>
  `steps(level.fighter, 1, ${n}d6, 5, ${n}d8, 11, ${n}d10, 17, ${n}d12)`;
const psionic = { resource: 'psionic-energy', amount: 1 };

/** Effects of the 2024 mapping of a Psi Warrior power whose rule is the same. */
const power2024 = (id: string, level: number) => fighterSub2024('psi warrior', id, level).effects;

/** The data offers one Psi Warrior power where the feature gives all of them. */
const ALL_POWERS =
  'You have every power listed here: the app asks for one only because of how the data lists them; the actions for all of them are given here.';
const OPTIONS_NEED = 'an options block whose options are all granted (no pick)';

export const RULES_2014_DRUID_FIGHTER: FeatureEffectsMap = {
  // ---- Druid ----
  [DC('druidic', 1)]: druid2024('druidic', 1),
  [DC('spellcasting', 1)]: druid2024('spellcasting', 1),
  [DC('wild shape', 2)]: toggled(
    [
      uses('wild-shape', 'Wild Shape', 2, 'short'),
      {
        type: 'toggle',
        toggleId: 'wild-shape',
        name: 'Wild Shape',
        cost: [wildShape, { action: 'action' }],
        endsOn: ['longRest'],
        effects: [],
      },
    ],
    {
      unoffered: 'The Beast is picked each time, on the Extras tab.',
      notes:
        'You take the Beast’s Hit Points; the app doesn’t check the Beast Shapes table’s CR and Speed limits.',
      needs: 'Wild Shape limits from the 2014 Beast Shapes tables (Max. CR, no Fly or Swim Speed)',
    },
  ),
  [DC('wild companion', 2, 'tce')]: numbers([
    action({
      id: 'wild-companion',
      name: 'Wild Companion',
      actionType: 'action',
      costs: [wildShape],
    }),
  ]),
  [DC('druid circle', 2)]: text(),
  [DC('wild shape improvement', 4)]: text(),
  [DC('wild shape improvement', 8)]: text(),
  [DC('cantrip versatility', 4, 'tce')]: text(),
  ...Object.fromEntries([4, 8, 12, 16, 19].map((l) => [DC('ability score improvement', l), asi])),
  [DC('druid circle feature', 6)]: text(),
  [DC('druid circle feature', 10)]: text(),
  [DC('druid circle feature', 14)]: text(),
  [DC('timeless body', 18)]: text(),
  [DC('beast spells', 18)]: text(),
  [DC('archdruid', 20)]: text({
    notes: 'Wild Shape has no limit on uses: switch it on without spending the counter.',
    needs: 'a counter with unlimited uses from a level',
  }),

  // ---- Circle of the Land ----
  [LAND('circle of the land', 2)]: text(),
  [LAND('bonus cantrip', 2)]: text({
    unoffered: 'The cantrip is picked through the circle’s land choice (its data).',
  }),
  // The same rule as 2024: slots up to half the Druid level (rounded up), none of 6th level.
  [LAND('natural recovery', 2)]: druidSub2024('land', 'natural recovery', 6),
  [LAND('circle spells', 2)]: druidSub2024('land', 'circle of the land spells', 3),
  [LAND("land's stride", 6)]: numbers([savesAgainst('plants that impede movement')]),
  [LAND("nature's ward", 10)]: numbers(
    [
      { type: 'immunity', value: 'poison' },
      { type: 'conditionImmunity', value: 'poisoned' },
    ],
    { notes: 'Also immune to disease; Elementals and Fey can’t Charm or Frighten you.' },
  ),
  [LAND("nature's sanctuary", 14)]: numbers(
    [
      action({
        id: 'natures-sanctuary',
        name: "Nature's Sanctuary",
        actionType: 'other',
        saveDc: dc('wis'),
      }),
    ],
    { unoffered: NO_CHOICE },
  ),

  // ---- Circle of the Moon ----
  [MOON('circle of the moon', 2)]: text(),
  [MOON('combat wild shape', 2)]: numbers(
    [
      when({ toggle: 'wild-shape' }, [
        action({
          id: 'combat-wild-shape',
          name: 'Combat Wild Shape healing',
          actionType: 'bonus',
          costs: [{ slot: { minLevel: 1 } }],
          roll: '1d8',
        }),
      ]),
    ],
    {
      notes: 'Wild Shape is a Bonus Action for you. Healing is 1d8 per level of the slot spent.',
      needs: 'a heal that scales with the level of the slot spent',
    },
  ),
  [MOON('circle forms', 2)]: text({
    notes: 'Your Beast’s Max. CR is 1, then your Druid level divided by 3 from level 6.',
    needs: 'Wild Shape limits from the 2014 Beast Shapes tables (Max. CR, no Fly or Swim Speed)',
  }),
  [MOON('primal strike', 6)]: text(),
  [MOON('elemental wild shape', 10)]: numbers([
    action({
      id: 'elemental-wild-shape',
      name: 'Elemental Wild Shape',
      actionType: 'bonus',
      costs: [{ resource: 'wild-shape', amount: 2 }],
    }),
  ]),
  // Alter Self comes from the subclass's data; it is cast at will.
  [MOON('thousand forms', 14)]: text(),

  // ---- 2014 circles mapped in 8.3: their opening feature at Druid 2 ----
  [DS('dreams', 'xge', 'circle of dreams', 2)]: text(),
  [DS('shepherd', 'xge', 'circle of the shepherd', 2)]: text(),
  [DS('spores', 'tce', 'circle of spores', 2)]: text(),
  [DS('wildfire', 'tce', 'circle of wildfire', 2)]: text(),

  // ---- Circle of Stars ----
  [STARS('circle of stars', 2)]: text(),
  // Guidance and Guiding Bolt come from the subclass's data; these are the free casts.
  [STARS('star map', 2)]: numbers(
    [
      {
        type: 'grantSpells',
        spells: [
          {
            mode: 'innate',
            ability: 'wis',
            uses: { count: 'pb', recharge: 'long' },
            spell: { id: 'guiding bolt|phb' },
          },
        ],
      },
    ],
    { unoffered: 'The map’s form is flavor, with no rules.' },
  ),
  [STARS('starry form', 2)]: toggled(
    [
      {
        type: 'toggle',
        toggleId: 'starry-form',
        name: 'Starry Form',
        cost: [wildShape, { action: 'bonus' }],
        endsOn: ['shortRest', 'longRest'],
        effects: [],
        options: [
          {
            id: 'archer',
            name: 'Archer',
            effects: [
              action({ id: 'starry-archer', name: 'Archer', actionType: 'bonus', roll: starDice }),
            ],
          },
          {
            id: 'chalice',
            name: 'Chalice',
            effects: [
              action({
                id: 'starry-chalice',
                name: 'Chalice',
                actionType: 'other',
                roll: starDice,
              }),
            ],
          },
          {
            id: 'dragon',
            name: 'Dragon',
            effects: [
              { type: 'rollFloor', target: 'check:int', value: 10 },
              { type: 'rollFloor', target: 'check:wis', value: 10 },
              { type: 'rollFloor', target: 'save:concentration', value: 10 },
              when({ level: 10, classId: 'druid|phb' }, [
                { type: 'speed', mode: 'fly', value: 20 },
              ]),
            ],
          },
        ],
      },
    ],
    { unoffered: 'Picked each time: switch on Starry Form with that constellation.' },
  ),
  [STARS('archer', 2)]: text(),
  [STARS('chalice', 2)]: text(),
  [STARS('dragon', 2)]: text(),
  [STARS('cosmic omen', 6)]: numbers([
    uses('cosmic-omen', 'Cosmic Omen', 'pb', 'long'),
    action({
      id: 'cosmic-omen',
      name: 'Cosmic Omen',
      actionType: 'reaction',
      costs: [{ resource: 'cosmic-omen', amount: 1 }],
      roll: '1d6',
    }),
  ]),
  [STARS('twinkling constellations', 10)]: text(),
  [STARS('full of stars', 14)]: druidSub2024('stars', 'full of stars', 14),

  // ---- Fighter ----
  [FC('fighting style', 1)]: text(),
  [FC('second wind', 1)]: numbers([
    uses('second-wind', 'Second Wind', 1, 'short'),
    action({
      id: 'second-wind',
      name: 'Second Wind',
      actionType: 'bonus',
      costs: [{ resource: 'second-wind', amount: 1 }],
      outcomes: [{ heal: '1d10 + level.fighter' }],
    }),
  ]),
  // One use, two from Fighter 17, back on a Short Rest: the 2024 counter.
  [FC('action surge', 2)]: fighter2024('action surge', 2),
  [FC('action surge (two uses)', 17)]: text(),
  [FC('martial archetype', 3)]: text(),
  ...Object.fromEntries(
    [4, 6, 8, 12, 14, 16, 19].map((l) => [FC('ability score improvement', l), asi]),
  ),
  [FC('martial versatility', 4, 'tce')]: text(),
  [FC('extra attack', 5)]: fighter2024('extra attack', 5),
  [FC('extra attack (2)', 11)]: fighter2024('two extra attacks', 11),
  [FC('extra attack (3)', 20)]: fighter2024('three extra attacks', 20),
  // One use, two from 13, three from 17, back on a Long Rest: the 2024 counter.
  [FC('indomitable', 9)]: fighter2024('indomitable', 9),
  [FC('indomitable (two uses)', 13)]: text(),
  [FC('indomitable (three uses)', 17)]: text(),
  ...Object.fromEntries([7, 10, 15, 18].map((l) => [FC('martial archetype feature', l), text()])),

  // ---- Battle Master ----
  [BM('battle master', 3)]: text(),
  [BM('student of war', 3)]: numbers([
    {
      type: 'proficiencyChoice',
      category: 'tool',
      choice: { slot: 'tools', count: 1, from: 'any' },
      filter: 'artisan',
    },
  ]),
  // Four d8s, five from 7, six from 15; d10 from 10 and d12 from 18: the 2024 counter.
  [BM('combat superiority', 3)]: fighterSub2024('battle master', 'combat superiority', 3),
  [BM('maneuvers', 3)]: text(),
  [BM('maneuver options', 3, 'tce')]: text(),
  [BM('additional maneuvers', 7)]: text(),
  [BM('additional superiority die', 7)]: text(),
  [BM('know your enemy', 7)]: text({ unoffered: AT_TABLE }),
  [BM('additional maneuvers', 10)]: text(),
  [BM('improved combat superiority (d10)', 10)]: text(),
  [BM('additional maneuvers', 15)]: text(),
  [BM('additional superiority die', 15)]: text(),
  // One die back on rolling Initiative with none left (no cost to track).
  [BM('relentless', 15)]: text(),
  [BM('improved combat superiority (d12)', 18)]: text(),

  // ---- Champion ----
  [CHAMP('champion', 3)]: text(),
  [CHAMP('improved critical', 3)]: {
    ...fighterSub2024('champion', 'improved critical', 3),
    unoffered: NO_CHOICE,
  },
  [CHAMP('remarkable athlete', 7)]: numbers(
    [{ type: 'halfProficiency', targets: ['check:str', 'check:dex', 'check:con'] }],
    {
      notes:
        'Half your Proficiency Bonus is rounded up: add 1 by hand when it is odd. Your running long jump grows by your Strength modifier in feet.',
      needs: 'half proficiency rounded up',
    },
  ),
  [CHAMP('additional fighting style', 10)]: text(),
  [CHAMP('superior critical', 15)]: fighterSub2024('champion', 'superior critical', 15),
  [CHAMP('survivor', 18)]: numbers([
    action({
      id: 'survivor',
      name: 'Survivor',
      actionType: 'other',
      outcomes: [{ heal: '5 + mod.con' }],
    }),
  ]),

  // ---- Eldritch Knight ----
  [EK('eldritch knight', 3)]: text(),
  [EK('spellcasting', 3)]: text(),
  [EK('weapon bond', 3)]: numbers([
    action({ id: 'weapon-bond', name: 'Summon bonded weapon', actionType: 'bonus' }),
  ]),
  // After casting a cantrip with the action (any spell from Fighter 18: Improved War Magic).
  [EK('war magic', 7)]: numbers([
    action({
      id: 'war-magic',
      name: 'War Magic',
      actionType: 'bonus',
      attack: { source: ['weapon'] },
    }),
  ]),
  [EK('eldritch strike', 10)]: text(),
  [EK('arcane charge', 15)]: text(),
  [EK('improved war magic', 18)]: text(),

  // ---- Purple Dragon Knight (Banneret) ----
  [PDK('purple dragon knight (banneret)', 3)]: text(),
  [PDK('restriction%3A knighthood', 3)]: text(),
  // Used with Second Wind; each chosen ally regains the Fighter level in Hit Points.
  [PDK('rallying cry', 3)]: numbers(
    [
      action({
        id: 'rallying-cry',
        name: 'Rallying Cry',
        actionType: 'other',
        roll: 'level.fighter',
      }),
    ],
    { unoffered: TARGETS },
  ),
  [PDK('royal envoy', 7)]: numbers(
    [
      { type: 'proficiency', category: 'skill', value: 'persuasion' },
      { type: 'expertise', skill: 'persuasion' },
    ],
    {
      unoffered: 'Only when already proficient in Persuasion: add the other skill by hand.',
      notes:
        'Already proficient in Persuasion: pick Animal Handling, Insight, Intimidation or Performance and add it by hand.',
    },
  ),
  [PDK('inspiring surge', 10)]: text({ unoffered: TARGETS }),
  [PDK('bulwark', 15)]: text({ unoffered: TARGETS }),
  [PDK('inspiring surge', 18)]: text({ unoffered: TARGETS }),

  // ---- Arcane Archer ----
  [AA('arcane archer', 3)]: text(),
  // The cantrip pick comes from the subclass's data.
  [AA('arcane archer lore', 3)]: numbers([
    {
      type: 'proficiencyChoice',
      category: 'skill',
      choice: { slot: 'skill', count: 1, from: ['arcana', 'nature'] },
    },
  ]),
  [AA('arcane shot', 3)]: numbers([
    uses('arcane-shot', 'Arcane Shot', 2, 'short'),
    action({
      id: 'arcane-shot',
      name: 'Arcane Shot',
      actionType: 'other',
      costs: [{ resource: 'arcane-shot', amount: 1 }],
      saveDc: dc('int'),
    }),
  ]),
  [AA('arcane shot options', 3)]: text(),
  [AA('magic arrow', 7)]: text(),
  [AA('curving shot', 7)]: same(
    SUP_FIGHTER,
    'subclassFeature:curving shot|fighter|xphb|arcane archer|au|7|au',
  ),
  ...Object.fromEntries(
    [7, 10, 15, 18].map((l) => [AA('additional arcane shot option', l), text()]),
  ),
  // One use back on rolling Initiative with none left (no cost to track).
  [AA('ever-ready shot', 15)]: text(),

  // ---- Psi Warrior ----
  [PSI('psi warrior', 3)]: text(),
  // Twice the Proficiency Bonus in dice, all back on a Long Rest; one back as a Bonus Action
  // once per Short Rest. Its three powers are all the Psi Warrior's (see `ALL_POWERS`).
  [PSI('psionic power', 3)]: numbers(
    [
      uses('psionic-energy', 'Psionic Energy Dice', '2 * pb', 'long', {
        die: 'steps(level.fighter, 1, d6, 5, d8, 11, d10, 17, d12)',
      }),
      uses('psionic-recovery', 'Psionic Energy recovery', 1, 'short'),
      action({
        id: 'psionic-recovery',
        name: 'Regain a Psionic Energy Die',
        actionType: 'bonus',
        costs: [{ resource: 'psionic-recovery', amount: 1 }],
        outcomes: [{ restore: { resource: 'psionic-energy', amount: 1 } }],
      }),
      action({
        id: 'protective-field',
        name: 'Protective Field',
        actionType: 'reaction',
        costs: [psionic],
        roll: `${psiDie('1')} + mod.int`,
      }),
      {
        type: 'damageRider',
        id: 'psionic-strike',
        name: 'Psionic Strike',
        dice: `${psiDie('1')} + mod.int`,
        damageType: 'force',
        filter: { source: ['weapon'] },
        oncePerTurn: true,
        cost: psionic,
        optIn: true,
      },
      ...power2024('telekinetic movement', 3),
    ],
    { notes: ALL_POWERS, needs: OPTIONS_NEED },
  ),
  [PSI('protective field', 3)]: text(),
  [PSI('psionic strike', 3)]: text(),
  [PSI('telekinetic movement', 3)]: text({ unoffered: TARGETS }),
  [PSI('telekinetic adept', 7)]: numbers(
    [...power2024('psi-powered leap', 7), ...power2024('telekinetic thrust', 7)],
    { notes: ALL_POWERS, needs: OPTIONS_NEED },
  ),
  [PSI('psi-powered leap', 7)]: text(),
  [PSI('telekinetic thrust', 7)]: text(),
  [PSI('guarded mind', 10)]: fighterSub2024('psi warrior', 'guarded mind', 10),
  [PSI('bulwark of force', 15)]: fighterSub2024('psi warrior', 'bulwark of force', 15),
  // Telekinesis once per Long Rest comes from the subclass's data.
  [PSI('telekinetic master', 18)]: fighterSub2024('psi warrior', 'telekinetic master', 18),
};
