// Static state (plan §8.2 rule 1): what predicates and choice-bound values may read. Levels,
// equipment, toggles and conditions; never a derived number such as AC or a modifier.

import type { ActiveToggle, Character, Id, Predicate } from '../../schema/index.ts';
import { classLevels } from '../collect/collect.ts';
import type { ClassLevel } from '../collect/types.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import { matchesFilter } from './attackTraits.ts';
import { buildWieldState, type WieldState } from './equipment.ts';

export interface StaticState {
  charLevel: number;
  classes: ClassLevel[];
  classLevels: ReadonlyMap<Id, number>;
  wield: WieldState;
  activeToggles: Readonly<Record<string, ActiveToggle>>;
  /** Condition rule ids, including `condition/exhaustion…` only through `exhaustion`. */
  conditions: ReadonlySet<Id>;
  exhaustion: number;
}

export function buildStaticState(character: Character, index: ContentIndex): StaticState {
  const classes = classLevels(character, index);
  return {
    charLevel: character.log.length,
    classes,
    classLevels: new Map(classes.map((c) => [c.classId, c.level])),
    wield: buildWieldState(character, index),
    activeToggles: character.state.activeToggles,
    conditions: new Set(character.state.conditions),
    exhaustion: character.state.exhaustion,
  };
}

/** P1: whether a predicate holds. */
export function holds(p: Predicate, s: StaticState): boolean {
  if ('all' in p) return p.all.every((q) => holds(q, s));
  if ('any' in p) return p.any.some((q) => holds(q, s));
  if ('not' in p) return !holds(p.not, s);
  if ('armor' in p) {
    const category = s.wield.armor?.info.category;
    switch (p.armor) {
      case 'none':
        return !category;
      case 'any':
        return !!category;
      case 'notHeavy':
        return category !== 'heavy';
      default:
        return category === p.armor;
    }
  }
  if ('shield' in p) return !!s.wield.shield === p.shield;
  if ('freeHands' in p) return s.wield.freeHands >= p.freeHands;
  if ('wielding' in p) return s.wield.wielded.some((w) => matchesFilter(p.wielding, w.traits));
  if ('toggle' in p) {
    const active = s.activeToggles[p.toggle];
    return !!active && (p.option === undefined || active.option === p.option);
  }
  if ('condition' in p) return s.conditions.has(p.condition);
  if ('level' in p) {
    const level = p.classId ? (s.classLevels.get(p.classId) ?? 0) : s.charLevel;
    return level >= p.level;
  }
  return false;
}
