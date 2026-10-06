// Opt-in invariants against a real local 5etools checkout (never committed):
//   FIVETOOLS_DATA=./5etools-src-2.36.1 npm run test:smoke
// Checks shapes and counts only; it never prints or stores content.

import { beforeAll, describe, expect, it } from 'vitest';
import { importFivetools, type ImportResult } from '../../src/adapters/fivetools/index.ts';
import { tokenize } from '../../src/richtext/parseTags.ts';
import { refFromTag } from '../../src/richtext/tagRegistry.ts';
import type { ClassDef, ContentEntity, Effect, Subclass } from '../../src/schema/index.ts';
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

  it('fills in all shared item text', () => {
    const unresolved = (result.entities.item ?? []).filter((i) =>
      JSON.stringify(i).includes('{#itemEntry'),
    );
    expect(unresolved.map((i) => i.id)).toEqual([]);
  });

  it('imports the player extras (plan §6.12)', () => {
    const { counts } = result.report;
    expect(counts.deity).toBeGreaterThan(500);
    expect(counts.reward).toBeGreaterThan(250);
    expect(counts.facility).toBeGreaterThan(60);
    expect(counts.charOption).toBeGreaterThan(40);
    const facilities = (result.entities.facility ?? []).filter((f) => f.source === 'XDMG');
    expect(facilities.length).toBeGreaterThanOrEqual(30);
    for (const f of facilities) {
      expect(f.edition, f.name).toBe('2024');
      if (f.facilityType === 'special') expect(f.level, f.name).toBeGreaterThanOrEqual(5);
    }
    const rewards = (result.entities.reward ?? []).filter((r) => r.source === 'XDMG');
    expect(rewards.length).toBeGreaterThan(15);
    expect(rewards.some((r) => r.effects.some((e) => e.type === 'grantSpells'))).toBe(true);
    for (const r of rewards.filter(
      (x) =>
        x.rewardType === 'Charm' &&
        x.name !== 'Charm of Feather Falling' &&
        x.name !== 'Charm of the Slayer',
    )) {
      expect(
        r.effects.some((e) => e.type === 'resource' && e.resourceId === 'uses'),
        r.name,
      ).toBe(true);
    }
  });

  it('spell uses paid from a resource point at one the entity has', () => {
    const bad: string[] = [];
    for (const list of Object.values(result.entities)) {
      for (const e of list as ContentEntity[]) {
        const flat: Effect[] = [];
        const collect = (effects: Effect[]) => {
          for (const x of effects) {
            flat.push(x);
            if (x.type === 'ifChoice' || x.type === 'atLevel' || x.type === 'toggle')
              collect(x.effects);
          }
        };
        collect(e.effects);
        const resources = new Set(
          flat.flatMap((x) => (x.type === 'resource' ? [x.resourceId] : [])),
        );
        for (const x of flat) {
          if (x.type !== 'grantSpells') continue;
          for (const g of x.spells) {
            if (
              typeof g.uses === 'object' &&
              'resource' in g.uses &&
              !resources.has(g.uses.resource)
            )
              bad.push(`${e.kind}:${e.id}`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('imports item groups, so focus and tool links resolve', () => {
    const items = new Map((result.entities.item ?? []).map((i) => [i.id, i]));
    for (const id of [
      'arcane focus|xphb',
      'holy symbol|xphb',
      'druidic focus|xphb',
      "artisan's tools|xphb",
    ]) {
      expect(items.get(id)?.groupItemIds?.length, id).toBeGreaterThan(0);
    }
    expect(items.get('arcane focus|xphb')?.itemKind).toBe('focus');
  });

  it('links between deities, gifts and facilities resolve', () => {
    const ids = new Set<string>();
    for (const [kind, list] of Object.entries(result.entities)) {
      for (const e of list as ContentEntity[]) ids.add(`${kind}:${e.id}`);
    }
    const missing = new Set<string>();
    const check = (kind: string, id: string) => {
      if (!ids.has(`${kind}:${id}`)) missing.add(`${kind}:${id}`);
    };
    for (const d of result.entities.deity ?? [])
      for (const id of d.supersededBy ?? []) check('deity', id);
    for (const r of result.entities.reward ?? [])
      for (const id of r.facilityIds ?? []) check('facility', id);
    const EXTRA_TAGS = new Set(['deity', 'reward', 'facility', 'charoption']);
    const walk = (value: unknown): void => {
      if (typeof value === 'string') {
        if (!value.includes('{@')) return;
        for (const t of tokenize(value)) {
          if (t.type === 'text') continue;
          const ref = EXTRA_TAGS.has(t.tag) ? refFromTag(t) : null;
          if (ref) check(ref.kind, ref.id);
          walk(t.content);
        }
      } else if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') Object.values(value).forEach(walk);
    };
    walk(result.entities);
    expect([...missing]).toEqual([]);
  });

  it('is deterministic', async () => {
    const again = await importFivetools(nodeFileSource(root!), { now: 1 });
    expect(again.entities).toEqual(result.entities);
  });
});
