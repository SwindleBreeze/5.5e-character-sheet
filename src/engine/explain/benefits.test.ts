import { beforeAll, describe, expect, it } from 'vitest';
import type { Background, ClassDef, Feat, Species } from '../../schema/index.ts';
import { fixtureIndex } from '../../test/fixtureIndex.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import { benefitsOf, firstSentence, lineageBenefits, type Benefit } from './benefits.ts';

let index: ContentIndex;
beforeAll(async () => {
  index = await fixtureIndex();
});

const line = (list: Benefit[], label: string) => list.find((b) => b.label === label);

describe('what an entity gives, in plain words (plan §9.3b)', () => {
  it('a class: hit points, saves, skills, training and level 1 features, with what they mean', () => {
    const brute = index.get({ kind: 'class', id: 'brute|tst' }) as ClassDef;
    const b = benefitsOf(brute, index);
    expect(line(b, 'Hit points')).toMatchObject({
      text: '12 + your Constitution modifier at level 1; then 7 (or 1d12) + your Constitution modifier each level',
      why: expect.stringMatching(/how much harm you can take/),
    });
    expect(line(b, 'Saving throws')?.why).toMatch(/proficiency bonus/);
    expect(line(b, 'Skills')?.text).toBe(
      'Choose 2: Athletics, Intimidation, Survival or Perception',
    );
    expect(line(b, 'Armor training')?.text).toBe('Light armor, Medium armor and Buckler');
    expect(line(b, 'Weapons')?.text).toBe('Simple weapons and Martial weapons');
    expect(line(b, 'Level 1 features')?.text).toContain('Weapon Mastery');
  });

  it('a background: ability increases, Origin feat, skills, languages and equipment', () => {
    const bg = index.get({ kind: 'background', id: 'arena hand|tst' }) as Background;
    const b = benefitsOf(bg, index);
    expect(line(b, 'Ability scores')?.text).toBe(
      '+2 to one and +1 to another, or +1 to each, of Strength, Constitution and Charisma',
    );
    expect(line(b, 'Origin feat')?.text).toBe('Spark Initiate; Gladiator');
    expect(line(b, 'Skill proficiencies')?.text).toBe('Athletics and Performance');
    // Its own language pick, and the one every 2024 character makes.
    expect(b.filter((x) => x.label === 'Languages').map((x) => x.text)).toEqual([
      'Choose 1 Standard language',
      'Common, and choose 2 Standard languages',
    ]);
    expect(line(b, 'Equipment A')?.text).toBe('2 × Torch, 10 GP');
  });

  it('a species: size, speed, senses, resistances and named traits; a lineage: what it adds', () => {
    const moss = index.get({ kind: 'species', id: 'mossling|tst' }) as Species;
    const b = benefitsOf(moss, index);
    expect(line(b, 'Size')?.text).toBe('Small or Medium');
    expect(line(b, 'Darkvision')).toMatchObject({ text: '60 ft.', why: expect.any(String) });
    expect(line(b, 'Resistance')?.text).toBe('Poison damage');
    expect(b.filter((x) => x.trait).map((x) => x.label)).toContain('Spores');
    const deep = index.get({ kind: 'species', id: 'mossling; deep lineage|tst' }) as Species;
    const adds = lineageBenefits(deep, moss, index);
    expect(line(adds, 'Darkvision')?.text).toBe('120 ft.');
    expect(adds.map((x) => x.label)).not.toContain('Size');
    // `benefitsOf` gives a lineage what it adds.
    expect(benefitsOf(deep, index)).toEqual(adds);
  });

  it('a feat: category, prerequisite and effects', () => {
    const feat = index.get({ kind: 'feat', id: 'arena veteran|tst' }) as Feat;
    const b = benefitsOf(feat, index);
    expect(line(b, 'Category')?.text).toBe('General');
    expect(line(b, 'Prerequisite')?.text).toBe('Level 4+, Strength 13+ or Charisma 13+');
    expect(line(b, 'Ability score')?.text).toBe('+1 to one of Strength or Charisma');
  });

  it('a trait’s summary is its first sentence, tags removed', () => {
    expect(firstSentence(['You gain {@skill Perception|XPHB}. More text here.'])).toBe(
      'You gain Perception.',
    );
    expect(firstSentence([{ type: 'entries', entries: ['Nested. Second.'] }])).toBe('Nested.');
  });
});
