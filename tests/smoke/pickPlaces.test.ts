// Every pick has a place on screen (plan step 7.10), on real data: in the creation wizard and in
// a level-up, for every 2024 class, subclass, background and species, with every option, feat
// and optional feature swapped in where a pick offers them. A pick no screen shows can't be
// made (Magician's cantrip once wasn't). Opt-in:
//   FIVETOOLS_DATA=./5etools-src-2.36.1 npm run test:smoke
// Checks names and keys only; it never prints or stores content.

import { beforeAll, describe, expect, it } from 'vitest';
import { importFivetools } from '../../src/adapters/fivetools/index.ts';
import type { AutoContext } from '../../src/engine/build/autoChoose.ts';
import { createCatalog, type Catalog } from '../../src/engine/build/catalog.ts';
import { readLevelUp, takeLevel } from '../../src/engine/build/levelUp.ts';
import { quickBuild } from '../../src/engine/build/quickBuild.ts';
import { offerOptions } from '../../src/engine/choices/options.ts';
import { createContentIndex, type ContentIndex } from '../../src/engine/content/contentIndex.ts';
import { derive } from '../../src/engine/derive/derive.ts';
import type { DerivedFeatureChoice, DerivedSheet } from '../../src/engine/derive/types.ts';
import { SUPPLEMENT_SOURCES } from '../../src/engine/featureEffects/done.ts';
import { featureEffects } from '../../src/engine/featureEffects/index.ts';
import { setPick } from '../../src/engine/play/features.ts';
import { hiddenLevelPicks } from '../../src/features/levelup/bindings.ts';
import { hiddenWizardPicks } from '../../src/features/wizard/reach.ts';
import {
  decodeChoiceKey,
  type Character,
  type ContentEntity,
  type Subclass,
} from '../../src/schema/index.ts';
import { nodeFileSource } from './nodeFileSource.ts';

const root = process.env.FIVETOOLS_DATA;
const SOURCES = ['XPHB', 'XDMG', ...SUPPLEMENT_SOURCES];
/** Picks that bring in something with picks of its own. */
const BRINGS = new Set(['featureOptions', 'optionalFeature', 'feat', 'option']);

