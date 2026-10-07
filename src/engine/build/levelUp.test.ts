import { beforeAll, describe, expect, it } from 'vitest';
import type { ContentEntity } from '../../schema/index.ts';
import { fixtureContent } from '../../test/fixtureIndex.ts';
import { FIXTURE_FEATURE_EFFECTS } from '../../test/fixtureFeatureEffects.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import { derive } from '../derive/derive.ts';
import { setSubclass } from './build.ts';
import { createCatalog, type Catalog } from './catalog.ts';
import { levelUpOptions, planLevelUp, readLevelUp, setLevelHp } from './levelUp.ts';
import { quickBuild } from './quickBuild.ts';

let index: ContentIndex;
let catalog: Catalog;
beforeAll(async () => {
  const content = await fixtureContent();
  index = content.index;
  catalog = createCatalog(
    Object.values(content.entities).flat() as ContentEntity[],
    new Set(['TST']),
  );
});

const registry = FIXTURE_FEATURE_EFFECTS;
const deps = () => ({ index, catalog, registry });
const build = (classId: string, levels: number) =>
  quickBuild(
    {
      name: 'Test',
      speciesId: 'mossling|tst',
      backgroundId: 'arena hand|tst',
      classes: [{ classId, levels }],
    },
    { ...deps(), now: 0 },
  );

const brute = { kind: 'class', id: 'brute|tst' } as const;
const lorekeeper = { kind: 'class', id: 'lorekeeper|tst' } as const;
const pactbinder = { kind: 'class', id: 'pactbinder|tst' } as const;

describe('level-up (plan §9.4, step 5.1)', () => {
  it('a level in the same class: features, hit points, and its picks', () => {
    const plan = planLevelUp(build('brute|tst', 3), brute, deps());
    expect(plan).toMatchObject({
      entryIndex: 3,
      classLevel: 4,
      charLevel: 4,
      multiclass: false,
      hitDie: 12,
      hpAverage: 7,
      hp: { mode: 'avg' },
      subclassDue: false,
      issues: [],
    });
    expect(plan.features.map((f) => f.name)).toEqual(['Ability Score Improvement']);
    // The feat, and a spell from the Path of the Spark (a subclass that casts).
    expect(
      plan.pending.map((p) => `${p.offer.key.owner.id}#${p.offer.key.slot}:${p.count - p.have}`),
    ).toEqual([
      'ability score improvement|brute|tst|4|tst#feat:1',
      'spark|brute|tst|tst#spells.4:1',
    ]);
    // A rolled 3 instead of the fixed 7: four hit points fewer.
    const avg = plan.sheet.hp.max.value;
    const rolled = readLevelUp(
      setLevelHp(plan.character, { mode: 'roll', value: 3 }),
      derive(build('brute|tst', 3), index, { registry }),
      deps(),
    );
    expect(rolled.sheet.hp.max.value).toBe(avg - 4);
  });

  it('the subclass is due at its level, with the subclasses to choose from', () => {
    const plan = planLevelUp(build('brute|tst', 2), brute, deps());
    expect(plan.subclassDue).toBe(true);
    expect(plan.subclasses.map((s) => s.name)).toEqual(['Path of the Spark']);
    const cls = plan.cls!;
    const chosen = readLevelUp(
      setSubclass(plan.character, cls, { kind: 'subclass', id: plan.subclasses[0]!.id }),
      plan.sheet,
      deps(),
    );
    expect(chosen.subclassRef?.id).toBe(plan.subclasses[0]!.id);
    expect(chosen.features.some((f) => f.ref.kind === 'subclassFeature')).toBe(true);
  });

  it('a caster’s new spells are this level’s picks, recorded on its entry', () => {
    const plan = planLevelUp(build('lorekeeper|tst', 1), lorekeeper, deps());
    const slots = plan.pending.map((p) => p.offer.key.slot);
    expect(slots).toContain('spellbook.2');
    // Level 1's unfinished picks stay level 1's.
    expect(slots).not.toContain('spellbook.1');
    const book = plan.sheet.features
      .flatMap((f) => f.choices)
      .find((c) => c.offer.key.slot === 'spellbook.2')!;
    expect(book.entryIndex).toBe(1);
  });

  it('multiclassing (2024): 13+ in the new class’s primary ability and every current one’s', () => {
    const c = build('brute|tst', 1);
    const sheet = derive(c, index, { registry });
    const options = levelUpOptions(c, sheet, index, catalog);
    // The character's own class first, then the others.
    expect(options[0]).toEqual({
      classId: 'brute|tst',
      name: 'Brute',
      classLevel: 2,
      multiclass: false,
    });
    expect(options.find((o) => o.classId === 'pactbinder|tst')?.prereq).toEqual({
      met: false,
      unmet: ['Pactbinder: Charisma 13+'],
      unknown: [],
    });
    // Warned, not blocked: the level can be taken.
    const plan = planLevelUp(c, pactbinder, deps());
    expect(plan).toMatchObject({ multiclass: true, classLevel: 1, charLevel: 2, hitDie: 8 });
    expect(plan.prereq?.met).toBe(false);
    // With Charisma 13, and Strength still 13+ for the Brute: met.
    const able = { ...c, baseScores: { ...c.baseScores, cha: 13 } };
    expect(planLevelUp(able, pactbinder, deps()).prereq).toEqual({
      met: true,
      unmet: [],
      unknown: [],
    });
  });

  it('a level past 20 is an issue', () => {
    const plan = planLevelUp(build('brute|tst', 20), brute, deps());
    expect(plan.issues).toEqual(['Characters go up to level 20.']);
  });
});
