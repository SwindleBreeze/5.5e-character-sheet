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

/** Dice the text names, in order, once each: `{@damage 1d8}`, `{@dice 2d4}`. */
function tagDice(entries: readonly unknown[], tag: 'damage' | 'dice', near?: RegExp): string[] {
  const out: string[] = [];
  const visit = (v: unknown): void => {
    if (typeof v === 'string') {
      if (near && !near.test(v)) return;
      for (const m of v.matchAll(new RegExp(`\\{@${tag} ([^}|]+)`, 'g'))) {
        const dice = m[1]!.trim();
        if (!out.includes(dice)) out.push(dice);
      }
    } else if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === 'object' && 'entries' in v)
      visit((v as { entries: unknown }).entries);
  };
  visit(entries);
  return out;
}

/** How a spell lands: who rolls, and against what. */
export type SpellHow =
  /** You roll a d20 to hit, against the target's Armor Class. */
  | { kind: 'attack'; bonus?: number | undefined }
  /** The target rolls a save against your DC; you roll nothing. */
  | { kind: 'save'; abilities: string[]; dc?: number | undefined }
  /** Nobody rolls to see whether it works. */
  | { kind: 'none' };

export interface SpellLanding {
  how: SpellHow;
  /** Its damage or healing dice; several when the text gives a choice (Toll the Dead). */
  dice: string[];
  /** Damage types, or `healing`. */
  what?: string;
  /** When the dice apply: `on a hit`, `on a failed save`. */
  when?: string;
}

/**
 * What a spell does at a glance, without opening it (play-test fix: Hunter's Mark, Toll the
 * Dead): who rolls what and against which number, and its damage or healing. The caster's
 * own DC and attack bonus are filled in; a cantrip's damage is the one for the character's
 * level.
 */
export function spellLanding(
  spell: Spell,
  caster: { dc?: number | undefined; attack?: number | undefined; charLevel: number },
): SpellLanding {
  const how: SpellHow = spell.attack
    ? { kind: 'attack', bonus: caster.attack }
    : spell.saves?.length
      ? { kind: 'save', abilities: spell.saves.map((a) => a.toUpperCase()), dc: caster.dc }
      : { kind: 'none' };
  const when =
    how.kind === 'attack' ? 'on a hit' : how.kind === 'save' ? 'on a failed save' : undefined;
  const types = spell.damageTypes?.length
    ? spell.damageTypes.map(titleCase).join(' or ')
    : undefined;
  const damage = (dice: string[]): SpellLanding =>
    dice.length
      ? { how, dice, ...(types ? { what: types } : {}), ...(when ? { when } : {}) }
      : { how, dice };
  const scaled = spell.scaling?.[0]?.byLevel;
  if (scaled) {
    const at = Object.keys(scaled)
      .map(Number)
      .filter((l) => l <= caster.charLevel)
      .sort((a, b) => b - a)[0];
    return damage(at !== undefined ? [scaled[at]!] : []);
  }
  const dice = tagDice(spell.entries, 'damage');
  if (dice.length) return damage(dice);
  const heal = tagDice(spell.entries, 'dice', /regains? .*Hit Points?|Hit Points?.* regain/i);
  return heal.length ? { how, dice: [heal[0]!], what: 'healing' } : { how, dice: [] };
}

/** `Roll to hit +7 vs AC`, `Target makes a WIS save, DC 15`, `No roll to hit or save`. */
export function howText(how: SpellHow): string {
  switch (how.kind) {
    case 'attack':
      return how.bonus === undefined
        ? 'Roll to hit vs AC'
        : `Roll to hit ${how.bonus < 0 ? '−' : '+'}${Math.abs(how.bonus)} vs AC`;
    case 'save':
      return `Target makes a ${how.abilities.join(' or ')} save${how.dc !== undefined ? `, DC ${how.dc}` : ''}`;
    case 'none':
      return 'No roll to hit or save';
  }
}
