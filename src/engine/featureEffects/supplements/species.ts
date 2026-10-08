// The 2024 supplement species (plan §10.2, step 6.16): Eberron: Forge of the Artificer, the
// Ravenloft and Lorwyn supplements, checked against the text of each. Speed, size, senses,
// resistances, skills and spells come from the data; these add the traits with uses or numbers:
// Fury of the Small, Shifting and its four forms, Howl, Vampiric Bite, Eerie Token, Knowledge
// from a Past Life, Kalashtar's Dual Mind and telepathy, Warforged plating. A species chosen by
// its lineage (`shifter; beasthide`, `faerie; lorwyn`) is its own entity, so each one gets the
// shared traits too. Advantage on saves against one condition is listed with the saves.

import { refKey, type Effect } from '../../../schema/index.ts';
import {
  action,
  AT_TABLE,
  numbers,
  savesAgainst,
  TARGETS,
  text,
  toggled,
  uses,
  when,
} from '../core/helpers.ts';
import type { FeatureEffectsMap, FeatureMapping } from '../types.ts';

const SP = (id: string, source: string) => refKey({ kind: 'species', id: `${id}|${source}` });

const FEY_ANCESTRY = savesAgainst('being Charmed');
/** The base species of a family picked by its lineage: the lineage is its own species. */
const BY_LINEAGE = 'Picked by choosing the lineage as the species.';

// ---- Boggart ----
const BOGGART = numbers([
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
  action({ id: 'nimble-escape', name: 'Nimble Escape', actionType: 'bonus' }),
  FEY_ANCESTRY,
]);

// ---- Changeling (Eberron) ----
const CHANGELING = toggled([
  {
    type: 'toggle',
    toggleId: 'shape-shifter',
    name: 'Shape-Shifter',
    cost: [{ action: 'action' }],
    effects: [{ type: 'rollMode', target: 'check:cha', mode: 'advantage' }],
  },
]);

// ---- Dhampir ----
const DHAMPIR = numbers(
  [
    action({
      id: 'vampiric-bite',
      name: 'Vampiric Bite',
      actionType: 'other',
      roll: '1d4 + mod.con',
      description: 'Piercing, in place of an Unarmed Strike’s damage.',
    }),
    uses('vampiric-bite', 'Vampiric Bite', 'pb', 'long'),
    action({
      id: 'vampiric-empowerment',
      name: 'Vampiric Bite: Empower',
      actionType: 'other',
      costs: [{ resource: 'vampiric-bite', amount: 1 }],
    }),
  ],
  {
    unoffered: AT_TABLE,
    needs: 'an Unarmed Strike form whose damage uses another ability than its attack roll',
  },
);

// ---- Elf (Lorwyn), Faerie, Kithkin, and the spell-trait species ----
const FEY = numbers([FEY_ANCESTRY]);
const FAERIE = text({
  notes: 'The fly speed does not apply in Medium or Heavy armor.',
  needs: 'a speed from the data that depends on the armor worn',
});
const KITHKIN = numbers([savesAgainst('being Frightened')]);

// ---- Hexblood ----
const HEXBLOOD = numbers([
  uses('eerie-token', 'Eerie Token', 1, 'long'),
  action({
    id: 'eerie-token',
    name: 'Eerie Token',
    actionType: 'bonus',
    costs: [{ resource: 'eerie-token', amount: 1 }],
  }),
  action({ id: 'distant-message', name: 'Distant Message', actionType: 'action' }),
  action({ id: 'remote-viewing', name: 'Remote Viewing', actionType: 'action' }),
]);

// ---- Kalashtar ----
// Telepathy reaches 10 feet per character level; the largest range applies.
const KALASHTAR = numbers(
  [
    { type: 'rollMode', target: 'save:wis', mode: 'advantage' },
    { type: 'rollMode', target: 'save:cha', mode: 'advantage' },
    ...Array.from({ length: 20 }, (_, i) =>
      when({ level: i + 1 }, [{ type: 'sense', sense: 'telepathy', range: 10 * (i + 1) }]),
    ),
    action({ id: 'mind-link', name: 'Mind Link', actionType: 'action' }),
  ],
  { unoffered: 'The skill is picked anew after each Long Rest.' },
);

// ---- Khoravar ----
const KHORAVAR = numbers(
  [
    {
      type: 'proficiencyChoice',
      category: ['skill', 'tool'],
      choice: { slot: 'skill-versatility', count: 1, from: 'any', retrain: 'longRest' },
    },
    uses('lethargy-resilience', 'Lethargy Resilience', 1, 'long'),
    action({
      id: 'lethargy-resilience',
      name: 'Lethargy Resilience',
      actionType: 'other',
      costs: [{ resource: 'lethargy-resilience', amount: 1 }],
    }),
    FEY_ANCESTRY,
  ],
  {
    notes: 'Lethargy Resilience comes back after 1d4 Long Rests, not one.',
    needs: 'a recharge over several rests',
  },
);

