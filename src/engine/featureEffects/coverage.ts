// The mapping coverage report (plan §9.2, step 3.11): for the class and subclass features of
// some sources, which ones have a hand-written mapping, which have effects from data only, and
// which have neither; and prose features that ask for a choice the character is never offered.

import {
  refKey,
  type ClassDef,
  type ClassFeature,
  type Effect,
  type Entry,
  type SourceCode,
  type Subclass,
  type SubclassFeature,
} from '../../schema/index.ts';
import { stripTags } from '../../richtext/tagRegistry.ts';
import { effectSlots } from '../collect/collect.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import { nestedFeatureRefs } from '../content/refs.ts';
import { walkEffects } from '../effects/walk.ts';
import { spellChoiceEffects } from '../spells/casters.ts';
import type { AutomationLevel, FeatureEffectsMap } from './types.ts';

export type CoverageStatus = 'mapped' | 'data' | 'none';

export interface CoverageRow {
  feature: ClassFeature | SubclassFeature;
  /** `Fighter` or `Fighter: Battle Master`. */
  owner: string;
  /** The class the feature belongs to (a subclass feature's class too). */
  classId: string;
  level: number;
  status: CoverageStatus;
  automation?: AutomationLevel;
  /** The text asks the player to choose something. */
  choiceInText: boolean;
  /**
   * A choice is offered: by the feature (data or mapping), by its class or subclass at that
   * level, or it is the subclass pick.
   */
  offered: boolean;
  /** The mapping's reason for not offering the choice its text asks for. */
  unofferedReason?: string;
  /** A primitive full automation would need. */
  needs?: string;
}

/** One class and its subclasses' features, for per-class progress. */
export interface ClassCoverage {
  classId: string;
  name: string;
  total: number;
  counts: Record<CoverageStatus, number>;
  byAutomation: Record<AutomationLevel, number>;
  unoffered: number;
}

export interface CoverageReport {
  rows: CoverageRow[];
  counts: Record<CoverageStatus, number>;
  byAutomation: Record<AutomationLevel, number>;
  /** Features whose text says to choose, with nothing offered for it and no reason given. */
  unofferedChoices: CoverageRow[];
  byClass: ClassCoverage[];
  /** Mapped features whose full automation needs a primitive the engine lacks. */
  needsPrimitive: CoverageRow[];
}

const CHOICE_TEXT = /\bchoose\b|\bof your choice\b/i;

