// 2014 cleric domains on a 2024 Cleric (plan step 8.3): Nature and Tempest (PHB), Death (DMG),
// Forge (Xanathar's), Order, Peace and Twilight (Tasha's), and the Amonkhet domains (Ambition,
// Knowledge, Solidarity, Strength, Zeal). Their Channel Divinity options are paid from the
// 2024 class's `channel-divinity` counter; domain spells and the Nature, Strength and Death
// cantrip picks come from the subclasses' own data. Resistances the 2014 text limits to
// nonmagical attacks aren't listed (no primitive for that limit).

import { refKey, type Effect } from '../../../schema/index.ts';
import type { FeatureEffectsMap } from '../types.ts';
import {
  action,
  AT_TABLE,
  attacksAgainst,
  dc,
  NO_CHOICE,
  numbers,
  restoredBy,
  TARGETS,
  text,
  toggled,
  uses,
  when,
} from '../core/helpers.ts';

/** The domain and its first Channel Divinity sit at the 2024 level 3; the rest keep 2014 ids. */
const S = (sub: string, src: string, id: string, level: number) =>
  refKey({
    kind: 'subclassFeature',
    id: `${id}|cleric|${level === 3 ? 'xphb' : 'phb'}|${sub}|${src}|${level}|${src}`,
  });
const NATURE = (id: string, level: number) => S('nature', 'phb', id, level);
const TEMPEST = (id: string, level: number) => S('tempest', 'phb', id, level);
const DEATH = (id: string, level: number) => S('death', 'dmg', id, level);
const AMBITION = (id: string, level: number) => S('ambition (psa)', 'psa', id, level);
const KNOWLEDGE = (id: string, level: number) => S('knowledge', 'phb', id, level);
const SOLIDARITY = (id: string, level: number) => S('solidarity (psa)', 'psa', id, level);
const STRENGTH = (id: string, level: number) => S('strength (psa)', 'psa', id, level);
const ZEAL = (id: string, level: number) => S('zeal (psa)', 'psa', id, level);
const FORGE = (id: string, level: number) => S('forge', 'xge', id, level);
const ORDER = (id: string, level: number) => S('order', 'tce', id, level);
const PEACE = (id: string, level: number) => S('peace', 'tce', id, level);
const TWILIGHT = (id: string, level: number) => S('twilight', 'tce', id, level);

const divinity = { resource: 'channel-divinity', amount: 1 };
const wisUses = 'max(1, mod.wis)';
const heavyArmor: Effect = { type: 'proficiency', category: 'armor', value: 'heavy' };
const martialWeapons: Effect = { type: 'proficiency', category: 'weapon', value: 'martial' };
const skillFrom = (from: string[], slot = 'skill'): Effect => ({
  type: 'proficiencyChoice',
  category: 'skill',
  choice: { slot, count: 1, from },
});
/** A Channel Divinity option: an action of some type paid from the class's counter. */
const channel = (id: string, name: string, actionType: 'action' | 'bonus' | 'reaction' | 'other') =>
  action({ id, name, actionType, costs: [divinity] });
/** Uses that come back on a Long Rest, spent by an action of the same name. */
const perLongRest = (
  id: string,
  name: string,
  max: string | number,
  actionType: 'action' | 'bonus' | 'reaction' | 'other',
  more: { roll?: string; saveDc?: string; attack?: { source: 'weapon'[] } } = {},
): Effect[] => [
  uses(id, name, max, 'long'),
  action({ id, name, actionType, costs: [{ resource: id, amount: 1 }], ...more }),
];
const NONMAGICAL = 'a resistance that applies only to nonmagical attacks';