// ---- Lupin ----
const LUPIN = numbers(
  [
    uses('howl', 'Howl', 'pb', 'long'),
    action({
      id: 'howl',
      name: 'Howl',
      actionType: 'bonus',
      costs: [{ resource: 'howl', amount: 1 }],
      saveDc: '8 + mod.con + pb',
    }),
  ],
  {
    notes: 'Unarmed Strikes deal Slashing damage.',
    needs: 'changing the damage type of the Unarmed Strike',
    unoffered: TARGETS,
  },
);

// ---- Reborn ----
const REBORN = numbers([
  { type: 'rollMode', target: 'save:death', mode: 'advantage' },
  uses('knowledge-from-a-past-life', 'Knowledge from a Past Life', 'pb', 'long'),
  action({
    id: 'knowledge-from-a-past-life',
    name: 'Knowledge from a Past Life',
    actionType: 'other',
    costs: [{ resource: 'knowledge-from-a-past-life', amount: 1 }],
    roll: '1d6',
  }),
]);

// ---- Shifter ----
function shifter(form?: { tempHp?: string; effects: Effect[] }): FeatureMapping {
  return toggled(
    [
      uses('shifting', 'Shifting', 'pb', 'long'),
      {
        type: 'toggle',
        toggleId: 'shifting',
        name: 'Shifting',
        cost: [{ resource: 'shifting', amount: 1 }, { action: 'bonus' }],
        onActivate: [{ tempHp: form?.tempHp ?? '2 * pb' }],
        endsOn: ['shortRest', 'longRest'],
        effects: form?.effects ?? [],
      },
    ],
    form ? {} : { unoffered: BY_LINEAGE },
  );
}
const SHIFTER_FORMS: Record<string, { tempHp?: string; effects: Effect[] }> = {
  beasthide: { tempHp: '2 * pb + 1d6', effects: [{ type: 'acBonus', value: 1 }] },
  longtooth: {
    effects: [
      {
        type: 'attack',
        id: 'longtooth-fangs',
        name: 'Longtooth Fangs',
        damage: '1d6',
        damageType: 'piercing',
        range: 'melee',
        distance: '5 ft.',
        abilities: ['str'],
      },
      action({ id: 'longtooth-fangs', name: 'Longtooth Fangs', actionType: 'bonus' }),
    ],
  },
  swiftstride: {
    effects: [
      { type: 'speedBonus', value: 10 },
      action({ id: 'swiftstride', name: 'Swiftstride', actionType: 'reaction' }),
    ],
  },
  wildhunt: { effects: [{ type: 'rollMode', target: 'check:wis', mode: 'advantage' }] },
};

// ---- Warforged ----
const WARFORGED = numbers([{ type: 'acBonus', value: 1 }, savesAgainst('being Poisoned')]);

export const SUP_SPECIES: FeatureEffectsMap = {
  [SP('boggart', 'lfl')]: BOGGART,
  [SP('changeling', 'efa')]: CHANGELING,
  [SP('dhampir', 'rhw')]: DHAMPIR,
  [SP('elf', 'lfl')]: FEY,
  [SP('elf; lorwyn lineage', 'lfl')]: FEY,
  [SP('elf; shadowmoor lineage', 'lfl')]: FEY,
  [SP('faerie', 'lfl')]: { ...FAERIE, unoffered: BY_LINEAGE },
  [SP('faerie; lorwyn', 'lfl')]: FAERIE,
  [SP('faerie; shadowmoor', 'lfl')]: FAERIE,
  [SP('flamekin', 'lfl')]: text(),
  [SP('hexblood', 'rhw')]: HEXBLOOD,
  [SP('kalashtar', 'efa')]: KALASHTAR,
  [SP('khoravar', 'efa')]: KHORAVAR,
  [SP('kithkin', 'lfl')]: { ...KITHKIN, unoffered: BY_LINEAGE },
  [SP('kithkin; lorwyn', 'lfl')]: KITHKIN,
  [SP('kithkin; shadowmoor', 'lfl')]: KITHKIN,
  [SP('lorwyn changeling', 'lfl')]: text(),
  [SP('lupin', 'rhw')]: LUPIN,
  [SP('reborn', 'rhw')]: REBORN,
  [SP('rimekin', 'lfl')]: text({ notes: 'Flame Blade cast with this trait deals Cold damage.' }),
  [SP('shifter', 'efa')]: shifter(),
  ...Object.fromEntries(
    Object.entries(SHIFTER_FORMS).map(([form, benefit]) => [
      SP(`shifter; ${form}`, 'efa'),
      shifter(benefit),
    ]),
  ),
  [SP('warforged', 'efa')]: WARFORGED,
};
