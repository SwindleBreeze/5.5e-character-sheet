// Creatures (plan §10.3, step 7.6). The bestiary has thousands; only those a player can have
// are kept: what spells and class features summon (`summonedBySpell`, `summonedByClass`),
// familiars, Beasts (Wild Shape) and any creature player content names with `{@creature}`.
// A stat block's traits and actions become the entity's entries, in 2024 section order.

import {
  ABILITIES,
  abilityModifier,
  crProficiency,
  crValue,
  nameSourceId,
  type Ability,
  type ContentEntity,
  type Creature,
  type CreatureAc,
  type CreatureSpeed,
  type EntityKind,
  type Entry,
  type Id,
  type MoveMode,
  type Size,
} from '../../../schema/index.ts';
import { normalizeEntries } from '../entries.ts';
import { asArray, isObject, num, str, strArray, type RawEntity, type RawObject } from '../raw.ts';
import { identityKey, uidToId } from '../uid.ts';
import { baseFields, type ConvertContext } from './common.ts';

/** Default source of `{@creature}` tags (5etools convention). */
export const CREATURE_TAG_SOURCE = 'MM';

const CREATURE_TAG = /\{@creature ([^|}]+)(?:\|([^|}]*))?/g;

/**
 * The player options whose text names creatures a character may get: a spell's or a feature's
 * summon, a feat's companion. Items, rules, gods and backgrounds name hundreds more, mostly as
 * foes or lore, so they don't count; an item's summon that is not a Beast can be written in.
 */
const NAMING_KINDS = new Set<EntityKind>([
  'spell',
  'classFeature',
  'subclassFeature',
  'feat',
  'optionalFeature',
  'species',
]);

/** Creature ids named by `{@creature}` tags in the rules text of player options. */
export function namedCreatureIds(entities: Iterable<ContentEntity>): Set<Id> {
  const out = new Set<Id>();
  for (const e of entities) {
    if (!NAMING_KINDS.has(e.kind)) continue;
    const text = JSON.stringify(
      e.kind === 'spell' && e.higherLevel ? [e.entries, e.higherLevel] : e.entries,
    );
    if (!text.includes('{@creature')) continue;
    for (const m of text.matchAll(CREATURE_TAG)) {
      out.add(nameSourceId(m[1] ?? '', m[2] || CREATURE_TAG_SOURCE));
    }
  }
  return out;
}

function typeName(type: unknown): string {
  if (typeof type === 'string') return type;
  if (isObject(type)) {
    if (isObject(type.type) && Array.isArray(type.type.choose))
      return strArray(type.type.choose).join(' or ');
    if (typeof type.type === 'string') return type.type;
  }
  return '';
}

/**
 * Whether a player could have this creature. `_copy` records inherit what they don't set,
 * so fields are read through the copy chain.
 */
function isWanted(raw: RawEntity, field: (key: string) => unknown, named: Set<Id>): boolean {
  if (field('summonedBySpell') || field('summonedByClass') || field('familiar') === true)
    return true;
  if (typeName(field('type')) === 'beast') return true;
  return named.has(nameSourceId(String(raw.name ?? ''), String(raw.source ?? '')));
}

/**
 * The monsters to keep, plus the `_copy` parents they need. The parents are dropped again after
 * copies are resolved, unless they are wanted themselves (`isKept`).
 */
export function selectCreatures(
  monsters: RawEntity[],
  named: Set<Id>,
): { records: RawEntity[]; isKept: (raw: RawEntity) => boolean } {
  const byKey = new Map<string, RawEntity>();
  for (const m of monsters) {
    const key = identityKey('monster', m);
    if (!byKey.has(key)) byKey.set(key, m);
  }
  const parentOf = (m: RawEntity) =>
    isObject(m._copy) ? byKey.get(identityKey('monster', m._copy as RawEntity)) : undefined;
  const field = (m: RawEntity) => (key: string) => {
    const seen = new Set<RawEntity>();
    for (let cur: RawEntity | undefined = m; cur && !seen.has(cur); cur = parentOf(cur)) {
      seen.add(cur);
      if (cur[key] !== undefined) return cur[key];
    }
    return undefined;
  };

  const wanted = new Set<string>();
  const needed = new Set<RawEntity>();
  for (const m of monsters) {
    if (!isWanted(m, field(m), named)) continue;
    wanted.add(identityKey('monster', m));
    for (let cur: RawEntity | undefined = m; cur && !needed.has(cur); cur = parentOf(cur))
      needed.add(cur);
  }
  return {
    records: monsters.filter((m) => needed.has(m)),
    isKept: (raw) => wanted.has(identityKey('monster', raw)),
  };
}

const SIZES = new Set(['T', 'S', 'M', 'L', 'H', 'G']);
const MOVE_MODES: MoveMode[] = ['walk', 'burrow', 'climb', 'fly', 'swim'];

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function acOf(raw: unknown): CreatureAc[] {
  return asArray(raw)
    .map((a): CreatureAc | null => {
      if (typeof a === 'number') return { value: a };
      if (!isObject(a)) return null;
      if (typeof a.special === 'string') return { special: a.special };
      const value = num(a.ac);
      if (value === undefined) return null;
      const notes = [...strArray(a.from)];
      if (typeof a.condition === 'string') notes.push(a.condition);
      return notes.length ? { value, note: notes.join(', ') } : { value };
    })
    .filter((a): a is CreatureAc => a !== null);
}

