// What each inline tag means (plan §6.4): entity tags open a rule sheet, roll tags render as
// dice (tapped to roll since step 3.22), formatting tags format, and everything else shows its
// text.

import type { EntityKind, Ref, RuleKind } from '../schema/index.ts';
import {
  classFeatureId,
  classId,
  DEFAULT_PANTHEON,
  deityId,
  nameSourceId,
  ruleId,
  subclassFeatureId,
  subclassId,
} from '../schema/ids.ts';
import { parseRoll, RollError } from '../engine/dice/roll.ts';
import { tokenize, type TagToken } from './parseTags.ts';

export type TagCategory = 'entity' | 'roll' | 'format' | 'text';

export type Formatting =
  'bold' | 'italic' | 'underline' | 'strike' | 'sup' | 'sub' | 'code' | 'note' | 'plain';

interface EntityTag {
  kind: EntityKind;
  ruleKind?: RuleKind;
  /** Default source when the tag omits it (5etools convention). */
  defaultSource: string;
}

/** Tags that link to an entity we can import. */
const ENTITY_TAGS: Record<string, EntityTag> = {
  spell: { kind: 'spell', defaultSource: 'PHB' },
  item: { kind: 'item', defaultSource: 'DMG' },
  class: { kind: 'class', defaultSource: 'PHB' },
  subclass: { kind: 'subclass', defaultSource: 'PHB' },
  classFeature: { kind: 'classFeature', defaultSource: 'PHB' },
  subclassFeature: { kind: 'subclassFeature', defaultSource: 'PHB' },
  background: { kind: 'background', defaultSource: 'PHB' },
  feat: { kind: 'feat', defaultSource: 'PHB' },
  race: { kind: 'species', defaultSource: 'PHB' },
  optfeature: { kind: 'optionalFeature', defaultSource: 'PHB' },
  condition: { kind: 'rule', ruleKind: 'condition', defaultSource: 'PHB' },
  disease: { kind: 'rule', ruleKind: 'disease', defaultSource: 'DMG' },
  status: { kind: 'rule', ruleKind: 'status', defaultSource: 'PHB' },
  variantrule: { kind: 'rule', ruleKind: 'variantrule', defaultSource: 'DMG' },
  action: { kind: 'rule', ruleKind: 'action', defaultSource: 'PHB' },
  sense: { kind: 'rule', ruleKind: 'sense', defaultSource: 'PHB' },
  skill: { kind: 'rule', ruleKind: 'skill', defaultSource: 'PHB' },
  language: { kind: 'rule', ruleKind: 'language', defaultSource: 'PHB' },
  itemProperty: { kind: 'rule', ruleKind: 'itemProperty', defaultSource: 'PHB' },
  itemMastery: { kind: 'rule', ruleKind: 'mastery', defaultSource: 'XPHB' },
  deity: { kind: 'deity', defaultSource: 'PHB' },
  reward: { kind: 'reward', defaultSource: 'DMG' },
  facility: { kind: 'facility', defaultSource: 'XDMG' },
  charoption: { kind: 'charOption', defaultSource: 'MOT' },
  creature: { kind: 'creature', defaultSource: 'MM' },
};

/** Default source per 5etools tag, for tags that refer to entities by `name|source`. */
export function defaultSourceForTag(tag: string): string | undefined {
  return ENTITY_TAGS[tag]?.defaultSource;
}

const ROLL_TAGS = new Set([
  'dice',
  'damage',
  'd20',
  'hit',
  'chance',
  'recharge',
  'scaledice',
  'scaledamage',
  'autodice',
  'coinflip',
  'savingThrow',
  'skillCheck',
  'ability',
]);

