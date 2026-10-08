// Opt-in checks of the featureEffects registry against a real local 5etools checkout (plan
// §9.2, step 3.11):
//   FIVETOOLS_DATA=./5etools-src-2.36.1 npm run test:smoke
// Checks counts and invariants only; it never prints or stores content.

import { beforeAll, describe, expect, it } from 'vitest';
import { importFivetools } from '../../src/adapters/fivetools/index.ts';
import { createContentIndex, type ContentIndex } from '../../src/engine/content/contentIndex.ts';
import { coverageGate, coverageReport } from '../../src/engine/featureEffects/coverage.ts';
import { DONE_CLASSES } from '../../src/engine/featureEffects/done.ts';
import { featureEffects } from '../../src/engine/featureEffects/index.ts';
import { validateFeatureEffects } from '../../src/engine/featureEffects/validate.ts';
import type { ContentEntity } from '../../src/schema/index.ts';
import { nodeFileSource } from './nodeFileSource.ts';

const root = process.env.FIVETOOLS_DATA;

describe.skipIf(!root)('featureEffects (local data)', () => {
  let index: ContentIndex;

  beforeAll(async () => {
    const result = await importFivetools(nodeFileSource(root!), { now: 1 });
    index = createContentIndex(Object.values(result.entities).flat() as ContentEntity[]);
  });

  it('the app mappings are valid against the real data', () => {
    expect(validateFeatureEffects(featureEffects(), index)).toEqual([]);
  });

  it('the coverage report covers every XPHB class and subclass feature', () => {
    const report = coverageReport(index, featureEffects(), new Set(['XPHB']));
    const kinds = report.rows.map((r) => r.feature.kind);
    // The engine survey's counts (plan §8): nested and option features included.
    expect(kinds.filter((k) => k === 'classFeature')).toHaveLength(283);
    expect(kinds.filter((k) => k === 'subclassFeature')).toHaveLength(309);
    expect(report.counts.mapped + report.counts.data + report.counts.none).toBe(592);
    expect(report.unofferedChoices.every((r) => r.choiceInText && !r.offered)).toBe(true);
    // Shrinks as phases 4–6 add mappings; a jump means the offer detection broke.
    expect(report.unofferedChoices.length).toBeLessThanOrEqual(80);
  });

  it('every class marked done passes the coverage gate (plan §10.2)', () => {
    const report = coverageReport(index, featureEffects(), new Set(['XPHB']));
    const problems = Object.fromEntries(
      DONE_CLASSES.map((id) => [id, coverageGate(report, id)] as const),
    );
    expect(problems).toEqual(Object.fromEntries(DONE_CLASSES.map((id) => [id, []])));
  });
});