function hpOf(raw: unknown): Creature['hp'] {
  if (!isObject(raw)) return {};
  if (typeof raw.special === 'string') {
    // Some books write a plain number as "special".
    const n = num(raw.special);
    return n !== undefined ? { average: n } : { special: raw.special };
  }
  const out: Creature['hp'] = {};
  const average = num(raw.average);
  if (average !== undefined) out.average = average;
  if (typeof raw.formula === 'string') out.formula = raw.formula;
  return out;
}

function speedOf(raw: unknown): CreatureSpeed[] {
  if (!isObject(raw)) return [];
  const out: CreatureSpeed[] = [];
  for (const mode of MOVE_MODES) {
    const v = raw[mode];
    const ft = num(v) ?? (isObject(v) ? num(v.number) : undefined);
    if (ft === undefined) continue;
    const speed: CreatureSpeed = { mode, ft };
    const note =
      isObject(v) && typeof v.condition === 'string'
        ? v.condition
        : mode === 'fly' && raw.canHover === true
          ? '(hover)'
          : undefined;
    if (note) speed.note = note;
    out.push(speed);
  }
  return out;
}

/** `["poison", {immune: ["fire"], note: "while…"}]` → `Poison, Fire (while…)`. */
function defenseText(raw: unknown, key: string): string | undefined {
  const parts = asArray(raw)
    .map((d): string => {
      if (typeof d === 'string') return cap(d);
      if (!isObject(d)) return '';
      if (typeof d.special === 'string') return d.special;
      const inner = defenseText(d[key], key) ?? '';
      const pre = typeof d.preNote === 'string' ? `${d.preNote} ` : '';
      const note = typeof d.note === 'string' ? ` ${d.note}` : '';
      return `${pre}${inner}${note}`.trim();
    })
    .filter(Boolean);
  return parts.length ? parts.join(', ') : undefined;
}

function crOf(raw: unknown): string | undefined {
  if (typeof raw === 'string') return raw;
  if (isObject(raw) && typeof raw.cr === 'string') return raw.cr;
  return undefined;
}

function stringRecord(raw: unknown): Record<string, string> | undefined {
  if (!isObject(raw)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) if (typeof v === 'string') out[k] = v;
  return Object.keys(out).length ? out : undefined;
}

/** A named block of a stat block (trait, action…) as a run-in item. */
function items(raw: unknown): Entry[] {
  return asArray(raw)
    .filter(isObject)
    .map((b) => ({
      type: 'item' as const,
      name: typeof b.name === 'string' ? b.name : '',
      entries: normalizeEntries(b.entries),
    }));
}