const FORMAT_TAGS: Record<string, Formatting> = {
  b: 'bold',
  bold: 'bold',
  i: 'italic',
  italic: 'italic',
  u: 'underline',
  underline: 'underline',
  s: 'strike',
  strike: 'strike',
  s2: 'strike',
  strikeDouble: 'strike',
  sup: 'sup',
  sub: 'sub',
  kbd: 'code',
  code: 'code',
  note: 'note',
  tip: 'note',
  style: 'plain',
  font: 'plain',
  color: 'plain',
  highlight: 'plain',
  help: 'plain',
  unit: 'plain',
};

/** Fixed labels for structural tags used in stat-block style text. */
const LABEL_TAGS: Record<string, string> = {
  h: 'Hit: ',
  m: 'Miss: ',
  hom: 'Hit or Miss: ',
  actSaveFail: 'Failure: ',
  actSaveSuccess: 'Success: ',
  actSaveSuccessOrFail: 'Failure or Success: ',
  actTrigger: 'Trigger: ',
  actResponse: 'Response: ',
};

/** Which part holds the display text, where it is not the third (index 2). */
const DISPLAY_INDEX: Record<string, number> = {
  subclass: 4,
  classFeature: 5,
  subclassFeature: 7,
  deity: 3,
  card: 3,
  quickref: 4,
};

/** Tags whose first part is the display text. */
const FIRST_PART_TAGS = new Set([
  'filter',
  'book',
  'adventure',
  '5etools',
  'link',
  'area',
  'loader',
  'footnote',
  'homebrew',
]);

const ABILITY_NAMES: Record<string, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
};

const ATTACK_LABELS: Record<string, string> = {
  mw: 'Melee Weapon Attack:',
  rw: 'Ranged Weapon Attack:',
  'mw,rw': 'Melee or Ranged Weapon Attack:',
  ms: 'Melee Spell Attack:',
  rs: 'Ranged Spell Attack:',
  'ms,rs': 'Melee or Ranged Spell Attack:',
  m: 'Melee Attack Roll:',
  r: 'Ranged Attack Roll:',
  'm,r': 'Melee or Ranged Attack Roll:',
};

export function tagCategory(tag: string): TagCategory {
  if (tag in ENTITY_TAGS) return 'entity';
  if (ROLL_TAGS.has(tag)) return 'roll';
  if (tag in FORMAT_TAGS || tag in LABEL_TAGS || tag === 'dc' || tag.startsWith('atk')) {
    return 'format';
  }
  if (tag.startsWith('act')) return 'format';
  return 'text';
}

export function tagFormatting(tag: string): Formatting {
  return FORMAT_TAGS[tag] ?? 'plain';
}

function part(token: TagToken, index: number): string | undefined {
  const value = token.parts[index]?.trim();
  return value ? value : undefined;
}

function signed(value: string): string {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && !value.startsWith('+') ? `+${value}` : value;
}

/**
 * What tapping a roll tag rolls: `{@dice 2d6 + 3}` and `{@damage 1d8}` their dice, `{@hit 5}`
 * and `{@d20 -1}` a d20 with that bonus. Nothing for tags that aren't plain dice (scaling dice,
 * chances, recharges).
 */
export function tagRollExpr(token: TagToken): string | undefined {
  const first = part(token, 0);
  if (!first) return undefined;
  let expr: string | undefined;
  if (token.tag === 'dice' || token.tag === 'damage' || token.tag === 'autodice') expr = first;
  if (token.tag === 'hit' || token.tag === 'd20') {
    const n = Number(first);
    if (!Number.isInteger(n)) return undefined;
    expr = n ? `1d20${n < 0 ? '-' : '+'}${Math.abs(n)}` : '1d20';
  }
  if (!expr) return undefined;
  try {
    parseRoll(expr);
    return expr;
  } catch (err) {
    if (err instanceof RollError) return undefined;
    throw err;
  }
}

