// The free rules the app ships (plan 9.2–9.4), checked as a player gets them: the pack as
// committed, on its own. Each SRD subclass builds at levels 1, 3, 5, 11 and 20 with no pick
// left and no rules issue, and with the numbers its 2024 Player's Handbook twin gives (the
// golden fingerprints), since the SRD entries carry their twins' ids and so their mappings.

import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { GOLDENS } from '../../tests/smoke/goldens.ts';
import { fingerprint } from '../../tests/smoke/fingerprint.ts';
import { readPack } from '../adapters/pack/packFile.ts';
import { ADAPTER_VERSION } from '../adapters/version.ts';
import { createCatalog, type Catalog } from '../engine/build/catalog.ts';
import { quickBuild } from '../engine/build/quickBuild.ts';
import { createContentIndex, type ContentIndex } from '../engine/content/contentIndex.ts';
import { derive } from '../engine/derive/derive.ts';
import { featureEffects } from '../engine/featureEffects/index.ts';
import type { ContentEntity, Pack, Subclass } from '../schema/index.ts';
import { SRD_BUNDLED, SRD_SOURCE } from './srd.ts';

const LEVELS = [1, 3, 5, 11, 20];

/**
 * Where the SRD build differs from its twin's, and why: the SRD has fewer Fighting Style feats,
 * so the quick-builder's second pick for a Champion (level 7) is Defense.
 */
const DIFFERENT: Record<string, Record<number, [string, string]>> = {
  'champion|fighter|xphb|xphb': { 11: ['AC 16', 'AC 17'], 20: ['AC 16', 'AC 17'] },
};

describe.skipIf(!SRD_BUNDLED)('the free rules pack', () => {
  let pack: Pack;
  let all: ContentEntity[];
  let index: ContentIndex;
  let catalog: Catalog;

  beforeAll(async () => {
    ({ pack } = await readPack(new Uint8Array(readFileSync('public/srd/srd52.pack.json.gz'))));
    all = Object.values(pack.entities).flat() as ContentEntity[];
    index = createContentIndex(all);
    catalog = createCatalog(all, new Set([SRD_SOURCE]));
  }, 30_000);

  it('is one source, made by this version of the converter', () => {
    expect(pack.sources.map((s) => s.code)).toEqual([SRD_SOURCE]);
    // Regenerate it (`node tools/srd/build.ts`) when ADAPTER_VERSION goes up.
    expect(pack.sources[0]!.adapterVersion).toBe(ADAPTER_VERSION);
    expect(new Set(all.map((e) => e.source))).toEqual(new Set([SRD_SOURCE]));
  });

  it('has the twelve classes, each with its SRD subclass', () => {
    const subclasses = all.filter((e): e is Subclass => e.kind === 'subclass');
    expect(subclasses).toHaveLength(12);
    expect(new Set(subclasses.map((s) => s.classId)).size).toBe(12);
  });

  it.each(Object.keys(GOLDENS).filter((id) => !id.endsWith('|au') && id.endsWith('|xphb|xphb')))(
    '%s builds as its twin does',
    (id) => {
      const sub = index.get({ kind: 'subclass', id }) as Subclass | undefined;
      if (!sub) return; // Not in the SRD.
      const registry = featureEffects();
      for (const levels of LEVELS) {
        const c = quickBuild(
          {
            name: 'Golden',
            speciesId: 'human|xphb',
            backgroundId: 'soldier|xphb',
            classes: [{ classId: sub.classId, levels, subclassId: id }],
          },
          { index, catalog, registry, now: 1 },
        );
        const s = derive(c, index, { registry });
        expect(s.choices.pending, `level ${levels}`).toEqual([]);
        expect(s.issues, `level ${levels}`).toEqual([]);
        const [from, to] = DIFFERENT[id]?.[levels] ?? ['', ''];
        expect(fingerprint(s), `level ${levels}`).toBe(GOLDENS[id]![levels]!.replace(from, to));
      }
    },
  );
});
