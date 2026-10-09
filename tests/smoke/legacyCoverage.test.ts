// The 2014 coverage gate (plan step 8.3), on real data: every 2014 subclass a 2024 character can
// take (one without a 2024 reprint, from every book) has its features mapped, class by class as
// `LEGACY_DONE` lists them; every 2014 species and feat too, once marked done. Opt-in:
//   FIVETOOLS_DATA=./5etools-src-2.36.1 npm run test:smoke
// With LEGACY_TODO=<a file outside the repo>, it also writes what is left to map there, with
// the features' text, for whoever maps them. Nothing of that file is ever committed.

import { writeFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { importFivetools } from '../../src/adapters/fivetools/index.ts';
import { createCatalog, type Catalog } from '../../src/engine/build/catalog.ts';
import { createContentIndex, type ContentIndex } from '../../src/engine/content/contentIndex.ts';
import {
  coverageGate,
  coverageReport,
  type CoverageReport,
} from '../../src/engine/featureEffects/coverage.ts';
import { LEGACY_DONE } from '../../src/engine/featureEffects/done.ts';
import { featureEffects } from '../../src/engine/featureEffects/index.ts';
import { validateFeatureEffects } from '../../src/engine/featureEffects/validate.ts';
import { stripTags } from '../../src/richtext/tagRegistry.ts';
import {
  refKey,
  type ContentEntity,
  type Entry,
  type Feat,
  type Species,
} from '../../src/schema/index.ts';
import { SHOW_2014 } from '../../src/sources/sourceFilter.ts';
import { nodeFileSource } from './nodeFileSource.ts';

const root = process.env.FIVETOOLS_DATA;
const todoPath = process.env.LEGACY_TODO;

function plain(entries: readonly Entry[] | undefined): string {
  const out: string[] = [];
  const visit = (v: unknown): void => {
    if (typeof v === 'string') out.push(stripTags(v));
    else if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === 'object') Object.values(v).forEach(visit);
  };
  visit(entries ?? []);
  return out.join(' ');
}

describe.skipIf(!root)('2014 options: mapping coverage (local data)', () => {
  let index: ContentIndex;
  let catalog: Catalog;
  let report: CoverageReport;
  let species: Species[];
  let feats: Feat[];
  let classIds: string[];

  beforeAll(async () => {
    const result = await importFivetools(nodeFileSource(root!), { now: 1 });
    const all = Object.values(result.entities).flat() as ContentEntity[];
    index = createContentIndex(all);
    const books = result.sources.filter((s) => s.origin !== 'homebrew').map((s) => s.code);
    catalog = createCatalog(all, new Set([...books, SHOW_2014]));
    classIds = catalog
      .of('class')
      .filter((c) => c.edition === '2024')
      .map((c) => c.id);
    // The 2024 classes, with their 2014 subclasses that no 2024 reprint hides.
    report = coverageReport(index, featureEffects(), new Set(books), {
      classIds: new Set(classIds),
      subclass: (s) => s.edition !== '2014' || !s.supersededBy?.length,
    });
    species = catalog.of('species').filter((s) => s.edition === '2014');
    feats = catalog.of('feat').filter((f) => f.edition === '2014');

    if (todoPath) {
      const registry = featureEffects();
      const lines: string[] = [];
      for (const id of classIds) {
        const rows = report.rows.filter(
          (r) =>
            r.classId === id &&
            (r.status !== 'mapped' || (r.choiceInText && !r.offered && !r.unofferedReason)),
        );
        if (!rows.length) continue;
        lines.push(`\n## ${id}: ${rows.length} left`);
        for (const r of rows)
          lines.push(
            `- ${refKey({ kind: r.feature.kind, id: r.feature.id })} [${r.owner} ${r.level}]` +
              ` data: ${r.feature.effects.map((e) => e.type).join(',') || 'none'}` +
              `${r.choiceInText && !r.offered && !r.unofferedReason ? ' CHOICE-NOT-OFFERED' : ''}\n  ${plain(r.feature.entries)}`,
          );
      }
      const left = <T extends ContentEntity>(list: T[]) =>
        list.filter((e) => !registry[refKey({ kind: e.kind, id: e.id })]);
      for (const [title, list] of [
        ['species', left(species)],
        ['feat', left(feats)],
      ] as const) {
        lines.push(`\n## ${title}: ${list.length} left`);
        for (const e of list)
          lines.push(
            `- ${refKey({ kind: e.kind, id: e.id })} data: ${e.effects.map((x) => x.type).join(',') || 'none'}\n  ${plain(e.entries)}`,
          );
      }
      writeFileSync(todoPath, lines.join('\n'));
    }
  });

  it('the mappings are valid against the real data', () => {
    expect(validateFeatureEffects(featureEffects(), index)).toEqual([]);
  });

  it('every class marked done passes the gate with its 2014 subclasses', () => {
    const problems = Object.fromEntries(
      LEGACY_DONE.classes.map((id) => [id, coverageGate(report, id)] as const),
    );
    expect(problems).toEqual(Object.fromEntries(LEGACY_DONE.classes.map((id) => [id, []])));
  });

  it('every 2014 species and feat has a mapping, once marked done', () => {
    const registry = featureEffects();
    const unmapped = (list: ContentEntity[]) =>
      list.filter((e) => !registry[refKey({ kind: e.kind, id: e.id })]).map((e) => e.id);
    if (LEGACY_DONE.species) expect(unmapped(species)).toEqual([]);
    if (LEGACY_DONE.feats) expect(unmapped(feats)).toEqual([]);
    expect(species.length).toBeGreaterThan(100);
    expect(feats.length).toBeGreaterThan(50);
  });
});
