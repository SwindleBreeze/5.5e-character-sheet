// Type-level coverage: one hand-written, invented sample per schema type. If a type changes in
// an incompatible way, this file stops compiling.

import { describe, expect, it } from 'vitest';
import type {
  Background,
  Character,
  ClassDef,
  ClassFeature,
  ContentOrigin,
  Effect,
  Feat,
  Item,
  OptionalFeature,
  Pack,
  Rule,
  Species,
  Spell,
  Subclass,
  SubclassFeature,
} from './index.ts';
import { CHARACTER_SCHEMA_VERSION, PACK_FORMAT, PACK_VERSION } from './index.ts';

const origin: ContentOrigin = { adapter: 'homebrew', adapterVersion: 1, importedAt: 0 };
const base: Pick<Spell, 'source' | 'edition' | 'entries' | 'effects' | 'origin'> = {
  source: 'TEST',
  edition: '2024',
  entries: ['A test entry.'],
  effects: [],
  origin,
};

const spell = {
  ...base,
  kind: 'spell',
  id: 'zap|test',
  name: 'Zap',
  level: 1,
  school: 'V',
  time: [{ amount: 1, unit: 'action' }],
  range: { type: 'point', distance: { type: 'feet', amount: 60 } },
  components: { v: true, s: true },
  duration: [{ type: 'instant' }],
  ritual: false,
  classIds: ['testificate|test'],
  subclassIds: [],
} satisfies Spell;

const classDef = {
  ...base,
  kind: 'class',
  id: 'testificate|test',
  name: 'Testificate',
  hitDie: 8,
  primaryAbility: [['str'], ['dex']],
  saves: ['str', 'con'],
  startingProficiencies: {
    armor: ['light'],
    weapons: ['simple'],
    tools: [],
    skills: { slot: 'skills', count: 2, from: ['athletics', 'stealth', 'survival'] },
  },
  startingEquipment: [{ key: 'A', items: [{ itemId: 'stick|test', quantity: 1 }], valueCp: 500 }],
  multiclass: { prereq: [['str'], ['dex']], gains: { armor: [], weapons: ['martial'], tools: [] } },
  table: [{ key: 'pep-points', label: 'Pep Points', values: Array(20).fill(2) }],
  features: [{ level: 1, featureId: 'pep|testificate|test|1|test', gainSubclassFeature: false }],
  subclassTitle: 'Testificate Path',
  subclassLevel: 3,
  featProgression: [],
  optionalFeatureProgression: [],
} satisfies ClassDef;

const classFeature = {
  ...base,
  kind: 'classFeature',
  id: 'pep|testificate|test|1|test',
  name: 'Pep',
  classId: classDef.id,
  level: 1,
} satisfies ClassFeature;

const subclass = {
  ...base,
  kind: 'subclass',
  id: 'tester|testificate|test|test',
  name: 'Path of Tests',
  classId: classDef.id,
  shortName: 'Tester',
  features: [{ level: 3, featureId: 'probe|testificate|test|tester|test|3|test' }],
} satisfies Subclass;

const subclassFeature = {
  ...base,
  kind: 'subclassFeature',
  id: 'probe|testificate|test|tester|test|3|test',
  name: 'Probe',
  classId: classDef.id,
  subclassId: subclass.id,
  level: 3,
} satisfies SubclassFeature;

const background = {
  ...base,
  kind: 'background',
  id: 'lamplighter|test',
  name: 'Lamplighter',
  abilityOptions: [{ from: ['dex', 'int', 'wis'], weights: [2, 1] }],
  featId: 'keen eye|test',
  equipment: [{ key: 'B', items: [], valueCp: 5000 }],
} satisfies Background;

const feat = {
  ...base,
  kind: 'feat',
  id: 'keen eye|test',
  name: 'Keen Eye',
  category: 'origin',
  prerequisites: [[{ type: 'level', level: 4 }]],
  repeatable: false,
} satisfies Feat;

const species = {
  ...base,
  kind: 'species',
  id: 'gloomkin|test',
  name: 'Gloomkin',
  size: ['S', 'M'],
  speed: { walk: 30 },
  creatureType: 'humanoid',
} satisfies Species;

