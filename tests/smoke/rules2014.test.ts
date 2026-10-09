// Characters on 2014 rules (plan steps 8.5–8.7), on real data: every 2014 Player's Handbook class,
// with each of its subclasses, built 1 → 20 by the 2014 rules with every book switched on. Opt-in:
//   FIVETOOLS_DATA=./5etools-src-2.36.1 npm run test:smoke
// Checks names, keys and numbers only; it never prints or stores content.

import { beforeAll, describe, expect, it } from 'vitest';
import { importFivetools } from '../../src/adapters/fivetools/index.ts';
import { createCatalog, type Catalog } from '../../src/engine/build/catalog.ts';
import { quickBuild } from '../../src/engine/build/quickBuild.ts';
import { createContentIndex, type ContentIndex } from '../../src/engine/content/contentIndex.ts';
import { derive } from '../../src/engine/derive/derive.ts';
import type { DerivedSheet } from '../../src/engine/derive/types.ts';
import { featureEffects } from '../../src/engine/featureEffects/index.ts';
import { LEGACY_ASI_SLOT } from '../../src/engine/rules/legacy.ts';
import { hiddenWizardPicks } from '../../src/features/wizard/reach.ts';
import type { Character, ContentEntity } from '../../src/schema/index.ts';
import { PREFER_2014, SHOW_2014 } from '../../src/sources/sourceFilter.ts';
import { nodeFileSource } from './nodeFileSource.ts';

const root = process.env.FIVETOOLS_DATA;

describe.skipIf(!root)('characters on 2014 rules (local data)', () => {
  let index: ContentIndex;
  let catalog: Catalog;
  const registry = featureEffects();

  beforeAll(async () => {
    const result = await importFivetools(nodeFileSource(root!), { now: 1 });
    const all = Object.values(result.entities).flat() as ContentEntity[];
    index = createContentIndex(all);
    const books = result.sources.filter((s) => s.origin !== 'homebrew').map((s) => s.code);
    catalog = createCatalog(all, new Set([...books, SHOW_2014, PREFER_2014]));
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
});
