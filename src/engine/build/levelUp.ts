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
import { setPick } from '../play/features.ts';
import { autoChoose } from './autoChoose.ts';
import { addLevel, setSubclass } from './build.ts';
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

/**
 * How a level's hit points are gained: the fixed value, or a roll of the die. The last level
 * by default; level 1 always takes the die's maximum.
 */
export function setLevelHp(c: Character, hp: HpGain, entryIndex = c.log.length - 1): Character {
  if (entryIndex < 1 || !c.log[entryIndex]) return c;
  const n = structuredClone(c);
  n.log[entryIndex]!.hp = hp;
  return n;
}

/** Picks per level at most, as in the quick-builder. */
const MAX_AUTO_PICKS = 100;

/**
 * Make the last level's picks automatically (plan step 5.4): its subclass when due (the first
 * one offered), then each of its picks, one at a time so each sees the ones before it. Earlier
 * levels' picks are left alone.
 */
export function autoFillLevel(c: Character, deps: Deps & { now?: number }): Character {
  const opts = deps.registry ? { registry: deps.registry } : {};
  const before = derive({ ...c, log: c.log.slice(0, -1) }, deps.index, opts);
  let character = c;
  let plan = readLevelUp(character, before, deps);
  if (plan.subclassDue && !plan.subclassRef && plan.cls && plan.subclasses[0]) {
    character = setSubclass(character, plan.cls, { kind: 'subclass', id: plan.subclasses[0].id });
    plan = readLevelUp(character, before, deps);
  }
  for (let i = 0; i < MAX_AUTO_PICKS; i++) {
    const ctx = { character, sheet: plan.sheet, catalog: deps.catalog, index: deps.index };
    const choices = plan.sheet.features.flatMap((f) => f.choices);
    const next = plan.pending
      .filter((p) => {
        // An earlier level's pick it gives more of is topped up, never made from nothing.
        const c = choices.find((x) => x.offer === p.offer);
        return !c || c.entryIndex === plan.entryIndex || c.values.length > 0;
      })
      .map((p) => ({ p, pick: autoChoose(p.offer, p.count - p.have, ctx) }))
      .find((x) => x.pick.values.length);
    if (!next) break;
    const { p, pick } = next;
    const choice = choices.find((x) => x.offer === p.offer);
    const existing = choice?.values ?? [];
    character = setPick(character, p.offer.key, {
      values: [...existing, ...pick.values],
      labels: [...(choice?.labels ?? []), ...(pick.labels ?? pick.values)],
      ...(pick.valueKinds ? { valueKinds: pick.valueKinds } : {}),
      entryIndex: choice?.entryIndex ?? plan.entryIndex,
      ...(deps.now !== undefined ? { now: deps.now } : {}),
      via: (choice?.entryIndex ?? plan.entryIndex) === 0 ? 'creation' : 'levelUp',
    });
    plan = readLevelUp(character, before, deps);
  }
  return character;
}

/**
 * Higher-level creation (plan step 5.4): the character at `level`, levels added in the class
 * of the last one (each made automatically, to be changed) or removed from the top.
 */
export function setStartLevel(
  c: Character,
  level: number,
  deps: Deps & { now?: number },
): Character {
  const target = Math.max(1, Math.min(MAX_LEVEL, Math.round(level)));
  if (!c.log.length) return c;
  let n = c;
  if (target < n.log.length) {
    n = structuredClone(n);
    n.log = n.log.slice(0, target);
    return n;
  }
  while (n.log.length < target) {
    n = autoFillLevel(takeLevel(n, n.log.at(-1)!.classRef), deps);
  }
  return n;
}

/**
 * Change the class of one of the higher levels: it and the levels after it are taken again
 * (the later ones in their own classes), each made automatically.
 */
export function changeLevelClass(
  c: Character,
  entryIndex: number,
  classRef: Ref,
  deps: Deps & { now?: number },
): Character {
  if (entryIndex < 1 || entryIndex >= c.log.length) return c;
  const classes = c.log.slice(entryIndex).map((e, i) => (i === 0 ? classRef : e.classRef));
  let n: Character = { ...structuredClone(c), log: structuredClone(c.log.slice(0, entryIndex)) };
  for (const ref of classes) n = autoFillLevel(takeLevel(n, ref), deps);
  return n;
}

/**
 * "Fill the rest automatically" (plan step 5.4): every pick still to make on the levels above
 * the first, and earlier picks those levels give more of, topped up. Level 1's are left alone.
 */
export function fillHigherLevels(c: Character, deps: Deps & { now?: number }): Character {
  const opts = deps.registry ? { registry: deps.registry } : {};
  let character = c;
  for (let i = 0; i < MAX_AUTO_PICKS * MAX_LEVEL; i++) {
    const sheet = derive(character, deps.index, opts);
    const choices = sheet.features.flatMap((f) => f.choices);
    const ctx = { character, sheet, catalog: deps.catalog, index: deps.index };
    const next = sheet.choices.pending
      .flatMap((p) => {
        const choice = choices.find((x) => x.offer === p.offer);
        if (!choice || (choice.entryIndex === 0 && !choice.values.length)) return [];
        const pick = autoChoose(p.offer, p.count - p.have, ctx);
        return pick.values.length ? [{ p, choice, pick }] : [];
      })
      .at(0);
    if (!next) break;
    const { p, choice, pick } = next;
    character = setPick(character, p.offer.key, {
      values: [...choice.values, ...pick.values],
      labels: [...choice.labels, ...(pick.labels ?? pick.values)],
      ...(pick.valueKinds ? { valueKinds: pick.valueKinds } : {}),
      entryIndex: choice.entryIndex,
      ...(deps.now !== undefined ? { now: deps.now } : {}),
      via: choice.entryIndex === 0 ? 'creation' : 'levelUp',
    });
  }
  return character;
}

/** The levels above the first taken again in the classes they had (after level 1 changed). */
export function retakeLevels(c: Character, deps: Deps & { now?: number }): Character {
  if (c.log.length < 2) return c;
  return changeLevelClass(c, 1, c.log[1]!.classRef, deps);
}
