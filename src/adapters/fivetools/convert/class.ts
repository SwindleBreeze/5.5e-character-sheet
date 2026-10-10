// Classes, subclasses and their features.

import {
  ABILITIES,
  classFeatureId,
  classId,
  subclassFeatureId,
  subclassId,
  type Ability,
  type ChoiceSlot,
  type ClassDef,
  type ClassFeature,
  type ClassSpellcasting,
  type Effect,
  type Entry,
  type EntityKind,
  type EquipmentItemGrant,
  type EquipmentOption,
  type SpellGrant,
  type Subclass,
  type SubclassFeature,
} from '../../../schema/index.ts';
import { stripTags, tokenize } from '../../../richtext/index.ts';
import {
  featProgressions,
  optionalFeatureProgressions,
  progressionEffects,
  spellEffects,
} from '../effectsFromData.ts';
import { asArray, isObject, num, strArray, type RawEntity } from '../raw.ts';
import { parseTableGroups } from '../tableKeys.ts';
import { parseClassFeatureUid, parseSubclassFeatureUid, uidToId } from '../uid.ts';
import { baseFields, consumesOf, editionOf, type ConvertContext } from './common.ts';

const ABILITY_SET = new Set<string>(ABILITIES);

/** `[{str: true}, {dex: true}]` → `[['str'], ['dex']]` (any-of groups of all-of). */
function abilityGroups(raw: unknown): Ability[][] {
  return asArray(raw)
    .filter(isObject)
    .map((g) => Object.keys(g).filter((k): k is Ability => ABILITY_SET.has(k) && g[k] !== false))
    .filter((g) => g.length > 0);
}

/** Multiclass requirements: explicit (2014) or the 2024 rule, primary ability 13+. */
function multiclassPrereq(raw: RawEntity): Ability[][] {
  const mc = isObject(raw.multiclassing) ? raw.multiclassing : {};
  const req = isObject(mc.requirements) ? mc.requirements : null;
  if (req) {
    if (Array.isArray(req.or)) {
      return req.or.filter(isObject).flatMap((o) =>
        Object.keys(o)
          .filter((k) => ABILITY_SET.has(k))
          .map((k) => [k as Ability]),
      );
    }
    const all = Object.keys(req).filter((k): k is Ability => ABILITY_SET.has(k));
    if (all.length) return [all];
  }
  return abilityGroups(raw.primaryAbility);
}

/** A proficiency string: a lone `{@item}` tag becomes an item id, other text is lowercased. */
function profString(value: string): string {
  const tokens = tokenize(value.trim());
  const only = tokens.length === 1 ? tokens[0] : undefined;
  if (only?.type === 'tag' && only.tag === 'item') {
    return uidToId.nameSource(only.content, 'DMG');
  }
  return stripTags(value).toLowerCase().trim();
}

function skillChoice(raw: unknown, slot: string): ChoiceSlot<string> | undefined {
  for (const set of asArray(raw)) {
    if (!isObject(set)) continue;
    if (isObject(set.choose)) {
      return { slot, count: num(set.choose.count) ?? 1, from: strArray(set.choose.from) };
    }
    const any = num(set.any);
    if (any !== undefined) return { slot, count: any, from: 'any' };
  }
  return undefined;
}

/** Proficiencies as names; a 2014 one with a note (`{proficiency, full}`) by its name. */
function profList(raw: unknown): string[] {
  return asArray(raw)
    .map((v) => (isObject(v) && typeof v.proficiency === 'string' ? v.proficiency : v))
    .filter((v): v is string => typeof v === 'string')
    .map(profString);
}

function profGroup(raw: unknown, skillSlot: string) {
  const p = isObject(raw) ? raw : {};
  const out: ClassDef['startingProficiencies'] = {
    armor: profList(p.armor),
    weapons: profList(p.weapons),
    tools: profList(p.tools),
  };
  const skills = skillChoice(p.skills, skillSlot);
  if (skills) out.skills = skills;
  return out;
}

