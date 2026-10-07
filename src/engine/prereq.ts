// The prerequisite evaluator (plan §8.1 P13, §9.3 step 4.1): whether a character meets a feat's,
// an optional feature's or (phase 5) a class's prerequisites. It reads static facts from the
// character's current sheet (levels, scores, proficiencies, spellcasting, what it has taken),
// never blocks, and leaves prerequisites it can't judge (`other`) as unknown: shown, not enforced.

import {
  ABILITIES,
  refKey,
  type Ability,
  type ClassDef,
  type Prereq,
  type Prereqs,
  type Ref,
  type RefKey,
} from '../schema/index.ts';
import { prereqText } from '../richtext/entityMeta.ts';
import type { ContentIndex } from './content/contentIndex.ts';
import type { DerivedSheet } from './derive/types.ts';
import { classKey } from './derive/scope.ts';

export interface PrereqContext {
  charLevel: number;
  /** Class levels by class key (`warlock`), so a prerequisite fits the class from any source. */
  classLevels: ReadonlyMap<string, number>;
  scores: Readonly<Record<Ability, number>>;
  /** Proficiencies by category (`armor`, `weapon`, `tool`, `skill`, `language`), lowercased. */
  proficiencies: Readonly<Record<string, ReadonlySet<string>>>;
  /** Has the Spellcasting or Pact Magic feature of a class or subclass. */
  spellcasting: boolean;
  /** Ref keys of the features, feats and optional features the character has. */
  has: ReadonlySet<RefKey>;
  /** Their names, lowercased, for prerequisites that name a feature (`Feature: Fighting Style`). */
  featureNames: ReadonlySet<string>;
  /** Display names of features and feats a prerequisite names, when the content has them. */
  nameOf?: (ref: Ref) => string | undefined;
}

export interface PrereqResult {
  /** Every requirement of at least one alternative holds (unknown ones are given the benefit). */
  met: boolean;
  /** What isn't met, as text; for several alternatives, the closest one's. */
  unmet: string[];
  /** Requirements the app can't check, shown to the player. */
  unknown: string[];
}

const lower = (values: readonly { value: string }[]) =>
  new Set(values.map((v) => v.value.toLowerCase()));

/**
 * The facts prerequisites read, from the character's current sheet. With the content index,
 * the names of its classes' feat and optional-feature progressions count as features too
 * (a Fighting Style feat names the progression that offers it).
 */
export function prereqContext(sheet: DerivedSheet, index?: ContentIndex): PrereqContext {
  const classLevels = new Map<string, number>();
  const has = new Set<RefKey>();
  const featureNames = new Set<string>();
  for (const c of sheet.classes) {
    classLevels.set(classKey(c.name), c.level);
    const owners = [
      index?.get({ kind: 'class', id: c.classId }),
      c.subclassId ? index?.get({ kind: 'subclass', id: c.subclassId }) : undefined,
    ];
    for (const owner of owners) {
      for (const p of [
        ...(owner?.featProgression ?? []),
        ...(owner?.optionalFeatureProgression ?? []),
      ]) {
        const levels = Object.keys(p.atLevels).map(Number);
        if (levels.some((l) => l <= c.level)) featureNames.add(p.name.toLowerCase());
      }
    }
  }
  for (const f of sheet.features) {
    has.add(refKey(f.ref));
    featureNames.add(f.name.toLowerCase());
  }
  const skills = new Set<string>();
  for (const [skill, roll] of Object.entries(sheet.skills)) {
    if (roll.proficiency === 'proficient' || roll.proficiency === 'expertise') skills.add(skill);
  }
  return {
    charLevel: sheet.charLevel,
    classLevels,
    scores: Object.fromEntries(ABILITIES.map((a) => [a, sheet.abilities[a].score.value])) as Record<
      Ability,
      number
    >,
    proficiencies: {
      armor: lower(sheet.proficiencies.armor),
      weapon: lower(sheet.proficiencies.weapons),
      tool: lower(sheet.proficiencies.tools),
      language: lower(sheet.proficiencies.languages),
      skill: skills,
    },
    spellcasting: sheet.spellcasting.casters.length > 0,
    has,
    featureNames,
    ...(index ? { nameOf: (ref: Ref) => index.get(ref)?.name } : {}),
  };
}

/** `classId` is `name|source`: the class key of its name. */
const classKeyOfId = (id: string) => classKey(id.split('|')[0] ?? id);

/** `Feature: Fighting Style` (the adapter's wording for a named class feature). */
const FEATURE_TEXT = /^Feature: (.+)$/;

/** true, false, or undefined when the app can't tell. */
function check(p: Prereq, ctx: PrereqContext): boolean | undefined {
  switch (p.type) {
    case 'level':
      return p.classId
        ? (ctx.classLevels.get(classKeyOfId(p.classId)) ?? 0) >= p.level
        : ctx.charLevel >= p.level;
    case 'ability':
      return (
        !p.anyOf.length ||
        p.anyOf.some((group) =>
          Object.entries(group).every(([a, min]) => (ctx.scores[a as Ability] ?? 0) >= (min ?? 0)),
        )
      );
    case 'proficiency': {
      const category = p.category === 'weapons' ? 'weapon' : p.category;
      const set = ctx.proficiencies[category];
      return set ? set.has(p.value.toLowerCase()) : undefined;
    }
    case 'spellcasting':
      return ctx.spellcasting;
    case 'feature':
    case 'feat':
      return ctx.has.has(refKey(p.ref));
    case 'other': {
      const named = FEATURE_TEXT.exec(p.text)?.[1];
      return named ? ctx.featureNames.has(named.toLowerCase()) : undefined;
    }
  }
}

/** Whether the prerequisites hold. Alternatives are any-of; each is all-of (plan P13). */
export function checkPrereqs(prereqs: Prereqs, ctx: PrereqContext): PrereqResult {
  if (!prereqs.length) return { met: true, unmet: [], unknown: [] };
  let best: PrereqResult | undefined;
  for (const group of prereqs) {
    const unmet: string[] = [];
    const unknown: string[] = [];
    for (const p of group) {
      const ok = check(p, ctx);
      const text =
        ((p.type === 'feature' || p.type === 'feat') && ctx.nameOf?.(p.ref)) || prereqText(p);
      if (ok === undefined) unknown.push(text);
      else if (!ok) unmet.push(text);
    }
    const result = { met: !unmet.length, unmet, unknown };
    if (result.met) return result;
    if (!best || unmet.length < best.unmet.length) best = result;
  }
  return best!;
}

/**
 * Multiclassing (2024): a score of 13 or higher in the class's primary abilities. The data's
 * groups are alternatives (Fighter: Strength or Dexterity), each needing all of its abilities.
 */
export function multiclassPrereqs(cls: ClassDef): Prereqs {
  const groups = cls.multiclass.prereq.length ? cls.multiclass.prereq : cls.primaryAbility;
  if (!groups.length) return [];
  return [
    [{ type: 'ability', anyOf: groups.map((g) => Object.fromEntries(g.map((a) => [a, 13]))) }],
  ];
}
