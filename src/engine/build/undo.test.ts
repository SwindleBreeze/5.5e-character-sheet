import { beforeAll, describe, expect, it } from 'vitest';
import type { ContentEntity } from '../../schema/index.ts';
import { fixtureContent } from '../../test/fixtureIndex.ts';
import { FIXTURE_FEATURE_EFFECTS } from '../../test/fixtureFeatureEffects.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import { derive } from '../derive/derive.ts';
import { createCatalog, type Catalog } from './catalog.ts';
import { planLevelUp } from './levelUp.ts';
import { fillPending, quickBuild } from './quickBuild.ts';
import { undoLastLevel, undoPreview } from './undo.ts';

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
const deps = () => ({ index, catalog, registry, now: 0 });
const build = (classId: string, levels: number) =>
  quickBuild(
    {
      name: 'Test',
      speciesId: 'mossling|tst',
      backgroundId: 'arena hand|tst',
      classes: [{ classId, levels }],
    },
    deps(),
  );

describe('undo the last level (plan §9.4, step 5.3)', () => {
  it('a level taken and undone gives back the character as it was', () => {
    for (const id of ['brute|tst', 'lorekeeper|tst', 'pactbinder|tst']) {
      const c = build(id, 3);
      const plan = planLevelUp(c, { kind: 'class', id }, deps());
      const levelled = fillPending(plan.character, deps()).character;
      expect(levelled.log).toHaveLength(4);
      expect(undoLastLevel(levelled, index, registry).character).toEqual(c);
    }
  });

  it('a pick the lower level allows fewer of keeps its first values', () => {
    // The Brute's Weapon Mastery goes from three kinds at level 4 back to two.
    const c = build('brute|tst', 4);
    const mastery = (x: typeof c) =>
      x.log[0]!.choices.find((r) => r.key.slot === 'mastery')!.values;
    expect(mastery(c)).toHaveLength(3);
    const { character, trimmed } = undoLastLevel(c, index, registry);
    expect(mastery(character)).toEqual(mastery(c).slice(0, 2));
    expect(trimmed).toHaveLength(1);
    expect(trimmed[0]!.labels).toHaveLength(1);
  });

  it('lists what goes: the level, its subclass, and every pick made on it', () => {
    const c = build('brute|tst', 4);
    expect(undoPreview(build('brute|tst', 1), index)).toBeUndefined();
    const preview = undoPreview(c, index)!;
    expect(preview).toMatchObject({ charLevel: 4, className: 'Brute', classLevel: 4 });
    expect(preview.picks.map((p) => p.owner)).toContain('Ability Score Improvement');
    expect(undoPreview(build('brute|tst', 3), index)?.subclass).toBe('Path of the Spark');
  });

  it('puts right what the lower level allows: spent slots, hit dice and prepared spells', () => {
    const c = build('lorekeeper|tst', 5);
    const sheet = derive(c, index, { registry });
    c.state.slotsUsed = sheet.spellcasting.slots.map((s) => s.max);
    c.state.hitDiceUsed = { 6: 5 };
    const { character, unprepared } = undoLastLevel(c, index, registry);
    const after = derive(character, index, { registry });
    // Every slot still there is spent; the 3rd-level ones are gone.
    after.spellcasting.slots.forEach((slot) =>
      expect(character.state.slotsUsed[slot.level - 1]).toBe(slot.max),
    );
    expect(character.state.slotsUsed[2] ?? 0).toBe(0);
    expect(character.state.hitDiceUsed[6]).toBe(4);
    const caster = after.spellcasting.casters.find((x) => x.key === 'lorekeeper|tst')!;
    const counted = (character.state.prepared[caster.key] ?? []).filter(
      (id) => !caster.alwaysPrepared.includes(id),
    );
    expect(counted.length).toBeLessThanOrEqual(caster.preparedMax);
    // A 3rd-level spell can't stay prepared at level 4.
    expect(unprepared).toEqual([{ caster: 'Lorekeeper', spells: ['rolling boom|tst'] }]);
  });
});