/** The text a tag shows, before any nested tags in it are resolved. */
export function tagDisplay(token: TagToken): string {
  const { tag } = token;
  const first = part(token, 0) ?? '';

  if (tag in LABEL_TAGS) return LABEL_TAGS[tag] ?? '';
  if (tag in FORMAT_TAGS) return token.parts[0] ?? '';
  if (FIRST_PART_TAGS.has(tag)) return first;

  switch (tag) {
    case 'dc':
      return `DC ${part(token, 1) ?? first}`;
    case 'dcYourSpellSave':
      return part(token, 0) ?? 'your spell save DC';
    case 'hit':
    case 'd20':
      return part(token, 1) ?? signed(first);
    case 'dice':
    case 'damage':
    case 'autodice':
      return part(token, 1) ?? first;
    case 'chance':
      return part(token, 1) ?? `${first} percent`;
    case 'recharge':
      return first && first !== '6' ? `(Recharge ${first}–6)` : '(Recharge 6)';
    case 'scaledice':
    case 'scaledamage':
      return part(token, 4) ?? part(token, 2) ?? first;
    case 'coinflip':
      return first || 'flip a coin';
    case 'ability': {
      const [ab, score] = first.split(/\s+/);
      const n = Number(score);
      if (!ab || !Number.isFinite(n)) return first;
      const mod = Math.floor((n - 10) / 2);
      return `${n} (${mod >= 0 ? '+' : ''}${mod})`;
    }
    case 'savingThrow':
    case 'skillCheck': {
      const bonus = first.split(/\s+/)[1];
      return bonus ? signed(bonus) : first;
    }
    case 'atk':
    case 'atkr':
      return ATTACK_LABELS[first] ?? first;
    case 'actSave':
      return `${ABILITY_NAMES[first] ?? first} Saving Throw:`;
    case 'actSaveFailBy':
      return `Failure by ${first} or More: `;
  }

  const display = part(token, DISPLAY_INDEX[tag] ?? 2);
  if (display) return display;
  // `{@variantrule Sphere [Area of Effect]|XPHB}` shows as "Sphere".
  if (tag === 'variantrule') return first.replace(/\s*\[[^\]]*\]\s*$/, '');
  return first;
}

/** Plain display text of a tagged string, with all tags (nested too) resolved. */
export function stripTags(input: string): string {
  if (!input.includes('{@')) return input;
  return tokenize(input)
    .map((t) => (t.type === 'text' ? t.text : stripTags(tagDisplay(t))))
    .join('');
}

/** The entity a tag links to, or null for non-entity tags. */
export function refFromTag(token: TagToken): Ref | null {
  const info = ENTITY_TAGS[token.tag];
  if (!info) return null;
  const name = part(token, 0);
  if (!name) return null;
  const src = (index: number, fallback = info.defaultSource) => part(token, index) ?? fallback;

  switch (info.kind) {
    case 'class':
      return { kind: 'class', id: classId(name, src(1)) };
    case 'subclass':
      // shortName|className|classSource|source
      return {
        kind: 'subclass',
        id: subclassId(name, part(token, 1) ?? '', src(2), src(3)),
      };
    case 'classFeature': {
      // name|className|classSource|level|source
      const classSource = src(2);
      return {
        kind: 'classFeature',
        id: classFeatureId(
          name,
          part(token, 1) ?? '',
          classSource,
          Number(part(token, 3)),
          src(4, classSource),
        ),
      };
    }
    case 'subclassFeature': {
      // name|className|classSource|subclassShortName|subclassSource|level|source
      const subclassSource = src(4);
      return {
        kind: 'subclassFeature',
        id: subclassFeatureId(
          name,
          part(token, 1) ?? '',
          src(2),
          part(token, 3) ?? '',
          subclassSource,
          Number(part(token, 5)),
          src(6, subclassSource),
        ),
      };
    }
    case 'deity':
      // name|pantheon|source
      return { kind: 'deity', id: deityId(name, part(token, 1) ?? DEFAULT_PANTHEON, src(2)) };
    case 'rule':
      return { kind: 'rule', id: ruleId(info.ruleKind ?? 'variantrule', name, src(1)) };
    default:
      return { kind: info.kind, id: nameSourceId(name, src(1)) };
  }
}
