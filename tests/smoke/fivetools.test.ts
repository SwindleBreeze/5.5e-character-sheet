// Opt-in invariants against a real local 5etools checkout (never committed):
//   FIVETOOLS_DATA=./5etools-src-2.36.1/5etools-src-2.36.1 npm run test:smoke
// Checks shapes and counts only; it never prints or stores content.

import { beforeAll, describe, expect, it } from 'vitest';
import { importFivetools, type ImportResult } from '../../src/adapters/fivetools/index.ts';
import type { ClassDef, ContentEntity, Subclass } from '../../src/schema/index.ts';
import { nodeFileSource } from './nodeFileSource.ts';

const root = process.env.FIVETOOLS_DATA;

describe.skipIf(!root)('5etools import (local data)', () => {
  let result: ImportResult;

  beforeAll(async () => {
    result = await importFivetools(nodeFileSource(root!), { now: 1 });
  });

  it('imports every source with no unresolved copies, failed mods or duplicate ids', () => {
    const codes = new Set(result.report.warnings.map((w) => w.code));
    for (const code of [
      'copyMissing',
      'copyCycle',
      'modFailed',
      'modUnsupported',
      'versionFailed',
      'convertFailed',
      'duplicateId',
    ] as const) {
      expect(codes.has(code), code).toBe(false);
    }
    expect(result.sources.length).toBeGreaterThan(50);
    expect(result.sources.find((s) => s.code === 'XPHB')?.edition).toBe('2024');
    expect(result.sources.find((s) => s.code === 'PHB')?.edition).toBe('2014');
  });

  it('has no table-key collisions in XPHB classes', () => {
    const collisions = result.report.warnings.filter(
      (w) => w.code === 'tableKeyCollision' && w.entity?.endsWith('|XPHB'),
    );
    expect(collisions).toEqual([]);
  });

  it('every feature an XPHB class or subclass lists exists', () => {
    const ids = (kind: 'classFeature' | 'subclassFeature') =>
      new Set((result.entities[kind] as ContentEntity[]).map((e) => e.id));
    const classFeatures = ids('classFeature');
    const subclassFeatures = ids('subclassFeature');
    const missing: string[] = [];
    for (const cls of result.entities.class as ClassDef[]) {
      if (cls.source !== 'XPHB') continue;
      for (const f of cls.features) if (!classFeatures.has(f.featureId)) missing.push(f.featureId);
    }
    for (const sub of result.entities.subclass as Subclass[]) {
      if (sub.source !== 'XPHB') continue;
      for (const f of sub.features)
        if (!subclassFeatures.has(f.featureId)) missing.push(f.featureId);
    }
    expect(missing).toEqual([]);
  });

  it('the twelve XPHB classes have 2024 subclasses, tables and keyed progressions', () => {
    const classes = (result.entities.class as ClassDef[]).filter((c) => c.source === 'XPHB');
    expect(classes).toHaveLength(12);
    const subclasses = result.entities.subclass as Subclass[];
    for (const cls of classes) {
      expect(
        subclasses.filter((s) => s.classId === cls.id && s.edition === '2024').length,
        cls.name,
      ).toBeGreaterThanOrEqual(4);
      for (const col of cls.table) {
        expect(col.key, cls.name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
        expect(col.values, `${cls.name} ${col.key}`).toHaveLength(20);
      }
    }
  });

  it('most XPHB spells are on at least one class list', () => {
    const spells = (result.entities.spell ?? []).filter((s) => s.source === 'XPHB');
    const listed = spells.filter((s) => s.classIds.length > 0);
    expect(listed.length / spells.length).toBeGreaterThan(0.95);
  });

  it('is deterministic', async () => {
    const again = await importFivetools(nodeFileSource(root!), { now: 1 });
    expect(again.entities).toEqual(result.entities);
  });
});
