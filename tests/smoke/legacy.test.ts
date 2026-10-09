// 2014 options on 2024 characters (plan step 8.2), on real data: every 2014 subclass, species,
// background and feat that the 2024 rules let a 2024 character take, with "Show 2014 content"
// on and every book switched on. Opt-in:
//   FIVETOOLS_DATA=./5etools-src-2.36.1 npm run test:smoke
// Checks names and keys only; it never prints or stores content.

import { beforeAll, describe, expect, it } from 'vitest';
import { importFivetools } from '../../src/adapters/fivetools/index.ts';
import { createCatalog, type Catalog } from '../../src/engine/build/catalog.ts';
import { readLevelUp, takeLevel } from '../../src/engine/build/levelUp.ts';
import { quickBuild } from '../../src/engine/build/quickBuild.ts';
import { offerOptions } from '../../src/engine/choices/options.ts';
import { createContentIndex, type ContentIndex } from '../../src/engine/content/contentIndex.ts';
import { derive } from '../../src/engine/derive/derive.ts';
import type { DerivedSheet } from '../../src/engine/derive/types.ts';
import { featureEffects } from '../../src/engine/featureEffects/index.ts';
import { LEGACY_ORIGIN_FEAT_SLOT } from '../../src/engine/rules/legacy.ts';
import { hiddenLevelPicks } from '../../src/features/levelup/bindings.ts';
import { hiddenWizardPicks } from '../../src/features/wizard/reach.ts';
import { ABILITIES, type Character, type ContentEntity } from '../../src/schema/index.ts';
import { SHOW_2014 } from '../../src/sources/sourceFilter.ts';
import { nodeFileSource } from './nodeFileSource.ts';

const root = process.env.FIVETOOLS_DATA;

describe.skipIf(!root)('2014 options on 2024 characters (local data)', () => {
  let index: ContentIndex;
  let catalog: Catalog;
  const registry = featureEffects();

  beforeAll(async () => {
    const result = await importFivetools(nodeFileSource(root!), { now: 1 });
    const all = Object.values(result.entities).flat() as ContentEntity[];
    index = createContentIndex(all);
    const books = result.sources.filter((s) => s.origin !== 'homebrew').map((s) => s.code);
    catalog = createCatalog(all, new Set([...books, SHOW_2014]));
  });

  const sheetOf = (c: Character) => derive(c, index, { registry });
  const build = (
    classId: string,
    levels: number,
    extra: Partial<{ subclassId: string; backgroundId: string; speciesId: string }> = {},
  ) =>
    quickBuild(
      {
        name: 'P',
        classes: [
          { classId, levels, ...(extra.subclassId ? { subclassId: extra.subclassId } : {}) },
        ],
        backgroundId: extra.backgroundId ?? 'soldier|xphb',
        speciesId: extra.speciesId ?? 'human|xphb',
      },
      { index, catalog, registry, now: 1 },
    );
  /** Warnings a correct build shouldn't have, and picks no screen shows. */
  const problems = (sheet: DerivedSheet) => [
    ...sheet.issues.filter((i) => i.severity !== 'info').map((i) => `issue ${i.code}`),
    ...hiddenWizardPicks(sheet).map((c) => `hidden ${c.offer.source.name}: ${c.key}`),
  ];
  const old = <T extends ContentEntity>(list: readonly T[]) =>
    list.filter((e) => e.edition === '2014');
  const classes = () => catalog.of('class').filter((c) => c.edition === '2024');

  it('every 2014 subclass on its 2024 class, built 1 → 20, reaching level 3 by level-up', () => {
    const ids = new Set(classes().map((c) => c.id));
    const subclasses = old(catalog.of('subclass')).filter((s) => ids.has(s.classId));
    expect(subclasses.length).toBeGreaterThan(50);
    const out: string[] = [];
    for (const sub of subclasses) {
      const c = build(sub.classId, 20, { subclassId: sub.id });
      for (const p of problems(sheetOf(c))) out.push(`${sub.id}: ${p}`);
      const base: Character = { ...structuredClone(c), log: c.log.slice(0, 2) };
      const plan = readLevelUp(takeLevel(base, { kind: 'class', id: sub.classId }), sheetOf(base), {
        index,
        catalog,
        registry,
      });
      for (const k of hiddenLevelPicks(plan)) out.push(`${sub.id} → 3: hidden ${k}`);
    }
    expect(out).toEqual([]);
  });

  it('every 2014 species: no ability increases of its own, the background gives them', () => {
    const species = old(catalog.of('species'));
    expect(species.length).toBeGreaterThan(50);
    const out: string[] = [];
    for (const sp of species) {
      const c = build('fighter|xphb', 1, { speciesId: sp.id });
      const sheet = sheetOf(c);
      for (const a of ABILITIES)
        for (const part of sheet.abilities[a].score.parts)
          if (part.source?.kind === 'species') out.push(`${sp.id}: ${a} from the species`);
      if (
        !sheet.features.flatMap((f) => f.choices).some((x) => x.offer.kind === 'backgroundAbility')
      )
        out.push(`${sp.id}: no background increases`);
      for (const p of problems(sheet)) out.push(`${sp.id}: ${p}`);
    }
    expect(out).toEqual([]);
  });

  it('every 2014 background: free ability increases and an Origin feat, all picked', () => {
    const backgrounds = old(catalog.of('background'));
    expect(backgrounds.length).toBeGreaterThan(50);
    const out: string[] = [];
    for (const bg of backgrounds) {
      const sheet = sheetOf(build('fighter|xphb', 1, { backgroundId: bg.id }));
      const all = sheet.features.flatMap((f) => f.choices);
      const ability = all.find((x) => x.offer.kind === 'backgroundAbility');
      if (ability?.values.length !== 3) out.push(`${bg.id}: ability increases not picked`);
      if (!bg.featId) {
        const feat = all.find((x) => x.offer.key.slot === LEGACY_ORIGIN_FEAT_SLOT);
        if (feat?.values.length !== 1) out.push(`${bg.id}: no Origin feat`);
      }
      for (const p of problems(sheet)) out.push(`${bg.id}: ${p}`);
    }
    expect(out).toEqual([]);
  });

  it('every 2014 feat is offered as a General feat at level 4', () => {
    const c = build('fighter|xphb', 4);
    const sheet = sheetOf(c);
    const choice = sheet.features
      .flatMap((f) => f.choices)
      .find(
        (x) =>
          x.offer.effect?.type === 'featChoice' && x.offer.effect.categories.includes('general'),
      );
    expect(choice).toBeDefined();
    const offered = new Set(
      offerOptions(choice!.offer, { character: c, sheet, catalog, index }, [], {
        ignoreRules: true,
      }).options.map((o) => o.value),
    );
    const feats = old(catalog.of('feat')).filter((f) => !f.category);
    expect(feats.length).toBeGreaterThan(50);
    expect(feats.filter((f) => !offered.has(f.id)).map((f) => f.id)).toEqual([]);
  });
});
