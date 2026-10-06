// Character origins: backgrounds, feats and species.

import {
  classId,
  nameSourceId,
  type Background,
  type Feat,
  type Prereq,
  type Prereqs,
  type Size,
  type Species,
} from '../../../schema/index.ts';
import {
  abilityEffects,
  defenseEffects,
  effectsFromData,
  featCategory,
  featEffects,
  featProgressions,
  optionalFeatureProgressions,
  progressionEffects,
  proficiencyEffects,
  senseEffects,
  speedEffects,
  speedOf,
  spellEffects,
  weightedAbilityOptions,
} from '../effectsFromData.ts';
import { asArray, isObject, num, strArray, type RawEntity, type RawObject } from '../raw.ts';
import { uidToId } from '../uid.ts';
import { equipmentOptions } from './class.ts';
import { baseFields, type ConvertContext } from './common.ts';

const nameSource = (defaultSource: string) => (uid: string) =>
  uidToId.nameSource(uid, defaultSource);

export function convertBackground(raw: RawEntity, ctx: ConvertContext): Background {
  const bg: Background = {
    ...baseFields(raw, 'background', nameSourceId(String(raw.name), String(raw.source)), ctx, {
      reprintId: nameSource('PHB'),
      reprintTag: 'background',
      variantOfId: nameSourceId,
    }),
    abilityOptions: weightedAbilityOptions(raw),
    equipment: equipmentOptions(raw.startingEquipment),
  };
  const fixedFeat = asArray(raw.feats)
    .filter(isObject)
    .flatMap((set) =>
      Object.entries(set)
        .filter(([, v]) => v === true)
        .map(([k]) => k),
    )[0];
  if (fixedFeat) bg.featId = uidToId.nameSource(fixedFeat, 'PHB');
  bg.effects = [
    ...abilityEffects(raw),
    ...proficiencyEffects(raw),
    ...featEffects(raw),
    ...spellEffects(raw),
  ];
  return bg;
}

/** One 5etools prerequisite object (all of its keys must hold). */
function prereqGroup(raw: RawObject): Prereq[] {
  const out: Prereq[] = [];
  for (const [key, value] of Object.entries(raw)) {
    switch (key) {
      case 'level': {
        if (typeof value === 'number') out.push({ type: 'level', level: value });
        else if (isObject(value)) {
          const p: Prereq = { type: 'level', level: num(value.level) ?? 1 };
          const cls = value.class;
          if (isObject(cls) && typeof cls.name === 'string') {
            p.classId = classId(cls.name, typeof cls.source === 'string' ? cls.source : 'PHB');
          }
          out.push(p);
        }
        break;
      }
      case 'ability':
        out.push({
          type: 'ability',
          anyOf: asArray(value)
            .filter(isObject)
            .map((o) =>
              Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v === 'number')),
            ),
        });
        break;
      case 'proficiency':
        for (const p of asArray(value).filter(isObject)) {
          for (const [category, v] of Object.entries(p)) {
            if (typeof v === 'string') out.push({ type: 'proficiency', category, value: v });
          }
        }
        break;
      case 'spellcasting':
      case 'spellcasting2020':
      case 'spellcastingFeature':
      case 'spellcastingPrepared':
        if (value === true) out.push({ type: 'spellcasting' });
        break;
      case 'feat':
        for (const f of strArray(value)) {
          out.push({
            type: 'feat',
            ref: { kind: 'feat', id: uidToId.nameSource(f.split('#')[0] ?? f, 'PHB') },
          });
        }
        break;
      case 'optionalfeature':
        for (const f of strArray(value)) {
          out.push({
            type: 'feature',
            ref: { kind: 'optionalFeature', id: uidToId.nameSource(f, 'PHB') },
          });
        }
        break;
      case 'feature':
        for (const f of strArray(value)) out.push({ type: 'other', text: `Feature: ${f}` });
        break;
      case 'other':
      case 'otherSummary':
        if (typeof value === 'string') out.push({ type: 'other', text: value });
        else if (isObject(value) && typeof value.entrySummary === 'string') {
          out.push({ type: 'other', text: value.entrySummary });
        }
        break;
      case 'membership':
        out.push({ type: 'other', text: `Membership in the ${joinOr(strArray(value))}` });
        break;
      case 'spellcastingFocus':
        out.push({ type: 'other', text: spellcastingFocusText(value) });
        break;
      case 'expertise':
        for (const e of asArray(value).filter(isObject)) {
          const skill = e.skill;
          out.push({
            type: 'other',
            text:
              skill === true ? 'Expertise in a skill' : `Expertise in ${titleCase(String(skill))}`,
          });
        }
        break;
      case 'race': {
        const names = asArray(value)
          .filter(isObject)
          .map((r) =>
            typeof r.displayEntry === 'string'
              ? r.displayEntry
              : `${titleCase(String(r.name))}${typeof r.subrace === 'string' ? ` (${r.subrace})` : ''}`,
          );
        out.push({ type: 'other', text: joinOr(names) });
        break;
      }
      case 'note':
        break;
      default:
        out.push({ type: 'other', text: `${key}: ${describe(value)}` });
    }
  }
  return out;
}

