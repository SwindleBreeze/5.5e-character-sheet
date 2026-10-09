// Characters on 2014 rules (plan steps 8.5–8.7), on real data: every 2014 Player's Handbook class,
// with each of its subclasses, built 1 → 20 by the 2014 rules with every book switched on. Opt-in:
//   FIVETOOLS_DATA=./5etools-src-2.36.1 npm run test:smoke
// Checks names, keys and numbers only; it never prints or stores content. With RULES_2014_TODO=<a
// file outside the repo>, it also writes the 2014 class features left to map there (step 8.6),
// with their text, for whoever maps them. Nothing of that file is ever committed.

import { writeFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { importFivetools } from '../../src/adapters/fivetools/index.ts';
import { createCatalog, type Catalog } from '../../src/engine/build/catalog.ts';
import { quickBuild } from '../../src/engine/build/quickBuild.ts';
import { createContentIndex, type ContentIndex } from '../../src/engine/content/contentIndex.ts';
import { derive } from '../../src/engine/derive/derive.ts';
import type { DerivedSheet } from '../../src/engine/derive/types.ts';
import {
  coverageGate,
  coverageReport,
  type CoverageReport,
} from '../../src/engine/featureEffects/coverage.ts';
import { RULES_2014_DONE } from '../../src/engine/featureEffects/done.ts';
import { featureEffects } from '../../src/engine/featureEffects/index.ts';
import { LEGACY_ASI_SLOT } from '../../src/engine/rules/legacy.ts';
import { hiddenWizardPicks } from '../../src/features/wizard/reach.ts';
import { stripTags } from '../../src/richtext/tagRegistry.ts';
import { refKey, type Character, type ContentEntity, type Entry } from '../../src/schema/index.ts';
import { PREFER_2014, SHOW_2014 } from '../../src/sources/sourceFilter.ts';
import { nodeFileSource } from './nodeFileSource.ts';

const root = process.env.FIVETOOLS_DATA;
const todoPath = process.env.RULES_2014_TODO;

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

describe.skipIf(!root)('characters on 2014 rules (local data)', () => {
  let index: ContentIndex;
  let catalog: Catalog;
  let report: CoverageReport;
  const registry = featureEffects();

  beforeAll(async () => {
    const result = await importFivetools(nodeFileSource(root!), { now: 1 });
    const all = Object.values(result.entities).flat() as ContentEntity[];
    index = createContentIndex(all);
    const books = result.sources.filter((s) => s.origin !== 'homebrew').map((s) => s.code);
    catalog = createCatalog(all, new Set([...books, SHOW_2014, PREFER_2014]));
    // The 2014 classes with every subclass: a 2014-rules character can take them all.
    const classIds = catalog
      .of('class')
      .filter((c) => c.edition === '2014')
      .map((c) => c.id);
    report = coverageReport(index, registry, new Set(books), { classIds: new Set(classIds) });
    if (todoPath) {
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
              ` data: ${r.feature.effects.map((e) => e.type).join(',') || 'none'}\n  ${plain(r.feature.entries)}`,
          );
      }
      writeFileSync(todoPath, lines.join('\n'));
    }
  });

  const sheetOf = (c: Character) => derive(c, index, { registry });
  const build = (classId: string, levels: number, subclassId?: string) =>
    quickBuild(
      {
        name: 'P',
        classes: [{ classId, levels, ...(subclassId ? { subclassId } : {}) }],
        backgroundId: 'soldier|phb',
        speciesId: 'half-orc|phb',
        ruleset: '2014',
      },
      { index, catalog, registry, now: 1 },
    );
  const problems = (sheet: DerivedSheet) => [
    ...sheet.issues.filter((i) => i.severity !== 'info').map((i) => `issue ${i.code}`),
    ...hiddenWizardPicks(sheet).map((c) => `hidden ${c.offer.source.name}: ${c.key}`),
  ];
  const phbClasses = () => catalog.of('class').filter((c) => c.source === 'PHB');

  it('the catalog offers the 2014 originals over their reprints', () => {
    expect(phbClasses().map((c) => c.id)).toContain('wizard|phb');
    expect(catalog.of('class').map((c) => c.id)).not.toContain('wizard|xphb');
    expect(catalog.of('species').map((s) => s.id)).toContain('half-orc|phb');
  });

  it('every 2014 class, with each subclass, built 1 → 20 without warnings', () => {
    const out: string[] = [];
    const classes = phbClasses();
    expect(classes.length).toBe(12);
    for (const cls of classes) {
      const subs = catalog.of('subclass').filter((s) => s.classId === cls.id);
      expect(subs.length, cls.id).toBeGreaterThan(0);
      for (const sub of subs) {
        const sheet = sheetOf(build(cls.id, 20, sub.id));
        for (const p of problems(sheet)) out.push(`${sub.id}: ${p}`);
      }
    }
    expect(out).toEqual([]);
  });

  it('origins: the species gives the increases; the background none', () => {
    const c = build('fighter|phb', 1);
    const sheet = sheetOf(c);
    // Half-Orc: +2 STR, +1 CON.
    expect(sheet.abilities.str.score.value).toBe(c.baseScores.str + 2);
    expect(sheet.abilities.con.score.value).toBe(c.baseScores.con + 1);
    expect(sheet.features.flatMap((f) => f.choices).map((x) => x.offer.kind)).not.toContain(
      'backgroundAbility',
    );
  });

  it('every class has its Ability Score Improvements: +2, +1/+1 or a feat', () => {
    for (const cls of phbClasses()) {
      const sheet = sheetOf(build(cls.id, 20));
      const asi = sheet.features
        .flatMap((f) => f.choices)
        .filter((x) => x.offer.key.slot === LEGACY_ASI_SLOT);
      expect(asi.length, cls.id).toBeGreaterThanOrEqual(cls.id === 'fighter|phb' ? 7 : 5);
    }
  });

  it('casters: known casters learn on level-up, prepared casters prepare level + modifier', () => {
    const known = ['bard|phb', 'ranger|phb', 'sorcerer|phb', 'warlock|phb'];
    const prepared = ['cleric|phb', 'druid|phb', 'paladin|phb', 'wizard|phb'];
    for (const id of [...known, ...prepared]) {
      const c = build(id, 5);
      const sheet = sheetOf(c);
      const caster = sheet.spellcasting.casters.find((x) => x.key.startsWith(id.split('|')[0]!));
      expect(caster, id).toBeDefined();
      expect(caster!.preparedMax, id).toBeGreaterThan(0);
      expect(caster!.preparedChange, id).toBe(known.includes(id) ? 'level' : 'restLong');
      if (prepared.includes(id)) {
        const share = id === 'paladin|phb' ? 2 : 5;
        const mod = sheet.abilities[caster!.ability].mod;
        expect(caster!.preparedMax, id).toBe(Math.max(1, share + mod));
      }
    }
  });

  it('every 2014 class marked done passes the gate with all its subclasses (step 8.6)', () => {
    const problems = Object.fromEntries(
      RULES_2014_DONE.map((id) => [id, coverageGate(report, id)] as const),
    );
    expect(problems).toEqual(Object.fromEntries(RULES_2014_DONE.map((id) => [id, []])));
  });
});