function equipmentItem(raw: unknown): { grant?: EquipmentItemGrant; valueCp?: number } {
  if (typeof raw === 'string')
    return { grant: { itemId: uidToId.nameSource(raw, 'PHB'), quantity: 1 } };
  if (!isObject(raw)) return {};
  const quantity = num(raw.quantity) ?? 1;
  if (typeof raw.item === 'string') {
    const grant: EquipmentItemGrant = { itemId: uidToId.nameSource(raw.item, 'PHB'), quantity };
    if (typeof raw.displayName === 'string') grant.special = raw.displayName;
    return { grant };
  }
  if (typeof raw.special === 'string') return { grant: { special: raw.special, quantity } };
  if (typeof raw.equipmentType === 'string') {
    return { grant: { special: `Any ${raw.equipmentType}`, quantity } };
  }
  const value = num(raw.value);
  if (value !== undefined) return { valueCp: value };
  return {};
}

/** `startingEquipment` of classes and backgrounds: `{A: [...], B: [...]}` per group. */
export function equipmentOptions(raw: unknown): EquipmentOption[] {
  const groups = isObject(raw) && Array.isArray(raw.defaultData) ? raw.defaultData : asArray(raw);
  const out: EquipmentOption[] = [];
  groups.filter(isObject).forEach((group, gi) => {
    for (const [key, items] of Object.entries(group)) {
      const option: EquipmentOption = { key, items: [], valueCp: 0 };
      if (groups.length > 1) option.group = gi;
      for (const item of asArray(items)) {
        const { grant, valueCp } = equipmentItem(item);
        if (grant) option.items.push(grant);
        if (valueCp) option.valueCp += valueCp;
      }
      out.push(option);
    }
  });
  return out;
}

const PROGRESSION: Record<string, ClassSpellcasting['progression']> = {
  full: 'full',
  '1/2': 'half',
  '1/3': 'third',
  pact: 'pact',
  artificer: 'artificer',
};

/**
 * Homebrew `classSpells` / `subclassSpells`: spell UIDs (`name|source`, PHB by default) and
 * `{ className, classSource }` for another class's whole list. Spell groups are not read.
 */
function extraSpellList(value: unknown): NonNullable<ClassSpellcasting['listAlso']> {
  const classes: string[] = [];
  const spellIds: string[] = [];
  for (const item of asArray(value)) {
    if (typeof item === 'string') spellIds.push(uidToId.nameSource(item, 'PHB'));
    else if (isObject(item) && typeof item.className === 'string') classes.push(item.className);
  }
  const out: NonNullable<ClassSpellcasting['listAlso']> = {};
  if (classes.length) out.classes = classes;
  if (spellIds.length) out.spellIds = spellIds;
  return out;
}

function spellcasting(raw: RawEntity, listProp: string): ClassSpellcasting | undefined {
  const progression = PROGRESSION[String(raw.casterProgression).toLowerCase()];
  // Homebrew writes the ability in any case ("WIS").
  const ability =
    typeof raw.spellcastingAbility === 'string' ? raw.spellcastingAbility.toLowerCase() : '';
  if (!progression || !ABILITY_SET.has(ability)) return undefined;
  const out: ClassSpellcasting = { ability: ability as Ability, progression };
  const listAlso = extraSpellList(raw[listProp]);
  if (listAlso.classes || listAlso.spellIds) out.listAlso = listAlso;
  const prepared = asArray(raw.preparedSpellsProgression ?? raw.spellsKnownProgression).map(
    (v) => num(v) ?? 0,
  );
  if (prepared.length) out.preparedByLevel = prepared;
  const cantrips = asArray(raw.cantripProgression).map((v) => num(v) ?? 0);
  if (cantrips.length) out.cantripsByLevel = cantrips;
  const spellbook = asArray(raw.spellsKnownProgressionFixed).map((v) => num(v) ?? 0);
  if (spellbook.length) out.spellbookByLevel = spellbook;
  if (raw.preparedSpellsChange === 'level' || raw.preparedSpellsChange === 'restLong') {
    out.preparedChange = raw.preparedSpellsChange;
  }
  if (isObject(raw.spellsKnownProgressionFixedByLevel)) {
    const fixed: Record<number, Record<number, number>> = {};
    for (const [level, bySpellLevel] of Object.entries(raw.spellsKnownProgressionFixedByLevel)) {
      const l = num(level);
      if (l === undefined || !isObject(bySpellLevel)) continue;
      const counts: Record<number, number> = {};
      for (const [spellLevel, n] of Object.entries(bySpellLevel)) {
        const sl = num(spellLevel);
        const count = num(n);
        if (sl !== undefined && count !== undefined) counts[sl] = count;
      }
      fixed[l] = counts;
    }
    if (Object.keys(fixed).length) out.fixedByLevel = fixed;
  }
  return out;
}

