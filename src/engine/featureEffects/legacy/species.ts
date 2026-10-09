// 2014 species on 2024 characters (plan step 8.3): every 2014 species and lineage a 2024
// character can take, from every book, checked against the text of each. Ability increases are
// step 8.2's; speed, size, senses, resistances, skills and most spells come from the data.
// These add the traits with uses or numbers: breath weapons, natural weapons and natural armor,
// once-per-rest traits, d4 bonuses from dragonmarks, Dwarven Toughness style hit points,
// advantage on saves against a condition, flight lost in armor, and free casts the data leaves
// without a counter. A species chosen by its lineage (`dragonborn (ravenite; red)`,
// `kobold; defiance`) is its own entity, so each one gets the shared traits too.

import {
  refKey,
  type Ability,
  type ActionDef,
  type Effect,
  type Skill,
} from '../../../schema/index.ts';
import {
  action,
  AT_TABLE,
  attacksAgainst,
  dc,
  fromData,
  numbers,
  savesAgainst,
  text,
  toggled,
  uses,
  when,
} from '../core/helpers.ts';
import type { FeatureEffectsMap, FeatureMapping } from '../types.ts';

const SP = (id: string, source: string) => refKey({ kind: 'species', id: `${id}|${source}` });
const title = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
const slug = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, '-');

/** The base species of a family picked by its lineage: the lineage is its own species. */
const BY_LINEAGE = 'Picked by choosing the lineage as the species.';
const COSMETIC = 'A choice of looks only; the sheet has nothing to track.';
/** The trance's weapon-or-tool pick offers tools: the engine offers no pick from all weapons. */
const TRANCE_NEEDS = 'a weapon proficiency pick from all weapons';

// ---- Shared builders ----
const atLevel = (level: number, effects: Effect[]): Effect => ({ type: 'atLevel', level, effects });

/** A trait with uses: its counter and the action that spends one. */
function limited(
  id: string,
  name: string,
  max: string | number,
  recharge: 'short' | 'long' | 'none',
  actionType: ActionDef['actionType'],
  more: Partial<ActionDef> = {},
): Effect[] {
  return [
    uses(id, name, max, recharge),
    action({ id, name, actionType, costs: [{ resource: id, amount: 1 }], ...more }),
  ];
}

/** Unarmed strikes made with a natural weapon: its die and damage type. */
const strike = (label: string, die: string, damageType: string): Effect => ({
  type: 'attackMod',
  filter: { source: ['unarmed'] },
  label,
  damageDie: die,
  damageType,
});

/** A natural weapon that is its own attack. */
const natural = (
  id: string,
  name: string,
  damage: string,
  damageType: string,
  noModifier = false,
): Effect => ({
  type: 'attack',
  id,
  name,
  damage,
  damageType,
  range: 'melee',
  distance: '5 ft.',
  abilities: ['str'],
  ...(noModifier ? { damageAbility: 'none' as const } : {}),
});

/** Armor Class without body armor (a Shield still adds). */
const naturalArmor = (name: string, base: number, abilities: Ability[] = ['dex']): Effect => ({
  type: 'acFormula',
  name,
  base,
  addAbilities: abilities,
  shield: true,
});

/** A speed lost in some armor. */
const offInArmor = (mode: 'fly' | 'climb', armor: ('medium' | 'heavy')[]): Effect =>
  when({ any: armor.map((a) => ({ armor: a })) }, [{ type: 'speedOff', mode }]);
const NO_FLY_IN_ARMOR = offInArmor('fly', ['medium', 'heavy']);

/** A d4 added to checks with these skills (the dragonmarks' Intuition traits). */
const d4 = (...skills: Skill[]): Effect[] =>
  skills.map((s) => ({ type: 'rollBonus', target: `skill:${s}` as const, value: '1d4' }));

/** Advantage on a skill's checks in one situation: listed with the skill. */
const checksIn = (skill: Skill, against: string): Effect => ({
  type: 'rollMode',
  target: `skill:${skill}` as const,
  mode: 'advantage',
  against,
});

const mentalSaves = (against?: string): Effect[] =>
  (['int', 'wis', 'cha'] as const).map((a) => ({
    type: 'rollMode',
    target: `save:${a}`,
    mode: 'advantage',
    ...(against ? { against } : {}),
  }));

/** A once-per-Long-Rest free cast the data grants without a counter. */
const freeCast = (spell: string, trait: string, level = 1): Effect => {
  const counter = uses(slug(`${spell} free cast`), `${title(spell)} (${trait})`, 1, 'long');
  return level > 1 ? atLevel(level, [counter]) : counter;
};
const FREE_CAST_NOTE = 'The free cast is counted on its own row; casting it with a slot is normal.';

/** A once-per-Long-Rest spell the data leaves out. */
const missingSpell = (id: string, level: number, ability: Ability): Effect => ({
  type: 'grantSpells',
  spells: [
    {
      mode: 'innate',
      atLevel: level,
      ability,
      spell: { id },
      uses: { count: 1, recharge: 'long' },
    },
  ],
});

/** A save DC that uses Intelligence, Wisdom or Charisma, picked with the species. */
function dcAbility(slot: string, def: (saveDc: string) => Effect[]): Effect[] {
  const from = ['int', 'wis', 'cha'] as const;
  return [
    {
      type: 'optionChoice',
      choice: { slot, count: 1, from: [...from] },
      labels: ['Intelligence', 'Wisdom', 'Charisma'],
    },
    ...from.map((a): Effect => ({
      type: 'ifChoice',
      slot,
      value: a,
      effects: def(`8 + mod.${a} + pb`),
    })),
  ];
}

