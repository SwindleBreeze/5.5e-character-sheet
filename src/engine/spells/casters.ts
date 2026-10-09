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
import { levelsUpTo, spellListValue } from './filter.ts';
import { casterSpellcasting } from '../rules/legacy.ts';

type CasterOwner = ClassDef | Subclass;

/**
 * The spell list filter of a class (`class=Wizard`) or subclass caster
 * (`subclass=Fighter: Eldritch Knight`).
 */
export function casterList(owner: CasterOwner): string {
  const own =
    owner.kind === 'class'
      ? `class=${owner.name}`
      : `subclass=${owner.classId.split('|')[0] ?? ''}: ${owner.shortName}`;
  // Homebrew can borrow other classes' lists and add single spells: one `list=` part says
  // "any of these", with the caster's own list as one of them.
  const also = owner.spellcasting?.listAlso;
  if (!also || (!also.classes?.length && !also.spellIds?.length)) return own;
  const values = [
    owner.kind === 'class' ? `class:${owner.name}` : null,
    ...(also.classes ?? []).map((c) => `class:${c}`),
    ...(also.spellIds ?? []).map(spellListValue),
  ].filter((v): v is string => v !== null);
  return `list=${values.join(';')}`;
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

/**
 * A count by class level from the spellcasting data, else from a table column. The first key
 * is the 2024 column; the others are older names homebrew still uses ("Spells Known").
 */
function countAt(
  byLevel: number[] | undefined,
  owner: CasterOwner,
  keys: string[],
  level: number,
): number {
  if (byLevel?.length) return byLevel[level - 1] ?? 0;
  const column = keys.map((k) => owner.table?.find((c) => c.key === k)).find((c) => c);
  const v = cellToValue(column?.values[level - 1]);
  return isDice(v) ? 0 : v;
}

const CANTRIP_KEYS = ['cantrips', 'cantrips-known'];
const PREPARED_KEYS = ['prepared-spells', 'spells-known'];

export function cantripCount(sc: ClassSpellcasting, owner: CasterOwner, level: number): number {
  return level < 1 ? 0 : countAt(sc.cantripsByLevel, owner, CANTRIP_KEYS, level);
}

export function preparedCount(sc: ClassSpellcasting, owner: CasterOwner, level: number): number {
  return level < 1 ? 0 : countAt(sc.preparedByLevel, owner, PREPARED_KEYS, level);
}

/**
 * The choices a caster's data implies, as level-gated grants: new cantrips, new spells for
 * casters that change spells on level-up (they work like known spells), and spellbook
 * entries. Prepared lists of Long Rest casters are play state, not choices (plan §9.1).
 */
export function spellChoiceEffects(data: ClassSpellcasting, owner: CasterOwner): Effect[] {
  const sc = casterSpellcasting(data, owner);
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
    // Spells gained at set levels outside the table (Mystic Arcanum: one level 6 spell at
    // Warlock 11, 7 at 13…), each cast once per Long Rest without a slot (plan step 5.8).
    for (const [spellLevel, count] of Object.entries(sc.fixedByLevel?.[level] ?? {})) {
      if (count <= 0) continue;
      grants.push({
        mode: 'known',
        ability: sc.ability,
        spell: {
          choose: `level=${spellLevel}|${list}`,
          count,
          slot: `arcanum.${level}`,
          retrain: 'levelUp',
        },
        uses: { count: 1, recharge: 'long' },
      });
    }
    if (grants.length)
      out.push({ type: 'atLevel', level, effects: [{ type: 'grantSpells', spells: grants }] });
  }
  return out;
}