/**
 * `type: options` blocks (P14): "choose N of these features". Each block gets slot
 * `options.<i>` in document order. Optional-feature options are skipped, because those
 * choices come from optional-feature progressions instead.
 */
export function optionEffects(entries: Entry[]): Effect[] {
  const out: Effect[] = [];
  let index = 0;
  const visit = (list: Entry[]) => {
    for (const e of list) {
      if (typeof e === 'string') continue;
      if (e.type === 'options') {
        const slot = `options.${index++}`;
        const refs = e.entries.flatMap((x) =>
          typeof x !== 'string' && x.type === 'ref' ? [x.ref] : [],
        );
        const kind = refs[0]?.kind;
        if (kind && kind !== 'optionalFeature' && refs.every((r) => r.kind === kind)) {
          out.push({
            type: 'featureOptions',
            optionKind: kind as EntityKind,
            choice: { slot, count: e.count ?? 1, from: refs.map((r) => r.id) },
          });
        }
        continue;
      }
      if ('entries' in e && Array.isArray(e.entries)) visit(e.entries);
      if (e.type === 'list') visit(e.items);
    }
  };
  visit(entries);
  return out;
}

export function convertClass(raw: RawEntity, ctx: ConvertContext): ClassDef {
  const name = String(raw.name);
  const source = String(raw.source);
  const id = classId(name, source);
  const base = baseFields(raw, 'class', id, ctx, { reprintId: uidToId.class });

  const features = asArray(raw.classFeatures).flatMap((f) => {
    const uid =
      typeof f === 'string'
        ? f
        : isObject(f) && typeof f.classFeature === 'string'
          ? f.classFeature
          : null;
    if (!uid) return [];
    const u = parseClassFeatureUid(uid);
    return [
      {
        level: u.level,
        featureId: classFeatureId(u.name, u.className, u.classSource, u.level, u.source),
        gainSubclassFeature: isObject(f) && f.gainSubclassFeature === true,
      },
    ];
  });

  const table = parseTableGroups(raw.classTableGroups, (key, label) =>
    ctx.report.warn('tableKeyCollision', `Column "${label}" renamed to "${key}"`, raw),
  );
  const featProg = featProgressions(raw);
  const optProg = optionalFeatureProgressions(raw);
  const mc = isObject(raw.multiclassing) ? raw.multiclassing : {};
  const prereq = multiclassPrereq(raw);
  const primary = abilityGroups(raw.primaryAbility);

  const cls: ClassDef = {
    ...base,
    hitDie: isObject(raw.hd) ? (num(raw.hd.faces) ?? 8) : 8,
    // A 2014 class lists no primary ability: its multiclassing requirement names it.
    primaryAbility: primary.length ? primary : prereq,
    saves: strArray(raw.proficiency).filter((a): a is Ability => ABILITY_SET.has(a)),
    startingProficiencies: profGroup(raw.startingProficiencies, 'skills'),
    startingEquipment: equipmentOptions(raw.startingEquipment),
    multiclass: {
      prereq,
      gains: profGroup(mc.proficienciesGained, 'multiclassSkills'),
    },
    table: table.columns,
    features,
    subclassTitle: typeof raw.subclassTitle === 'string' ? raw.subclassTitle : 'Subclass',
    subclassLevel: features.find((f) => f.gainSubclassFeature)?.level ?? 3,
    featProgression: featProg,
    optionalFeatureProgression: optProg,
  };
  if (table.slotTable) cls.slotTable = table.slotTable;
  const sc = spellcasting(raw, 'classSpells');
  if (sc) cls.spellcasting = sc;
  cls.effects = [...progressionEffects(featProg, optProg), ...spellEffects(raw)];
  return cls;
}

/** The 2024 Ability Score Improvement feature grants a General feat (P14). */
function asiEffects(name: string, edition: string): Effect[] {
  return name === 'Ability Score Improvement' && edition === '2024'
    ? [{ type: 'featChoice', slot: 'feat', categories: ['general'] }]
    : [];
}

