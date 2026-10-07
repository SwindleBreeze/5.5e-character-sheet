// Opt-in check of the creation wizard's engine against a real local 5etools checkout (plan
// §9.3, step 4.5):
//   FIVETOOLS_DATA=./5etools-src-2.36.1 npm run test:smoke
// Every XPHB class with every XPHB species (lineages included) and background, made as the
// wizard makes it and filled automatically, ends with nothing left to pick. Checks invariants
// only; it never prints or stores content.

import { beforeAll, describe, expect, it } from 'vitest';
import { importFivetools } from '../../src/adapters/fivetools/index.ts';
import { createCatalog, type Catalog } from '../../src/engine/build/catalog.ts';
import {
  anyEquipmentType,
  anyItemKey,
  equipmentTypeItems,
  pickedEquipment,
  startingEquipmentOwners,
  syncStartingEquipment,
  unpickedAnyItems,
} from '../../src/engine/build/equipment.ts';
import { fillPending, prepareSpells } from '../../src/engine/build/quickBuild.ts';
import {
  chooseBackground,
  chooseClass,
  chooseSpecies,
  finishDraft,
  newDraft,
} from '../../src/engine/build/wizard.ts';
import { createContentIndex, type ContentIndex } from '../../src/engine/content/contentIndex.ts';
import { derive } from '../../src/engine/derive/derive.ts';
import { featureEffects } from '../../src/engine/featureEffects/index.ts';
import type { Character, ContentEntity } from '../../src/schema/index.ts';
import { nodeFileSource } from './nodeFileSource.ts';

const root = process.env.FIVETOOLS_DATA;

describe.skipIf(!root)('creation wizard (local data)', () => {
  let index: ContentIndex;
  let catalog: Catalog;

  beforeAll(async () => {
    const result = await importFivetools(nodeFileSource(root!), { now: 1 });
    const all = Object.values(result.entities).flat() as ContentEntity[];
    index = createContentIndex(all);
    catalog = createCatalog(all, new Set(['XPHB', 'XDMG']));
  });

  /** "Any …" entries get the first item they can be. */
  function pickAnyItems(c: Character): Character {
    let n = c;
    for (const owner of startingEquipmentOwners(c, index)) {
      const option = pickedEquipment(c, owner.ref, owner.options);
      option?.items.forEach((g, i) => {
        const code = anyEquipmentType(g);
        const item = code ? equipmentTypeItems(catalog, code)[0] : undefined;
        if (item)
          n = {
            ...n,
            draft: {
              step: 'equipment',
              ...n.draft,
              anyItems: { ...n.draft?.anyItems, [anyItemKey(owner.ref, option.key, i)]: item.id },
            },
          };
      });
    }
    return syncStartingEquipment(n, index);
  }

  it(
    'every XPHB class, species and background makes a level 1 character with nothing left',
    () => {
      const xphb = <T extends { source: string }>(list: readonly T[]) =>
        list.filter((e) => e.source === 'XPHB');
      const classes = xphb(catalog.of('class'));
      const species = xphb(catalog.of('species'));
      const backgrounds = xphb(catalog.of('background'));
      expect(classes).toHaveLength(12);
      expect(backgrounds).toHaveLength(16);
      expect(species.length).toBeGreaterThanOrEqual(30);

      const registry = featureEffects();
      const deps = { index, catalog, registry, now: 0 };
      const problems: string[] = [];
      let built = 0;
      for (const cls of classes) {
        for (const sp of species) {
          for (const bg of backgrounds) {
            const label = `${cls.name} / ${sp.name} / ${bg.name}`;
            let c = newDraft(0);
            c = chooseClass(c, { kind: 'class', id: cls.id }, index);
            c = chooseBackground(c, { kind: 'background', id: bg.id });
            c = chooseSpecies(c, { kind: 'species', id: sp.id });
            c = syncStartingEquipment(fillPending(c, deps).character, index);
            c = pickAnyItems(c);
            c = prepareSpells(c, derive(c, index, { registry }), catalog);
            for (const item of unpickedAnyItems(c, index)) problems.push(`${label}: ${item}`);
            c = finishDraft(c, index, registry, 0);
            const sheet = derive(c, index, { registry });
            built++;
            if (sheet.charLevel !== 1) problems.push(`${label}: level ${sheet.charLevel}`);
            for (const p of sheet.choices.pending)
              problems.push(`${label}: pending ${p.offer.source.name} ${p.offer.key.slot}`);
            for (const r of sheet.choices.attention)
              problems.push(`${label}: attention ${r.status} ${r.key}`);
            for (const i of sheet.issues.filter((x) => x.severity === 'warn'))
              problems.push(`${label}: ${i.code} ${i.message}`);
            if (c.inventory.some((r) => r.name.startsWith('Any ')))
              problems.push(`${label}: an "any" item without an item`);
            if (!sheet.proficiencies.languages.some((l) => l.value === 'common'))
              problems.push(`${label}: no Common`);
          }
        }
      }
      expect(built).toBe(classes.length * species.length * backgrounds.length);
      expect(problems.slice(0, 40)).toEqual([]);
    },
    30 * 60_000,
  );
});
