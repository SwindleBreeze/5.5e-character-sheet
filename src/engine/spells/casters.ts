// Spellcasting a class or subclass has from its data (plan §9.1, §9.2 step 3.7): how many
// cantrips and spells it picks at each level, and the highest spell level it can use.

import type {
  ClassDef,
  ClassSpellcasting,
  Effect,
  SpellGrant,
  Subclass,
} from '../../schema/index.ts';
import { cellToValue } from '../formula/evaluate.ts';
import { isDice } from '../formula/dice.ts';
import {
  casterLevelShare,
  highestSlot,
  MULTICLASS_SLOTS,
  pactSlots,
  slotRow,
} from '../rules/slots.ts';
import { levelsUpTo } from './filter.ts';

type CasterOwner = ClassDef | Subclass;

/**
 * The spell list filter of a class (`class=Wizard`) or subclass caster
 * (`subclass=Fighter: Eldritch Knight`).
 */
export function casterList(owner: CasterOwner): string {
  if (owner.kind === 'class') return `class=${owner.name}`;
  return `subclass=${owner.classId.split('|')[0] ?? ''}: ${owner.shortName}`;
}

/**
 * How many prepared spells a Long Rest caster may replace after a Long Rest (2024 Spell
 * Preparation by Class table): Paladin and Ranger one; the others any number (undefined).
 */
export function prepSwapLimit(owner: CasterOwner): number | undefined {
  const name = (owner.kind === 'class' ? owner.name : (owner.classId.split('|')[0] ?? ''))
    .toLowerCase()
    .trim();
  return name === 'paladin' || name === 'ranger' ? 1 : undefined;
}

/** Highest spell level this caster can prepare at a class level, as if single-classed. */
export function maxSpellLevel(sc: ClassSpellcasting, owner: CasterOwner, level: number): number {
  if (sc.progression === 'pact') return pactSlots(owner, level)?.level ?? 0;
  if (owner.slotTable?.length) return highestSlot(slotRow(owner.slotTable, level));
  return highestSlot(slotRow(MULTICLASS_SLOTS, casterLevelShare(sc.progression, level)));
}

/** A count by class level from the spellcasting data, else from a table column. */
function countAt(
  byLevel: number[] | undefined,
  owner: CasterOwner,
  key: string,
  level: number,
): number {
  if (byLevel?.length) return byLevel[level - 1] ?? 0;
  const v = cellToValue(owner.table?.find((c) => c.key === key)?.values[level - 1]);
  return isDice(v) ? 0 : v;
}

export function cantripCount(sc: ClassSpellcasting, owner: CasterOwner, level: number): number {
  return level < 1 ? 0 : countAt(sc.cantripsByLevel, owner, 'cantrips', level);
}

export function preparedCount(sc: ClassSpellcasting, owner: CasterOwner, level: number): number {
  return level < 1 ? 0 : countAt(sc.preparedByLevel, owner, 'prepared-spells', level);
}

/**
 * The choices a caster's data implies, as level-gated grants: new cantrips, new spells for
 * casters that change spells on level-up (they work like known spells), and spellbook
 * entries. Prepared lists of Long Rest casters are play state, not choices (plan §9.1).
 */
export function spellChoiceEffects(sc: ClassSpellcasting, owner: CasterOwner): Effect[] {
  const list = casterList(owner);
  const spellbook = !!sc.spellbookByLevel?.length;
  const out: Effect[] = [];
  for (let level = 1; level <= 20; level++) {
    const grants: SpellGrant[] = [];
    const newCantrips = cantripCount(sc, owner, level) - cantripCount(sc, owner, level - 1);
    if (newCantrips > 0) {
      grants.push({
        mode: 'known',
        ability: sc.ability,
        spell: {
          choose: `level=0|${list}`,
          count: newCantrips,
          slot: `cantrips.${level}`,
          retrain: spellbook ? 'longRest' : 'levelUp',
        },
      });
    }
    const top = maxSpellLevel(sc, owner, level);
    if (sc.preparedChange === 'level' && top > 0) {
      const newSpells = preparedCount(sc, owner, level) - preparedCount(sc, owner, level - 1);
      if (newSpells > 0) {
        grants.push({
          mode: 'known',
          ability: sc.ability,
          spell: {
            choose: `${levelsUpTo(top)}|${list}`,
            count: newSpells,
            slot: `spells.${level}`,
            retrain: 'levelUp',
          },
        });
      }
    }
    const book = sc.spellbookByLevel?.[level - 1] ?? 0;
    if (book > 0 && top > 0) {
      grants.push({
        mode: 'spellbook',
        ability: sc.ability,
        spell: { choose: `${levelsUpTo(top)}|${list}`, count: book, slot: `spellbook.${level}` },
      });
    }
    if (grants.length)
      out.push({ type: 'atLevel', level, effects: [{ type: 'grantSpells', spells: grants }] });
  }
  return out;
}
