// Stat blocks that scale with the summoner (plan §10.3, step 7.6). 2024 summons and companions
// write their numbers in words: "11 + the spell's level", "5 plus five times your Ranger level",
// "{@damage 1d8 + 4 + summonSpellLevel}", "{@hitYourSpellAttack}", "DC equals your spell save
// DC". The common patterns are worked out for the character; anything else stays as written.

import {
  ABILITIES,
  ABILITY_NAMES,
  type Ability,
  type Creature,
  type Entry,
  type EntryBlock,
} from '../../schema/index.ts';

/** What a stat block's words refer to, for one character and one summon. */
export interface ScaleContext {
  /** The level of the spell that summoned it. */
  spellLevel?: number;
  /** Class levels by lowercased class name (`ranger`). */
  classLevels: Record<string, number>;
  charLevel: number;
  pb: number;
  mods: Record<Ability, number>;
  /** The summoner's spell attack bonus and save DC, when it has them. */
  spellAttack?: number;
  spellDc?: number;
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

const ABILITY_BY_NAME = Object.fromEntries(
  ABILITIES.map((a) => [ABILITY_NAMES[a].toLowerCase(), a]),
) as Record<string, Ability>;

const count = (word: string | undefined): number | undefined =>
  word === undefined ? 1 : /^\d+$/.test(word) ? Number(word) : NUMBER_WORDS[word];

const SPELL_LEVEL = /^(?:the spell's level|the level of the spell|the spell level)$/;

/** One term of a written formula: `11`, `the spell's level`, `five times your Ranger level`. */
function term(raw: string, ctx: ScaleContext): number | undefined {
  const t = raw.trim().toLowerCase();
  const lvl = ctx.spellLevel;
  let m: RegExpExecArray | null;
  if (/^\d+$/.test(t)) return Number(t);
  if ((m = /^(\d+) for each spell level above (\d+)(?:st|nd|rd|th)?$/.exec(t)))
    return lvl === undefined ? undefined : Number(m[1]) * Math.max(0, lvl - Number(m[2]));
  if ((m = /^(\d+) per spell level$/.exec(t)))
    return lvl === undefined ? undefined : Number(m[1]) * lvl;
  if (SPELL_LEVEL.test(t)) return lvl;
  if (t === 'pb' || t === 'your proficiency bonus') return ctx.pb;
  if ((m = /^your (\w+) modifier$/.exec(t))) {
    const ability = ABILITY_BY_NAME[m[1] ?? ''];
    return ability ? ctx.mods[ability] : undefined;
  }
  if ((m = /^(?:(\w+) times )?your (?:(\w+) )?level$/.exec(t))) {
    const times = count(m[1]);
    const level = m[2] ? ctx.classLevels[m[2]] : ctx.charLevel;
    return times === undefined || level === undefined ? undefined : times * level;
  }
  return undefined;
}

/**
 * The number a written Armor Class or Hit Points formula comes to, or undefined when it isn't
 * one of the clear patterns (choices between forms, sizes, anything else).
 */
export function evalWritten(text: string, ctx: ScaleContext): number | undefined {
  // "20 (Air only) or 30 (Land only)": depends on the form chosen, so left as written.
  if (/\bonly\)/i.test(text)) return undefined;
  const plain = text.replace(/\([^)]*\)/g, ' ').trim();
  if (!plain || /,|\bor\b/i.test(plain)) return undefined;
  let total = 0;
  for (const part of plain.split(/\s*(?:\+|\bplus\b)\s*/i)) {
    const n = term(part, ctx);
    if (n === undefined) return undefined;
    total += n;
  }
  return total;
}

/** "(… a number of Hit Dice [d8s] equal to your Ranger level)" → `5d8`. */
export function writtenHitDice(text: string, ctx: ScaleContext): string | undefined {
  const m = /Hit Dice \[d(\d+)s?\] equal to (.+?)\)/i.exec(text);
  if (!m) return undefined;
  const n = term(m[2] ?? '', ctx);
  return n !== undefined && n > 0 ? `${n}d${m[1]}` : undefined;
}

export interface ScaledNumber {
  /** Worked out, when the pattern is clear. */
  value?: number;
  /** As written in the stat block. */
  text: string;
}

/** The Armor Class of the first line: its number, or its written formula worked out. */
export function scaledAc(c: Creature, ctx: ScaleContext): ScaledNumber {
  const first = c.ac[0];
  if (!first) return { text: '' };
  if (first.special !== undefined) {
    const value = evalWritten(first.special, ctx);
    return value === undefined ? { text: first.special } : { value, text: first.special };
  }
  const text = `${first.value ?? ''}${first.note ? ` (${first.note})` : ''}`;
  return first.value === undefined ? { text } : { value: first.value, text };
}

