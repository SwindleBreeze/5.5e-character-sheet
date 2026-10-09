// 2014 subclasses on 2024 characters (plan step 8.3): the Sorcerer's Pyromancer, Divine Soul,
// Storm and Lunar Sorcery, the Warlock's Undying, Hexblade, Fathomless and Genie, and the
// Wizard's War Magic, Chronurgy, Graviturgy and Order of Scribes. They spend the 2024 classes'
// own pools (Sorcery Points, spell slots); subclass spells, the Divine Soul's affinity and the
// Genie's kind (with their spells) come from the subclass data. The lunar phase, Hexblade's
// Curse and concentrating for Durable Magic are switches.

import type { Effect, Predicate, Ref } from '../../../schema/index.ts';
import type { FeatureEffectsMap } from '../types.ts';
import {
  action,
  AT_TABLE,
  dc,
  NO_CHOICE,
  numbers,
  restoredBy,
  savesAgainst,
  TARGETS,
  text,
  toggled,
  uses,
  when,
} from '../core/helpers.ts';

/** A 2014 subclass's features: its level-3 entry is filed under the 2024 class (`xphb`). */
const S =
  (cls: string, sub: string, src: string) =>
  (id: string, level: number, owner = level === 3 ? 'xphb' : 'phb') =>
    `subclassFeature:${id}|${cls}|${owner}|${sub}|${src}|${level}|${src}` as const;
const PYRO = S('sorcerer', 'pyromancer (psk)', 'psk');
const DIVINE = S('sorcerer', 'divine soul', 'xge');
const STORM = S('sorcerer', 'storm', 'xge');
const LUNAR = S('sorcerer', 'lunar', 'dsotdq');
const UNDYING = S('warlock', 'undying', 'scag');
const HEX = S('warlock', 'hexblade', 'xge');
const DEEP = S('warlock', 'fathomless', 'tce');
const GENIE = S('warlock', 'genie', 'tce');
const WAR = S('wizard', 'war', 'xge');
const CHRONO = S('wizard', 'chronurgy', 'egw');
const GRAVITY = S('wizard', 'graviturgy', 'egw');
const SCRIBES = S('wizard', 'scribes', 'tce');

const points = (amount: number) => ({ resource: 'sorcery-points', amount });
const intUses = 'max(1, mod.int)';
const halfSorcerer = 'floor(level.sorcerer / 2)';
const halfWizard = 'floor(level.wizard / 2)';
const anySlot = { slot: { minLevel: 1 } };

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

// ---- Lunar Sorcery: the phase is a switch with three forms ----
const PHASES = [
  ['full-moon', 'Full Moon', 'shield|phb'],
  ['new-moon', 'New Moon', 'ray of sickness|phb'],
  ['crescent-moon', 'Crescent Moon', 'color spray|phb'],
] as const;
const phase = (option: string): Predicate => ({ toggle: 'lunar-phase', option });

// ---- Genie: the patron's kind is the subclass's own pick (its spell set) ----
const genie: Ref = { kind: 'subclass', id: 'genie|warlock|xphb|tce' };
const GENIE_TYPES = ['bludgeoning', 'thunder', 'fire', 'cold'];
const byKind = (effects: (damageType: string) => Effect[]): Effect[] =>
  GENIE_TYPES.map((type, i): Effect => ({
    type: 'ifChoice',
    owner: genie,
    slot: 'spellsSet',
    value: String(i),
    effects: effects(type),
  }));

const curse = { toggle: 'hexblades-curse' };
const tentacleDice = 'steps(level.warlock, 1, 1d8, 10, 2d8)';

