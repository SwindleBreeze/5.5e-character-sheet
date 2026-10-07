import { beforeAll, describe, expect, it } from 'vitest';
import type { ContentEntity } from '../../schema/index.ts';
import { fixtureContent } from '../../test/fixtureIndex.ts';
import { FIXTURE_FEATURE_EFFECTS } from '../../test/fixtureFeatureEffects.ts';
import { createCatalog, type Catalog } from '../build/catalog.ts';
import { quickBuild } from '../build/quickBuild.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import { derive } from '../derive/derive.ts';
import { copiedSpells, copyCost, copyToSpellbook, removeCopied } from './spellbook.ts';

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

const lorekeeper = { kind: 'class', id: 'lorekeeper|tst' } as const;

describe('spellbook additions (plan §9.4, step 5.6)', () => {
  it('a copied spell is in the spellbook, a manual record the sheet doesn’t flag', () => {
    const c = quickBuild(
      { name: 'L', classes: [{ classId: 'lorekeeper|tst', levels: 5 }] },
      { index, catalog, registry: FIXTURE_FEATURE_EFFECTS, now: 0 },
    );
    const before = derive(c, index, { registry: FIXTURE_FEATURE_EFFECTS });
    const book = before.spellcasting.casters[0]!.spellbook!;
    const extra = catalog
      .of('spell')
      .find((s) => s.level >= 1 && s.level <= 3 && !book.includes(s.id))!;
    const copied = copyToSpellbook(c, lorekeeper, extra.id, extra.name, 0);
    expect(copyToSpellbook(copied, lorekeeper, extra.id, extra.name, 0)).toBe(copied);
    expect(copiedSpells(copied, lorekeeper)).toEqual([extra.id]);
    const after = derive(copied, index, { registry: FIXTURE_FEATURE_EFFECTS });
    expect(after.spellcasting.casters[0]!.spellbook).toContain(extra.id);
    expect(after.choices.attention).toEqual(before.choices.attention);
    expect(copied.log.at(-1)!.choices.at(-1)).toMatchObject({ via: 'manual' });
    // Taken out again: the record goes.
    expect(removeCopied(copied, lorekeeper, extra.id).log).toEqual(c.log);
    expect(copyCost(3)).toEqual({ hours: 6, gp: 150 });
  });
});
