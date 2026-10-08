// Effects generated from 5etools structured fields (plan §6.1 step 7, P14), so they need no
// hand mapping: ability bonuses, proficiencies, defenses, senses, speed, granted feats, extra
// spells, and feat/optional-feature progressions. Every choice gets a deterministic slot name
// (plan §4.4) built from the field it came from, so re-importing keeps character keys stable.

import {
  ABILITIES,
  nameSourceId,
  type Ability,
  type ChoiceSlot,
  type Effect,
  type Formula,
  type FeatProgression,
  type Id,
  type MoveMode,
  type OptionalFeatureProgression,
  type ProficiencyCategory,
  type Recharge,
  type Skill,
  type SpellGrant,
} from '../../schema/index.ts';
import { normalizeKey } from './tableKeys.ts';
import { asArray, isObject, num, strArray, type RawEntity, type RawObject } from './raw.ts';

const ABILITY_SET = new Set<string>(ABILITIES);

function isAbility(value: unknown): value is Ability {
  return typeof value === 'string' && ABILITY_SET.has(value);
}

/**
 * Several alternative sets (a 5etools array with more than one element) become an option
 * choice `<slot>Set`, with each set's effects behind `ifChoice`. One set needs no choice.
 */
function alternatives(
  sets: unknown[],
  slot: string,
  labelOf: (set: unknown, i: number) => string,
  build: (set: unknown, slot: string) => Effect[],
): Effect[] {
  if (sets.length <= 1) return sets.length ? build(sets[0], slot) : [];
  const selector = `${slot}Set`;
  return [
    {
      type: 'optionChoice',
      choice: { slot: selector, count: 1, from: sets.map((_, i) => String(i)) },
      labels: sets.map(labelOf),
    },
    ...sets.map((set, i): Effect => ({
      type: 'ifChoice',
      slot: selector,
      value: String(i),
      effects: build(set, `${slot}.${i}`),
    })),
  ];
}

/** Numbered slot names: the first is `base`, then `base.1`, `base.2`… */
function slotNamer(base: string): () => string {
  let n = 0;
  return () => (n++ === 0 ? base : `${base}.${n - 1}`);
}

// ---------------------------------------------------------------------------------------------
// Ability scores

function abilitySet(set: unknown, slot: string): Effect[] {
  if (!isObject(set)) return [];
  const out: Effect[] = [];
  const max = num(set.max);
  for (const ab of ABILITIES) {
    const value = num(set[ab]);
    if (value !== undefined)
      out.push({ type: 'abilityBonus', ability: ab, value, ...(max ? { max } : {}) });
  }
  const choose = set.choose;
  if (isObject(choose) && !isObject(choose.weighted)) {
    const from = strArray(choose.from).filter(isAbility);
    out.push({
      type: 'abilityChoice',
      choice: { slot, count: num(choose.count) ?? 1, from: from.length ? from : [...ABILITIES] },
      value: num(choose.amount) ?? 1,
      ...(max ? { max } : {}),
    });
  }
  return out;
}

function describeAbilitySet(set: unknown, i: number): string {
  if (!isObject(set)) return `Option ${i + 1}`;
  const choose = isObject(set.choose) ? set.choose : null;
  if (choose && num(choose.amount) === 2) return '+2 to one score';
  if (choose && (num(choose.count) ?? 1) > 1) return `+1 to ${num(choose.count)} scores`;
  return `Option ${i + 1}`;
}

/** `ability` on feats and 2014 species. Weighted choices (2024 backgrounds) are not effects. */
export function abilityEffects(raw: RawEntity): Effect[] {
  const sets = asArray(raw.ability).filter(
    (s) => !(isObject(s) && isObject(s.choose) && isObject(s.choose.weighted)),
  );
  return alternatives(sets, 'ability', describeAbilitySet, abilitySet);
}

