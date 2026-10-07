// Levelling up (plan §9.4, step 5.1). A level-up is the character with one more log entry,
// worked on in memory until it is applied: `planLevelUp` takes the level and says what it brings
// (hit points, a subclass when due, new features, the picks they ask for, multiclass
// requirements); the flow changes it with the usual helpers (`setPick`, `setLevelHp`,
// `setSubclass`) and reads the plan again after each change.

import {
  ABILITY_NAMES,
  encodeChoiceKey,
  type Character,
  type ClassDef,
  type HpGain,
  type Id,
  type Ref,
  type Subclass,
} from '../../schema/index.ts';
import type { Pending } from '../choices/reconcile.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import { derive } from '../derive/derive.ts';
import type { DerivedFeature, DerivedSheet } from '../derive/types.ts';
import type { FeatureEffectsMap } from '../featureEffects/types.ts';
import { checkPrereqs, multiclassPrereqs, prereqContext, type PrereqResult } from '../prereq.ts';
import { addLevel } from './build.ts';
import type { Catalog } from './catalog.ts';

export const MAX_LEVEL = 20;

export interface ClassOption {
  classId: Id;
  name: string;
  /** The level this class would reach. */
  classLevel: number;
  /** A class the character doesn't have yet. */
  multiclass: boolean;
  /**
   * For a new class (2024 multiclassing): 13 or more in the primary ability of the new class
   * and of every class the character has. Warned, never blocked.
   */
  prereq?: PrereqResult;
}

/** Text for a class's multiclass requirement: `Strength 13+`, `Strength or Dexterity 13+`. */
function requirementText(cls: ClassDef): string {
  const groups = cls.multiclass.prereq.length ? cls.multiclass.prereq : cls.primaryAbility;
  return groups.map((g) => g.map((a) => `${ABILITY_NAMES[a]} 13+`).join(' and ')).join(' or ');
}

/**
 * Whether the character can multiclass into `cls` by the 2024 rule: the new class's
 * requirement and every current class's, each named in what isn't met.
 */
export function multiclassCheck(
  cls: ClassDef,
  sheet: DerivedSheet,
  index: ContentIndex,
): PrereqResult {
  const ctx = prereqContext(sheet, index);
  const unmet: string[] = [];
  const unknown: string[] = [];
  const classes = [
    cls,
    ...sheet.classes.flatMap((c) => {
      const own = index.get({ kind: 'class', id: c.classId });
      return own && own.id !== cls.id ? [own] : [];
    }),
  ];
  for (const each of classes) {
    const r = checkPrereqs(multiclassPrereqs(each), ctx);
    if (!r.met) unmet.push(`${each.name}: ${requirementText(each)}`);
    unknown.push(...r.unknown);
  }
  return { met: !unmet.length, unmet, unknown };
}

/** The classes a level can go to: the character's own first, then every other one offered. */
export function levelUpOptions(
  c: Character,
  sheet: DerivedSheet,
  index: ContentIndex,
  catalog: Catalog,
): ClassOption[] {
  const levelOf = (id: Id) => c.log.filter((e) => e.classRef.id === id).length;
  const own = [...new Set(c.log.map((e) => e.classRef.id))];
  const out: ClassOption[] = own.map((id) => ({
    classId: id,
    name: index.get({ kind: 'class', id })?.name ?? id,
    classLevel: levelOf(id) + 1,
    multiclass: false,
  }));
  for (const cls of catalog.of('class')) {
    if (own.includes(cls.id)) continue;
    out.push({
      classId: cls.id,
      name: cls.name,
      classLevel: 1,
      multiclass: true,
      prereq: multiclassCheck(cls, sheet, index),
    });
  }
  return out;
}

