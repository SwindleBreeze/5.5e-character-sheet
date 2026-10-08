// The six 2024 Artificer subclasses (plan §10.2, step 6.16): Alchemist, Armorer, Artillerist,
// Battle Smith and Cartographer (EFA) and Reanimator (RHW). Subclass spells, and the Alchemist's
// Lesser Restoration and Bubbling Cauldron casts, come from the subclass data. Companions
// (Steel Defender, Eldritch Cannon, Reanimated Companion) are not run by the sheet: their
// stat blocks are text; the sheet tracks how often they are made and the actions that command
// them. Each subclass defines its own counters, so nothing here leans on the class's ids.

import type { AttackFilter, Effect } from '../../../schema/index.ts';
import type { FeatureEffectsMap } from '../types.ts';
import {
  action,
  AT_TABLE,
  dc,
  numbers,
  restoredBy,
  TARGETS,
  text,
  toggled,
  uses,
  when,
} from '../core/helpers.ts';

const S = (sub: string, id: string, level: number) =>
  `subclassFeature:${id}|artificer|efa|${sub}|efa|${level}|efa` as const;
const R = (id: string, level: number) =>
  `subclassFeature:${id}|artificer|efa|reanimator|rhw|${level}|rhw` as const;

const ARTIFICER = 'artificer|efa';
const intUses = 'max(1, mod.int)';
const anySlot = { slot: { minLevel: 1 } };
const spend = (resource: string) => ({ resource, amount: 1 });
const atLevel = (level: number) => ({ level, classId: ARTIFICER });

/** Tools of the Trade: a fallback Artisan's Tools pick only when the tool is already known. */
const FALLBACK_TOOL =
  "Only when a granted tool is already known: pick another Artisan's Tools at the table.";

const tool = (id: string): Effect => ({ type: 'proficiency', category: 'tool', value: id });

/** Free casts of a spell, paid from the grant's own counter, cast with Intelligence. */
function freeCasts(id: string, count: string | number): Effect {
  return {
    type: 'grantSpells',
    spells: [{ mode: 'innate', ability: 'int', uses: { count, recharge: 'long' }, spell: { id } }],
  };
}

/** Made once per Long Rest, or again for a spell slot, with a Magic action. */
function oncePerRestOrSlot(id: string, name: string): Effect[] {
  return [
    uses(id, name, 1, 'long'),
    restoredBy(id, anySlot),
    action({ id, name, actionType: 'action', costs: [spend(id)] }),
  ];
}

// ---- Armorer: the armor model is picked when Arcane Armor is switched on ----
const model = (option: string) => ({ toggle: 'arcane-armor', option });
const MODEL_ABILITY = "Uses Intelligence instead of Strength or Dexterity when it's better.";
// The model weapons are feature attacks (no item), so filters pick them out by what no
// ordinary weapon has: the demolisher is the only Reach weapon that is neither Heavy nor
// Finesse; the launcher the only ranged weapon without Ammunition or Thrown.
const DEMOLISHER: AttackFilter = {
  range: 'melee',
  source: ['weapon'],
  properties: ['R'],
  notProperties: ['H', 'F'],
};
const LAUNCHER: AttackFilter = { range: 'ranged', source: ['weapon'], notProperties: ['A', 'T'] };
// The pulse has no properties; a few plain weapons (Mace, Flail) don't either, but an Armorer
// never uses Intelligence with those.
const PULSE: AttackFilter = {
  range: 'melee',
  source: ['weapon'],
  ability: ['int'],
  notProperties: ['F', 'L', 'H', '2H', 'R', 'T', 'V'],
};