const item = {
  ...base,
  kind: 'item',
  id: 'stick|test',
  name: 'Stick',
  itemKind: 'weapon',
  weightLb: 2,
  valueCp: 10,
  weapon: { category: 'simple', damage: '1d4', damageType: 'B', properties: [] },
} satisfies Item;

const optionalFeature = {
  ...base,
  kind: 'optionalFeature',
  id: 'flourish|test',
  name: 'Flourish',
  featureTypes: ['TST'],
  prerequisites: [],
} satisfies OptionalFeature;

const rule = {
  ...base,
  kind: 'rule',
  id: 'woozy|test',
  name: 'Woozy',
  ruleKind: 'condition',
} satisfies Rule;

const effects: Effect[] = [
  { type: 'abilityChoice', choice: { slot: 'ability', count: 1, from: ['str', 'dex'] }, value: 1 },
  {
    type: 'resource',
    resourceId: 'pep',
    name: 'Pep',
    max: 'table.pep-points',
    recharge: 'shortOne',
  },
  { type: 'acFormula', name: 'Thick Skin', base: 10, addAbilities: ['dex', 'con'], shield: true },
  { type: 'toggle', toggleId: 'hype', name: 'Hype', effects: [{ type: 'resistance', value: 'B' }] },
];

const character = {
  id: 'c1',
  schemaVersion: CHARACTER_SCHEMA_VERSION,
  createdAt: 0,
  updatedAt: 0,
  name: 'Test Hero',
  enabledSources: null,
  baseScores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
  scoreMethod: 'standard',
  log: [
    {
      charLevel: 1,
      classRef: { kind: 'class', id: classDef.id },
      classLevel: 1,
      origin: {
        speciesRef: { kind: 'species', id: species.id },
        backgroundRef: { kind: 'background', id: background.id },
      },
      hp: { mode: 'max' },
      choices: [
        {
          key: { owner: { kind: 'class', id: classDef.id }, slot: 'skills' },
          values: ['athletics', 'stealth'],
          labels: ['Athletics', 'Stealth'],
          madeAt: 0,
          via: 'creation',
        },
      ],
    },
  ],
  inventory: [
    {
      uid: 'i1',
      itemRef: { kind: 'item', id: item.id },
      name: 'Stick',
      quantity: 1,
      equipped: 'mainHand',
      attuned: false,
    },
  ],
  currency: { cp: 0, sp: 0, ep: 0, gp: 5, pp: 0 },
  state: {
    damage: 0,
    tempHp: 0,
    deathSaves: { successes: 0, failures: 0 },
    hitDiceUsed: {},
    slotsUsed: [],
    pactSlotsUsed: 0,
    resourcesUsed: {},
    conditions: [],
    exhaustion: 0,
    heroicInspiration: false,
    concentration: null,
    activeToggles: {},
    prepared: {},
  },
  overrides: { ac: 16, 'skill.stealth': 7 },
  details: {},
  notes: '',
  sessionLog: [],
  snapshots: {},
  ui: {},
} satisfies Character;

const pack = {
  format: PACK_FORMAT,
  version: PACK_VERSION,
  adapterVersion: 1,
  exportedAt: 0,
  sources: [
    {
      code: 'TEST',
      name: 'Test Source',
      edition: '2024',
      counts: { spell: 1 },
      importedAt: 0,
      adapterVersion: 1,
      origin: 'homebrew',
    },
  ],
  entities: { spell: [spell], class: [classDef] },
} satisfies Pack;

describe('schema types', () => {
  it('accepts one sample of every entity kind', () => {
    const all = [
      spell,
      classDef,
      classFeature,
      subclass,
      subclassFeature,
      background,
      feat,
      species,
      item,
      optionalFeature,
      rule,
    ];
    expect(new Set(all.map((e) => e.kind)).size).toBe(11);
    expect(effects).toHaveLength(4);
    expect(character.log[0]?.choices).toHaveLength(1);
    expect(pack.entities.spell).toHaveLength(1);
  });
});