export interface LevelUpPlan {
  /** The character with the level taken. */
  character: Character;
  sheet: DerivedSheet;
  /** The new log entry's index. */
  entryIndex: number;
  classId: Id;
  cls: ClassDef | undefined;
  classLevel: number;
  charLevel: number;
  multiclass: boolean;
  /** For a new class: the 2024 multiclass requirement (checked before the level). */
  prereq?: PrereqResult;
  hitDie: number;
  /** The fixed hit point gain before the Constitution modifier: half the die, plus one. */
  hpAverage: number;
  hp: HpGain;
  /** This level is where the class's subclass is chosen. */
  subclassDue: boolean;
  /** Subclasses to choose from, when due. */
  subclasses: Subclass[];
  subclassRef?: Ref;
  /** Class and subclass features this level brings. */
  features: DerivedFeature[];
  /**
   * This level's picks, by encoded key: those recorded on its entry, and earlier ones it gives
   * more of (a third Weapon Mastery kind) or brings anew.
   */
  choiceKeys: ReadonlySet<string>;
  /** This level's picks still to make. */
  pending: Pending[];
  /** What stands in the way, as text (a level past 20, content that isn't imported). */
  issues: string[];
}

interface Deps {
  index: ContentIndex;
  catalog: Catalog;
  registry?: FeatureEffectsMap;
}

/** Take a level in a class: the character with it added (average hit points until chosen). */
export function takeLevel(c: Character, classRef: Ref): Character {
  return addLevel(c, classRef, { mode: 'avg' });
}

/** Read what the last level of a character being levelled up brings. */
export function readLevelUp(character: Character, before: DerivedSheet, deps: Deps): LevelUpPlan {
  const { index, catalog } = deps;
  const entryIndex = character.log.length - 1;
  const entry = character.log[entryIndex]!;
  const classId = entry.classRef.id;
  const cls = index.get({ kind: 'class', id: classId });
  const sheet = derive(character, index, deps.registry ? { registry: deps.registry } : {});
  const multiclass = !character.log.slice(0, entryIndex).some((e) => e.classRef.id === classId);
  const issues: string[] = [];
  if (entry.charLevel > MAX_LEVEL) issues.push(`Characters go up to level ${MAX_LEVEL}.`);
  if (!cls) issues.push('This class isn’t in your imported content.');
  const hitDie = cls?.hitDie ?? 8;
  const subclassDue = !!cls && entry.classLevel === cls.subclassLevel;
  const subclasses = subclassDue ? catalog.of('subclass').filter((s) => s.classId === classId) : [];
  const features = sheet.features.filter(
    (f) =>
      f.entryIndex === entryIndex &&
      (f.ref.kind === 'classFeature' || f.ref.kind === 'subclassFeature') &&
      f.classId === classId &&
      f.level === entry.classLevel,
  );
  const countBefore = new Map(
    before.features.flatMap((f) => f.choices).map((c) => [c.key, c.count]),
  );
  const choiceKeys = new Set(
    sheet.features
      .flatMap((f) => f.choices)
      .filter((c) => c.entryIndex === entryIndex || c.count > (countBefore.get(c.key) ?? 0))
      .map((c) => c.key),
  );
  const pending = sheet.choices.pending.filter((p) => choiceKeys.has(encodeChoiceKey(p.offer.key)));
  return {
    character,
    sheet,
    entryIndex,
    classId,
    cls,
    classLevel: entry.classLevel,
    charLevel: entry.charLevel,
    multiclass,
    ...(multiclass && cls ? { prereq: multiclassCheck(cls, before, index) } : {}),
    hitDie,
    hpAverage: Math.floor(hitDie / 2) + 1,
    hp: entry.hp,
    subclassDue,
    subclasses,
    ...(entry.subclassRef ? { subclassRef: entry.subclassRef } : {}),
    features,
    choiceKeys,
    pending,
    issues,
  };
}

/** Plan a level in a class: the level taken, and what it brings. */
export function planLevelUp(c: Character, classRef: Ref, deps: Deps): LevelUpPlan {
  const before = derive(c, deps.index, deps.registry ? { registry: deps.registry } : {});
  return readLevelUp(takeLevel(c, classRef), before, deps);
}

/** How the last level's hit points are gained: the fixed value, or a roll of the die. */
export function setLevelHp(c: Character, hp: HpGain): Character {
  const n = structuredClone(c);
  const last = n.log.at(-1);
  if (last && n.log.length > 1) last.hp = hp;
  return n;
}
