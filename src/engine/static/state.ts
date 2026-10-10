// Static state (plan §8.2 rule 1): what predicates and choice-bound values may read. Levels,
// equipment, toggles and conditions; never a derived number such as AC or a modifier.

import type { ActiveToggle, Character, Id, Predicate } from '../../schema/index.ts';
import { classLevels } from '../collect/collect.ts';
import type { ClassLevel } from '../collect/types.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import { magicWorks } from '../items/items.ts';
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
  /** The conditions by name (`prone`), whatever book they come from: a 2014 character's are 2014's. */
  conditionNames: ReadonlySet<string>;
  exhaustion: number;
  /** Items in use (equipped or worn, attuned when they need it), with their variants. */
  itemsInUse: ReadonlySet<Id>;
  attunedCount: number;
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
    conditionNames: new Set(character.state.conditions.map(conditionName)),
    exhaustion: character.state.exhaustion,
    ...itemsState(character, index),
  };
}

function itemsState(character: Character, index: ContentIndex) {
  const itemsInUse = new Set<Id>();
  let attunedCount = 0;
  for (const row of character.inventory) {
    if (row.attuned) attunedCount++;
    if (!row.equipped || !row.itemRef) continue;
    const item = index.get({ kind: 'item', id: row.itemRef.id });
    const variant = row.variantRef ? index.get({ kind: 'item', id: row.variantRef.id }) : undefined;
    if (!magicWorks(row, item, variant)) continue;
    itemsInUse.add(row.itemRef.id);
    if (row.variantRef) itemsInUse.add(row.variantRef.id);
  }
  return { itemsInUse, attunedCount };
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
  if ('condition' in p)
    return s.conditions.has(p.condition) || s.conditionNames.has(conditionName(p.condition));
  if ('attuned' in p) return s.attunedCount > 0;
  if ('itemInUse' in p) return p.itemInUse.some((id) => s.itemsInUse.has(id));
  if ('level' in p) {
    const level = p.classId ? (s.classLevels.get(p.classId) ?? 0) : s.charLevel;
    return level >= p.level;
  }
  return false;
}

/** `condition/stunned|xphb` → `stunned`. */
export function conditionName(id: Id): string {
  return ((id.split('|')[0] ?? id).split('/').pop() ?? id).toLowerCase();
}
