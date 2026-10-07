// How spells read on the Spells tab: casting time, level and school, list headings, why the
// character can cast a spell, and what casting it did.

import type { DerivedSheet } from '../../../engine/derive/types.ts';
import type { CastWay } from '../../../engine/play/casting.ts';
import { ABILITY_NAMES, type Recharge, type Spell } from '../../../schema/index.ts';
import { titleCase } from '../components/format.ts';
import type { SpellEntry } from './entries.ts';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** `Action`, `Bonus Action`, `Reaction`, `1 minute`, `8 hours`. */
export function castingTime(spell: Spell): string {
  const t = spell.time[0];
  if (!t) return '';
  switch (t.unit) {
    case 'action':
      return 'Action';
    case 'bonus':
      return 'Bonus Action';
    case 'reaction':
      return 'Reaction';
    default:
      return plural(t.amount, t.unit);
  }
}

/** `Level 1 Illusion`, `Evocation cantrip`. */
export function levelSchool(spell: Spell): string {
  const school = titleCase(spell.school);
  return spell.level === 0 ? `${school} cantrip` : `Level ${spell.level} ${school}`;
}

export function levelHeading(level: number): string {
  return level === 0 ? 'Cantrips' : `Level ${level}`;
}

/**
 * How the spell decides whether it works: a spell attack against Armor Class, or a saving
 * throw against the caster's spell save DC. Undefined when it calls for neither.
 */
export function resolveText(spell: Spell, dc?: number): string | undefined {
  if (spell.attack) {
    return `It calls for a ${spell.attack} spell attack: roll a d20 and add your spell attack bonus. It hits when the total equals or exceeds the target’s Armor Class.`;
  }
  if (spell.saves?.length) {
    const saves = spell.saves.map((a) => ABILITY_NAMES[a]).join(' or ');
    return `It calls for a saving throw: the target makes a ${saves} saving throw against your spell save DC${dc !== undefined ? ` (${dc})` : ''}.`;
  }
  return undefined;
}

const RECHARGE_WHEN: Record<Recharge, string> = {
  short: 'back on a Short or Long Rest',
  long: 'back on a Long Rest',
  shortOne: 'one back on a Short Rest, all on a Long Rest',
  dawn: 'back at dawn',
  none: 'not regained',
};

/**
 * Why the character can cast a spell, and with what: a caster's prepared spell takes slots;
 * a species' or feat's spell has its own free uses, and may also take slots.
 */
export function whereFrom(e: SpellEntry, spell: Spell, sheet: DerivedSheet): string {
  const g = e.from.granted;
  const status = e.from.caster?.status;
  if (status === 'spellbook') {
    return `In your ${e.sourceName} spellbook but not prepared: you can cast it only as a Ritual, if it has the Ritual tag.`;
  }
  if (!g) {
    const how =
      spell.level === 0
        ? 'a cantrip, cast without a spell slot'
        : 'cast with a spell slot of its level or higher';
    return status === 'always'
      ? `Always prepared from ${e.sourceName}: ${how}.`
      : `Prepared as a ${e.sourceName} spell: ${how}.`;
  }
  const from = `From ${e.sourceName}`;
  if (spell.level === 0 || g.uses === 'atWill') {
    return `${from}: you can cast it at will, without a spell slot.`;
  }
  if (g.uses === 'ritual') return `${from}: you can cast it only as a Ritual.`;
  if (g.resourceKey) {
    const r = sheet.resources.find((x) => x.key === g.resourceKey);
    return `${from}: each cast costs ${g.cost ?? 1} ${r?.name ?? 'use'}, not a spell slot.`;
  }
  const slots = 'You can also cast it with a spell slot of its level or higher.';
  if (g.usesMax !== undefined && typeof g.uses === 'object' && 'count' in g.uses) {
    const times = g.usesMax === 1 ? 'once' : `${g.usesMax} times`;
    return `${from}: ${times} without a spell slot (${RECHARGE_WHEN[g.uses.recharge]}). ${slots}`;
  }
  return `${from}: cast it with a spell slot of its level or higher.`;
}

/** What casting it just did, for the notice: `Level 2 slot expended, 1 left · cast at level 2`. */
export function castNotice(way: CastWay, spell: Spell, sourceName: string): string {
  switch (way.kind) {
    case 'cantrip':
      return 'Cantrip, no spell slot';
    case 'slot': {
      const slot = way.pact ? 'Pact Magic slot' : `Level ${way.level} slot`;
      const higher = way.level > spell.level ? ` · cast at level ${way.level}` : '';
      return `${slot} expended, ${way.left - 1} left${higher}`;
    }
    case 'ritual':
      return 'As a Ritual: no spell slot, 10 minutes longer';
    case 'free':
      return way.left !== undefined
        ? `Free use from ${sourceName}, ${way.left - 1} left`
        : `Free use from ${sourceName}`;
    case 'atWill':
      return 'At will, no spell slot';
  }
}