describe.skipIf(!root)('every pick has a place on screen (local data)', () => {
  let index: ContentIndex;
  let catalog: Catalog;
  const registry = featureEffects();

  beforeAll(async () => {
    const result = await importFivetools(nodeFileSource(root!), { now: 1 });
    const all = Object.values(result.entities).flat() as ContentEntity[];
    index = createContentIndex(all);
    catalog = createCatalog(all, new Set(SOURCES));
  });

  const sheetOf = (c: Character) => derive(c, index, { registry });
  const name = (c: DerivedFeatureChoice) => `${c.offer.source.name}: ${c.key}`;

  /** The same character with one value picked in a choice, for each value it offers. */
  function* swaps(c: Character, sheet: DerivedSheet, choice: DerivedFeatureChoice) {
    const ctx: AutoContext = { character: c, sheet, catalog, index };
    const { options } = offerOptions(choice.offer, ctx, [], { ignoreRules: true });
    for (const o of options) {
      yield {
        value: o.value,
        character: setPick(c, decodeChoiceKey(choice.key), {
          values: [o.value],
          labels: [o.label],
          entryIndex: choice.entryIndex,
          via: 'creation',
        }),
      };
    }
  }

  /**
   * Swaps already checked, by class: a class's own picks (its feats, invocations) are the same
   * for each of its subclasses, so they are swapped once per class.
   */
  const done = new Set<string>();
  const once = (scope: string, choice: DerivedFeatureChoice, value: string) => {
    const owner = choice.offer.source.ref.kind;
    const key = `${owner === 'subclass' || owner === 'subclassFeature' ? scope : scope.split('/')[0]}|${choice.key}|${value}`;
    if (done.has(key)) return false;
    done.add(key);
    return true;
  };

  /** Hidden picks of a character, and of every swap of its picks that bring things in. */
  function sweep(scope: string, c: Character, hidden: (s: DerivedSheet) => string[]): string[] {
    const sheet = sheetOf(c);
    const out = hidden(sheet).map((k) => `as built: ${k}`);
    for (const choice of sheet.features.flatMap((f) => f.choices)) {
      if (!BRINGS.has(choice.offer.kind)) continue;
      for (const swap of swaps(c, sheet, choice)) {
        if (!once(scope, choice, swap.value)) continue;
        for (const k of hidden(sheetOf(swap.character)))
          out.push(`${choice.key} = ${swap.value}: ${k}`);
      }
    }
    return [...new Set(out)];
  }
  const wizardHidden = (s: DerivedSheet) => hiddenWizardPicks(s).map(name);

  // Lists made from the data once it is imported (it.each needs them up front: by name).
  const CLASSES = [
    'barbarian',
    'bard',
    'cleric',
    'druid',
    'fighter',
    'monk',
    'paladin',
    'ranger',
    'rogue',
    'sorcerer',
    'warlock',
    'wizard',
  ]
    .map((n) => `${n}|xphb`)
    .concat(['artificer|efa']);
  const subclassesOf = (classId: string) =>
    catalog
      .of('subclass')
      .filter((s) => s.classId === classId && s.edition === '2024' && SOURCES.includes(s.source));
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

  it.each(CLASSES)('creation at level 1: %s, every option swapped in', (classId) => {
    expect(sweep(classId, build(classId, 1), wizardHidden)).toEqual([]);
  });

  it('creation at level 1: every 2024 background and species, their picks swapped in', () => {
    const problems: string[] = [];
    for (const bg of catalog.of('background').filter((b) => b.edition === '2024'))
      for (const k of sweep('bg', build('fighter|xphb', 1, { backgroundId: bg.id }), wizardHidden))
        problems.push(`${bg.id}: ${k}`);
    for (const sp of catalog.of('species').filter((s) => s.edition === '2024'))
      for (const k of sweep('sp', build('fighter|xphb', 1, { speciesId: sp.id }), wizardHidden))
        problems.push(`${sp.id}: ${k}`);
    expect(problems).toEqual([]);
  });

  it.each(CLASSES)('creation at level 20: every %s subclass, options swapped in', (classId) => {
    const problems: string[] = [];
    for (const sub of subclassesOf(classId))
      for (const k of sweep(
        `${classId}/${sub.id}`,
        build(classId, 20, { subclassId: sub.id }),
        wizardHidden,
      ))
        problems.push(`${sub.id}: ${k}`);
    expect(problems).toEqual([]);
  });

  it.each(CLASSES)(
    'level-up to levels 2–20: every %s subclass, new options swapped in',
    (classId) => {
      const problems: string[] = [];
      const deps = { index, catalog, registry };
      for (const sub of subclassesOf(classId) as Subclass[]) {
        const full = build(classId, 20, { subclassId: sub.id });
        for (let level = 2; level <= 20; level++) {
          const base: Character = { ...structuredClone(full), log: full.log.slice(0, level - 1) };
          const before = sheetOf(base);
          const plan = readLevelUp(takeLevel(base, { kind: 'class', id: classId }), before, deps);
          for (const k of hiddenLevelPicks(plan)) problems.push(`${sub.id} → ${level}: ${k}`);
          for (const choice of plan.sheet.features.flatMap((f) => f.choices)) {
            if (!plan.choiceKeys.has(choice.key) || !BRINGS.has(choice.offer.kind)) continue;
            for (const swap of swaps(plan.character, plan.sheet, choice)) {
              if (
                !once(
                  `${classId}/${sub.id}/up${level}`.replace(/\/up\d+$/, ''),
                  choice,
                  `up${level}:${swap.value}`,
                )
              )
                continue;
              const next = readLevelUp(swap.character, before, deps);
              for (const k of hiddenLevelPicks(next))
                problems.push(`${sub.id} → ${level}, ${choice.key} = ${swap.value}: ${k}`);
            }
          }
        }
      }
      expect(problems).toEqual([]);
    },
  );
});