/** Background ability options: `{ from, weights }`, e.g. +2/+1 or +1/+1/+1. */
export function weightedAbilityOptions(raw: RawEntity): { from: Ability[]; weights: number[] }[] {
  const out: { from: Ability[]; weights: number[] }[] = [];
  for (const set of asArray(raw.ability)) {
    if (!isObject(set) || !isObject(set.choose) || !isObject(set.choose.weighted)) continue;
    const w = set.choose.weighted;
    out.push({
      from: strArray(w.from).filter(isAbility),
      weights: asArray(w.weights).map((x) => num(x) ?? 0),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Proficiencies

interface ProfField {
  prop: string;
  category: ProficiencyCategory;
  slot: string;
}

const PROF_FIELDS: ProfField[] = [
  { prop: 'skillProficiencies', category: 'skill', slot: 'skills' },
  { prop: 'toolProficiencies', category: 'tool', slot: 'tools' },
  { prop: 'languageProficiencies', category: 'language', slot: 'languages' },
  { prop: 'weaponProficiencies', category: 'weapon', slot: 'weapons' },
  { prop: 'armorProficiencies', category: 'armor', slot: 'armor' },
  { prop: 'savingThrowProficiencies', category: 'save', slot: 'saves' },
];

/** `any…` keys: which category they pick from and an optional filter. */
const ANY_KEYS: Record<string, { category?: ProficiencyCategory; filter?: string }> = {
  any: {},
  anySkill: { category: 'skill' },
  anyTool: { category: 'tool' },
  anyLanguage: { category: 'language' },
  anyStandard: { category: 'language', filter: 'standard' },
  anyExotic: { category: 'language', filter: 'rare' },
  anyRare: { category: 'language', filter: 'rare' },
  anyArtisansTool: { category: 'tool', filter: 'artisan' },
  anyMusicalInstrument: { category: 'tool', filter: 'instrument' },
  anyGamingSet: { category: 'tool', filter: 'gamingSet' },
  anyWeapon: { category: 'weapon' },
  anyArmor: { category: 'armor' },
};

function categoriesOf(tokens: string[], fallback: ProficiencyCategory): ProficiencyCategory[] {
  const cats = new Set<ProficiencyCategory>();
  for (const t of tokens) {
    const cat = ANY_KEYS[t]?.category;
    if (cat) cats.add(cat);
  }
  return cats.size ? [...cats] : [fallback];
}

/** Value stored for a fixed proficiency: item UIDs become item ids, the rest lowercased keys. */
function profValue(key: string): string {
  return key.includes('|')
    ? nameSourceId(...(key.split('|') as [string, string]))
    : key.toLowerCase();
}

function profSet(field: ProfField, set: unknown, next: () => string): Effect[] {
  if (!isObject(set)) return [];
  const out: Effect[] = [];
  for (const [key, value] of Object.entries(set)) {
    if (key === 'choose') {
      for (const ch of asArray(set.choose)) {
        if (!isObject(ch)) continue;
        const tokens = strArray(ch.from);
        const anyTokens = tokens.filter((t) => t in ANY_KEYS);
        const categories = categoriesOf(anyTokens, field.category);
        const choice: ChoiceSlot<string> = {
          slot: next(),
          count: num(ch.count) ?? 1,
          from: anyTokens.length ? 'any' : tokens.map(profValue),
        };
        const effect: Effect = {
          type: 'proficiencyChoice',
          category: categories.length === 1 ? (categories[0] ?? field.category) : categories,
          choice,
        };
        if (typeof ch.fromFilter === 'string') {
          choice.from = 'any';
          effect.filter = ch.fromFilter;
        }
        out.push(effect);
      }
    } else if (key in ANY_KEYS && typeof value === 'number') {
      const any = ANY_KEYS[key] ?? {};
      out.push({
        type: 'proficiencyChoice',
        category: any.category ?? field.category,
        choice: { slot: next(), count: value, from: 'any' },
        ...(any.filter ? { filter: any.filter } : {}),
      });
    } else if (value === true) {
      out.push({ type: 'proficiency', category: field.category, value: profValue(key) });
    }
  }
  return out;
}

function describeProfSet(set: unknown, i: number): string {
  if (!isObject(set)) return `Option ${i + 1}`;
  const names = Object.entries(set)
    .filter(([k, v]) => v === true && k !== 'choose')
    .map(([k]) => k);
  return names.length ? names.join(', ') : `Option ${i + 1}`;
}

export function proficiencyEffects(raw: RawEntity): Effect[] {
  const out: Effect[] = [];
  for (const field of PROF_FIELDS) {
    const sets = asArray(raw[field.prop]);
    out.push(
      ...alternatives(sets, field.slot, describeProfSet, (set, slot) =>
        profSet(field, set, slotNamer(slot)),
      ),
    );
  }

  // Mixed picks, e.g. "three skills or tools" (Skilled) or "a language and a tool".
  const mixed = asArray(raw.skillToolLanguageProficiencies);
  out.push(
    ...alternatives(mixed, 'skillsToolsLanguages', describeProfSet, (set, slot) =>
      profSet({ prop: '', category: 'skill', slot }, set, slotNamer(slot)),
    ),
  );

  const nextExpertise = slotNamer('expertise');
  for (const set of asArray(raw.expertise)) {
    if (!isObject(set)) continue;
    for (const [key, value] of Object.entries(set)) {
      if (key === 'anyProficientSkill' && typeof value === 'number') {
        out.push({
          type: 'expertiseChoice',
          choice: { slot: nextExpertise(), count: value, from: 'any' },
          filter: 'proficient',
        });
      } else if (value === true) {
        out.push({ type: 'expertise', skill: key as Skill });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Defenses, senses, speed

export function defenseEffects(raw: RawEntity): Effect[] {
  const out: Effect[] = [];
  const fields = [
    ['resist', 'resistance'],
    ['immune', 'immunity'],
    ['conditionImmune', 'conditionImmunity'],
  ] as const;
  for (const [prop, type] of fields) {
    const nextSlot = slotNamer(prop === 'resist' ? 'resistance' : prop);
    for (const v of asArray(raw[prop])) {
      if (typeof v === 'string') out.push({ type, value: v });
      else if (isObject(v) && isObject(v.choose) && type === 'resistance') {
        out.push({
          type: 'resistanceChoice',
          choice: {
            slot: nextSlot(),
            count: num(v.choose.count) ?? 1,
            from: strArray(v.choose.from),
          },
        });
      } else if (isObject(v)) {
        // Conditional defenses ("while raging") are text until mapped by hand.
        const values = strArray(v[prop]);
        if (values.length)
          out.push({ type: 'note', text: `${type}: ${values.join(', ')} (conditional)` });
      }
    }
  }
  for (const v of asArray(raw.vulnerable)) {
    if (typeof v === 'string') out.push({ type: 'note', text: `Vulnerable to ${v} damage` });
  }
  return out;
}

const SENSES = ['darkvision', 'blindsight', 'truesight', 'tremorsense'];

export function senseEffects(raw: RawEntity): Effect[] {
  const out: Effect[] = [];
  for (const sense of SENSES) {
    const range = num(raw[sense]);
    if (range) out.push({ type: 'sense', sense, range });
  }
  for (const set of asArray(raw.senses)) {
    if (!isObject(set)) continue;
    for (const sense of SENSES) {
      const range = num(set[sense]);
      if (range) out.push({ type: 'sense', sense, range });
    }
  }
  for (const set of asArray(raw.bonusSenses)) {
    if (!isObject(set)) continue;
    for (const sense of SENSES) {
      const range = num(set[sense]);
      if (range) out.push({ type: 'note', text: `${sense} range +${range} ft.` });
    }
  }
  return out;
}

const MOVE_MODES: MoveMode[] = ['walk', 'fly', 'swim', 'climb', 'burrow'];

/** Species speeds. `true` for a mode means "equal to your walking speed". */
export function speedOf(raw: RawEntity): Partial<Record<MoveMode, number>> {
  const speed = raw.speed;
  const n = num(speed);
  if (n !== undefined) return { walk: n };
  if (!isObject(speed)) return {};
  const out: Partial<Record<MoveMode, number>> = {};
  for (const mode of MOVE_MODES) {
    const v = speed[mode];
    const value = num(v) ?? (isObject(v) ? num(v.number) : undefined);
    if (value !== undefined) out[mode] = value;
  }
  return out;
}

export function speedEffects(raw: RawEntity): Effect[] {
  const out: Effect[] = [];
  const speed = raw.speed;
  for (const [mode, value] of Object.entries(speedOf(raw))) {
    out.push({ type: 'speed', mode: mode as MoveMode, value });
  }
  if (isObject(speed)) {
    for (const mode of MOVE_MODES)
      if (speed[mode] === true) out.push({ type: 'speed', mode, value: 'walk' });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Feats granted

const FEAT_CATEGORY_NAMES: Record<string, string> = {
  O: 'origin',
  G: 'general',
  FS: 'fightingStyle',
  EB: 'epicBoon',
};

export function featCategory(code: string): string {
  return FEAT_CATEGORY_NAMES[code] ?? code;
}

export function featEffects(raw: RawEntity): Effect[] {
  const out: Effect[] = [];
  const nextSlot = slotNamer('feat');
  for (const set of asArray(raw.feats)) {
    if (!isObject(set)) continue;
    for (const [key, value] of Object.entries(set)) {
      if (value === true) {
        const [name = '', source = 'PHB'] = key.split('|');
        out.push({ type: 'grantFeat', feat: { kind: 'feat', id: nameSourceId(name, source) } });
      } else if (key === 'any' && typeof value === 'number') {
        out.push({ type: 'featChoice', slot: nextSlot(), categories: [], count: value });
      } else if (key === 'anyFromCategory' && isObject(value)) {
        out.push({
          type: 'featChoice',
          slot: nextSlot(),
          categories: strArray(value.category).map(featCategory),
          count: num(value.count) ?? 1,
        });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Extra spells (`additionalSpells`)

type SpellMode = 'known' | 'innate' | 'prepared' | 'expanded';
const SPELL_MODES: SpellMode[] = ['known', 'prepared', 'innate', 'expanded'];
const GRANT_MODE: Record<SpellMode, SpellGrant['mode']> = {
  known: 'known',
  prepared: 'alwaysPrepared',
  innate: 'innate',
  expanded: 'expanded',
};

/** `fireball|xphb#3` → the spell id and the level it is cast at; `#c` only marks a cantrip. */
export function spellRef(ref: string): { id: string; castAtLevel?: number } {
  const [uid = '', suffix = ''] = ref.split('#');
  const [name = '', source = 'PHB'] = uid.split('|');
  const out: { id: string; castAtLevel?: number } = { id: nameSourceId(name, source || 'PHB') };
  if (/^\d$/.test(suffix)) out.castAtLevel = Number(suffix);
  return out;
}

function spellId(ref: string): string {
  return spellRef(ref).id;
}

/** Sends every `limited` use to one counter of the entity, e.g. a charm's charges. */
export interface LimitedUses {
  resourceId: string;
  /** What one cast of this spell costs; 1 when not given. */
  cost?: (spellId: Id) => number | undefined;
}

export interface SpellEffectOptions {
  limited?: LimitedUses;
}

interface GrantContext {
  base: Omit<SpellGrant, 'spell'>;
  nextSlot: () => string;
  /** Prefix for shared-use resource ids, e.g. `spells.0.innate._`. */
  poolPrefix: string;
  /** Display name of shared-use resources: the entity's, or the alternative's. */
  poolName: string;
  /** Collects the `resource` effects that shared uses create. */
  resources: Effect[];
  /** 5etools `resourceName`: what `resource` uses are paid from (Ki, Focus Point). */
  resourceName?: string;
  limited?: LimitedUses;
}

function grantsFromItems(items: unknown, ctx: GrantContext): SpellGrant[] {
  const out: SpellGrant[] = [];
  for (const item of asArray(items)) {
    if (typeof item === 'string') {
      const ref = spellRef(item);
      const grant: SpellGrant = { ...ctx.base, spell: { id: ref.id } };
      if (ref.castAtLevel !== undefined) grant.castAtLevel = ref.castAtLevel;
      out.push(grant);
    } else if (isObject(item) && typeof item.all === 'string') {
      out.push({ ...ctx.base, spell: { all: item.all } });
    } else if (isObject(item) && item.choose !== undefined) {
      const count = num(item.count) ?? 1;
      if (typeof item.choose === 'string') {
        out.push({ ...ctx.base, spell: { choose: item.choose, count, slot: ctx.nextSlot() } });
      } else if (isObject(item.choose)) {
        out.push({
          ...ctx.base,
          spell: {
            from: strArray(item.choose.from).map(spellId),
            count: num(item.choose.count) ?? count,
            slot: ctx.nextSlot(),
          },
        });
      }
    }
  }
  return out;
}

const USE_RECHARGE: Record<string, Recharge> = { daily: 'long', rest: 'short', limited: 'none' };

/** Use count keys: `1`, `1e` (each), `wis` (that modifier, at least 1) or `pb`. */
function usesCount(key: string): Formula {
  const n = num(key.replace(/e$/, ''));
  if (n !== undefined) return n;
  if (isAbility(key)) return `max(1,mod.${key})`;
  if (key === 'pb') return 'pb';
  return 1;
}

/**
 * `{daily: {"1": [...]}, rest: {...}, limited: {...}, will: [...], ritual: [...], resource:
 * {...}, _: [...]}`. `limited` uses never recharge (charms). A count without the `e` ("each")
 * suffix over several spells is one counter they share: "cast one of these once". `resource`
 * keys are what one cast costs.
 */
function grantsFromUses(value: unknown, ctx: GrantContext): SpellGrant[] {
  if (!isObject(value)) return grantsFromItems(value, ctx);
  const withUses = (items: unknown, uses: NonNullable<SpellGrant['uses']>) =>
    grantsFromItems(items, { ...ctx, base: { ...ctx.base, uses } });
  const out: SpellGrant[] = [];
  for (const [key, inner] of Object.entries(value)) {
    if (key === '_') out.push(...grantsFromItems(inner, ctx));
    else if (key === 'will') out.push(...withUses(inner, 'atWill'));
    else if (key === 'ritual') out.push(...withUses(inner, 'ritual'));
    else if (key === 'resource' && isObject(inner)) {
      for (const [cost, items] of Object.entries(inner)) {
        out.push(
          ...(ctx.resourceName
            ? withUses(items, { resourceName: ctx.resourceName, cost: num(cost) ?? 1 })
            : grantsFromItems(items, ctx)),
        );
      }
    } else if (key === 'limited' && ctx.limited && isObject(inner)) {
      const { resourceId, cost } = ctx.limited;
      for (const items of Object.values(inner)) {
        for (const grant of grantsFromItems(items, ctx)) {
          const c = 'id' in grant.spell ? cost?.(grant.spell.id) : undefined;
          out.push({ ...grant, uses: { resource: resourceId, cost: c ?? 1 } });
        }
      }
    } else if (USE_RECHARGE[key] && isObject(inner)) {
      const recharge = USE_RECHARGE[key];
      for (const [countKey, items] of Object.entries(inner)) {
        const count = usesCount(countKey);
        if (!countKey.endsWith('e') && asArray(items).length > 1) {
          const resourceId = `${ctx.poolPrefix}.${key}.${countKey}`;
          ctx.resources.push({
            type: 'resource',
            resourceId,
            name: ctx.poolName,
            max: count,
            recharge,
          });
          out.push(...withUses(items, { resource: resourceId, cost: 1 }));
        } else {
          out.push(...withUses(items, { count, recharge }));
        }
      }
    }
  }
  return out;
}

function spellAbility(block: RawObject, slot: string): SpellGrant['ability'] | undefined {
  const a = block.ability;
  if (isAbility(a)) return a;
  if (a === 'inherit') return 'inherit';
  if (isObject(a) && Array.isArray(a.choose)) {
    return { slot: `${slot}.ability`, from: a.choose.filter(isAbility) };
  }
  return undefined;
}

function spellBlock(
  block: unknown,
  slot: string,
  name: string,
  opts: SpellEffectOptions,
): Effect[] {
  if (!isObject(block)) return [];
  const ability = spellAbility(block, slot);
  const resources: Effect[] = [];
  const shared = {
    poolName: typeof block.name === 'string' ? block.name : name,
    resources,
    ...(typeof block.resourceName === 'string' ? { resourceName: block.resourceName } : {}),
    ...(opts.limited ? { limited: opts.limited } : {}),
  };
  const grants: SpellGrant[] = [];
  for (const mode of SPELL_MODES) {
    const byLevel = block[mode];
    if (!isObject(byLevel)) continue;
    // Always numbered, so a later choice never renames an earlier one: spells.0.known.0, .1…
    let n = 0;
    const next = () => `${slot}.${mode}.${n++}`;
    for (const [levelKey, value] of Object.entries(byLevel)) {
      const base: Omit<SpellGrant, 'spell'> = { mode: GRANT_MODE[mode] };
      const level = num(levelKey);
      const spellLevel = /^s(\d)$/.exec(levelKey)?.[1];
      if (level !== undefined) base.atLevel = level;
      if (spellLevel !== undefined) base.atSpellLevel = Number(spellLevel);
      if (ability !== undefined) base.ability = ability;
      grants.push(
        ...grantsFromUses(value, {
          ...shared,
          base,
          nextSlot: next,
          poolPrefix: `${slot}.${mode}.${levelKey}`,
        }),
      );
    }
  }
  return grants.length ? [...resources, { type: 'grantSpells', spells: grants }] : [];
}

/** `additionalSpells`. Several blocks are alternatives (Magic Initiate: Cleric, Druid, Wizard). */
export function spellEffects(raw: RawEntity, opts: SpellEffectOptions = {}): Effect[] {
  const blocks = asArray(raw.additionalSpells);
  const name = typeof raw.name === 'string' ? raw.name : 'Uses';
  if (blocks.length <= 1) return spellBlock(blocks[0], 'spells.0', name, opts);
  return [
    {
      type: 'optionChoice',
      choice: { slot: 'spellsSet', count: 1, from: blocks.map((_, i) => String(i)) },
      labels: blocks.map((b, i) =>
        isObject(b) && typeof b.name === 'string' ? b.name : `Option ${i + 1}`,
      ),
    },
    ...blocks.map((b, i): Effect => ({
      type: 'ifChoice',
      slot: 'spellsSet',
      value: String(i),
      effects: spellBlock(b, `spells.${i}`, name, opts),
    })),
  ];
}

// ---------------------------------------------------------------------------------------------
// Feat and optional-feature progressions

/** `{ "1": 1, "19": 2 }` or a 20-element array of running totals → level → total. */
export function progressionLevels(raw: unknown): Record<number, number> {
  const out: Record<number, number> = {};
  if (Array.isArray(raw)) {
    let prev = 0;
    raw.forEach((v, i) => {
      const n = num(v) ?? prev;
      if (n !== prev) out[i + 1] = n;
      prev = n;
    });
  } else if (isObject(raw)) {
    for (const [k, v] of Object.entries(raw)) {
      const level = k === '*' ? 0 : num(k);
      const n = num(v);
      if (level !== undefined && n !== undefined) out[level] = n;
    }
  }
  return out;
}

export function featProgressions(raw: RawEntity): FeatProgression[] {
  return asArray(raw.featProgression)
    .filter(isObject)
    .map((p) => {
      const name = typeof p.name === 'string' ? p.name : 'Feat';
      return {
        key: normalizeKey(name),
        name,
        categories: strArray(p.category).map(featCategory),
        atLevels: progressionLevels(p.progression),
      };
    });
}

export function optionalFeatureProgressions(raw: RawEntity): OptionalFeatureProgression[] {
  return asArray(raw.optionalfeatureProgression)
    .filter(isObject)
    .map((p) => {
      const name = typeof p.name === 'string' ? p.name : 'Options';
      return {
        key: normalizeKey(name),
        name,
        featureTypes: strArray(p.featureType),
        atLevels: progressionLevels(p.progression),
      };
    });
}

/**
 * One choice per level where a progression's total goes up. Level 0 (`"*"`) means "when this
 * is gained" and is not level-gated.
 */
export function progressionEffects(
  feats: FeatProgression[],
  optional: OptionalFeatureProgression[],
): Effect[] {
  const out: Effect[] = [];
  const atLevel = (level: number, effect: Effect): Effect =>
    level > 0 ? { type: 'atLevel', level, effects: [effect] } : effect;

  for (const p of feats) {
    let prev = 0;
    for (const [lvl, total] of Object.entries(p.atLevels).sort(
      (a, b) => Number(a[0]) - Number(b[0]),
    )) {
      const level = Number(lvl);
      const delta = total - prev;
      prev = total;
      if (delta <= 0) continue;
      const slot = level > 0 ? `featProgression.${p.key}.${level}` : `featProgression.${p.key}`;
      out.push(
        atLevel(level, { type: 'featChoice', slot, categories: p.categories, count: delta }),
      );
    }
  }
  for (const p of optional) {
    let prev = 0;
    for (const [lvl, total] of Object.entries(p.atLevels).sort(
      (a, b) => Number(a[0]) - Number(b[0]),
    )) {
      const level = Number(lvl);
      const delta = total - prev;
      prev = total;
      if (delta <= 0) continue;
      const slot = level > 0 ? `optfeat.${p.key}.${level}` : `optfeat.${p.key}`;
      out.push(
        atLevel(level, {
          type: 'optionalFeatureChoice',
          slot,
          featureTypes: p.featureTypes,
          count: delta,
        }),
      );
    }
  }
  return out;
}

/** Everything above that applies to the record. */
export function effectsFromData(raw: RawEntity, opts: SpellEffectOptions = {}): Effect[] {
  return [
    ...abilityEffects(raw),
    ...proficiencyEffects(raw),
    ...defenseEffects(raw),
    ...senseEffects(raw),
    ...featEffects(raw),
    ...spellEffects(raw, opts),
  ];
}
