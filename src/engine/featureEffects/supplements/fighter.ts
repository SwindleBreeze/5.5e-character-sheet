// 2024 supplement fighter subclasses (plan §10.2, step 6.16): Banneret (Heroes of Faerûn) and
// Arcane Archer. Features riding on Second Wind, Action Surge and Indomitable spend the core
// counters (`second-wind`, `indomitable`). Arcane Shot is a counter with a die; its options and
// the Arcane Archer cantrip come from the subclass's data, as does Comprehend Languages.

import type { FeatureEffectsMap } from '../types.ts';
import { action, AT_TABLE, dc, numbers, restoredBy, TARGETS, text, uses } from '../core/helpers.ts';

const S = (sub: string, src: string, id: string, level: number) =>
  `subclassFeature:${id}|fighter|xphb|${sub}|${src}|${level}|${src}` as const;
const BANNERET = (id: string, level: number) => S('banneret', 'frhof', id, level);
const ARCHER = (id: string, level: number) => S('arcane archer', 'au', id, level);

export const SUP_FIGHTER: FeatureEffectsMap = {
  // ---- Banneret ----
  [BANNERET('banneret', 3)]: text(),
  // Polyglot's language may be swapped after a Long Rest.
  [BANNERET('knightly envoy', 3)]: numbers([
    {
      type: 'proficiencyChoice',
      category: 'language',
      choice: { slot: 'language', count: 1, from: 'any', retrain: 'longRest' },
      filter: 'standard|rare',
    },
    {
      type: 'proficiencyChoice',
      category: 'skill',
      choice: {
        slot: 'skill',
        count: 1,
        from: ['insight', 'intimidation', 'persuasion', 'performance'],
      },
    },
  ]),
  // Used with Second Wind; each chosen ally regains the rolled Hit Points.
  [BANNERET('group recovery', 3)]: numbers(
    [
      uses('group-recovery', 'Group Recovery', 1, 'short'),
      action({
        id: 'group-recovery',
        name: 'Group Recovery',
        actionType: 'other',
        costs: [{ resource: 'group-recovery', amount: 1 }],
        roll: '1d4 + level.fighter',
      }),
    ],
    { unoffered: TARGETS },
  ),
  [BANNERET('team tactics', 7)]: text(),
  // Which allies, and whether each attacks or moves, is decided at the table.
  [BANNERET('rallying surge', 10)]: text({ unoffered: TARGETS }),
  [BANNERET('shared resilience', 15)]: numbers(
    [
      action({
        id: 'shared-resilience',
        name: 'Shared Resilience',
        actionType: 'reaction',
        costs: [{ resource: 'indomitable', amount: 1 }],
        roll: 'level.fighter',
      }),
    ],
    { unoffered: TARGETS },
  ),
  [BANNERET('inspiring commander', 18)]: numbers([
    { type: 'conditionImmunity', value: 'charmed' },
    { type: 'conditionImmunity', value: 'frightened' },
  ]),

  // ---- Arcane Archer ----
  [ARCHER('arcane archer', 3)]: text(),
  // The cantrip pick comes from the subclass's data.
  [ARCHER('arcane archer lore', 3)]: numbers(
    [
      { type: 'proficiency', category: 'skill', value: 'arcana' },
      { type: 'proficiency', category: 'skill', value: 'nature' },
    ],
    {
      notes:
        'Already proficient in Arcana or Nature: pick another Fighter skill for each and add it by hand.',
    },
  ),
  [ARCHER('arcane shot', 3)]: numbers([
    uses('arcane-shot', 'Arcane Shot', 'max(1, mod.int)', 'short', {
      die: 'steps(level.fighter, 3, d6, 10, d8, 15, d10, 18, d12)',
    }),
    action({
      id: 'arcane-shot',
      name: 'Arcane Shot',
      actionType: 'other',
      costs: [{ resource: 'arcane-shot', amount: 1 }],
      saveDc: dc('int'),
    }),
  ]),
  [ARCHER('arcane shot options', 3)]: text(),
  [ARCHER('curving shot', 7)]: numbers([
    action({
      id: 'curving-shot',
      name: 'Curving Shot',
      actionType: 'bonus',
      attack: { range: 'ranged', source: ['weapon'] },
    }),
  ]),
  // The kind of ammunition is picked each time.
  [ARCHER('magical ammunition', 7)]: numbers(
    [
      uses('magical-ammunition', 'Magical Ammunition', 1, 'short'),
      restoredBy('magical-ammunition', { resource: 'second-wind', amount: 1 }),
      action({
        id: 'magical-ammunition',
        name: 'Magical Ammunition',
        actionType: 'action',
        costs: [{ resource: 'magical-ammunition', amount: 1 }],
      }),
    ],
    { unoffered: AT_TABLE },
  ),
  // One expended use back when rolling Initiative (no cost to track).
  [ARCHER('ever-ready shot', 10)]: text(),
  [ARCHER('indomitable teleport', 15)]: text(),
  [ARCHER('masterful shots', 18)]: numbers([
    action({
      id: 'masterful-shots',
      name: 'Masterful Shots',
      actionType: 'reaction',
      attack: { range: 'ranged', source: ['weapon'] },
    }),
  ]),
};