const ORDINAL = ['Cantrips', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

function spellNames(raw: unknown): string[] {
  return asArray(raw)
    .map((s) =>
      typeof s === 'string' ? s : isObject(s) && typeof s.entry === 'string' ? s.entry : '',
    )
    .filter(Boolean);
}

/** `{ "2e": [...] }` → `2/Day Each: …`. */
function perDay(key: string, list: string[]): string {
  const each = key.endsWith('e');
  return `${key.replace(/e$/, '')}/Day${each ? ' Each' : ''}: ${list.join(', ')}`;
}

/** A spellcasting block as one item: its header, the spells by frequency, its footer. */
function spellcastingItem(sc: RawObject): Entry {
  const hidden = new Set(strArray(sc.hidden));
  const lines: string[] = [];
  const will = spellNames(sc.will);
  if (will.length && !hidden.has('will')) lines.push(`At Will: ${will.join(', ')}`);
  for (const key of ['rest', 'daily', 'weekly', 'monthly', 'yearly'] as const) {
    if (hidden.has(key) || !isObject(sc[key])) continue;
    for (const [k, v] of Object.entries(sc[key] as RawObject).sort(([a], [b]) =>
      b.localeCompare(a),
    )) {
      const list = spellNames(v);
      if (!list.length) continue;
      lines.push(
        key === 'daily'
          ? perDay(k, list)
          : `${k.replace(/e$/, '')}/${cap(key)}: ${list.join(', ')}`,
      );
    }
  }
  if (isObject(sc.spells) && !hidden.has('spells')) {
    for (const [level, v] of Object.entries(sc.spells)) {
      if (!isObject(v)) continue;
      const list = spellNames(v.spells);
      const slots = num(v.slots);
      const label = ORDINAL[Number(level)] ?? level;
      if (list.length)
        lines.push(`${label}${slots !== undefined ? ` (${slots} slots)` : ''}: ${list.join(', ')}`);
    }
  }
  return {
    type: 'item',
    name: typeof sc.name === 'string' ? sc.name : 'Spellcasting',
    entries: [
      ...normalizeEntries(sc.headerEntries),
      ...(lines.length ? [{ type: 'list' as const, style: 'none' as const, items: lines }] : []),
      ...normalizeEntries(sc.footerEntries),
    ],
  };
}

const SECTIONS = [
  { key: 'trait', name: 'Traits' },
  { key: 'action', name: 'Actions' },
  { key: 'bonus', name: 'Bonus Actions' },
  { key: 'reaction', name: 'Reactions' },
  { key: 'legendary', name: 'Legendary Actions' },
  { key: 'mythic', name: 'Mythic Actions' },
] as const;

/** Traits, actions, bonus actions, reactions…: each a named section of run-in items. */
function statBlockEntries(raw: RawEntity): Entry[] {
  const bySection = new Map<string, Entry[]>();
  for (const { key } of SECTIONS) {
    const header = normalizeEntries(raw[`${key}Header`]);
    bySection.set(key, [...header, ...items(raw[key])]);
  }
  for (const sc of asArray(raw.spellcasting).filter(isObject)) {
    const where = typeof sc.displayAs === 'string' ? sc.displayAs : 'trait';
    (bySection.get(where) ?? bySection.get('trait'))?.push(spellcastingItem(sc));
  }
  const out: Entry[] = normalizeEntries(raw.entries);
  for (const { key, name } of SECTIONS) {
    const list = bySection.get(key) ?? [];
    if (list.some((e) => typeof e !== 'string')) out.push({ type: 'entries', name, entries: list });
  }
  return out;
}

export function convertCreature(raw: RawEntity, ctx: ConvertContext): Creature {
  const abilities = Object.fromEntries(ABILITIES.map((a) => [a, num(raw[a]) ?? 10])) as Record<
    Ability,
    number
  >;
  const type = raw.type;
  const creature: Creature = {
    ...baseFields(raw, 'creature', nameSourceId(String(raw.name), String(raw.source)), ctx, {
      reprintId: (uid) => uidToId.nameSource(uid, CREATURE_TAG_SOURCE),
      reprintTag: 'creature',
      variantOfId: nameSourceId,
    }),
    size: strArray(raw.size).filter((s): s is Size => SIZES.has(s)),
    creatureType: typeName(type),
    ac: acOf(raw.ac),
    hp: hpOf(raw.hp),
    speed: speedOf(raw.speed),
    abilities,
    senses: strArray(raw.senses),
    languages: strArray(raw.languages),
  };
  creature.entries = statBlockEntries(raw);

  if (isObject(type)) {
    const tags = asArray(type.tags)
      .map((t) => (typeof t === 'string' ? t : isObject(t) ? str(t.tag) : undefined))
      .filter((t): t is string => !!t);
    if (tags.length) creature.typeTags = tags;
    if (type.swarmSize !== undefined) creature.swarm = true;
  }
  const alignment = asArray(raw.alignment).flatMap((a) =>
    typeof a === 'string' ? [a] : isObject(a) && typeof a.special === 'string' ? [a.special] : [],
  );
  if (alignment.length) creature.alignment = alignment;
  const saves = stringRecord(raw.save) as Creature['saves'];
  if (saves) creature.saves = saves;
  const skills = stringRecord(raw.skill);
  if (skills) creature.skills = skills;
  const passive = num(raw.passive);
  if (passive !== undefined) creature.passive = passive;
  const cr = crOf(raw.cr);
  if (cr !== undefined) creature.cr = cr;

  // 2024 stat blocks give initiative as proficiency in it; the bonus is worked out here.
  const dexMod = abilityModifier(abilities.dex);
  const crNumber = crValue(cr);
  if (typeof raw.initiative === 'number') creature.initiative = raw.initiative;
  else if (isObject(raw.initiative) && typeof raw.initiative.initiative === 'number')
    creature.initiative = raw.initiative.initiative;
  else {
    const prof = isObject(raw.initiative) ? (num(raw.initiative.proficiency) ?? 0) : 0;
    const pb = crNumber !== undefined ? crProficiency(crNumber) : 0;
    creature.initiative = dexMod + prof * pb;
  }

  const defenses: NonNullable<Creature['defenses']> = {};
  for (const key of ['vulnerable', 'resist', 'immune', 'conditionImmune'] as const) {
    const text = defenseText(raw[key], key);
    if (text) defenses[key] = text;
  }
  if (Object.keys(defenses).length) creature.defenses = defenses;
  if (typeof raw.pbNote === 'string') creature.pbNote = raw.pbNote;

  const summon: NonNullable<Creature['summon']> = {};
  if (typeof raw.summonedBySpell === 'string')
    summon.spellId = uidToId.nameSource(raw.summonedBySpell, 'PHB');
  const spellLevel = num(raw.summonedBySpellLevel);
  if (spellLevel !== undefined) summon.spellLevel = spellLevel;
  if (typeof raw.summonedByClass === 'string') summon.classId = uidToId.class(raw.summonedByClass);
  if (Object.keys(summon).length) creature.summon = summon;
  if (raw.familiar === true) creature.familiar = true;
  return creature;
}