function entryText(entries: readonly Entry[]): string {
  const out: string[] = [];
  const visit = (value: unknown): void => {
    if (typeof value === 'string') out.push(stripTags(value));
    // A nested feature's text is its own row's.
    else if (value && typeof value === 'object' && 'type' in value && value.type === 'ref') return;
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  visit(entries);
  return out.join(' ');
}

/** Levels at which an owner's own effects offer a choice (`atLevel` wrappers give the level). */
function offerLevels(effects: readonly Effect[]): Set<number> {
  const levels = new Set<number>();
  const visit = (list: readonly Effect[], level: number) => {
    for (const e of list) {
      if (e.type === 'atLevel') visit(e.effects, e.level);
      else if (effectSlots([e]).length) levels.add(level);
    }
  };
  visit(effects, 1);
  return levels;
}

export function coverageReport(
  index: ContentIndex,
  registry: FeatureEffectsMap,
  sources: ReadonlySet<SourceCode>,
): CoverageReport {
  const rows: CoverageRow[] = [];
  const seen = new Set<string>();
  const all = index.all();
  const classes = all.filter((e): e is ClassDef => e.kind === 'class' && sources.has(e.source));
  const subclasses = all.filter(
    (e): e is Subclass => e.kind === 'subclass' && sources.has(e.source),
  );

  const add = (
    feature: ClassFeature | SubclassFeature | undefined,
    classId: string,
    owner: string,
    ownerLevels: Set<number>,
    /** The class feature where a subclass is picked: that pick is the log's, not a slot's. */
    picksSubclass = false,
  ) => {
    if (!feature || seen.has(feature.id)) return;
    seen.add(feature.id);
    const mapping = registry[refKey({ kind: feature.kind, id: feature.id })];
    const dataEffects = feature.effects.filter((e) => e.type !== 'note');
    const offered =
      effectSlots([...feature.effects, ...(mapping?.effects ?? [])]).length > 0 ||
      ownerLevels.has(feature.level) ||
      picksSubclass;
    const row: CoverageRow = {
      feature,
      owner,
      classId,
      level: feature.level,
      status: mapping ? 'mapped' : dataEffects.length ? 'data' : 'none',
      choiceInText: CHOICE_TEXT.test(entryText(feature.entries)),
      offered,
    };
    if (mapping) row.automation = mapping.level;
    if (mapping?.unoffered) row.unofferedReason = mapping.unoffered;
    if (mapping?.needs) row.needs = mapping.needs;
    rows.push(row);
    // Features written inside this one belong to the same owner (Frenzy in Berserker), and
    // so do the ones it offers as options (Divine Order: Protector, Thaumaturge). An option is
    // the pick itself, so its own text saying "choose" is not a missing offer.
    for (const ref of nestedFeatureRefs(feature)) {
      const nested = index.get(ref);
      if (nested?.kind === 'classFeature' || nested?.kind === 'subclassFeature')
        add(nested, classId, owner, ownerLevels);
    }
    for (const effect of walkEffects(feature.effects)) {
      if (effect.type !== 'featureOptions' || !Array.isArray(effect.choice.from)) continue;
      for (const id of effect.choice.from) {
        const option = index.get({ kind: effect.optionKind, id });
        if (option?.kind === 'classFeature' || option?.kind === 'subclassFeature')
          add(option, classId, owner, ownerLevels);
      }
    }
  };

  for (const cls of classes) {
    const levels = offerLevels([
      ...cls.effects,
      ...(cls.spellcasting ? spellChoiceEffects(cls.spellcasting, cls) : []),
    ]);
    if (cls.startingProficiencies.skills) levels.add(1);
    for (const f of cls.features) {
      add(
        index.get({ kind: 'classFeature', id: f.featureId }),
        cls.id,
        cls.name,
        levels,
        f.gainSubclassFeature && f.level === cls.subclassLevel,
      );
    }
    for (const sub of subclasses.filter((s) => s.classId === cls.id)) {
      const subLevels = offerLevels([
        ...sub.effects,
        ...(sub.spellcasting ? spellChoiceEffects(sub.spellcasting, sub) : []),
      ]);
      for (const f of sub.features) {
        add(
          index.get({ kind: 'subclassFeature', id: f.featureId }),
          cls.id,
          `${cls.name}: ${sub.shortName}`,
          subLevels,
        );
      }
    }
  }

  const tally = (list: readonly CoverageRow[]) => {
    const counts: Record<CoverageStatus, number> = { mapped: 0, data: 0, none: 0 };
    const byAutomation: Record<AutomationLevel, number> = { A: 0, B: 0, C: 0 };
    for (const r of list) {
      counts[r.status]++;
      if (r.automation) byAutomation[r.automation]++;
    }
    return { counts, byAutomation };
  };
  const unexplained = unexplainedChoice;
  return {
    rows,
    ...tally(rows),
    unofferedChoices: rows.filter(unexplained),
    byClass: classes.map((cls) => {
      const own = rows.filter((r) => r.classId === cls.id);
      return {
        classId: cls.id,
        name: cls.name,
        total: own.length,
        ...tally(own),
        unoffered: own.filter(unexplained).length,
      };
    }),
    needsPrimitive: rows.filter((r) => r.needs),
  };
}

/**
 * The coverage gate (plan §10.2, step 6.1): what keeps a class from being done. Every feature
 * of the class and its subclasses has a mapping (an automation level, even C for text), and
 * every choice its text asks for is offered or has a reason it isn't.
 */
export function coverageGate(report: CoverageReport, classId: string): string[] {
  return report.rows
    .filter((r) => r.classId === classId)
    .flatMap((r) => {
      const where = `${r.owner} ${r.level}: ${r.feature.name}`;
      return [
        ...(r.status !== 'mapped' ? [`${where} has no mapping`] : []),
        ...(unexplainedChoice(r) ? [`${where} asks for a choice nothing offers`] : []),
      ];
    });
}

function unexplainedChoice(r: CoverageRow): boolean {
  return r.choiceInText && !r.offered && !r.unofferedReason;
}