/** Hit point maximum: the average, or the written formula worked out. */
export function scaledHp(c: Creature, ctx: ScaleContext): ScaledNumber & { hitDice?: string } {
  const { average, formula, special } = c.hp;
  if (special !== undefined) {
    const value = evalWritten(special, ctx);
    const hitDice = writtenHitDice(special, ctx);
    return {
      ...(value !== undefined ? { value } : {}),
      text: special,
      ...(hitDice ? { hitDice } : {}),
    };
  }
  const text = average === undefined ? '' : formula ? `${average} (${formula})` : `${average}`;
  return average === undefined
    ? { text }
    : { value: average, text, ...(formula ? { hitDice: formula } : {}) };
}

/** `1d8 + 4 + 3` → `1d8 + 7`; `(5 - 4)d4 + 3` → `1d4 + 3`. Undefined when it isn't plain dice. */
export function simplifyDice(expr: string): string | undefined {
  const flat = expr
    .replace(/\((\d+)\s*([-+])\s*(\d+)\)\s*d/g, (_, a: string, op: string, b: string) => {
      const n = op === '+' ? Number(a) + Number(b) : Number(a) - Number(b);
      return `${Math.max(0, n)}d`;
    })
    .replace(/\s+/g, '');
  if (!/^[-+]?(\d*d\d+|\d+)([-+](\d*d\d+|\d+))*$/.test(flat)) return undefined;
  const dice: string[] = [];
  let bonus = 0;
  for (const m of flat.matchAll(/([-+]?)(\d*d\d+|\d+)/g)) {
    const sign = m[1] === '-' ? -1 : 1;
    const part = m[2] ?? '';
    if (part.includes('d')) {
      if (part.startsWith('0d')) continue;
      dice.push(`${sign < 0 ? '- ' : dice.length ? '+ ' : ''}${part}`);
    } else bonus += sign * Number(part);
  }
  if (!dice.length) return String(bonus);
  const tail = bonus > 0 ? ` + ${bonus}` : bonus < 0 ? ` - ${-bonus}` : '';
  return dice.join(' ') + tail;
}

const ROLL_TAG =
  /\{@(damage|dice) ([^}|]+)(?:\|[^}]*)?\}( plus your (strength|dexterity|constitution|intelligence|wisdom|charisma) modifier)?/gi;

/**
 * One line of a stat block with the summoner's numbers in: its spell attack bonus for
 * `{@hitYourSpellAttack}`, the spell level in damage dice, an ability modifier added to the
 * dice it follows, its save DC after a saving throw, and how many attacks "half this spell's
 * level" makes. What can't be worked out is left as written.
 */
export function scaleText(text: string, ctx: ScaleContext): string {
  let out = text;
  if (ctx.spellAttack !== undefined)
    out = out.replace(/\{@hitYourSpellAttack[^}]*\}/g, `{@hit ${ctx.spellAttack}}`);
  if (ctx.spellDc !== undefined) {
    out = out
      .replace(
        /(\{@actSave \w+\} )(?:DC equals your spell save DC|Your spell save DC)/g,
        `$1{@dc ${ctx.spellDc}}`,
      )
      .replace(/\{@dcYourSpellSave[^}]*\}/g, `{@dc ${ctx.spellDc}}`);
  }
  out = out.replace(ROLL_TAG, (whole, tag: string, expr: string, plus?: string, ab?: string) => {
    const usesLevel = expr.includes('summonSpellLevel');
    if (!usesLevel && !plus) return whole;
    if (usesLevel && ctx.spellLevel === undefined) return whole;
    let e = expr.replace(/summonSpellLevel/g, String(ctx.spellLevel ?? 0));
    if (plus) {
      const mod = ctx.mods[ABILITY_BY_NAME[(ab ?? '').toLowerCase()] ?? 'str'];
      e = `${e} + ${mod}`;
    }
    const simple = simplifyDice(e);
    return simple ? `{@${tag} ${simple}}` : whole;
  });
  if (ctx.spellLevel !== undefined) {
    out = out.replace(
      /equal to half this spell's level \(round down\)/g,
      (m) => `${m} (${Math.floor((ctx.spellLevel ?? 0) / 2)} at level ${ctx.spellLevel})`,
    );
  }
  return out;
}

function scaleEntry(e: Entry, ctx: ScaleContext): Entry {
  if (typeof e === 'string') return scaleText(e, ctx);
  const block: EntryBlock = e;
  switch (block.type) {
    case 'entries':
    case 'section':
    case 'inset':
    case 'quote':
    case 'options':
      return { ...block, entries: scaleEntries(block.entries, ctx) };
    case 'item':
      return { ...block, entries: scaleEntries(block.entries, ctx) };
    case 'list':
      return { ...block, items: scaleEntries(block.items, ctx) };
    default:
      return block;
  }
}

/** A stat block's entries with the summoner's numbers in (see `scaleText`). */
export function scaleEntries(entries: readonly Entry[], ctx: ScaleContext): Entry[] {
  return entries.map((e) => scaleEntry(e, ctx));
}
