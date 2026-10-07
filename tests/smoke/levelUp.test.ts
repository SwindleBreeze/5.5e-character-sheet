// Opt-in level-up matrix against a real local 5etools checkout (plan §9.4, step 5.9):
//   FIVETOOLS_DATA=./5etools-src-2.36.1 npm run test:smoke
// Every XPHB class and subclass is levelled 1 → 20 the way the level-up flow does it, and ten
// seeded random multiclass builds too. Checks invariants only; it never prints or stores
// content.

import { beforeAll, describe, expect, it } from 'vitest';
import { importFivetools } from '../../src/adapters/fivetools/index.ts';
import { autoChoose } from '../../src/engine/build/autoChoose.ts';
import { setSubclass } from '../../src/engine/build/build.ts';
import { createCatalog, type Catalog } from '../../src/engine/build/catalog.ts';
import { autoFillLevel, planLevelUp } from '../../src/engine/build/levelUp.ts';
import { quickBuild } from '../../src/engine/build/quickBuild.ts';
import { undoLastLevel } from '../../src/engine/build/undo.ts';
import { createContentIndex, type ContentIndex } from '../../src/engine/content/contentIndex.ts';
import { derive } from '../../src/engine/derive/derive.ts';
import { featureEffects } from '../../src/engine/featureEffects/index.ts';
import type { Character, ClassDef, ContentEntity, Subclass } from '../../src/schema/index.ts';
import { seededRng } from '../../src/test/rng.ts';
import { nodeFileSource } from './nodeFileSource.ts';

const root = process.env.FIVETOOLS_DATA;

describe.skipIf(!root)('level-up (local data)', () => {
  let index: ContentIndex;
  let catalog: Catalog;
  let classes: ClassDef[];
  const registry = featureEffects();
  const deps = () => ({ index, catalog, registry, now: 0 });

  beforeAll(async () => {
    const result = await importFivetools(nodeFileSource(root!), { now: 1 });
    const all = Object.values(result.entities).flat() as ContentEntity[];
    index = createContentIndex(all);
    catalog = createCatalog(all, new Set(['XPHB', 'XDMG']));
    classes = catalog.of('class').filter((c) => c.source === 'XPHB');
  });

  /** One level in a class, its subclass (when due) the one given, its picks made. */
  function level(c: Character, cls: ClassDef, subclass?: Subclass): Character {
    const plan = planLevelUp(c, { kind: 'class', id: cls.id }, deps());
    let next = plan.character;
    if (plan.subclassDue && subclass)
      next = setSubclass(next, cls, { kind: 'subclass', id: subclass.id });
    return autoFillLevel(next, deps());
  }

  function start(cls: ClassDef): Character {
    return quickBuild(
      {
        name: cls.name,
        classes: [{ classId: cls.id, levels: 1 }],
        speciesId: 'human|xphb',
        backgroundId: 'sage|xphb',
      },
      deps(),
    );
  }

  /** What is wrong with a built character: errors, warnings, picks left that could be made. */
  function problems(label: string, c: Character): string[] {
    const sheet = derive(c, index, { registry });
    const ctx = { character: c, sheet, catalog, index };
    return [
      ...sheet.issues
        .filter((i) => i.severity === 'warn' && i.code !== 'overPrepared')
        .map((i) => `${label}: ${i.code}`),
      ...sheet.choices.pending
        .filter((p) => autoChoose(p.offer, p.count - p.have, ctx).values.length)
        .map((p) => `${label}: fillable ${p.offer.key.owner.id}#${p.offer.key.slot}`),
      ...(sheet.charLevel === c.log.length ? [] : [`${label}: level ${sheet.charLevel}`]),
    ];
  }

  it('every XPHB class and subclass, 1 → 20; the last level undone gives back level 19', () => {
    const found: string[] = [];
    for (const cls of classes) {
      const subclasses = catalog
        .of('subclass')
        .filter((s) => s.classId === cls.id && s.source === 'XPHB');
      expect(subclasses.length, cls.name).toBeGreaterThan(0);
      for (const sub of subclasses) {
        let c = start(cls);
        let at19: Character | undefined;
        for (let l = 2; l <= 20; l++) {
          c = level(c, cls, sub);
          if (l === 19) at19 = c;
        }
        expect(c.log.find((e) => e.subclassRef)?.subclassRef?.id, sub.name).toBe(sub.id);
        found.push(...problems(`${cls.name} (${sub.name}) 20`, c));
        expect(undoLastLevel(c, index, registry).character.log).toEqual(at19!.log);
      }
    }
    expect(found).toEqual([]);
  });

  it('ten seeded random multiclass builds derive without problems', () => {
    const rng = seededRng(5);
    const pick = <T>(list: readonly T[]) => list[Math.floor(rng() * list.length)]!;
    const found: string[] = [];
    for (let b = 0; b < 10; b++) {
      const first = pick(classes);
      const others = [pick(classes), pick(classes)].filter((x) => x.id !== first.id);
      const total = 5 + Math.floor(rng() * 16);
      let c = start(first);
      const subs = new Map<string, Subclass | undefined>();
      const subOf = (cls: ClassDef) => {
        if (!subs.has(cls.id))
          subs.set(cls.id, pick(catalog.of('subclass').filter((s) => s.classId === cls.id)));
        return subs.get(cls.id);
      };
      for (let l = 2; l <= total; l++) {
        const cls = rng() < 0.5 || !others.length ? first : pick(others);
        c = level(c, cls, subOf(cls));
      }
      const label = `build ${b} (${[...new Set(c.log.map((e) => e.classRef.id))].join(' / ')})`;
      found.push(...problems(label, c));
      // Hit dice: one per level, by the size of each class's die.
      const sheet = derive(c, index, { registry });
      expect(
        sheet.hitDice.reduce((n, h) => n + h.total, 0),
        label,
      ).toBe(total);
    }
    expect(found).toEqual([]);
  });
});
