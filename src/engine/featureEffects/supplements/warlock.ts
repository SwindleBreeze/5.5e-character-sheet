// Warlock patrons from the 2024 supplements (plan §10.2, step 6.16): the Undead Patron (RHW)
// and the Vestige Patron (AU). Patron spells come from the subclass data (the Vestige's domain
// pick included). Form of Dread is a switch the later Undead features hang off; the vestige's
// creature type is a pick its resistances read.

import type { Effect } from '../../../schema/index.ts';
import type { FeatureEffectsMap } from '../types.ts';
import { action, dc, numbers, TARGETS, text, toggled, uses, when } from '../core/helpers.ts';

const S = (sub: string, src: string, id: string, level: number) =>
  `subclassFeature:${id}|warlock|xphb|${sub}|${src}|${level}|${src}` as const;
const U = (id: string, level: number) => S('undead', 'rhw', id, level);
const V = (id: string, level: number) => S('vestige', 'au', id, level);

const chaUses = 'max(1, mod.cha)';
const dread = { toggle: 'form-of-dread' };
const pactSlot = { slot: { minLevel: 1 } };

/** The Vestige Companion's creature type, picked in its own slot (and again each Long Rest). */
const vestigeCompanion = {
  kind: 'subclassFeature' as const,
  id: 'vestige companion|warlock|xphb|vestige|au|3|au',
};
const VESTIGE_TYPES = ['celestial', 'fiend', 'undead'];
const VESTIGE_RESISTANCE: Record<string, string> = {
  celestial: 'radiant',
  fiend: 'fire',
  undead: 'necrotic',
};

export const SUP_WARLOCK: FeatureEffectsMap = {
  // ---- Undead Patron (RHW) ----
  [U('undead patron', 3)]: text(),
  [U('form of dread', 3)]: toggled(
    [
      uses('form-of-dread', 'Form of Dread', chaUses, 'long'),
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
      notes: 'Frightful Avatar (a Wisdom save on a hit, once a turn) is rolled at the table.',
      unoffered: TARGETS,
    },
  ),
  [U('undead spells', 3)]: text(),
  [U('grave touched', 6)]: text({
    needs: "a rider worth one more of the attack's own damage dice",
  }),
  [U('necrotic husk', 10)]: numbers(
    [
      { type: 'resistance', value: 'necrotic' },
      when(dread, [{ type: 'immunity', value: 'necrotic' }]),
      uses('unholy-resuscitation', 'Unholy Resuscitation', 1, 'short'),
      action({
        id: 'unholy-resuscitation',
        name: 'Unholy Resuscitation',
        actionType: 'other',
        costs: [{ resource: 'unholy-resuscitation', amount: 1 }],
        roll: '2d10 + mod.cha',
        saveDc: dc('cha'),
      }),
    ],
    {
      notes: 'Set your Hit Points and add the Exhaustion level by hand.',
      unoffered: TARGETS,
    },
  ),
  [U('superior dread', 14)]: numbers(
    [
      when(dread, [
        { type: 'resistance', value: 'bludgeoning' },
        { type: 'resistance', value: 'piercing' },
        { type: 'resistance', value: 'slashing' },
        { type: 'speed', mode: 'fly', value: 'walk' },
      ]),
    ],
    { notes: 'The Fly Speed can hover.' },
  ),

  // ---- Vestige Patron (AU) ----
  [V('vestige patron', 3)]: text(),
  [V('vestige companion', 3)]: numbers(
    [
      {
        type: 'optionChoice',
        choice: { slot: 'type', count: 1, from: VESTIGE_TYPES, retrain: 'longRest' },
        labels: ['Celestial', 'Fiend', 'Undead'],
      },
      // The vestige's once-a-day Divine Power, tracked here since the companion isn't.
      uses('vestige-divine-power', "Vestige's Divine Power", 1, 'long'),
    ],
    { notes: "The vestige isn't tracked by the app yet: note its stat block and Hit Points." },
  ),
  [V('vestige spells', 3)]: text(),
  [V('vestige power', 6)]: toggled(
    [
      { type: 'resourceModify', resourceId: 'vestige-divine-power', recharge: 'short' },
      {
        type: 'toggle',
        toggleId: 'near-vestige',
        name: 'Within 30 ft of your vestige',
        effects: VESTIGE_TYPES.map((value): Effect => ({
          type: 'ifChoice',
          owner: vestigeCompanion,
          slot: 'type',
          value,
          effects: [{ type: 'resistance', value: VESTIGE_RESISTANCE[value]! }],
        })),
      },
    ],
    { notes: 'Magical Cunning also restores the vestige’s Divine Power.' },
  ),
  [V('vestige recovery', 10)]: numbers([
    uses('vestige-recovery', 'Vestige Recovery', 1, 'long'),
    action({
      id: 'vestige-recovery',
      name: 'Vestige Recovery',
      actionType: 'reaction',
      costs: [{ resource: 'vestige-recovery', amount: 1 }, pactSlot],
    }),
  ]),
  [V('semblance of life', 14)]: numbers([
    uses('semblance-of-life', 'Semblance of Life', 1, 'long'),
    action({
      id: 'semblance-of-life',
      name: 'Semblance of Life',
      actionType: 'action',
      costs: [{ resource: 'semblance-of-life', amount: 1 }],
    }),
  ]),
};