export function convertClassFeature(raw: RawEntity, ctx: ConvertContext): ClassFeature {
  const name = String(raw.name);
  const className = String(raw.className);
  const classSource = String(raw.classSource);
  const level = num(raw.level) ?? 1;
  const parent = classId(className, classSource);
  const edition = editionOf(raw, ctx, parent);
  const feature: ClassFeature = {
    ...baseFields(
      raw,
      'classFeature',
      classFeatureId(name, className, classSource, level, String(raw.source)),
      ctx,
      {
        edition,
      },
    ),
    classId: parent,
    level,
  };
  const consumes = consumesOf(raw);
  if (consumes) feature.consumes = consumes;
  feature.effects = [
    ...asiEffects(name, edition),
    ...optionEffects(feature.entries),
    ...spellEffects(raw),
  ];
  return feature;
}

function subclassTable(raw: RawEntity): unknown[] {
  return asArray(raw.subclassTableGroups).filter((g) => {
    if (!isObject(g) || !Array.isArray(g.subclasses)) return true;
    return g.subclasses.some(
      (s: unknown) =>
        isObject(s) && s.name === raw.name && (s.source === undefined || s.source === raw.source),
    );
  });
}

/** A subclass adding spells to its class's list (homebrew `subclassSpells`). */
function expandedListEffects(list: NonNullable<ClassSpellcasting['listAlso']>): Effect[] {
  const grants: SpellGrant[] = [
    ...(list.classes ?? []).map((c): SpellGrant => ({
      mode: 'expanded',
      spell: { all: `class=${c}` },
    })),
    ...(list.spellIds ?? []).map((id): SpellGrant => ({ mode: 'expanded', spell: { id } })),
  ];
  return grants.length ? [{ type: 'grantSpells', spells: grants }] : [];
}

export function convertSubclass(raw: RawEntity, ctx: ConvertContext): Subclass {
  const shortName = String(raw.shortName ?? raw.name);
  const className = String(raw.className);
  const classSource = String(raw.classSource);
  const source = String(raw.source);
  const parent = classId(className, classSource);
  const base = baseFields(
    raw,
    'subclass',
    subclassId(shortName, className, classSource, source),
    ctx,
    {
      reprintId: uidToId.subclass,
    },
  );

  const features = asArray(raw.subclassFeatures).flatMap((f) => {
    const uid =
      typeof f === 'string'
        ? f
        : isObject(f) && typeof f.subclassFeature === 'string'
          ? f.subclassFeature
          : null;
    if (!uid) return [];
    const u = parseSubclassFeatureUid(uid);
    return [
      {
        level: u.level,
        featureId: subclassFeatureId(
          u.name,
          u.className,
          u.classSource,
          u.subclassShortName,
          u.subclassSource,
          u.level,
          u.source,
        ),
      },
    ];
  });

  const sub: Subclass = { ...base, classId: parent, shortName, features };
  const groups = subclassTable(raw);
  if (groups.length) {
    const table = parseTableGroups(groups, (key, label) =>
      ctx.report.warn('tableKeyCollision', `Column "${label}" renamed to "${key}"`, raw),
    );
    if (table.columns.length) sub.table = table.columns;
    if (table.slotTable) sub.slotTable = table.slotTable;
  }
  const sc = spellcasting(raw, 'subclassSpells');
  if (sc) sub.spellcasting = sc;
  const featProg = featProgressions(raw);
  const optProg = optionalFeatureProgressions(raw);
  if (featProg.length) sub.featProgression = featProg;
  if (optProg.length) sub.optionalFeatureProgression = optProg;
  sub.effects = [
    ...progressionEffects(featProg, optProg),
    ...spellEffects(raw),
    ...(sc ? [] : expandedListEffects(extraSpellList(raw.subclassSpells))),
  ];
  return sub;
}

export function convertSubclassFeature(raw: RawEntity, ctx: ConvertContext): SubclassFeature {
  const name = String(raw.name);
  const className = String(raw.className);
  const classSource = String(raw.classSource);
  const shortName = String(raw.subclassShortName);
  const subclassSource = String(raw.subclassSource);
  const level = num(raw.level) ?? 1;
  const parent = subclassId(shortName, className, classSource, subclassSource);
  const feature: SubclassFeature = {
    ...baseFields(
      raw,
      'subclassFeature',
      subclassFeatureId(
        name,
        className,
        classSource,
        shortName,
        subclassSource,
        level,
        String(raw.source),
      ),
      ctx,
      { edition: editionOf(raw, ctx, parent) },
    ),
    classId: classId(className, classSource),
    subclassId: parent,
    level,
  };
  const consumes = consumesOf(raw);
  if (consumes) feature.consumes = consumes;
  feature.effects = [...optionEffects(feature.entries), ...spellEffects(raw)];
  return feature;
}
