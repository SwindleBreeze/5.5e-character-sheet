// 2024 supplement cleric domains (plan §10.2, step 6.16): Knowledge (Heroes of Faerûn), Grave
// and Arcana. Channel Divinity options are actions paid from the core counter
// (`channel-divinity`); domain spells, the Arcana cantrips and Magical Mastery's picks come from
// the subclasses' own data.

import { ABILITIES, type Effect } from '../../../schema/index.ts';
import type { FeatureEffectsMap } from '../types.ts';
import {
  action,
  AT_TABLE,
  numbers,
  restoredBy,
  TARGETS,
  text,
  toggled,
  uses,
} from '../core/helpers.ts';

const S = (sub: string, src: string, id: string, level: number) =>
  `subclassFeature:${id}|cleric|xphb|${sub}|${src}|${level}|${src}` as const;
const KNOWLEDGE = (id: string, level: number) => S('knowledge', 'frhof', id, level);
const GRAVE = (id: string, level: number) => S('grave', 'rhw', id, level);
const ARCANA = (id: string, level: number) => S('arcana', 'au', id, level);

const divinity = { resource: 'channel-divinity', amount: 1 };
const wisUses = 'max(1, mod.wis)';
const KNOWLEDGE_SKILLS = ['arcana', 'history', 'nature', 'religion'];

export const SUP_CLERIC: FeatureEffectsMap = {
  // ---- Knowledge Domain ----
  [KNOWLEDGE('knowledge domain', 3)]: text(),
  [KNOWLEDGE('knowledge domain spells', 3)]: text(),
  // Two skills from the list, each with Expertise, and one kind of Artisan's Tools.
  [KNOWLEDGE('blessings of knowledge', 3)]: numbers([
    {
      type: 'proficiencyChoice',
      category: 'tool',
      choice: { slot: 'tools', count: 1, from: 'any' },
      filter: 'artisan',
    },
    ...['skill-1', 'skill-2'].flatMap((slot): Effect[] => [
      {
        type: 'proficiencyChoice',
        category: 'skill',
        choice: { slot, count: 1, from: KNOWLEDGE_SKILLS },
      },
      { type: 'expertise', skill: { fromChoice: slot } },
    ]),
  ]),
  // Which Divination spell is cast is picked each time.
  [KNOWLEDGE('mind magic', 3)]: numbers(
    [action({ id: 'mind-magic', name: 'Mind Magic', actionType: 'action', costs: [divinity] })],
    { unoffered: AT_TABLE },
  ),
  [KNOWLEDGE('unfettered mind', 6)]: numbers(
    [
      { type: 'sense', sense: 'telepathy', range: 60 },
      { type: 'proficiency', category: 'save', value: 'int' },
    ],
    {
      notes:
        'Already proficient in Intelligence saves: pick another save at the table and add it by hand.',
    },
  ),
  [KNOWLEDGE('divine foreknowledge', 17)]: toggled([
    uses('divine-foreknowledge', 'Divine Foreknowledge', 1, 'long'),
    restoredBy('divine-foreknowledge', { slot: { minLevel: 6 } }),
    {
      type: 'toggle',
      toggleId: 'divine-foreknowledge',
      name: 'Divine Foreknowledge',
      cost: [{ resource: 'divine-foreknowledge', amount: 1 }, { action: 'bonus' }],
      endsOn: ['shortRest', 'longRest'],
      effects: [
        ...(['attack:all', 'save:all'] as const).map((target): Effect => ({
          type: 'rollMode',
          target,
          mode: 'advantage',
        })),
        ...ABILITIES.map((a): Effect => ({
          type: 'rollMode',
          target: `check:${a}`,
          mode: 'advantage',
        })),
      ],
    },
  ]),

  // ---- Grave Domain ----
  [GRAVE('grave domain', 3)]: text(),
  [GRAVE('grave domain spells', 3)]: text(),
  // Pull of Death: only against a creature missing Hit Points, so it is tapped in. Return to
  // Life (Spare the Dying as a Bonus Action, maximized healing at 0 HP) is text.
  [GRAVE('circle of mortality', 3)]: numbers([
    {
      type: 'damageRider',
      id: 'pull-of-death',
      name: 'Pull of Death',
      dice: 'steps(level.cleric, 3, 1d4, 11, 1d6)',
      damageType: 'necrotic',
      filter: {},
      oncePerTurn: true,
      optIn: true,
    },
  ]),
  // The extra damage's type (Necrotic or Radiant) is picked when the curse ends.
  [GRAVE('path to the grave', 3)]: numbers(
    [
      action({
        id: 'path-to-the-grave',
        name: 'Path to the Grave',
        actionType: 'bonus',
        costs: [divinity],
        roll: 'level.cleric',
      }),
    ],
    { unoffered: AT_TABLE },
  ),
  [GRAVE("sentinel at death's door", 6)]: numbers(
    [
      uses('sentinel-at-deaths-door', "Sentinel at Death's Door", wisUses, 'long'),
      action({
        id: 'sentinel-at-deaths-door',
        name: "Sentinel at Death's Door",
        actionType: 'reaction',
        costs: [{ resource: 'sentinel-at-deaths-door', amount: 1 }],
      }),
    ],
    { unoffered: TARGETS },
  ),
  [GRAVE('divine reaper', 17)]: numbers(
    [
      action({
        id: 'enhanced-necromancy',
        name: 'Enhanced Necromancy',
        actionType: 'other',
        costs: [divinity],
      }),
      uses('keeper-of-souls', 'Keeper of Souls', 1, 'short'),
      restoredBy('keeper-of-souls', { slot: { minLevel: 6 } }),
      action({
        id: 'keeper-of-souls',
        name: 'Keeper of Souls',
        actionType: 'other',
        costs: [{ resource: 'keeper-of-souls', amount: 1 }],
        roll: '2 * level.cleric',
      }),
    ],
    { unoffered: TARGETS },
  ),

  // ---- Arcana Domain ----
  [ARCANA('arcana domain', 3)]: text(),
  [ARCANA('arcana domain spells', 3)]: text(),
  // The way the spell changes is picked each time: its two options are actions below.
  [ARCANA('modify magic', 3)]: text({ unoffered: AT_TABLE }),
  [ARCANA('fortifying spell', 3)]: numbers(
    [
      action({
        id: 'fortifying-spell',
        name: 'Fortifying Spell',
        actionType: 'other',
        costs: [divinity],
        roll: '2d8 + level.cleric',
      }),
    ],
    { unoffered: TARGETS },
  ),
  [ARCANA('tenacious spell', 3)]: numbers([
    action({
      id: 'tenacious-spell',
      name: 'Tenacious Spell',
      actionType: 'other',
      costs: [divinity],
      roll: '1d6',
    }),
  ]),
  // The two Wizard cantrips come from the domain's data; the skill is added here.
  [ARCANA('student of arcana', 3)]: numbers([
    {
      type: 'proficiencyChoice',
      category: 'skill',
      choice: {
        slot: 'skill',
        count: 1,
        from: ['arcana', 'history', 'insight', 'medicine', 'persuasion', 'religion'],
      },
    },
  ]),
  [ARCANA('dispelling recovery', 6)]: numbers([
    uses('dispelling-recovery', 'Dispelling Recovery', 1, 'short'),
    restoredBy('dispelling-recovery', divinity),
    action({
      id: 'dispelling-recovery',
      name: 'Dispelling Recovery',
      actionType: 'other',
      costs: [{ resource: 'dispelling-recovery', amount: 1 }],
    }),
  ]),
  // Its four spells are picked through the domain's data.
  [ARCANA('magical mastery', 17)]: text(),
};