// ---- Shared traits ----
const FEY_ANCESTRY = savesAgainst('being Charmed');
const BRAVE = savesAgainst('being Frightened');
const POISON = savesAgainst('poison');
const SUNLIGHT: Effect[] = [
  { type: 'rollMode', target: 'attack:all', mode: 'disadvantage', against: 'in direct sunlight' },
  {
    type: 'rollMode',
    target: 'skill:perception',
    mode: 'disadvantage',
    against: 'sight, in direct sunlight',
  },
];
const RELENTLESS = limited('relentless-endurance', 'Relentless Endurance', 1, 'long', 'other');
const NIMBLE_ESCAPE = action({ id: 'nimble-escape', name: 'Nimble Escape', actionType: 'bonus' });
const FURY_OF_THE_SMALL: Effect[] = [
  uses('fury-of-the-small', 'Fury of the Small', 'pb', 'long'),
  {
    type: 'damageRider',
    id: 'fury-of-the-small',
    name: 'Fury of the Small',
    dice: 'pb',
    filter: {},
    oncePerTurn: true,
    cost: { resource: 'fury-of-the-small', amount: 1 },
    optIn: true,
  },
];
const telepathy = (range: number): Effect => ({ type: 'sense', sense: 'telepathy', range });
/** Trance: two proficiencies picked anew after each Long Rest. */
const trance = (slot: string, count: number, category: 'skill' | 'tool'): Effect => ({
  type: 'proficiencyChoice',
  category,
  choice: { slot, count, from: 'any', retrain: 'longRest' },
});
const ELF = numbers([FEY_ANCESTRY]);
const SAVAGE_NOTE = 'Savage Attacks: roll one extra weapon die on a melee critical hit, by hand.';
const SAVAGE_NEEDS = 'an extra weapon damage die on critical hits';
const ORCISH = numbers(RELENTLESS, { notes: SAVAGE_NOTE, needs: SAVAGE_NEEDS });

// ---- Dragonborn (Eberron and Wildemount, Fizban's) ----
const EGW_COLORS: Record<string, string> = {
  black: 'Acid',
  blue: 'Lightning',
  brass: 'Fire',
  bronze: 'Lightning',
  copper: 'Acid',
  gold: 'Fire',
  green: 'Poison',
  red: 'Fire',
  silver: 'Cold',
  white: 'Cold',
};
const egwBreath = (type?: string) =>
  limited(
    'breath-weapon',
    type ? `Breath Weapon (${type})` : 'Breath Weapon',
    1,
    'short',
    'action',
    {
      roll: 'dice(steps(level, 1, 2, 6, 3, 11, 4, 16, 5), 6)',
      saveDc: dc('con'),
    },
  );
const draconblood = (type?: string) =>
  numbers(
    [...egwBreath(type), ...limited('forceful-presence', 'Forceful Presence', 1, 'short', 'other')],
    type ? {} : { unoffered: BY_LINEAGE },
  );
const ravenite = (type?: string) =>
  numbers(
    [
      ...egwBreath(type),
      ...limited('vengeful-assault', 'Vengeful Assault', 1, 'short', 'reaction'),
    ],
    type ? {} : { unoffered: BY_LINEAGE },
  );

const GEMS: Record<string, string> = {
  amethyst: 'force',
  crystal: 'radiant',
  emerald: 'psychic',
  sapphire: 'thunder',
  topaz: 'necrotic',
};
const gemBreath = (type?: string) =>
  action({
    id: 'breath-weapon',
    name: type ? `Breath Weapon (${title(type)})` : 'Breath Weapon',
    actionType: 'other',
    costs: [{ resource: 'breath-weapon', amount: 1 }],
    roll: 'dice(steps(level, 1, 1, 5, 2, 11, 3, 17, 4), 10)',
    saveDc: dc('con'),
  });
/** `type` for a gem lineage; none for the base species, whose ancestry pick names it. */
function gem(type?: string): FeatureMapping {
  return toggled([
    uses('breath-weapon', 'Breath Weapon', 'pb', 'long'),
    ...(type
      ? [gemBreath(type)]
      : Object.values(GEMS).map((t): Effect => ({
          type: 'ifChoice',
          slot: 'resistance',
          value: t,
          effects: [gemBreath(t)],
        }))),
    telepathy(30),
    atLevel(5, [
      uses('gem-flight', 'Gem Flight', 1, 'long'),
      {
        type: 'toggle',
        toggleId: 'gem-flight',
        name: 'Gem Flight',
        cost: [{ resource: 'gem-flight', amount: 1 }, { action: 'bonus' }],
        endsOn: ['shortRest', 'longRest'],
        effects: [{ type: 'speed', mode: 'fly', value: 'walk' }],
      },
    ]),
  ]);
}