function titleCase(s: string): string {
  return s.replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, c: string) => sep + c.toUpperCase());
}

/** `a`, `a or b`, `a, b, or c`. */
function joinOr(values: string[]): string {
  if (values.length <= 2) return values.join(' or ');
  return `${values.slice(0, -1).join(', ')}, or ${values.at(-1)}`;
}

const FOCUS_ITEMS: Record<string, string> = {
  arcane: 'Arcane Focus',
  druid: 'Druidic Focus',
  holy: 'Holy Symbol',
  artisansTool: "Artisan's Tools",
};

/** As 5etools words it: "Ability to use an Arcane Focus or tool as a Spellcasting Focus". */
function spellcastingFocusText(value: unknown): string {
  const focus = '{@variantrule Spellcasting Focus|XPHB}';
  if (!Array.isArray(value)) return `Ability to use a ${focus}`;
  const names = strArray(value).map((v) => {
    const item = FOCUS_ITEMS[v];
    return item ? `{@item ${item}|XPHB}` : v;
  });
  const first = strArray(value)[0] ?? '';
  const article = /^[aeiou]/i.test(FOCUS_ITEMS[first] ?? first) ? 'an' : 'a';
  return `Ability to use ${article} ${joinOr(names)} as a ${focus}`;
}

function describe(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  if (Array.isArray(value)) return value.map(describe).join(', ');
  if (isObject(value)) {
    if (typeof value.entrySummary === 'string') return value.entrySummary;
    if (typeof value.entry === 'string') return value.entry;
    if (typeof value.name === 'string') return value.name;
    return Object.entries(value)
      .map(([k, v]) => `${k} ${describe(v)}`)
      .join(', ');
  }
  return '';
}

/** `prerequisite`: an array of alternatives, each an object of requirements. */
export function prerequisites(raw: RawEntity): Prereqs {
  return asArray(raw.prerequisite).filter(isObject).map(prereqGroup);
}

export function convertFeat(raw: RawEntity, ctx: ConvertContext): Feat {
  const featProg = featProgressions(raw);
  const optProg = optionalFeatureProgressions(raw);
  const feat: Feat = {
    ...baseFields(raw, 'feat', nameSourceId(String(raw.name), String(raw.source)), ctx, {
      reprintId: nameSource('PHB'),
      reprintTag: 'feat',
      variantOfId: nameSourceId,
    }),
    category: featCategory(typeof raw.category === 'string' ? raw.category : ''),
    prerequisites: prerequisites(raw),
    repeatable: raw.repeatable === true,
  };
  feat.effects = [...effectsFromData(raw), ...progressionEffects(featProg, optProg)];
  return feat;
}

const SIZES = new Set<string>(['T', 'S', 'M', 'L', 'H', 'G']);

export function convertSpecies(raw: RawEntity, ctx: ConvertContext): Species {
  const species: Species = {
    ...baseFields(raw, 'species', nameSourceId(String(raw.name), String(raw.source)), ctx, {
      reprintId: nameSource('PHB'),
      reprintTag: 'race',
      variantOfId: nameSourceId,
    }),
    size: strArray(raw.size).filter((s): s is Size => SIZES.has(s)),
    speed: speedOf(raw),
    creatureType: strArray(raw.creatureTypes)[0] ?? 'humanoid',
  };
  species.effects = [
    ...speedEffects(raw),
    ...senseEffects(raw),
    ...defenseEffects(raw),
    ...abilityEffects(raw),
    ...proficiencyEffects(raw),
    ...featEffects(raw),
    ...spellEffects(raw),
  ];
  if (species.size.length > 1) {
    species.effects.unshift({
      type: 'optionChoice',
      choice: { slot: 'size', count: 1, from: species.size },
      labels: species.size,
    });
  }
  return species;
}