export const LEGACY_CLERIC: FeatureEffectsMap = {
  // ---- Nature Domain (PHB) ----
  [NATURE('nature domain', 3)]: text(),
  // The Druid cantrip is the domain's own pick; the skill is added here.
  [NATURE('acolyte of nature', 1)]: numbers([skillFrom(['animal handling', 'nature', 'survival'])]),
  [NATURE('bonus proficiency', 1)]: numbers([heavyArmor]),
  [NATURE('channel divinity: charm animals and plants', 3)]: numbers([
    action({
      id: 'charm-animals-and-plants',
      name: 'Charm Animals and Plants',
      actionType: 'action',
      costs: [divinity],
      saveDc: dc('wis'),
    }),
  ]),
  [NATURE('dampen elements', 6)]: numbers([
    action({ id: 'dampen-elements', name: 'Dampen Elements', actionType: 'reaction' }),
  ]),
  [NATURE('master of nature', 17)]: numbers([
    action({ id: 'master-of-nature', name: 'Master of Nature', actionType: 'bonus' }),
  ]),

  // ---- Tempest Domain (PHB) ----
  [TEMPEST('tempest domain', 3)]: text(),
  [TEMPEST('bonus proficiencies', 1)]: numbers([martialWeapons, heavyArmor]),
  // The damage type is picked each time it is used.
  [TEMPEST('wrath of the storm', 1)]: numbers(
    perLongRest('wrath-of-the-storm', 'Wrath of the Storm', wisUses, 'reaction', {
      roll: '2d8',
      saveDc: dc('wis'),
    }),
  ),
  [TEMPEST('channel divinity: destructive wrath', 3)]: numbers([
    channel('destructive-wrath', 'Destructive Wrath', 'other'),
  ]),
  [TEMPEST('thunderbolt strike', 6)]: text(),
  [TEMPEST('stormborn', 17)]: toggled(
    [
      {
        type: 'toggle',
        toggleId: 'stormborn',
        name: 'Stormborn',
        effects: [{ type: 'speed', mode: 'fly', value: 'walk' }],
      },
    ],
    { notes: 'Switch it on where it works; the flying speed shows only while it is on.' },
  ),

  // ---- Death Domain (DMG) ----
  [DEATH('death domain', 3)]: text(),
  [DEATH('bonus proficiency', 1)]: numbers([martialWeapons]),
  // The cantrip is the domain's own pick; its extra target is played at the table.
  [DEATH('reaper', 1)]: text(),
  [DEATH('channel divinity: touch of death', 3)]: numbers([
    {
      type: 'damageRider',
      id: 'touch-of-death',
      name: 'Touch of Death',
      dice: '5 + 2 * level.cleric',
      damageType: 'necrotic',
      filter: { range: 'melee' },
      cost: divinity,
      optIn: true,
    },
  ]),
  [DEATH('inescapable destruction', 6)]: text(),
  [DEATH('improved reaper', 17)]: text(),

  // ---- Ambition Domain (Plane Shift: Amonkhet) ----
  [AMBITION('ambition domain (psa)', 3)]: text(),
  // The same counter as the Light Domain's Warding Flare.
  [AMBITION('warding flare', 1)]: numbers(
    perLongRest('warding-flare', 'Warding Flare', wisUses, 'reaction'),
    { unoffered: NO_CHOICE },
  ),
  [AMBITION('channel divinity: invoke duplicity', 3)]: numbers([
    channel('invoke-duplicity', 'Invoke Duplicity', 'action'),
    attacksAgainst('a creature within 5 feet of both you and your illusion'),
  ]),
  [AMBITION('channel divinity: cloak of shadows', 6)]: numbers([
    channel('cloak-of-shadows', 'Cloak of Shadows', 'action'),
  ]),
  [AMBITION('improved duplicity', 17)]: text(),

  // ---- Knowledge Domain (Plane Shift: Amonkhet, the PHB's features) ----
  [S('knowledge (psa)', 'psa', 'knowledge domain (psa)', 3)]: text(),
  [KNOWLEDGE('knowledge domain', 1)]: text(),
  [KNOWLEDGE('blessings of knowledge', 1)]: numbers([
    {
      type: 'proficiencyChoice',
      category: 'language',
      choice: { slot: 'languages', count: 2, from: 'any' },
      filter: 'standard|rare',
    },
    ...['skill-1', 'skill-2'].flatMap((slot): Effect[] => [
      skillFrom(['arcana', 'history', 'nature', 'religion'], slot),
      { type: 'expertise', skill: { fromChoice: slot } },
    ]),
  ]),
  [KNOWLEDGE('channel divinity: knowledge of the ages', 3)]: numbers(
    [channel('knowledge-of-the-ages', 'Knowledge of the Ages', 'action')],
    { unoffered: AT_TABLE },
  ),
  [KNOWLEDGE('channel divinity: read thoughts', 6)]: numbers(
    [
      action({
        id: 'read-thoughts',
        name: 'Read Thoughts',
        actionType: 'action',
        costs: [divinity],
        saveDc: dc('wis'),
      }),
    ],
    { unoffered: TARGETS },
  ),
  [KNOWLEDGE('visions of the past', 17)]: numbers([
    uses('visions-of-the-past', 'Visions of the Past', 1, 'short'),
    action({
      id: 'visions-of-the-past',
      name: 'Visions of the Past',
      actionType: 'other',
      costs: [{ resource: 'visions-of-the-past', amount: 1 }],
    }),
  ]),

  // ---- Solidarity Domain (Plane Shift: Amonkhet) ----
  [SOLIDARITY('solidarity domain (psa)', 3)]: text(),
  [SOLIDARITY('bonus proficiency', 1)]: numbers([heavyArmor], { unoffered: NO_CHOICE }),
  [SOLIDARITY("solidarity's action", 1)]: numbers(
    perLongRest('solidaritys-action', "Solidarity's Action", wisUses, 'bonus', {
      attack: { source: ['weapon'] },
    }),
  ),
  [SOLIDARITY('channel divinity: preserve life', 3)]: numbers(
    [
      action({
        id: 'preserve-life',
        name: 'Preserve Life',
        actionType: 'action',
        costs: [divinity],
        roll: '5 * level.cleric',
      }),
    ],
    { unoffered: TARGETS },
  ),
  [SOLIDARITY("oketra's blessing", 6)]: numbers([
    channel('oketras-blessing', "Oketra's Blessing", 'reaction'),
  ]),
  [SOLIDARITY('supreme healing', 17)]: text(),

  // ---- Strength Domain (Plane Shift: Amonkhet) ----
  [STRENGTH('strength domain (psa)', 3)]: text(),
  // The Druid cantrip is the domain's own pick; the skill is added here.
  [STRENGTH('acolyte of strength', 1)]: numbers([
    skillFrom(['animal handling', 'athletics', 'nature', 'survival']),
  ]),
  [STRENGTH('bonus proficiency', 1)]: numbers([heavyArmor]),
  [STRENGTH('channel divinity: feat of strength', 3)]: numbers([
    channel('feat-of-strength', 'Feat of Strength', 'other'),
  ]),
  [STRENGTH("rhonas's blessing", 6)]: numbers([
    channel('rhonass-blessing', "Rhonas's Blessing", 'reaction'),
  ]),
  [STRENGTH('avatar of battle', 17)]: text({
    notes: 'Not listed with the defenses: the resistances cover only some attacks.',
    needs: NONMAGICAL,
  }),

  // ---- Zeal Domain (Plane Shift: Amonkhet) ----
  [ZEAL('zeal domain (psa)', 3)]: text(),
  [ZEAL('bonus proficiencies', 1)]: numbers([martialWeapons, heavyArmor]),
  [ZEAL('priest of zeal', 1)]: numbers(
    perLongRest('priest-of-zeal', 'Priest of Zeal', wisUses, 'bonus', {
      attack: { source: ['weapon'] },
    }),
  ),
  [ZEAL('channel divinity: consuming fervor', 3)]: numbers([
    channel('consuming-fervor', 'Consuming Fervor', 'other'),
  ]),
  [ZEAL('resounding strike', 6)]: text(),
  [ZEAL('blaze of glory', 17)]: numbers(
    perLongRest('blaze-of-glory', 'Blaze of Glory', 1, 'reaction'),
  ),

  // ---- Forge Domain (Xanathar's) ----
  [FORGE('forge domain', 3)]: text(),
  [FORGE('bonus proficiency', 1)]: numbers(
    [heavyArmor, { type: 'proficiency', category: 'tool', value: "smith's tools|xphb" }],
    { unoffered: NO_CHOICE },
  ),
  // Switched on with the blessed item: armor or a weapon the character uses.
  [FORGE('blessing of the forge', 1)]: toggled(
    [
      uses('blessing-of-the-forge', 'Blessing of the Forge', 1, 'long'),
      {
        type: 'toggle',
        toggleId: 'blessing-of-the-forge',
        name: 'Blessing of the Forge',
        cost: [{ resource: 'blessing-of-the-forge', amount: 1 }],
        endsOn: ['longRest'],
        effects: [],
        options: [
          { id: 'armor', name: 'Armor', effects: [{ type: 'acBonus', value: 1 }] },
          {
            id: 'weapon',
            name: 'Weapon',
            effects: [
              {
                type: 'attackMod',
                label: '+1 Blessing of the Forge',
                filter: { source: ['weapon'] },
                toHit: 1,
                damage: 1,
              },
            ],
          },
        ],
      },
    ],
    {
      notes:
        'The weapon option adds +1 to every weapon attack: count it only with the blessed weapon. Leave it off when the blessing is on another creature’s item.',
      needs: 'a bonus tied to one picked item',
    },
  ),
  [FORGE("channel divinity: artisan's blessing", 3)]: numbers(
    [channel('artisans-blessing', "Artisan's Blessing", 'other')],
    { unoffered: AT_TABLE },
  ),
  [FORGE('soul of the forge', 6)]: numbers([
    { type: 'resistance', value: 'fire' },
    when({ armor: 'heavy' }, [{ type: 'acBonus', value: 1 }]),
  ]),
  [FORGE('saint of forge and fire', 17)]: toggled([{ type: 'immunity', value: 'fire' }], {
    notes: 'The heavy-armor resistances are not listed: they cover only some attacks.',
    needs: NONMAGICAL,
  }),

  // ---- Order Domain (Tasha's) ----
  [ORDER('order domain', 3)]: text(),
  [ORDER('bonus proficiencies', 1)]: numbers([
    heavyArmor,
    skillFrom(['intimidation', 'persuasion']),
  ]),
  [ORDER('voice of authority', 1)]: text({ unoffered: TARGETS }),
  [ORDER("channel divinity: order's demand", 3)]: numbers(
    [
      action({
        id: 'orders-demand',
        name: "Order's Demand",
        actionType: 'action',
        costs: [divinity],
        saveDc: dc('wis'),
      }),
    ],
    { unoffered: TARGETS },
  ),
  [ORDER('embodiment of the law', 6)]: numbers(
    perLongRest('embodiment-of-the-law', 'Embodiment of the Law', wisUses, 'other'),
  ),
  [ORDER("order's wrath", 17)]: text(),

  // ---- Peace Domain (Tasha's) ----
  [PEACE('peace domain', 3)]: text(),
  [PEACE('implement of peace', 1)]: numbers([skillFrom(['insight', 'performance', 'persuasion'])]),
  [PEACE('emboldening bond', 1)]: numbers(
    perLongRest('emboldening-bond', 'Emboldening Bond', 'pb', 'action', { roll: '1d4' }),
    { unoffered: TARGETS },
  ),
  [PEACE('channel divinity: balm of peace', 3)]: numbers([
    action({
      id: 'balm-of-peace',
      name: 'Balm of Peace',
      actionType: 'action',
      costs: [divinity],
      roll: '2d6 + mod.wis',
    }),
  ]),
  [PEACE('protective bond', 6)]: text(),
  [PEACE('expansive bond', 17)]: text(),

  // ---- Twilight Domain (Tasha's) ----
  [TWILIGHT('twilight domain', 3)]: text(),
  [TWILIGHT('bonus proficiencies', 1)]: numbers([martialWeapons, heavyArmor]),
  // The counter tracks sharing the darkvision.
  [TWILIGHT('eyes of night', 1)]: numbers([
    { type: 'sense', sense: 'darkvision', range: 300 },
    ...perLongRest('eyes-of-night', 'Eyes of Night', 1, 'action'),
    restoredBy('eyes-of-night', { slot: { minLevel: 1 } }),
  ]),
  [TWILIGHT('vigilant blessing', 1)]: numbers([
    action({ id: 'vigilant-blessing', name: 'Vigilant Blessing', actionType: 'action' }),
  ]),
  [TWILIGHT('channel divinity: twilight sanctuary', 3)]: numbers([
    action({
      id: 'twilight-sanctuary',
      name: 'Twilight Sanctuary',
      actionType: 'action',
      costs: [divinity],
      roll: '1d6 + level.cleric',
    }),
  ]),
  [TWILIGHT('steps of night', 6)]: toggled([
    uses('steps-of-night', 'Steps of Night', 'pb', 'long'),
    {
      type: 'toggle',
      toggleId: 'steps-of-night',
      name: 'Steps of Night',
      cost: [{ resource: 'steps-of-night', amount: 1 }, { action: 'bonus' }],
      endsOn: ['shortRest', 'longRest'],
      effects: [{ type: 'speed', mode: 'fly', value: 'walk' }],
    },
  ]),
  [TWILIGHT('twilight shroud', 17)]: text(),
};