// ---- Others with several entities ----
const GRIT: Effect[] = [naturalArmor('Grit', 11)];
const KOBOLD_CRY = limited('draconic-cry', 'Draconic Cry', 'pb', 'long', 'bonus');
const MARK_OF_FINDING = numbers(
  [...d4('perception', 'survival'), freeCast("hunter's mark", "Finder's Magic")],
  {
    notes: FREE_CAST_NOTE,
  },
);
const VAMPIRE_BITE: Effect[] = [
  natural('blood-thirst', 'Blood Thirst', '1', 'piercing', true),
  {
    type: 'damageRider',
    id: 'blood-thirst',
    name: 'Blood Thirst',
    dice: '1d6',
    damageType: 'necrotic',
    filter: { tags: ['feature:blood-thirst'] },
    optIn: false,
  },
];
const HALF_ELF = numbers([FEY_ANCESTRY]);
const LUCKY_NOTE = 'Lucky: reroll a 1 on an attack roll, ability check or save, by hand.';

// ---- Eladrin (Monsters of the Multiverse) ----
const SEASONS = ['autumn', 'winter', 'spring', 'summer'];
const ELADRIN = numbers(
  [
    FEY_ANCESTRY,
    {
      type: 'optionChoice',
      choice: { slot: 'season', count: 1, from: SEASONS, retrain: 'longRest' },
      labels: SEASONS.map(title),
    },
    uses('fey-step', 'Fey Step', 'pb', 'long'),
    ...dcAbility('fey-step-ability', (saveDc) => [
      action({
        id: 'fey-step',
        name: 'Fey Step',
        actionType: 'bonus',
        costs: [{ resource: 'fey-step', amount: 1 }],
        saveDc,
      }),
    ]),
    trance('trance', 2, 'tool'),
  ],
  { notes: 'The season and the trance picks change after a Long Rest.', needs: TRANCE_NEEDS },
);

// ---- Simic Hybrid ----
const ENHANCEMENTS: [string, string, Effect[]][] = [
  ['manta-glide', 'Manta Glide', []],
  ['nimble-climber', 'Nimble Climber', [{ type: 'speed', mode: 'climb', value: 'walk' }]],
  [
    'underwater-adaptation',
    'Underwater Adaptation',
    [{ type: 'speed', mode: 'swim', value: 'walk' }],
  ],
];
const LATE_ENHANCEMENTS: [string, string, Effect[]][] = [
  [
    'grappling-appendage',
    'Grappling Appendage',
    [natural('grappling-appendage', 'Grappling Appendage', '1d6', 'bludgeoning')],
  ],
  ['carapace', 'Carapace', [when({ armor: 'notHeavy' }, [{ type: 'acBonus', value: 1 }])]],
  [
    'acid-spit',
    'Acid Spit',
    limited('acid-spit', 'Acid Spit', 'max(1, mod.con)', 'long', 'action', {
      roll: 'dice(steps(level, 1, 2, 11, 3, 17, 4), 10)',
      saveDc: dc('con'),
    }),
  ],
];
const enhancementPicks = (slot: string, list: [string, string, Effect[]][]): Effect[] => [
  {
    type: 'optionChoice',
    choice: { slot, count: 1, from: list.map(([id]) => id) },
    labels: list.map(([, label]) => label),
  },
  ...list.map(([id, , effects]): Effect => ({ type: 'ifChoice', slot, value: id, effects })),
];
const SIMIC_HYBRID = numbers(
  [
    ...enhancementPicks('enhancement', ENHANCEMENTS),
    atLevel(5, enhancementPicks('enhancement-5', [...ENHANCEMENTS, ...LATE_ENHANCEMENTS])),
  ],
  { notes: "The 5th-level pick is one you didn't take at 1st.", unoffered: COSMETIC },
);

// ---- Tortle ----
const TORTLE = numbers(
  [
    strike('Claws', '1d6', 'slashing'),
    naturalArmor('Natural Armor', 17, []),
    {
      type: 'toggle',
      toggleId: 'shell-defense',
      name: 'Shell Defense',
      cost: [{ action: 'action' }],
      effects: [
        { type: 'acBonus', value: 4 },
        { type: 'rollMode', target: 'save:str', mode: 'advantage' },
        { type: 'rollMode', target: 'save:con', mode: 'advantage' },
        { type: 'rollMode', target: 'save:dex', mode: 'disadvantage' },
      ],
    },
  ],
  { notes: 'A tortle wears no armor; the sheet does not stop it.' },
);

