// Golden checks per class on real data (plan §10.2, steps 6.3–6.14 and 6.17): one build per
// subclass at a few levels, its numbers read the way the 2024 rules give them. Opt-in:
//   FIVETOOLS_DATA=./5etools-src-2.36.1 npm run test:smoke
// Checks numbers only; it never prints or stores content.

import { beforeAll, describe, expect, it } from 'vitest';
import { importFivetools } from '../../src/adapters/fivetools/index.ts';
import { createCatalog, type Catalog } from '../../src/engine/build/catalog.ts';
import { quickBuild } from '../../src/engine/build/quickBuild.ts';
import { createContentIndex, type ContentIndex } from '../../src/engine/content/contentIndex.ts';
import { derive } from '../../src/engine/derive/derive.ts';
import type { DerivedSheet } from '../../src/engine/derive/types.ts';
import { featureEffects } from '../../src/engine/featureEffects/index.ts';
import { toggle } from '../../src/engine/play/reducers.ts';
import type { ContentEntity } from '../../src/schema/index.ts';
import { nodeFileSource } from './nodeFileSource.ts';

const root = process.env.FIVETOOLS_DATA;

describe.skipIf(!root)('class golden checks (local data)', () => {
  let index: ContentIndex;
  let catalog: Catalog;

  beforeAll(async () => {
    const result = await importFivetools(nodeFileSource(root!), { now: 1 });
    const all = Object.values(result.entities).flat() as ContentEntity[];
    index = createContentIndex(all);
    catalog = createCatalog(all, new Set(['XPHB']));
  });

  /** A human soldier of one class, quick-built, with these toggles switched on. */
  function build(cls: string, levels: number, sub?: string, toggles: string[] = []): DerivedSheet {
    const registry = featureEffects();
    const classId = `${cls}|xphb`;
    let c = quickBuild(
      {
        name: 'Golden',
        speciesId: 'human|xphb',
        backgroundId: 'soldier|xphb',
        classes: [{ classId, levels, ...(sub ? { subclassId: `${sub}|${cls}|xphb|xphb` } : {}) }],
      },
      { index, catalog, registry, now: 1 },
    );
    let s = derive(c, index, { registry });
    for (const t of toggles) {
      c = toggle(c, s, t, true, { free: true });
      s = derive(c, index, { registry });
    }
    expect(s.choices.pending).toEqual([]);
    return s;
  }
  const resource = (s: DerivedSheet, name: string) => s.resources.find((r) => r.name === name);
  const attack = (s: DerivedSheet, name: string) => s.attacks.find((a) => a.name === name)!;
  const values = (list: { value: string }[]) => list.map((v) => v.value).sort();

  it('Barbarian: Rage, Unarmored Defense, Extra Attack and the four paths', () => {
    const one = build('barbarian', 1, undefined, ['rage']);
    expect(resource(one, 'Rage')?.max.value).toBe(2);
    // Strength 17 at level 1: +3, and +2 Rage damage.
    expect(attack(one, 'Greataxe').damageBonus.value).toBe(5);
    expect(values(one.defenses.resistances)).toEqual(['bludgeoning', 'piercing', 'slashing']);
    expect(one.saves.str.mode).toBe('advantage');
    // 10 + Dexterity + Constitution, no armor.
    expect(one.ac.value).toBe(10 + one.abilities.dex.mod + one.abilities.con.mod);

    const five = build('barbarian', 5);
    expect(five.attacksPerAction.value).toBe(2);
    expect(five.speed.walk?.value).toBe(40);
    expect(five.saves.dex.mode).toBe('advantage');

    const berserker = build('barbarian', 11, 'berserker', ['rage', 'reckless-attack']);
    expect(resource(berserker, 'Rage')?.max.value).toBe(4);
    expect(berserker.initiative.mode).toBe('advantage');
    expect(values(berserker.defenses.conditionImmunities)).toEqual(['charmed', 'frightened']);
    expect(attack(berserker, 'Greataxe').riders.find((r) => r.name === 'Frenzy')?.dice).toBe('3d6');

    const zealot = build('barbarian', 3, 'zealot', ['rage']);
    expect(resource(zealot, 'Warrior of the Gods')).toMatchObject({ die: '1d12' });
    expect(resource(zealot, 'Warrior of the Gods')?.max.value).toBe(4);
    expect(attack(zealot, 'Greataxe').riders.find((r) => r.id === 'divine-fury')?.dice).toBe(
      '1d6 + 1',
    );

    const twenty = build('barbarian', 20, 'zealot');
    expect(resource(twenty, 'Rage')?.max.value).toBe(6);
    expect(resource(twenty, 'Warrior of the Gods')?.max.value).toBe(7);
    expect(twenty.abilities.str.score.value).toBeGreaterThanOrEqual(21);
  });
});
