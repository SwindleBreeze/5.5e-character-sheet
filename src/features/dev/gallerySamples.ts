// Invented sample numbers for the design gallery, so every component can be shown without any
// imported content.

import type { Contribution, Derived, DerivedRoll } from '../../engine/derive/types.ts';
import type { Ability } from '../../schema/index.ts';

export function derived(value: number, parts: Contribution[]): Derived {
  return { value, parts };
}

export function sampleRoll(
  bonus: number,
  opts: Partial<Omit<DerivedRoll, 'bonus'>> & { parts?: Contribution[] } = {},
): DerivedRoll {
  const { parts, ...rest } = opts;
  return {
    bonus: derived(bonus, parts ?? [{ label: 'Ability modifier', value: bonus }]),
    dice: [],
    proficiency: 'none',
    mode: 'normal',
    advantage: [],
    disadvantage: [],
    ...rest,
  };
}

export const SAMPLE_ABILITIES: { ability: Ability; score: number; parts: Contribution[] }[] = [
  {
    ability: 'str',
    score: 17,
    parts: [
      { label: 'Base score', value: 15, kind: 'base' },
      { label: 'Background', value: 2 },
    ],
  },
  { ability: 'dex', score: 12, parts: [{ label: 'Base score', value: 12, kind: 'base' }] },
  {
    ability: 'con',
    score: 15,
    parts: [
      { label: 'Base score', value: 14, kind: 'base' },
      { label: 'Background', value: 1 },
    ],
  },
  { ability: 'int', score: 8, parts: [{ label: 'Base score', value: 8, kind: 'base' }] },
  {
    ability: 'wis',
    score: 13,
    parts: [
      { label: 'Base score', value: 13, kind: 'base' },
      { label: 'Your override', value: 13, kind: 'override' },
    ],
  },
  { ability: 'cha', score: 10, parts: [{ label: 'Base score', value: 10, kind: 'base' }] },
];

export const modOf = (score: number) => Math.floor((score - 10) / 2);

export const SAMPLE_AC = derived(18, [
  { label: 'Splint armor', value: 17, kind: 'base' },
  { label: 'Shield', value: 2 },
  { label: 'Heavy armor: no DEX', value: -1 },
]);

export const SAMPLE_SKILLS: { label: string; ability: Ability; roll: DerivedRoll }[] = [
  {
    label: 'Athletics',
    ability: 'str',
    roll: sampleRoll(8, {
      proficiency: 'expertise',
      parts: [
        { label: 'STR modifier', value: 3 },
        { label: 'Expertise', value: 5 },
      ],
    }),
  },
  {
    label: 'Perception',
    ability: 'wis',
    roll: sampleRoll(4, {
      proficiency: 'proficient',
      mode: 'advantage',
      advantage: ['Keen Senses'],
      parts: [
        { label: 'WIS modifier', value: 1 },
        { label: 'Proficiency', value: 3 },
      ],
    }),
  },
  {
    label: 'Performance',
    ability: 'cha',
    roll: sampleRoll(1, {
      proficiency: 'half',
      parts: [
        { label: 'CHA modifier', value: 0 },
        { label: 'Half proficiency', value: 1 },
      ],
    }),
  },
  {
    label: 'Stealth',
    ability: 'dex',
    roll: sampleRoll(1, {
      mode: 'disadvantage',
      disadvantage: ['Splint armor'],
      parts: [{ label: 'DEX modifier', value: 1 }],
    }),
  },
  {
    label: 'Arcana',
    ability: 'int',
    roll: sampleRoll(-1, {
      dice: [{ label: 'Guidance', dice: '1d4' }],
      parts: [{ label: 'INT modifier', value: -1 }],
    }),
  },
];

export const DAMAGE_TYPES = [
  'acid',
  'bludgeoning',
  'cold',
  'fire',
  'force',
  'lightning',
  'necrotic',
  'piercing',
  'poison',
  'psychic',
  'radiant',
  'slashing',
  'thunder',
] as const;

export const SAMPLE_CONDITIONS = [
  { id: 'sample/blinded', name: 'Blinded' },
  { id: 'sample/grappled', name: 'Grappled' },
  { id: 'sample/poisoned', name: 'Poisoned' },
  { id: 'sample/prone', name: 'Prone' },
];