export const LEGACY_SPECIES: FeatureEffectsMap = {
  [SP('aarakocra', 'dmg')]: numbers([
    strike('Talons', '1d4', 'slashing'),
    {
      type: 'damageRider',
      id: 'dive-attack',
      name: 'Dive Attack',
      dice: '1d6',
      filter: { range: 'melee' },
      optIn: true,
    },
  ]),
  [SP('aarakocra', 'mpmm')]: numbers(
    [
      NO_FLY_IN_ARMOR,
      strike('Talons', '1d6', 'slashing'),
      freeCast('gust of wind', 'Wind Caller', 3),
    ],
    { notes: FREE_CAST_NOTE },
  ),
  [SP('aetherborn', 'psk')]: fromData(),
  [SP('astral elf', 'aag')]: numbers(
    [
      FEY_ANCESTRY,
      ...limited('starlight-step', 'Starlight Step', 'pb', 'long', 'bonus'),
      trance('astral-trance-skill', 1, 'skill'),
      trance('astral-trance-tool', 1, 'tool'),
    ],
    { notes: 'The trance picks change after each Long Rest.', needs: TRANCE_NEEDS },
  ),
  [SP('autognome', 'aag')]: numbers([
    naturalArmor('Armored Casing', 13),
    ...limited('built-for-success', 'Built for Success', 'pb', 'long', 'other', { roll: '1d4' }),
    savesAgainst('being Paralyzed or Poisoned'),
  ]),
  [SP('aven', 'psa')]: numbers([NO_FLY_IN_ARMOR]),
  [SP('aven', 'psd')]: numbers([NO_FLY_IN_ARMOR]),
  [SP('aven (hawk-headed)', 'psa')]: numbers([NO_FLY_IN_ARMOR]),
  [SP('aven (ibis-headed)', 'psa')]: numbers([
    NO_FLY_IN_ARMOR,
    { type: 'halfProficiency', targets: ['check:int'] },
  ]),
  [SP('bugbear', 'mpmm')]: numbers(
    [
      FEY_ANCESTRY,
      {
        type: 'damageRider',
        id: 'surprise-attack',
        name: 'Surprise Attack',
        dice: '2d6',
        filter: {},
        optIn: true,
      },
    ],
    { notes: 'Long-Limbed: 5 feet more reach on your turn, by hand.' },
  ),
  [SP('bullywug', 'dmg')]: numbers([checksIn('stealth', 'hiding in swamps')]),
  [SP('centaur', 'mpmm')]: numbers([
    strike('Hooves', '1d6', 'bludgeoning'),
    action({ id: 'charge', name: 'Charge', actionType: 'bonus' }),
  ]),
  [SP('custom lineage', 'tce')]: text({
    unoffered: BY_LINEAGE,
    notes: 'This entry gives both Variable Trait options; pick one of its two versions instead.',
  }),
  [SP('custom lineage; darkvision', 'tce')]: fromData(),
  [SP('custom lineage; skill proficiency', 'tce')]: fromData(),
  [SP('deep gnome', 'mpmm')]: numbers([
    ...mentalSaves('spells'),
    ...limited('svirfneblin-camouflage', 'Svirfneblin Camouflage', 'pb', 'long', 'other'),
  ]),
  ...Object.fromEntries(
    Object.entries(EGW_COLORS).flatMap(([color, type]) => [
      [SP(`dragonborn (draconblood; ${color})`, 'egw'), draconblood(type)],
      [SP(`dragonborn (ravenite; ${color})`, 'egw'), ravenite(type)],
    ]),
  ),
  [SP('dragonborn (draconblood)', 'egw')]: draconblood(),
  [SP('dragonborn (ravenite)', 'egw')]: ravenite(),
  ...Object.fromEntries(
    Object.entries(GEMS).map(([name, type]) => [SP(`dragonborn (gem; ${name})`, 'ftd'), gem(type)]),
  ),
  [SP('dragonborn (gem)', 'ftd')]: gem(),
  [SP('duergar', 'mpmm')]: numbers([
    savesAgainst('being Poisoned'),
    savesAgainst('being Charmed or Stunned'),
  ]),
  [SP('dwarf (kaladesh)', 'psk')]: numbers([POISON, { type: 'hpBonus', perLevel: 1 }], {
    notes: 'Double proficiency with the two chosen tools is added by hand.',
    needs: 'expertise with a tool',
  }),
  [SP('dwarf (mark of warding)', 'erlw')]: numbers(
    [
      POISON,
      ...d4('investigation'),
      freeCast('alarm', 'Wards and Seals'),
      freeCast('mage armor', 'Wards and Seals'),
      missingSpell('arcane lock|phb', 3, 'int'),
    ],
    { notes: `${FREE_CAST_NOTE} The d4 with thieves' tools is added by hand.` },
  ),
  [SP('eladrin', 'mpmm')]: ELADRIN,
  [SP('elf (eladrin)', 'dmg')]: ELF,
  [SP('elf (kaladesh; bishatar and tirahar)', 'psk')]: ELF,
  [SP('elf (kaladesh; vahadar)', 'psk')]: numbers([
    FEY_ANCESTRY,
    {
      type: 'proficiencyChoice',
      category: 'language',
      choice: { slot: 'extra-language', count: 1, from: 'any' },
      filter: 'standard',
    },
  ]),
  [SP('elf (kaladesh)', 'psk')]: { ...ELF, unoffered: BY_LINEAGE },
  [SP('elf (mark of shadow)', 'erlw')]: numbers([FEY_ANCESTRY, ...d4('performance', 'stealth')]),
  [SP('elf (pallid)', 'egw')]: numbers([
    FEY_ANCESTRY,
    { type: 'rollMode', target: 'skill:investigation', mode: 'advantage' },
    { type: 'rollMode', target: 'skill:insight', mode: 'advantage' },
  ]),
  [SP('elf (zendikar; joraga nation)', 'psz')]: ELF,
  [SP('elf (zendikar; mul daya nation)', 'psz')]: numbers([FEY_ANCESTRY, ...SUNLIGHT]),
  [SP('elf (zendikar; tajuru nation)', 'psz')]: ELF,
  [SP('elf (zendikar)', 'psz')]: ELF,
  [SP('fairy', 'mpmm')]: numbers([NO_FLY_IN_ARMOR]),
  [SP('firbolg', 'mpmm')]: numbers(
    [
      freeCast('detect magic', 'Firbolg Magic'),
      freeCast('disguise self', 'Firbolg Magic'),
      ...limited('hidden-step', 'Hidden Step', 'pb', 'long', 'bonus'),
      { type: 'rollMode', target: 'check:cha', mode: 'advantage', against: 'Beasts and Plants' },
    ],
    { notes: FREE_CAST_NOTE },
  ),
  [SP('genasi', 'mpmm')]: text({ unoffered: BY_LINEAGE }),
  [SP('genasi (air)', 'mpmm')]: fromData(),
  [SP('genasi (earth)', 'mpmm')]: numbers(
    [
      ...limited('merge-with-stone', 'Merge with Stone', 'pb', 'long', 'bonus'),
      freeCast('pass without trace', 'Merge with Stone', 5),
    ],
    { notes: `Merge with Stone's uses cast Blade Ward as a Bonus Action. ${FREE_CAST_NOTE}` },
  ),
  [SP('genasi (fire)', 'mpmm')]: fromData(),
  [SP('genasi (water)', 'mpmm')]: fromData(),
  [SP('giff', 'aag')]: numbers(
    [
      uses('astral-spark', 'Astral Spark', 'pb', 'long'),
      {
        type: 'damageRider',
        id: 'astral-spark',
        name: 'Astral Spark',
        dice: 'pb',
        damageType: 'force',
        filter: { source: ['weapon'] },
        oncePerTurn: true,
        cost: { resource: 'astral-spark', amount: 1 },
        optIn: true,
      },
      { type: 'rollMode', target: 'check:str', mode: 'advantage' },
      { type: 'rollMode', target: 'save:str', mode: 'advantage' },
    ],
    { notes: 'Firearms ignore Loading and long range for you, by hand.' },
  ),
  [SP('githyanki', 'mpmm')]: text({
    notes: 'The skill and tool picks may change after each Long Rest: change them on the sheet.',
  }),
  [SP('githzerai', 'mpmm')]: numbers([savesAgainst('being Charmed or Frightened')]),
  [SP('gnoll', 'dmg')]: numbers([
    strike('Bite', '1d4', 'piercing'),
    action({ id: 'rampage', name: 'Rampage', actionType: 'bonus' }),
  ]),
  [SP('gnome (deep)', 'dmg')]: numbers(
    [
      ...mentalSaves('magic'),
      checksIn('stealth', 'hiding in rocky terrain'),
      freeCast('blindness/deafness', 'Innate Spellcasting'),
      freeCast('blur', 'Innate Spellcasting'),
      freeCast('disguise self', 'Innate Spellcasting'),
    ],
    { notes: FREE_CAST_NOTE },
  ),
  [SP('gnome (mark of scribing)', 'erlw')]: numbers([...mentalSaves('magic'), ...d4('history')], {
    notes: "The d4 with calligrapher's supplies is added by hand.",
  }),
  [SP('goblin', 'dmg')]: numbers([NIMBLE_ESCAPE]),
  [SP('goblin', 'mpmm')]: numbers([FEY_ANCESTRY, ...FURY_OF_THE_SMALL, NIMBLE_ESCAPE]),
  [SP('goblin', 'psz')]: numbers(GRIT),
  [SP('goblin (ixalan)', 'psx')]: numbers([
    ...GRIT,
    { type: 'resistance', value: 'fire' },
    { type: 'resistance', value: 'psychic' },
    { type: 'speed', mode: 'climb', value: 25 },
    offInArmor('climb', ['medium', 'heavy']),
  ]),
  [SP('goblin (zendikar; grotag tribe)', 'psz')]: numbers(GRIT),
  [SP('goblin (zendikar; lavastep tribe)', 'psz')]: numbers([
    ...GRIT,
    checksIn('stealth', 'hiding in rocky or underground places'),
  ]),
  [SP('goblin (zendikar; tuktuk tribe)', 'psz')]: numbers(GRIT),
  [SP('grimlock', 'dmg')]: numbers([
    { type: 'conditionImmunity', value: 'blinded' },
    checksIn('perception', 'hearing or smell'),
    checksIn('stealth', 'hiding in rocky terrain'),
  ]),
  [SP('grung', 'oga')]: text(),
  [SP('hadozee', 'aag')]: numbers([
    ...limited('hadozee-dodge', 'Hadozee Dodge', 'pb', 'long', 'reaction', { roll: '1d6 + pb' }),
    action({ id: 'glide', name: 'Glide', actionType: 'reaction' }),
    action({ id: 'dexterous-feet', name: 'Dexterous Feet', actionType: 'bonus' }),
  ]),
  [SP('half-elf (variant; aquatic elf descent)', 'scag')]: HALF_ELF,
  [SP('half-elf (variant; drow descent)', 'scag')]: HALF_ELF,
  [SP('half-elf (variant; mark of detection)', 'erlw')]: numbers(
    [
      FEY_ANCESTRY,
      ...d4('investigation', 'insight'),
      freeCast('detect magic', 'Magical Detection'),
      freeCast('detect poison and disease', 'Magical Detection'),
    ],
    { notes: FREE_CAST_NOTE },
  ),
  [SP('half-elf (variant; mark of storm)', 'erlw')]: numbers(
    [FEY_ANCESTRY, ...d4('acrobatics'), missingSpell('gust of wind|phb', 3, 'cha')],
    { notes: "The d4 with navigator's tools is added by hand." },
  ),
  [SP('half-elf (variant; moon elf or sun elf descent)', 'scag')]: HALF_ELF,
  [SP('half-elf (variant; wood elf descent)', 'scag')]: HALF_ELF,
  [SP('half-orc', 'phb')]: ORCISH,
  [SP('half-orc (variant; mark of finding)', 'erlw')]: MARK_OF_FINDING,
  [SP('halfling (ghostwise)', 'scag')]: numbers([BRAVE, telepathy(30)], { notes: LUCKY_NOTE }),
  [SP('halfling (lotusden)', 'egw')]: numbers([BRAVE], { notes: LUCKY_NOTE }),
  [SP('halfling (mark of healing)', 'erlw')]: numbers(
    [BRAVE, ...d4('medicine'), freeCast('cure wounds', 'Healing Touch')],
    { notes: `${LUCKY_NOTE} ${FREE_CAST_NOTE} The d4 with an herbalism kit is added by hand.` },
  ),
  [SP('halfling (mark of hospitality)', 'erlw')]: numbers(
    [
      BRAVE,
      ...d4('persuasion'),
      freeCast('purify food and drink', "Innkeeper's Magic"),
      freeCast('unseen servant', "Innkeeper's Magic"),
    ],
    {
      notes: `${LUCKY_NOTE} ${FREE_CAST_NOTE} The d4 with brewing or cooking tools is added by hand.`,
    },
  ),
  [SP('harengon', 'mpmm')]: numbers([
    { type: 'initiativeBonus', value: 'pb' },
    action({ id: 'lucky-footwork', name: 'Lucky Footwork', actionType: 'reaction', roll: '1d4' }),
    ...limited('rabbit-hop', 'Rabbit Hop', 'pb', 'long', 'bonus'),
  ]),
  [SP('hobgoblin', 'dmg')]: numbers([
    {
      type: 'damageRider',
      id: 'martial-advantage',
      name: 'Martial Advantage',
      dice: '2d6',
      filter: { source: ['weapon'] },
      oncePerTurn: true,
      optIn: true,
    },
  ]),
  [SP('hobgoblin', 'mpmm')]: numbers(
    [
      FEY_ANCESTRY,
      ...limited('fey-gift', 'Fey Gift', 'pb', 'long', 'bonus'),
      ...limited('fortune-from-the-many', 'Fortune from the Many', 'pb', 'long', 'other'),
    ],
    { unoffered: AT_TABLE },
  ),
  [SP('human (amonkhet)', 'psa')]: fromData(),
  [SP('human (innistrad; gavony)', 'psi')]: fromData(),
  [SP('human (innistrad; kessig)', 'psi')]: text(),
  [SP('human (innistrad; nephalia)', 'psi')]: fromData(),
  [SP('human (innistrad; stensia)', 'psi')]: numbers([{ type: 'hpBonus', perLevel: 2 }]),
  [SP('human (innistrad)', 'psi')]: fromData(),
  [SP('human (ixalan)', 'psx')]: fromData(),
  [SP('human (kaladesh)', 'psk')]: fromData(),
  [SP('human (keldon)', 'psd')]: numbers([{ type: 'proficiency', category: 'save', value: 'str' }]),
  [SP('human (mark of handling)', 'erlw')]: numbers(d4('animal handling', 'nature')),
  [SP('human (mark of making)', 'erlw')]: numbers(
    [...d4('arcana'), freeCast('magic weapon', 'Spellsmith')],
    { notes: `${FREE_CAST_NOTE} The d4 with artisan's tools is added by hand.` },
  ),
  [SP('human (mark of passage)', 'erlw')]: numbers(
    [...d4('acrobatics'), freeCast('misty step', 'Magical Passage')],
    { notes: `${FREE_CAST_NOTE} The d4 with land vehicles is added by hand.` },
  ),
  [SP('human (mark of sentinel)', 'erlw')]: numbers(
    [
      ...d4('insight', 'perception'),
      freeCast('shield', "Guardian's Shield"),
      ...limited('vigilant-guardian', 'Vigilant Guardian', 1, 'long', 'reaction'),
    ],
    { notes: FREE_CAST_NOTE },
  ),
  [SP('human (variant; mark of finding)', 'erlw')]: MARK_OF_FINDING,
  [SP('human (zendikar)', 'psz')]: fromData(),
  [SP('kender', 'dsotdq')]: numbers([
    BRAVE,
    ...limited('fearless', 'Fearless', 1, 'long', 'other'),
    uses('taunt', 'Taunt', 'pb', 'long'),
    ...dcAbility('taunt-ability', (saveDc) => [
      action({
        id: 'taunt',
        name: 'Taunt',
        actionType: 'bonus',
        costs: [{ resource: 'taunt', amount: 1 }],
        saveDc,
      }),
    ]),
  ]),
  [SP('kenku', 'dmg')]: numbers([attacksAgainst('Surprised creatures, in the first round')]),
  [SP('kenku', 'mpmm')]: numbers(limited('kenku-recall', 'Kenku Recall', 'pb', 'long', 'other')),
  // With no living twin, the khenra can't be Frightened.
  [SP('khenra', 'psa')]: toggled([
    {
      type: 'toggle',
      toggleId: 'no-living-twin',
      name: 'No living twin',
      effects: [{ type: 'conditionImmunity', value: 'frightened' }],
    },
  ]),
  [SP('kobold', 'dmg')]: numbers([
    attacksAgainst('a creature next to an ally of yours'),
    ...SUNLIGHT,
  ]),
  [SP('kobold', 'mpmm')]: numbers(KOBOLD_CRY, {
    unoffered: BY_LINEAGE,
    notes: 'This entry gives two Kobold Legacy options; pick one of the legacies instead.',
  }),
  [SP('kobold; craftiness', 'mpmm')]: numbers(KOBOLD_CRY),
  [SP('kobold; defiance', 'mpmm')]: numbers([...KOBOLD_CRY, BRAVE]),
  [SP('kobold; draconic sorcery', 'mpmm')]: numbers(KOBOLD_CRY),
  [SP('kor', 'psz')]: numbers([BRAVE, offInArmor('climb', ['heavy'])], { notes: LUCKY_NOTE }),
  [SP('kuo-toa', 'dmg')]: numbers([
    savesAgainst('escaping a grapple'),
    checksIn('athletics', 'escaping a grapple'),
    checksIn('acrobatics', 'escaping a grapple'),
    ...SUNLIGHT,
  ]),
  [SP('leonin', 'mot')]: numbers([
    strike('Claws', '1d4', 'slashing'),
    ...limited('daunting-roar', 'Daunting Roar', 1, 'short', 'bonus', { saveDc: dc('con') }),
  ]),
  [SP('lizardfolk', 'dmg')]: numbers([{ type: 'acBonus', value: 3 }]),
  [SP('lizardfolk', 'mpmm')]: numbers([
    strike('Bite', '1d6', 'slashing'),
    ...limited('hungry-jaws', 'Hungry Jaws', 'pb', 'long', 'bonus', {
      outcomes: [{ tempHp: 'pb' }],
    }),
    naturalArmor('Natural Armor', 13),
  ]),
  [SP('locathah', 'lr')]: numbers([
    naturalArmor('Natural Armor', 12),
    savesAgainst('being Charmed, Frightened, Paralyzed, Poisoned, Stunned or put to sleep'),
  ]),
  [SP('loxodon', 'ggr')]: numbers([
    naturalArmor('Natural Armor', 12, ['con']),
    savesAgainst('being Charmed or Frightened'),
    checksIn('perception', 'smell'),
    checksIn('survival', 'smell'),
    checksIn('investigation', 'smell'),
  ]),
  [SP('merfolk', 'dmg')]: fromData(),
  [SP('merfolk', 'psz')]: fromData(),
  [SP('merfolk (ixalan; blue)', 'psx')]: fromData(),
  [SP('merfolk (ixalan; green)', 'psx')]: fromData(),
  [SP('merfolk (zendikar; cosi creed)', 'psz')]: fromData(),
  [SP('merfolk (zendikar; emeria creed)', 'psz')]: fromData(),
  [SP('merfolk (zendikar; ula creed)', 'psz')]: fromData(),
  [SP('minotaur', 'mpmm')]: numbers([
    strike('Horns', '1d6', 'piercing'),
    action({ id: 'goring-rush', name: 'Goring Rush', actionType: 'bonus' }),
    action({
      id: 'hammering-horns',
      name: 'Hammering Horns',
      actionType: 'bonus',
      saveDc: dc('str'),
    }),
    checksIn('survival', 'navigating or tracking'),
  ]),
  [SP('minotaur (amonkhet)', 'psa')]: numbers(
    [strike('Horns', '1d6', 'bludgeoning'), ...RELENTLESS],
    { notes: SAVAGE_NOTE, needs: SAVAGE_NEEDS },
  ),
  [SP('naga', 'psa')]: numbers([
    natural('naga-bite', 'Bite', '1d4', 'piercing'),
    natural('naga-constrict', 'Constrict', '1d6', 'bludgeoning'),
    {
      type: 'toggle',
      toggleId: 'speed-burst',
      name: 'Speed Burst',
      cost: [{ action: 'bonus' }],
      effects: [{ type: 'speedBonus', value: 5 }],
    },
  ]),
  [SP('orc (ixalan)', 'psx')]: ORCISH,
  [SP('owlin', 'scc')]: numbers([NO_FLY_IN_ARMOR]),
  [SP('plasmoid', 'aag')]: numbers([
    savesAgainst('being Poisoned'),
    checksIn('athletics', 'starting or escaping a grapple'),
    checksIn('acrobatics', 'escaping a grapple'),
    action({ id: 'shape-self', name: 'Shape Self', actionType: 'action' }),
    action({ id: 'pseudopod', name: 'Pseudopod', actionType: 'bonus' }),
  ]),
  [SP('satyr', 'mpmm')]: numbers([strike('Ram', '1d6', 'bludgeoning'), savesAgainst('spells')]),
  [SP('sea elf', 'mpmm')]: numbers([FEY_ANCESTRY, trance('trance', 2, 'tool')], {
    notes: 'The trance picks change after each Long Rest.',
    needs: TRANCE_NEEDS,
  }),
  [SP('shadar-kai', 'mpmm')]: numbers(
    [
      FEY_ANCESTRY,
      ...limited(
        'blessing-of-the-raven-queen',
        'Blessing of the Raven Queen',
        'pb',
        'long',
        'bonus',
      ),
      trance('trance', 2, 'tool'),
    ],
    { notes: 'The trance picks change after each Long Rest.', needs: TRANCE_NEEDS },
  ),
  [SP('simic hybrid', 'ggr')]: SIMIC_HYBRID,
  [SP('siren', 'psx')]: numbers([NO_FLY_IN_ARMOR]),
  [SP('skeleton', 'dmg')]: fromData(),
  [SP('tabaxi', 'mpmm')]: numbers(
    [
      strike("Cat's Claws", '1d6', 'slashing'),
      ...limited('feline-agility', 'Feline Agility', 1, 'none', 'other'),
    ],
    {
      notes: 'Feline Agility comes back after a turn you stay still: reset it by hand.',
      needs: 'a recharge on a turn without movement',
    },
  ),
  [SP('thri-kreen', 'aag')]: numbers([
    naturalArmor('Chameleon Carapace', 13),
    action({ id: 'chameleon-carapace', name: 'Chameleon Carapace', actionType: 'action' }),
    checksIn('stealth', 'hiding in matching surroundings'),
    telepathy(120),
  ]),
  [SP('tiefling (asmodeus)', 'mtf')]: fromData(),
  [SP('tiefling (baalzebul)', 'mtf')]: fromData(),
  [SP('tiefling (dispater)', 'mtf')]: fromData(),
  [SP('tiefling (fierna)', 'mtf')]: fromData(),
  [SP('tiefling (glasya)', 'mtf')]: fromData(),
  [SP('tiefling (levistus)', 'mtf')]: fromData(),
  [SP('tiefling (mammon)', 'mtf')]: fromData(),
  [SP('tiefling (mephistopheles)', 'mtf')]: fromData(),
  [SP("tiefling (variant; devil's tongue)", 'scag')]: { ...fromData(), unoffered: COSMETIC },
  [SP('tiefling (variant; hellfire)', 'scag')]: { ...fromData(), unoffered: COSMETIC },
  [SP('tiefling (variant; infernal legacy)', 'scag')]: { ...fromData(), unoffered: COSMETIC },
  [SP('tiefling (variant; winged)', 'scag')]: numbers([offInArmor('fly', ['heavy'])], {
    unoffered: COSMETIC,
  }),
  [SP('tiefling (zariel)', 'mtf')]: fromData(),
  [SP('tortle', 'mpmm')]: TORTLE,
  [SP('triton', 'mpmm')]: fromData(),
  [SP('troglodyte', 'dmg')]: numbers([
    checksIn('stealth', 'hiding'),
    { type: 'acBonus', value: 1 },
    ...SUNLIGHT,
  ]),
  [SP('vampire', 'psz')]: numbers(VAMPIRE_BITE),
  [SP('vampire (ixalan)', 'psx')]: toggled([
    ...VAMPIRE_BITE,
    {
      type: 'toggle',
      toggleId: 'feast-of-blood',
      name: 'Feast of Blood',
      effects: [
        { type: 'speedBonus', value: 10 },
        ...(['check:str', 'check:dex', 'save:str', 'save:dex'] as const).map((target): Effect => ({
          type: 'rollMode',
          target,
          mode: 'advantage',
        })),
      ],
    },
  ]),
  [SP('vampire (zendikar)', 'psz')]: numbers(VAMPIRE_BITE),
  [SP('variant; aquatic elf descent; skill versatility', 'scag')]: HALF_ELF,
  [SP('variant; aquatic elf descent; swim speed', 'scag')]: HALF_ELF,
  [SP('variant; drow descent; drow magic', 'scag')]: HALF_ELF,
  [SP('variant; drow descent; skill versatility', 'scag')]: HALF_ELF,
  [SP('variant; gifted aetherborn', 'psk')]: numbers(
    [natural('drain-life', 'Drain Life', '1d6', 'necrotic', true)],
    { notes: 'Drain Life heals you by its damage; the weekly loss is tracked by hand.' },
  ),
  [SP('variant; moon elf or sun elf descent; cantrip', 'scag')]: HALF_ELF,
  [SP('variant; moon elf or sun elf descent; elf weapon training', 'scag')]: HALF_ELF,
  [SP('variant; moon elf or sun elf descent; skill versatility', 'scag')]: HALF_ELF,
  [SP('variant; wood elf descent; elf weapon training', 'scag')]: HALF_ELF,
  [SP('variant; wood elf descent; fleet of foot', 'scag')]: HALF_ELF,
  [SP('variant; wood elf descent; mask of the wild', 'scag')]: HALF_ELF,
  [SP('variant; wood elf descent; skill versatility', 'scag')]: HALF_ELF,
  [SP('vedalken', 'ggr')]: numbers(
    [
      ...mentalSaves(),
      ...(
        [
          'arcana',
          'history',
          'investigation',
          'medicine',
          'performance',
          'sleight of hand',
        ] as const
      ).map((skill): Effect => ({
        type: 'ifChoice',
        slot: 'skills',
        value: skill,
        effects: d4(skill),
      })),
      uses('partially-amphibious', 'Partially Amphibious', 1, 'long'),
    ],
    { notes: 'The d4 with the chosen tool is added by hand.' },
  ),
  [SP('vedalken', 'psk')]: numbers(mentalSaves('magic')),
  [SP('verdan', 'ai')]: numbers(
    [
      { type: 'rollMode', target: 'save:wis', mode: 'advantage' },
      { type: 'rollMode', target: 'save:cha', mode: 'advantage' },
      telepathy(30),
    ],
    { notes: 'Black Blood Healing: reroll a Hit Die of 1 or 2 on a Short Rest, by hand.' },
  ),
  [SP('yuan-ti', 'mpmm')]: numbers([savesAgainst('spells'), savesAgainst('being Poisoned')]),
  [SP('zombie', 'dmg')]: text(),
};
