// Opt-in build matrix against a real local 5etools checkout (plan §9.2, step 3.10):
//   FIVETOOLS_DATA=./5etools-src-2.36.1 npm run test:smoke
// Every XPHB class at levels 1, 5 and 20 is quick-built and derived. Checks invariants only;
// it never prints or stores content.

import { beforeAll, describe, expect, it } from 'vitest';
import { importFivetools } from '../../src/adapters/fivetools/index.ts';
import { autoChoose } from '../../src/engine/build/autoChoose.ts';
import { createCatalog, type Catalog } from '../../src/engine/build/catalog.ts';
import { quickBuild } from '../../src/engine/build/quickBuild.ts';
import { createContentIndex, type ContentIndex } from '../../src/engine/content/contentIndex.ts';
import { derive } from '../../src/engine/derive/derive.ts';
import { featureEffects } from '../../src/engine/featureEffects/index.ts';
import { encodeChoiceKey, type ClassDef, type ContentEntity } from '../../src/schema/index.ts';
import { nodeFileSource } from './nodeFileSource.ts';

const root = process.env.FIVETOOLS_DATA;
const LEVELS = [1, 5, 20];

describe.skipIf(!root)('quick-builder (local data)', () => {
  let index: ContentIndex;
  let catalog: Catalog;
  let classes: ClassDef[];

  beforeAll(async () => {
    const result = await importFivetools(nodeFileSource(root!), { now: 1 });
    const all = Object.values(result.entities).flat() as ContentEntity[];
    index = createContentIndex(all);
    catalog = createCatalog(all, new Set(['XPHB', 'XDMG']));
    classes = catalog.of('class').filter((c) => c.source === 'XPHB');
  });

  it('builds every XPHB class at levels 1, 5 and 20 with nothing left to fill', () => {
    expect(classes).toHaveLength(12);
    const species = catalog.of('species');
    const backgrounds = catalog.of('background');
    const problems: string[] = [];
    classes.forEach((cls, i) => {
      for (const levels of LEVELS) {
        const label = `${cls.name} ${levels}`;
        const registry = featureEffects();
        const deps = { index, catalog, registry, now: 0 };
        let sheet;
        let character;
        try {
          character = quickBuild(
            {
              name: label,
              classes: [{ classId: cls.id, levels }],
              speciesId: species[i % species.length]!.id,
              backgroundId: backgrounds[i % backgrounds.length]!.id,
            },
            deps,
          );
          sheet = derive(character, index, { registry });
        } catch (err) {
          problems.push(`${label}: threw ${(err as Error).message}`);
          continue;
        }
        if (sheet.charLevel !== levels) problems.push(`${label}: level ${sheet.charLevel}`);
        if (sheet.hp.max.value < levels) problems.push(`${label}: HP ${sheet.hp.max.value}`);
        if (levels >= cls.subclassLevel && !sheet.classes[0]?.subclassId)
          problems.push(`${label}: no subclass`);
        for (const issue of sheet.issues.filter((x) => x.severity === 'warn'))
          problems.push(`${label}: issue ${issue.code} ${issue.message}`);
        for (const r of sheet.choices.attention)
          problems.push(`${label}: attention ${r.status} ${r.key}`);
        for (const p of sheet.choices.pending) {
          const pick = autoChoose(p.offer, p.count - p.have, { character, sheet, catalog, index });
          if (pick.values.length)
            problems.push(`${label}: fillable ${encodeChoiceKey(p.offer.key)}`);
        }
      }
    });
    expect(problems).toEqual([]);
  });
});