// ---- Battle Smith: attacks with a magic weapon. The sheet knows magic items and variants; a
// switch makes the other weapons count (one made magic by a spell). ----
const magicWeapon = { toggle: 'battle-ready' };
const battleReady: Extract<Effect, { type: 'attackMod' }> = {
  type: 'attackMod',
  label: 'Battle Ready',
  filter: { source: ['weapon'] },
  abilities: ['int'],
};
const arcaneJolt: Extract<Effect, { type: 'damageRider' }> = {
  type: 'damageRider',
  id: 'arcane-jolt',
  name: 'Arcane Jolt',
  dice: 'steps(level.artificer, 9, 2d6, 15, 4d6)',
  damageType: 'force',
  filter: { source: ['weapon'] },
  oncePerTurn: true,
  cost: { resource: 'arcane-jolt', amount: 1 },
  optIn: true,
};
/** On magic weapons always; on the others while the switch is on. */
const onMagicWeapons = (
  effect: Extract<Effect, { type: 'attackMod' | 'damageRider' }>,
): Effect[] => {
  const on = (magic: boolean): Effect => ({ ...effect, filter: { ...effect.filter, magic } });
  return [on(true), when(magicWeapon, [on(false)])];
};

// ---- Cartographer ----
const mapHolder = { toggle: 'atlas-map' };

