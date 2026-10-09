// Feature mappings for the invented fixture classes (plan §9.2, step 3.0). Test-only: the app's
// registry never contains these. Each primitive P1–P12 is used at least once.

import type { FeatureEffectsMap } from '../engine/featureEffects/types.ts';

const noArmorNoShield = { all: [{ armor: 'none' as const }, { shield: false }] };

export const FIXTURE_FEATURE_EFFECTS: FeatureEffectsMap = {
  // ---- Brute (martial) ----
  'classFeature:fury|brute|tst|1|tst': {
    level: 'B',
    effects: [
      {
        type: 'resource',
        resourceId: 'furies',
        name: 'Furies',
        max: 'table.furies',
        recharge: 'long',
      },
      {
        type: 'toggle',
        toggleId: 'fury',
        name: 'Fury',
        cost: [{ resource: 'furies', amount: 1 }, { action: 'bonus' }],
        endsOn: ['longRest'],
        effects: [
          { type: 'resistance', value: 'bludgeoning' },
          { type: 'resistance', value: 'piercing' },
          { type: 'resistance', value: 'slashing' },
          { type: 'rollMode', target: 'check:str', mode: 'advantage' },
          { type: 'rollMode', target: 'save:str', mode: 'advantage' },
          {
            type: 'attackMod',
            label: 'Fury',
            filter: { range: 'melee', ability: ['str'] },
            damage: 'table.fury-damage',
          },
        ],
      },
    ],
  },
  'classFeature:hardened hide|brute|tst|1|tst': {
    level: 'A',
    effects: [
      {
        type: 'acFormula',
        name: 'Hardened Hide',
        base: 10,
        addAbilities: ['dex', 'con'],
        shield: true,
      },
    ],
  },
  'classFeature:weapon mastery|brute|tst|1|tst': {
    level: 'A',
    effects: [
      {
        type: 'weaponMasteryChoice',
        choice: {
          slot: 'mastery',
          count: 'table.weapon-mastery',
          from: { query: 'proficientWeapons' },
          retrain: 'longRest',
        },
      },
    ],
  },
  'classFeature:catch breath|brute|tst|2|tst': {
    level: 'A',
    effects: [
      {
        type: 'resource',
        resourceId: 'catch-breath',
        name: 'Catch Breath',
        max: 2,
        recharge: 'shortOne',
      },
      {
        type: 'grantAction',
        action: {
          id: 'catch-breath',
          name: 'Catch Breath',
          actionType: 'bonus',
          costs: [{ resource: 'catch-breath', amount: 1 }],
          outcomes: [{ heal: '1d8 + level.brute' }],
        },
      },
    ],
  },
  'classFeature:extra attack|brute|tst|5|tst': {
    level: 'A',
    effects: [{ type: 'extraAttack', count: 2 }],
  },
  'classFeature:swift feet|brute|tst|5|tst': {
    level: 'A',
    effects: [
      { type: 'when', when: { armor: 'notHeavy' }, effects: [{ type: 'speedBonus', value: 10 }] },
    ],
  },

  'subclassFeature:static charge|brute|tst|spark|tst|3|tst': {
    level: 'A',
    effects: [{ type: 'rollMode', target: 'skill:arcana', mode: 'advantage' }],
  },

  // ---- Gladiator (half caster) ----
  'classFeature:arena training|gladiator|tst|1|tst': {
    level: 'A',
    effects: [
      {
        type: 'resource',
        resourceId: 'bravado',
        name: 'Bravado',
        max: 'table.bravado',
        recharge: 'long',
      },
    ],
  },

  // ---- Lorekeeper (full caster) ----
  'classFeature:glyph ward|lorekeeper|tst|1|tst': {
    level: 'A',
    effects: [{ type: 'ward', name: 'Glyph Ward', max: '2 * level.lorekeeper + mod.int' }],
  },
  'classFeature:lore recovery|lorekeeper|tst|1|tst': {
    level: 'A',
    effects: [
      {
        type: 'resource',
        resourceId: 'lore-recovery',
        name: 'Lore Recovery',
        max: 1,
        recharge: 'long',
      },
      {
        type: 'grantAction',
        action: {
          id: 'lore-recovery',
          name: 'Lore Recovery',
          actionType: 'other',
          costs: [{ resource: 'lore-recovery', amount: 1 }],
          outcomes: [{ regainSlot: { maxLevel: 'ceil(level.lorekeeper / 2)' } }],
        },
      },
    ],
  },
  'classFeature:keen mind|lorekeeper|tst|2|tst': {
    level: 'A',
    effects: [
      { type: 'spellMod', filter: 'school=V', casterKey: 'lorekeeper|tst', damageBonus: 'mod.int' },
    ],
  },

  // ---- Pactbinder (pact caster) ----
  'classFeature:hex strike|pactbinder|tst|1|tst': {
    level: 'A',
    effects: [
      {
        type: 'damageRider',
        id: 'hex-strike',
        name: 'Hex Strike',
        dice: '1d6',
        damageType: 'necrotic',
        filter: { source: ['weapon'] },
        oncePerTurn: true,
        optIn: true,
      },
    ],
  },
  'classFeature:pact blade|pactbinder|tst|2|tst': {
    level: 'B',
    effects: [
      {
        type: 'toggle',
        toggleId: 'pact-blade',
        name: 'Pact Blade',
        effects: [
          {
            type: 'attackMod',
            label: 'Pact Blade',
            filter: { source: ['weapon'], range: 'melee' },
            abilities: ['cha'],
          },
        ],
      },
    ],
  },

  // ---- Wanderer (unarmored) ----
  'classFeature:unarmored defense|wanderer|tst|1|tst': {
    level: 'A',
    effects: [
      {
        type: 'acFormula',
        name: 'Unarmored Defense',
        base: 10,
        addAbilities: ['dex', 'wis'],
        shield: false,
      },
    ],
  },
  'classFeature:martial arts|wanderer|tst|1|tst': {
    level: 'A',
    effects: [
      {
        type: 'when',
        when: noArmorNoShield,
        effects: [
          {
            type: 'attackMod',
            label: 'Martial Arts',
            filter: { source: ['unarmed'] },
            abilities: ['str', 'dex'],
            damageDie: 'table.martial-arts',
          },
          {
            type: 'attackMod',
            label: 'Martial Arts',
            filter: { tags: ['monkWeapon'] },
            abilities: ['str', 'dex'],
            damageDie: 'table.martial-arts',
          },
        ],
      },
    ],
  },
  'classFeature:focus|wanderer|tst|2|tst': {
    level: 'A',
    effects: [
      {
        type: 'resource',
        resourceId: 'focus-points',
        name: 'Focus Points',
        max: 'table.focus-points',
        recharge: 'short',
      },
      {
        type: 'grantAction',
        action: {
          id: 'flurry',
          name: 'Flurry of Strikes',
          actionType: 'bonus',
          costs: [{ resource: 'focus-points', amount: 1 }],
          attack: { source: ['unarmed'] },
        },
      },
    ],
  },
  'classFeature:unarmored movement|wanderer|tst|2|tst': {
    level: 'A',
    effects: [
      {
        type: 'when',
        when: noArmorNoShield,
        effects: [{ type: 'speedBonus', value: 'table.unarmored-movement' }],
      },
    ],
  },
  // Wild Shape's stand-in (step 7.6): known forms come from the feature's table.
  'classFeature:beast form|wanderer|tst|2|tst': {
    level: 'B',
    effects: [
      {
        type: 'resource',
        resourceId: 'wild-shape',
        name: 'Beast Form',
        max: 2,
        recharge: 'long',
      },
      {
        type: 'toggle',
        toggleId: 'wild-shape',
        name: 'Beast Form',
        cost: [{ resource: 'wild-shape', amount: 1 }, { action: 'bonus' }],
        onActivate: [{ tempHp: 'level.wanderer' }],
        endsOn: ['longRest'],
        effects: [],
      },
    ],
  },
  'classFeature:extra attack|wanderer|tst|5|tst': {
    level: 'A',
    effects: [{ type: 'extraAttack', count: 2 }],
  },
  'classFeature:evasion|wanderer|tst|7|tst': { level: 'C', effects: [] },
};
