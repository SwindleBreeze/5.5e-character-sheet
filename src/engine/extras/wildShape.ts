// Wild Shape forms (plan §10.3, step 7.6). The feature that gives the `wild-shape` switch
// carries a table of known forms, maximum CR and Fly Speed by class level; a feature may raise
// the maximum CR to the class level divided by a number (Circle Forms). The forms a druid knows
// are play state, like prepared spells. In a form the sheet shows the Beast next to what the
// druid keeps; nothing is replaced.

import { crValue, type Character, type Creature, type Entry, type Id } from '../../schema/index.ts';
import { stripTags } from '../../richtext/tagRegistry.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import type { DerivedSheet, DerivedToggle } from '../derive/types.ts';

/** The switch every Wild Shape mapping uses (`featureEffects/core/druid.ts`). */
export const WILD_SHAPE = 'wild-shape';

export interface WildShapeRules {
  toggle: DerivedToggle;
  /** The class the limits go by, and its level. */
  className?: string;
  level: number;
  /** How many forms can be known; undefined when the feature has no table. */
  known?: number;
  maxCr?: number;
  /** Forms with a Fly Speed are allowed. */
  fly: boolean;
  /** Temporary HP gained on taking a form, as the switch's outcome says (`7`, `1d10 + 3`). */
  tempHp?: string;
}

type Table = Extract<Entry, { type: 'table' }>;

function tables(entries: readonly Entry[]): Table[] {
  const out: Table[] = [];
  for (const e of entries) {
    if (typeof e === 'string') continue;
    if (e.type === 'table') out.push(e);
    else if (e.type === 'list') out.push(...tables(e.items));
    else if ('entries' in e) out.push(...tables(e.entries));
  }
  return out;
}

const cellText = (cell: Entry | undefined) =>
  typeof cell === 'string' ? stripTags(cell).trim() : '';

/** Known forms, maximum CR and Fly Speed at a class level, from a "Known Forms / Max CR" table. */
export function formsTableAt(
  entries: readonly Entry[],
  level: number,
): { known?: number; maxCr?: number; fly: boolean } | undefined {
  for (const t of tables(entries)) {
    const labels = t.colLabels.map((l) => stripTags(l).toLowerCase());
    const knownCol = labels.findIndex((l) => l.includes('known forms'));
    const crCol = labels.findIndex((l) => /\bmax(imum)? cr\b/.test(l));
    if (knownCol < 0 || crCol < 0) continue;
    const flyCol = labels.findIndex((l) => l.includes('fly'));
    const row = t.rows.filter((r) => Number(cellText(r[0])) <= level).at(-1);
    if (!row) return { fly: false };
    const known = Number(cellText(row[knownCol]));
    const maxCr = crValue(cellText(row[crCol]));
    return {
      ...(Number.isFinite(known) ? { known } : {}),
      ...(maxCr !== undefined ? { maxCr } : {}),
      fly: flyCol >= 0 && /^yes/i.test(cellText(row[flyCol])),
    };
  }
  return undefined;
}

const RAISED_CR = /maximum Challenge Rating for the form equals your (\w+) level divided by (\d+)/i;

/** The Wild Shape limits for this character, or undefined without the switch. */
export function wildShapeRules(
  sheet: DerivedSheet,
  index: ContentIndex,
): WildShapeRules | undefined {
  const toggle = sheet.toggles.find((t) => t.toggleId === WILD_SHAPE);
  if (!toggle) return undefined;
  const feature = index.get(toggle.source);
  const classId =
    feature && (feature.kind === 'classFeature' || feature.kind === 'subclassFeature')
      ? feature.classId
      : undefined;
  const cls = sheet.classes.find((c) => c.classId === classId);
  const level = cls?.level ?? sheet.charLevel;
  const rules: WildShapeRules = { toggle, level, fly: false };
  if (cls) rules.className = cls.name;
  const table = feature ? formsTableAt(feature.entries, level) : undefined;
  if (table) Object.assign(rules, table);

  // A feature that raises the maximum CR by level (Circle Forms).
  for (const f of sheet.features) {
    const text = stripTags(JSON.stringify(index.get(f.ref)?.entries ?? []));
    const m = RAISED_CR.exec(text);
    if (!m) continue;
    const by = sheet.classes.find((c) => c.name.toLowerCase() === m[1]?.toLowerCase());
    if (by) rules.maxCr = Math.max(rules.maxCr ?? 0, Math.floor(by.level / Number(m[2])));
  }
  const temp = toggle.onActivate.find((o) => 'tempHp' in o);
  if (temp && 'tempHp' in temp) rules.tempHp = temp.tempHp;
  return rules;
}

/** Why a creature can't be a known form, or undefined when it can. */
export function formIssue(c: Creature, rules: WildShapeRules): string | undefined {
  if (c.creatureType !== 'beast') return 'Not a Beast';
  if (c.swarm) return 'A swarm';
  const cr = crValue(c.cr);
  if (rules.maxCr !== undefined && (cr === undefined || cr > rules.maxCr))
    return cr === undefined ? 'No challenge rating' : `CR ${c.cr} is over ${crText(rules.maxCr)}`;
  if (!rules.fly && c.speed.some((s) => s.mode === 'fly')) return 'Has a Fly Speed';
  return undefined;
}

/** 0.25 → `1/4`. */
export function crText(cr: number): string {
  if (cr >= 1 || cr === 0) return String(cr);
  const inverse = Math.round(1 / cr);
  return `1/${inverse}`;
}

export function setWildShapeForms(c: Character, ids: readonly Id[]): Character {
  const n = structuredClone(c);
  n.wildShapeForms = [...new Set(ids)];
  return n;
}

/** The form taken, while Wild Shape is on. */
export function activeForm(c: Character): Id | undefined {
  return c.state.activeToggles[WILD_SHAPE]?.option;
}

/** Say which form, when Wild Shape was switched on without one (from the Actions tab). */
export function setActiveForm(c: Character, id: Id): Character {
  if (!c.state.activeToggles[WILD_SHAPE]) return c;
  const n = structuredClone(c);
  n.state.activeToggles[WILD_SHAPE] = { option: id };
  return n;
}