export const SUP_ARTIFICER_SUBCLASSES: FeatureEffectsMap = {
  // ---- Alchemist ----
  [S('alchemist', 'alchemist', 3)]: text(),
  [S('alchemist', 'tools of the trade', 3)]: numbers(
    [tool("alchemist's supplies|xphb"), tool('herbalism kit|xphb')],
    { unoffered: FALLBACK_TOOL, notes: 'Brewing potions takes half the time.' },
  ),
  [S('alchemist', 'alchemist spells', 3)]: text(),
  // Elixirs made at a Long Rest (2, then 3/4/5 at 5/9/15), more for a spell slot. Each drink is
  // rolled on (or, for a slot, picked from) the table; Healing's dice are shown as an action.
  [S('alchemist', 'experimental elixir', 3)]: numbers(
    [
      uses(
        'experimental-elixir',
        'Experimental Elixir',
        'steps(level.artificer, 3, 2, 5, 3, 9, 4, 15, 5)',
        'long',
      ),
      restoredBy('experimental-elixir', anySlot),
      action({
        id: 'experimental-elixir',
        name: 'Experimental Elixir',
        actionType: 'bonus',
        costs: [spend('experimental-elixir')],
        roll: '1d6',
      }),
      action({
        id: 'experimental-elixir-healing',
        name: 'Experimental Elixir: Healing',
        actionType: 'bonus',
        costs: [spend('experimental-elixir')],
        roll: 'steps(level.artificer, 3, 2d8, 9, 3d8, 15, 4d8) + mod.int',
      }),
    ],
    { unoffered: AT_TABLE },
  ),
  // Only spells cast through Alchemist's Supplies, and only healing or Acid/Fire/Poison rolls.
  [S('alchemist', 'alchemical savant', 5)]: text({
    needs: 'a spell filter by damage type (or healing) for spellMod damage bonuses',
    notes: 'Add your Intelligence modifier (at least +1) to one qualifying roll.',
  }),
  // Lesser Restoration's free casts come from the subclass data.
  [S('alchemist', 'restorative reagents', 9)]: text(),
  // Bubbling Cauldron's free cast comes from the subclass data.
  [S('alchemist', 'chemical mastery', 15)]: numbers([
    { type: 'resistance', value: 'acid' },
    { type: 'resistance', value: 'poison' },
    { type: 'conditionImmunity', value: 'poisoned' },
    action({
      id: 'alchemical-eruption',
      name: 'Alchemical Eruption',
      actionType: 'other',
      roll: '2d8',
    }),
  ]),

  // ---- Armorer ----
  [S('armorer', 'armorer', 3)]: text(),
  [S('armorer', 'tools of the trade', 3)]: numbers(
    [{ type: 'proficiency', category: 'armor', value: 'heavy' }, tool("smith's tools|xphb")],
    { unoffered: FALLBACK_TOOL, notes: 'Crafting armor takes half the time.' },
  ),
  [S('armorer', 'armorer spells', 3)]: text(),
  [S('armorer', 'arcane armor', 3)]: text({
    needs: "a way to waive worn armor's Strength requirement (the Speed penalty still shows)",
  }),
  // Switched on while wearing the Arcane Armor; its model is picked then. Each model feature
  // hangs its weapon and benefits off the picked option.
  [S('armorer', 'armor model', 3)]: toggled(
    [
      {
        type: 'toggle',
        toggleId: 'arcane-armor',
        name: 'Arcane Armor',
        effects: [],
        options: [
          { id: 'dreadnaught', name: 'Dreadnaught', effects: [] },
          { id: 'guardian', name: 'Guardian', effects: [] },
          { id: 'infiltrator', name: 'Infiltrator', effects: [] },
        ],
      },
    ],
    { unoffered: 'Picked when switching on Arcane Armor; changed at a Short or Long Rest.' },
  ),
  // Force Demolisher (its die grows at 15, Perfected Armor) and Giant Stature.
  [S('armorer', 'dreadnaught', 3)]: toggled(
    [
      when(model('dreadnaught'), [
        {
          type: 'attack',
          id: 'force-demolisher',
          name: 'Force Demolisher',
          damage: 'steps(level.artificer, 3, 1d10, 15, 2d6)',
          damageType: 'force',
          range: 'melee',
          distance: '10 ft.',
          abilities: ['str', 'int'],
          properties: ['R'],
        },
        uses('giant-stature', 'Giant Stature', intUses, 'long'),
        {
          type: 'toggle',
          toggleId: 'giant-stature',
          name: 'Giant Stature',
          cost: [spend('giant-stature'), { action: 'bonus' }],
          endsOn: ['shortRest', 'longRest'],
          effects: [
            when(atLevel(15), [
              { type: 'rollMode', target: 'check:str', mode: 'advantage' },
              { type: 'rollMode', target: 'save:str', mode: 'advantage' },
            ]),
          ],
        },
      ]),
    ],
    { notes: MODEL_ABILITY + ' Giant Stature lasts 1 minute: reach +5 ft. and Large.' },
  ),
  // Thunder Pulse (its die grows at 15) and Defensive Field (while Bloodied).
  [S('armorer', 'guardian', 3)]: toggled(
    [
      when(model('guardian'), [
        {
          type: 'attack',
          id: 'thunder-pulse',
          name: 'Thunder Pulse',
          damage: 'steps(level.artificer, 3, 1d8, 15, 1d10)',
          damageType: 'thunder',
          range: 'melee',
          distance: '5 ft.',
          abilities: ['str', 'int'],
        },
        action({
          id: 'defensive-field',
          name: 'Defensive Field',
          actionType: 'bonus',
          outcomes: [{ tempHp: 'level.artificer' }],
        }),
      ]),
    ],
    { notes: MODEL_ABILITY + ' Defensive Field only while Bloodied.' },
  ),
  // Lightning Launcher (its die grows at 15) with its once-per-turn extra die, Powered Steps
  // and Dampening Field.
  [S('armorer', 'infiltrator', 3)]: toggled(
    [
      when(model('infiltrator'), [
        {
          type: 'attack',
          id: 'lightning-launcher',
          name: 'Lightning Launcher',
          damage: 'steps(level.artificer, 3, 1d6, 15, 2d6)',
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
        { type: 'speedBonus', value: 5 },
        { type: 'rollMode', target: 'skill:stealth', mode: 'advantage' },
      ]),
    ],
    { notes: MODEL_ABILITY },
  ),
  [S('armorer', 'extra attack', 5)]: numbers([{ type: 'extraAttack', count: 2 }]),
  // +1 to hit and damage with the model's weapon; the extra Armor plan is the class feature's.
  [S('armorer', 'improved armorer', 9)]: numbers(
    [
      when(model('dreadnaught'), [
        { type: 'attackMod', label: 'Improved Arsenal', filter: DEMOLISHER, toHit: 1, damage: 1 },
      ]),
      when(model('guardian'), [
        { type: 'attackMod', label: 'Improved Arsenal', filter: PULSE, toHit: 1, damage: 1 },
      ]),
      when(model('infiltrator'), [
        { type: 'attackMod', label: 'Improved Arsenal', filter: LAUNCHER, toHit: 1, damage: 1 },
      ]),
    ],
    {
      needs:
        "an attack filter matching one feature attack by id (Thunder Pulse's bonus needs Intelligence as its ability); one more plan and item for Replicate Magic Item",
      notes: 'Learn one more Armor plan and make one more Armor item with Replicate Magic Item.',
    },
  ),
  // The bigger dice are in each model's attack; Giant Stature's advantage is in its toggle.
  [S('armorer', 'perfected armor', 15)]: numbers(
    [
      when(model('guardian'), [
        uses('guardian-pull', 'Guardian Pull', intUses, 'long'),
        action({
          id: 'guardian-pull',
          name: 'Guardian Pull',
          actionType: 'reaction',
          costs: [spend('guardian-pull')],
          saveDc: dc('int'),
        }),
      ]),
      when(model('infiltrator'), [
        uses('infiltrator-flight', 'Infiltrator Flight', intUses, 'long'),
        action({
          id: 'infiltrator-flight',
          name: 'Infiltrator Flight',
          actionType: 'bonus',
          costs: [spend('infiltrator-flight')],
        }),
      ]),
    ],
    {
      unoffered: TARGETS,
      notes:
        'Giant Stature can make you Large or Huge with +10 ft. reach. Launcher targets glimmer and have Disadvantage against you.',
    },
  ),

  // ---- Artillerist ----
  [S('artillerist', 'artillerist', 3)]: text(),
  // Martial Ranged weapons, listed one by one (proficiency has no "martial ranged" value).
  [S('artillerist', 'tools of the trade', 3)]: numbers(
    [
      ...[
        'blowgun|xphb',
        'hand crossbow|xphb',
        'heavy crossbow|xphb',
        'longbow|xphb',
        'musket|xphb',
        'pistol|xphb',
      ].map((value): Effect => ({ type: 'proficiency', category: 'weapon', value })),
      tool("woodcarver's tools|xphb"),
    ],
    { unoffered: FALLBACK_TOOL, notes: 'Crafting a Wand takes half the time.' },
  ),
  [S('artillerist', 'artillerist spells', 3)]: text(),
  // Made once per Long Rest or for a slot; its three Bonus Action options (cannon stat block),
  // their dice one die larger from level 9 (Explosive Cannon's Firepower).
  [S('artillerist', 'eldritch cannon', 3)]: numbers([
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
      roll: 'steps(level.artificer, 3, 1d8, 9, 2d8) + max(1, mod.int)',
    }),
  ]),
  // A spell's damage roll through the firearm gains a d8.
  [S('artillerist', 'arcane firearm', 5)]: numbers([
    action({ id: 'arcane-firearm', name: 'Arcane Firearm', actionType: 'other', roll: '1d8' }),
  ]),
  [S('artillerist', 'explosive cannon', 9)]: numbers([
    action({
      id: 'cannon-detonate',
      name: 'Cannon: Detonate',
      actionType: 'reaction',
      saveDc: dc('int'),
      roll: '3d10',
    }),
  ]),
  [S('artillerist', 'fortified position', 15)]: text({
    notes: 'Two cannons at once, made with the same action; Cover within 10 ft. of a cannon.',
  }),

  // ---- Battle Smith ----
  [S('battle smith', 'battle smith', 3)]: text(),
  [S('battle smith', 'tools of the trade', 3)]: numbers([tool("smith's tools|xphb")], {
    unoffered: FALLBACK_TOOL,
    notes: 'Crafting weapons takes half the time.',
  }),
  [S('battle smith', 'battle smith spells', 3)]: text(),
  // Intelligence for attacks with a magic weapon; the switch is for a weapon made magic by a
  // spell, which the sheet can't see.
  [S('battle smith', 'battle ready', 3)]: toggled([
    { type: 'proficiency', category: 'weapon', value: 'martial' },
    {
      type: 'toggle',
      toggleId: 'battle-ready',
      name: 'Other weapons count as magic (Battle Ready)',
      effects: [],
    },
    ...onMagicWeapons(battleReady),
  ]),
  [S('battle smith', 'steel defender', 3)]: numbers([
    action({ id: 'command-steel-defender', name: 'Command Steel Defender', actionType: 'bonus' }),
    action({
      id: 'revive-steel-defender',
      name: 'Revive Steel Defender',
      actionType: 'action',
      costs: [anySlot],
    }),
  ]),
  [S('battle smith', 'extra attack', 5)]: numbers([{ type: 'extraAttack', count: 2 }], {
    notes: "One attack can be traded for the Steel Defender's Force-Empowered Rend.",
  }),
  // Destructive Energy as a rider on magic weapon hits, Restorative Energy as an action; the
  // dice double at 15 (Improved Defender).
  [S('battle smith', 'arcane jolt', 9)]: numbers(
    [
      uses('arcane-jolt', 'Arcane Jolt', intUses, 'long'),
      ...onMagicWeapons(arcaneJolt),
      action({
        id: 'arcane-jolt-healing',
        name: 'Arcane Jolt: Restorative Energy',
        actionType: 'other',
        costs: [spend('arcane-jolt')],
        roll: 'steps(level.artificer, 9, 2d6, 15, 4d6)',
      }),
    ],
    { unoffered: AT_TABLE },
  ),
  [S('battle smith', 'improved defender', 15)]: numbers([
    action({
      id: 'improved-deflection',
      name: 'Improved Deflection',
      actionType: 'other',
      roll: '1d4 + mod.int',
    }),
  ]),

  // ---- Cartographer ----
  [S('cartographer', 'cartographer', 3)]: text(),
  [S('cartographer', 'tools of the trade', 3)]: numbers(
    [tool("calligrapher's supplies|xphb"), tool("cartographer's tools|xphb")],
    { unoffered: FALLBACK_TOOL, notes: 'Scribing a Spell Scroll takes half the time.' },
  ),
  [S('cartographer', 'cartographer spells', 3)]: text(),
  // While the artificer holds one of the maps.
  [S('cartographer', "adventurer's atlas", 3)]: toggled(
    [
      {
        type: 'toggle',
        toggleId: 'atlas-map',
        name: "Adventurer's Atlas map",
        effects: [{ type: 'rollBonus', target: 'initiative', value: '1d4' }],
      },
    ],
    { unoffered: TARGETS },
  ),
  [S('cartographer', 'mapping magic', 3)]: numbers([freeCasts('faerie fire|xphb', intUses)], {
    notes: 'Portal Jump: half your Speed to teleport a short way.',
  }),
  // Weapon hits on a creature in Faerie Fire; the spell half is the player's.
  [S('cartographer', 'guided precision', 5)]: numbers([
    {
      type: 'damageRider',
      id: 'guided-precision',
      name: 'Guided Precision',
      dice: 'mod.int',
      filter: { source: ['weapon', 'unarmed'] },
      oncePerTurn: true,
      optIn: true,
    },
  ]),
  [S('cartographer', 'ingenious movement', 9)]: text({ unoffered: TARGETS }),
  // Find the Path, while holding one of the maps.
  [S('cartographer', 'superior atlas', 15)]: numbers(
    [when(mapHolder, [freeCasts('find the path|xphb', 1)])],
    { notes: 'Safe Haven: a map holder at 0 HP can destroy its map instead.' },
  ),

  // ---- Reanimator ----
  [R('reanimator', 3)]: text(),
  [R('reanimator spells', 3)]: text(),
  // Jolt to Life (Int mod uses, no minimum) and Alchemist's Supplies.
  [R("reanimator's skill set", 3)]: numbers(
    [
      uses('jolt-to-life', 'Jolt to Life', 'max(0, mod.int)', 'long'),
      action({
        id: 'jolt-to-life',
        name: 'Jolt to Life',
        actionType: 'other',
        costs: [spend('jolt-to-life')],
        saveDc: dc('int'),
        roll: 'steps(level.artificer, 3, 2d4, 11, 3d4, 17, 4d4)',
      }),
      tool("alchemist's supplies|xphb"),
    ],
    { unoffered: `${FALLBACK_TOOL} ${TARGETS}` },
  ),
  [R('reanimated companion', 3)]: numbers([
    ...oncePerRestOrSlot('reanimated-companion', 'Reanimated Companion'),
    action({
      id: 'command-reanimated-companion',
      name: 'Command Reanimated Companion',
      actionType: 'bonus',
    }),
  ]),
  [R('strange modifications', 5)]: text({ unoffered: AT_TABLE }),
  [R('improved reanimation', 9)]: text(),
  [R('macabre modifications', 9)]: text({ unoffered: AT_TABLE }),
  [R('refined reanimation', 15)]: numbers([
    freeCasts('raise dead|xphb', 1),
    action({ id: 'life-transfer', name: 'Life Transfer', actionType: 'reaction' }),
  ]),
};