export const LEGACY_CASTERS: FeatureEffectsMap = {
  // ---- Sorcerer: Pyromancer (PSK) ----
  [PYRO('pyromancer (psk)', 3)]: text(),
  [PYRO('heart of fire', 1)]: numbers(
    [
      action({
        id: 'heart-of-fire',
        name: 'Heart of Fire',
        actionType: 'other',
        roll: `max(1, ${halfSorcerer})`,
      }),
    ],
    { unoffered: TARGETS },
  ),
  [PYRO('fire in the veins', 6)]: numbers([{ type: 'resistance', value: 'fire' }], {
    notes: 'Ignoring Fire Resistance with your spells is done at the table.',
  }),
  [PYRO("pyromancer's fury", 14)]: numbers([
    action({
      id: 'pyromancers-fury',
      name: "Pyromancer's Fury",
      actionType: 'reaction',
      roll: 'level.sorcerer',
    }),
  ]),
  [PYRO('fiery soul', 18)]: numbers([{ type: 'immunity', value: 'fire' }], {
    notes: 'What your spells do to Fire Resistance and Immunity is applied at the table.',
  }),

  // ---- Sorcerer: Divine Soul ----
  [DIVINE('divine soul', 3)]: text(),
  [DIVINE('divine magic', 1)]: text(),
  [DIVINE('favored by the gods', 1)]: numbers(
    usesAction('favored-by-the-gods', 'Favored by the Gods', 1, 'short', { roll: '2d4' }),
  ),
  // Its Sorcery Point action comes from the data.
  [DIVINE('empowered healing', 6)]: text(),
  [DIVINE('otherworldly wings', 14)]: toggled([
    {
      type: 'toggle',
      toggleId: 'otherworldly-wings',
      name: 'Otherworldly Wings',
      cost: [{ action: 'bonus' }],
      endsOn: ['shortRest', 'longRest'],
      effects: [{ type: 'speed', mode: 'fly', value: 30 }],
    },
  ]),
  [DIVINE('unearthly recovery', 18)]: toggled(
    usesAction('unearthly-recovery', 'Unearthly Recovery', 1, 'long', { actionType: 'bonus' }),
    {
      notes: 'Add the Hit Points it restores by hand.',
      needs: 'a formula reference to the Hit Point maximum',
    },
  ),

  // ---- Sorcerer: Storm Sorcery ----
  [STORM('storm sorcery', 3)]: text(),
  [STORM('wind speaker', 1)]: numbers([
    { type: 'proficiency', category: 'language', value: 'primordial' },
  ]),
  [STORM('tempestuous magic', 1)]: numbers([
    action({ id: 'tempestuous-magic', name: 'Tempestuous Magic', actionType: 'bonus' }),
  ]),
  [STORM('heart of the storm', 6)]: numbers(
    [
      { type: 'resistance', value: 'lightning' },
      { type: 'resistance', value: 'thunder' },
      action({
        id: 'heart-of-the-storm',
        name: 'Heart of the Storm',
        actionType: 'other',
        roll: halfSorcerer,
      }),
    ],
    { unoffered: AT_TABLE },
  ),
  [STORM('storm guide', 6)]: numbers(
    [
      action({ id: 'storm-guide-rain', name: 'Storm Guide (rain)', actionType: 'action' }),
      action({ id: 'storm-guide-wind', name: 'Storm Guide (wind)', actionType: 'bonus' }),
    ],
    { unoffered: AT_TABLE },
  ),
  [STORM("storm's fury", 14)]: numbers([
    action({
      id: 'storms-fury',
      name: "Storm's Fury",
      actionType: 'reaction',
      roll: 'level.sorcerer',
      saveDc: dc('cha'),
    }),
  ]),
  [STORM('wind soul', 18)]: toggled(
    [
      { type: 'immunity', value: 'lightning' },
      { type: 'immunity', value: 'thunder' },
      { type: 'speed', mode: 'fly', value: 60 },
      ...usesAction('wind-soul', 'Wind Soul', 1, 'short', { actionType: 'action' }),
    ],
    { notes: 'Lower your Fly Speed by hand after sharing it.', unoffered: TARGETS },
  ),

  // ---- Sorcerer: Lunar Sorcery ----
  [LUNAR('lunar sorcery', 3)]: text(),
  [LUNAR('lunar embodiment', 1)]: toggled(
    [
      uses('lunar-embodiment', 'Lunar Embodiment', 1, 'long'),
      {
        type: 'toggle',
        toggleId: 'lunar-phase',
        name: 'Lunar phase',
        effects: [],
        options: PHASES.map(([id, name]) => ({ id, name, effects: [] })),
      },
      ...PHASES.map(([id, , spell]) =>
        when(phase(id), [
          {
            type: 'grantSpells',
            spells: [
              {
                mode: 'innate',
                ability: 'cha',
                uses: { resource: 'lunar-embodiment', cost: 1 },
                spell: { id: spell },
              },
            ],
          },
        ]),
      ),
    ],
    { unoffered: 'The phase is picked when the Lunar phase switch is turned on.' },
  ),
  [LUNAR('moon fire', 1)]: numbers([
    { type: 'grantSpells', spells: [{ mode: 'known', spell: { id: 'sacred flame|xphb' } }] },
  ]),
  [LUNAR('lunar boons', 6)]: numbers([uses('lunar-boons', 'Lunar Boons', 'pb', 'long')], {
    notes: 'Lower the Metamagic cost by hand when you spend a use.',
  }),
  // Changing phase for a Sorcery Point is an action from the data.
  [LUNAR('waxing and waning', 6)]: numbers(
    [{ type: 'resourceModify', resourceId: 'lunar-embodiment', max: 3 }],
    { notes: 'The sheet allows three free casts; keep to one per phase by hand.' },
  ),
  [LUNAR('lunar empowerment', 14)]: toggled(
    [
      when(phase('full-moon'), [
        action({ id: 'lunar-empowerment-light', name: 'Full Moon light', actionType: 'bonus' }),
        {
          type: 'rollMode',
          target: 'skill:investigation',
          mode: 'advantage',
          against: 'in your bright light',
        },
        {
          type: 'rollMode',
          target: 'skill:perception',
          mode: 'advantage',
          against: 'in your bright light',
        },
      ]),
      when(phase('new-moon'), [
        { type: 'rollMode', target: 'skill:stealth', mode: 'advantage' },
        {
          type: 'attackedMode',
          mode: 'disadvantage',
          against: 'while you are entirely in darkness',
        },
      ]),
      when(phase('crescent-moon'), [
        { type: 'resistance', value: 'necrotic' },
        { type: 'resistance', value: 'radiant' },
      ]),
    ],
    { unoffered: TARGETS },
  ),
  [LUNAR('lunar phenomenon', 18)]: toggled(
    [
      ...PHASES.flatMap(([id, name]): Effect[] => {
        const res = `lunar-phenomenon-${id}`;
        const label = `Lunar Phenomenon (${name})`;
        const roll = id === 'full-moon' ? '3d8' : id === 'new-moon' ? '3d10' : undefined;
        return [
          uses(res, label, 1, 'long'),
          restoredBy(res, points(5)),
          when(phase(id), [
            action({
              id: res,
              name: label,
              actionType: 'bonus',
              costs: [{ resource: res, amount: 1 }],
              ...(roll ? { roll, saveDc: dc('cha') } : {}),
            }),
          ]),
        ];
      }),
    ],
    { unoffered: TARGETS },
  ),

  // ---- Warlock: The Undying ----
  [UNDYING('the undying', 3)]: text({ unoffered: EXPANDED }),
  [UNDYING('among the dead', 1)]: numbers(
    [
      savesAgainst('disease'),
      action({
        id: 'among-the-dead',
        name: 'Among the Dead',
        actionType: 'other',
        saveDc: dc('cha'),
      }),
    ],
    { unoffered: NO_CHOICE },
  ),
  [UNDYING('defy death', 6)]: numbers(
    usesAction('defy-death', 'Defy Death', 1, 'long', { outcomes: [{ heal: '1d8 + mod.con' }] }),
    { notes: 'Raise a total below 1 to 1 by hand.' },
  ),
  [UNDYING('undying nature', 10)]: text(),
  [UNDYING('indestructible life', 14)]: numbers(
    usesAction('indestructible-life', 'Indestructible Life', 1, 'short', {
      actionType: 'bonus',
      outcomes: [{ heal: '1d8 + level.warlock' }],
    }),
  ),

  // ---- Warlock: The Hexblade ----
  [HEX('the hexblade', 3)]: text({ unoffered: EXPANDED }),
  [HEX("hexblade's curse", 1)]: toggled(
    [
      uses('hexblades-curse', "Hexblade's Curse", 1, 'short'),
      {
        type: 'toggle',
        toggleId: 'hexblades-curse',
        name: "Hexblade's Curse",
        cost: [{ resource: 'hexblades-curse', amount: 1 }, { action: 'bonus' }],
        endsOn: ['shortRest', 'longRest'],
        effects: [
          {
            type: 'attackMod',
            label: "Hexblade's Curse (cursed target)",
            filter: {},
            damage: 'pb',
            critRange: 19,
          },
        ],
      },
      action({
        id: 'hexblades-curse-heal',
        name: "Hexblade's Curse: the target dies",
        actionType: 'other',
        outcomes: [{ heal: 'max(1, level.warlock + mod.cha)' }],
      }),
    ],
    {
      notes:
        'While it is on, attack numbers are for the cursed target; other damage rolls against it add the bonus by hand.',
      unoffered: TARGETS,
    },
  ),
  [HEX('hex warrior', 1)]: toggled(
    [
      { type: 'proficiency', category: 'armor', value: 'medium' },
      { type: 'proficiency', category: 'armor', value: 'shield' },
      { type: 'proficiency', category: 'weapon', value: 'martial' },
      {
        type: 'toggle',
        toggleId: 'hex-warrior',
        name: 'Hex Warrior weapon',
        effects: [
          {
            type: 'attackMod',
            label: 'Hex Warrior',
            filter: { source: ['weapon'], notProperties: ['2H'] },
            abilities: ['cha'],
          },
        ],
      },
    ],
    { notes: 'Switch it on while attacking with your Hex Warrior weapon.' },
  ),
  [HEX('accursed specter', 6)]: numbers(
    usesAction('accursed-specter', 'Accursed Specter', 1, 'long', {
      roll: 'floor(level.warlock / 2)',
    }),
    { notes: "The specter isn't tracked: the roll is its Temporary Hit Points." },
  ),
  [HEX('armor of hexes', 10)]: numbers([
    when(curse, [
      action({ id: 'armor-of-hexes', name: 'Armor of Hexes', actionType: 'reaction', roll: '1d6' }),
    ]),
  ]),
  [HEX('master of hexes', 14)]: text(),

  // ---- Warlock: The Fathomless ----
  [DEEP('the fathomless', 3)]: text({ unoffered: EXPANDED }),
  [DEEP('tentacle of the deeps', 1)]: numbers(
    [
      ...usesAction('tentacle-of-the-deeps', 'Tentacle of the Deeps', 'pb', 'long', {
        actionType: 'bonus',
        roll: tentacleDice,
      }),
      action({
        id: 'tentacle-move',
        name: 'Tentacle of the Deeps (move)',
        actionType: 'bonus',
        roll: tentacleDice,
      }),
    ],
    { notes: 'The roll is the damage; the attack uses your Warlock spell attack bonus.' },
  ),
  [DEEP('gift of the sea', 1)]: numbers([{ type: 'speed', mode: 'swim', value: 40 }]),
  [DEEP('oceanic soul', 6)]: numbers([{ type: 'resistance', value: 'cold' }]),
  [DEEP('guardian coil', 6)]: numbers(
    [
      action({
        id: 'guardian-coil',
        name: 'Guardian Coil',
        actionType: 'reaction',
        roll: tentacleDice,
      }),
    ],
    { unoffered: TARGETS },
  ),
  // The spell and its free cast come from the subclass data.
  [DEEP('grasping tentacles', 10)]: toggled(
    [
      action({
        id: 'grasping-tentacles',
        name: 'Grasping Tentacles',
        actionType: 'other',
        outcomes: [{ tempHp: 'level.warlock' }],
      }),
    ],
    {
      notes:
        'Use it when you cast the spell. Damage not breaking that Concentration is applied at the table.',
      needs: 'concentration that only one spell keeps',
    },
  ),
  [DEEP('fathomless plunge', 14)]: numbers(
    usesAction('fathomless-plunge', 'Fathomless Plunge', 1, 'short', { actionType: 'action' }),
  ),

  // ---- Warlock: The Genie ----
  [GENIE('the genie', 3)]: text({
    unoffered: `The kind is the subclass's own pick, with its spells. ${EXPANDED}`,
  }),
  // Both of the vessel's uses are tracked here, whichever option is picked.
  [GENIE("genie's vessel", 1)]: numbers(
    [
      ...usesAction('bottled-respite', 'Bottled Respite', 1, 'long', { actionType: 'action' }),
      ...byKind((damageType) => [
        {
          type: 'damageRider',
          id: 'genies-wrath',
          name: "Genie's Wrath",
          dice: 'pb',
          damageType,
          filter: {},
          oncePerTurn: true,
          optIn: true,
        },
      ]),
    ],
    { notes: 'The vessel AC and Hit Points are not tracked.' },
  ),
  [GENIE('bottled respite', 1)]: text({ notes: "Tracked with Genie's Vessel." }),
  [GENIE("genie's wrath", 1)]: text({ notes: "Tracked with Genie's Vessel." }),
  [GENIE('elemental gift', 6)]: toggled([
    ...byKind((value) => [{ type: 'resistance', value }]),
    uses('elemental-gift', 'Elemental Gift', 'pb', 'long'),
    {
      type: 'toggle',
      toggleId: 'elemental-gift',
      name: 'Elemental Gift flight',
      cost: [{ resource: 'elemental-gift', amount: 1 }, { action: 'bonus' }],
      endsOn: ['shortRest', 'longRest'],
      effects: [{ type: 'speed', mode: 'fly', value: 30 }],
    },
  ]),
  [GENIE('sanctuary vessel', 10)]: text({ unoffered: TARGETS }),
  [GENIE('limited wish', 14)]: numbers(
    usesAction('limited-wish', 'Limited Wish', 1, 'none', { actionType: 'action' }),
    { notes: 'Restore the use by hand once its Long Rests have passed.' },
  ),

  // ---- Wizard: War Magic ----
  [WAR('war magic', 3)]: text(),
  [WAR('arcane deflection', 2)]: numbers([
    action({ id: 'arcane-deflection', name: 'Arcane Deflection', actionType: 'reaction' }),
  ]),
  [WAR('tactical wit', 2)]: numbers([{ type: 'initiativeBonus', value: 'mod.int' }]),
  [WAR('power surge', 6)]: toggled(
    [
      uses('power-surge', 'Power Surge', intUses, 'none'),
      {
        type: 'damageRider',
        id: 'power-surge',
        name: 'Power Surge',
        dice: halfWizard,
        damageType: 'force',
        filter: { source: ['spell'] },
        oncePerTurn: true,
        cost: { resource: 'power-surge', amount: 1 },
        optIn: true,
      },
    ],
    {
      notes: 'Set the count by hand after a rest and when you gain a surge.',
      needs: 'a rest that sets a counter to a fixed number',
    },
  ),
  [WAR('durable magic', 10)]: toggled(
    [
      {
        type: 'toggle',
        toggleId: 'durable-magic',
        name: 'Concentrating (Durable Magic)',
        effects: [
          { type: 'acBonus', value: 2 },
          { type: 'rollBonus', target: 'save:all', value: 2 },
        ],
      },
    ],
    {
      notes: 'Switch it on while you concentrate on a spell.',
      needs: 'a predicate for concentrating on a spell',
    },
  ),
  [WAR('deflecting shroud', 14)]: numbers(
    [
      action({
        id: 'deflecting-shroud',
        name: 'Deflecting Shroud',
        actionType: 'other',
        roll: halfWizard,
      }),
    ],
    { unoffered: TARGETS },
  ),

  // ---- Wizard: Chronurgy Magic ----
  [CHRONO('chronurgy magic', 3)]: text(),
  [CHRONO('chronal shift', 2)]: numbers(
    usesAction('chronal-shift', 'Chronal Shift', 2, 'long', { actionType: 'reaction' }),
  ),
  [CHRONO('temporal awareness', 2)]: numbers([{ type: 'initiativeBonus', value: 'mod.int' }]),
  [CHRONO('momentary stasis', 6)]: numbers(
    usesAction('momentary-stasis', 'Momentary Stasis', intUses, 'long', {
      actionType: 'action',
      saveDc: dc('int'),
    }),
  ),
  [CHRONO('arcane abeyance', 10)]: numbers(
    usesAction('arcane-abeyance', 'Arcane Abeyance', 1, 'short'),
  ),
  [CHRONO('convergent future', 14)]: numbers(
    [action({ id: 'convergent-future', name: 'Convergent Future', actionType: 'reaction' })],
    { notes: 'Add the Exhaustion level by hand.' },
  ),

  // ---- Wizard: Graviturgy Magic ----
  [GRAVITY('graviturgy magic', 3)]: text(),
  [GRAVITY('adjust density', 2)]: numbers([
    action({ id: 'adjust-density', name: 'Adjust Density', actionType: 'action' }),
  ]),
  [GRAVITY('gravity well', 6)]: text({ unoffered: AT_TABLE }),
  [GRAVITY('violent attraction', 10)]: numbers(
    usesAction('violent-attraction', 'Violent Attraction', intUses, 'long', {
      actionType: 'reaction',
      roll: '1d10',
    }),
    { notes: 'The roll is for a weapon hit; roll the extra damage of a fall by hand.' },
  ),
  [GRAVITY('event horizon', 14)]: numbers([
    ...usesAction('event-horizon', 'Event Horizon', 1, 'long', {
      actionType: 'action',
      roll: '2d10',
      saveDc: dc('int'),
    }),
    restoredBy('event-horizon', { slot: { minLevel: 3 } }),
  ]),

  // ---- Wizard: Order of Scribes ----
  [SCRIBES('order of scribes', 3)]: text(),
  [SCRIBES('wizardly quill', 2)]: numbers(
    [action({ id: 'wizardly-quill', name: 'Wizardly Quill', actionType: 'bonus' })],
    { unoffered: NO_CHOICE },
  ),
  [SCRIBES('awakened spellbook', 2)]: numbers(
    [uses('awakened-spellbook', 'Awakened Spellbook (quick ritual)', 1, 'long')],
    { notes: 'Swapping a damage type is done at the table.' },
  ),
  [SCRIBES('manifest mind', 6)]: numbers(
    [
      ...usesAction('manifest-mind', 'Manifest Mind', 1, 'long', { actionType: 'bonus' }),
      restoredBy('manifest-mind', anySlot),
      uses('manifest-mind-casts', 'Manifest Mind casts', 'pb', 'long'),
    ],
    { unoffered: AT_TABLE },
  ),
  [SCRIBES('master scrivener', 10)]: text(),
  [SCRIBES('one with the word', 14)]: numbers(
    [
      { type: 'rollMode', target: 'skill:arcana', mode: 'advantage' },
      ...usesAction('one-with-the-word', 'One with the Word', 1, 'long', {
        actionType: 'reaction',
        roll: '3d6',
      }),
    ],
    { unoffered: AT_TABLE },
  ),
};
