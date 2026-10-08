// What a choice can be (plan §9.2 step 3.20, reworked in §9.3 step 4.3): every value an offer
// allows, with a readable label, a detail line, a group to list it under, and the rules it
// breaks (prerequisites not met), for the choice picker. Values the character already has from
// something else are marked, so a player doesn't take the same skill twice. "Ignore rules" lists
// everything of the kind, and lets any of it be picked (plan §9.1).

import {
  ABILITIES,
  ABILITY_NAMES,
  SKILL_ABILITY,
  SKILLS,
  type Ability,
  type Background,
  type Effect,
  type EntityKind,
  type Feat,
  type Item,
  type OptionalFeature,
  type Size,
  type Skill,
  type Spell,
} from '../../schema/index.ts';
import { prereqsText, spellRange, spellTime, summaryOf } from '../../richtext/entityMeta.ts';
import {
  carriedWeapons,
  knownSpells,
  proficiencyOptions,
  spellOptions,
  type AutoContext,
} from '../build/autoChoose.ts';
import type { Offer } from '../collect/types.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import { equipmentOptionText } from '../build/equipment.ts';
import { SIZE_NAMES } from '../items/items.ts';
import { walkEffects } from '../effects/walk.ts';
import { effectBenefits } from '../explain/benefits.ts';
import { checkPrereqs, prereqContext, type PrereqContext } from '../prereq.ts';
import { distanceOf } from '../derive/attacks.ts';
import { masteryHasSave, masterySaveNote, masteryWhen } from '../explain/mastery.ts';
import { isRangedWeapon } from '../static/attackTraits.ts';
import { baseWeapons, expertiseOptions, queryOptions, weaponMasteryOptions } from './queries.ts';

export interface ChoiceOption {
  value: string;
  label: string;
  /** The character already has it from something else. */
  taken?: boolean;
  /** A second line: a spell's level and school, a weapon's kind, what an option holds. */
  detail?: string;
  /** The heading it is listed under: a spell level, a kind of tool, a feat category. */
  group?: string;
  /** Rules picking it breaks (a prerequisite not met): it is picked only with Ignore rules. */
  unmet?: string[];
  /** Prerequisites the app can't check: shown, never enforced. */
  unknown?: string[];
  /** What it does, in a sentence of its own text (a spell's first sentence). */
  summary?: string;
  /** The text goes on past the summary: where to read it (`Press Read to see them.`). */
  more?: string;
  /** A rule that goes with it (a weapon's mastery property): its text, imported, and when it applies. */
  about?: { title: string; text: string; when?: string; note?: string };
}

export interface OptionsSettings {
  /** List everything of the kind, not only what the offer allows (plan §9.1). */
  ignoreRules?: boolean;
}

export interface OfferOptions {
  options: ChoiceOption[];
  /** The kind of entity the values are ids of. */
  valueKind?: EntityKind;
  /**
   * Each option is a whole pick, its values joined with commas (a background's +2 and +1), and
   * one is chosen.
   */
  joined?: boolean;
  /** What each pick gives, when the options don't say (`+1 to each, up to 20`). */
  hint?: string;
}

const SMALL_WORDS = new Set(['of', 'the', 'and']);

/** `sleight of hand` → `Sleight of Hand`. */
export function readable(text: string): string {
  return text
    .split(' ')
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/**
 * The ways to spread a background's increases among its three abilities: +2 to one and +1 to
 * another, or +1 to all three. Values are listed largest increase first, as they are stored.
 */
export function backgroundSpreads(options: Background['abilityOptions']): Ability[][] {
  const out: Ability[][] = [];
  const seen = new Set<string>();
  for (const o of options) {
    const weights = [...o.weights].sort((a, b) => b - a);
    const assign = (used: Ability[]) => {
      if (used.length === weights.length) {
        const values = weights.flatMap((w, i) => Array<Ability>(w).fill(used[i]!));
        const key = [...values].sort().join();
        if (!seen.has(key)) {
          seen.add(key);
          out.push(values);
        }
        return;
      }
      for (const a of o.from) if (!used.includes(a)) assign([...used, a]);
    };
    assign([]);
  }
  return out;
}

/** `+2 Intelligence, +1 Wisdom`. */
export function spreadLabel(values: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].map(([a, n]) => `+${n} ${ABILITY_NAMES[a as Ability] ?? a}`).join(', ');
}

/** An option's label. A species' size pick stores the size code (`S`, `M`). */
export function optionLabel(offer: Offer, value: string): string {
  if (offer.key.owner.kind === 'species' && offer.key.slot === 'size')
    return SIZE_NAMES[value as Size] ?? value;
  const from = Array.isArray(offer.from) ? (offer.from as string[]) : [];
  return offer.labels?.[from.indexOf(value)] ?? value;
}

/**
 * What one value of an option pick brings, from the owner's effects that depend on it (a Circle
 * of the Land's land: its spells): `Spell: Blur, Burning Hands and Fire Bolt (cantrip)`.
 */
function optionWhat(offer: Offer, value: string, index: ContentIndex): Partial<ChoiceOption> {
  const owner = index.get(offer.key.owner);
  if (!owner || !('effects' in owner) || !Array.isArray(owner.effects)) return {};
  const effects = [...walkEffects(owner.effects as Effect[])].flatMap((e) =>
    e.type === 'ifChoice' && e.slot === offer.key.slot && e.value === value ? e.effects : [],
  );
  // Fixed spells, by the level they come at: `Spells: Blur, Fire Bolt; at level 5: Fireball`.
  const byLevel = new Map<number, string[]>();
  let mode = '';
  const rest = effects.filter((e) => {
    if (e.type !== 'grantSpells' || !e.spells.every((g) => 'id' in g.spell)) return true;
    for (const g of e.spells) {
      const id = (g.spell as { id: string }).id;
      const at = g.atLevel ?? 0;
      byLevel.set(at, [...(byLevel.get(at) ?? []), index.get({ kind: 'spell', id })?.name ?? id]);
      if (g.mode === 'alwaysPrepared') mode = ' (always prepared)';
    }
    return false;
  });
  const levels = [...byLevel.keys()].sort((a, b) => a - b);
  const spells = levels
    .map((l, i) => `${i ? `at level ${l}: ` : ''}${byLevel.get(l)!.join(', ')}`)
    .join('; ');
  const lines = [
    ...(spells ? [`Spells${mode}: ${spells}`] : []),
    ...effectBenefits(rest, index).map((b) => `${b.label}: ${b.text}`),
  ];
  return lines.length ? { summary: lines.join(' · ') } : {};
}

/** The same pick in any order: background increases are compared this way. */
export const sameSpread = (a: readonly string[], b: readonly string[]) =>
  [...a].sort().join() === [...b].sort().join();

const ORDINAL = ['Cantrip', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

const FEAT_GROUPS: Record<string, string> = {
  origin: 'Origin feats',
  general: 'General feats',
  fightingStyle: 'Fighting Style feats',
  epicBoon: 'Epic Boon feats',
};

/** Groups listed in this order, before any others. */
const GROUP_ORDER = [
  'Skills',
  'Standard languages',
  'Rare languages',
  'Origin feats',
  'General feats',
  'Fighting Style feats',
  'Simple weapons',
  'Martial weapons',
];

const TOOL_GROUPS: Record<string, string> = {
  artisan: 'Artisan’s Tools',
  instrument: 'Musical instruments',
  gamingSet: 'Gaming sets',
};

/** `Level 1 · Evocation · Ritual · Concentration`. */
export function spellDetail(spell: Spell): string {
  return [
    spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`,
    readable(spell.school),
    readable(spellTime(spell)),
    spellRange(spell),
    spell.ritual ? 'Ritual' : '',
    spell.duration.some((d) => d.concentration) ? 'Concentration' : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

const spellGroup = (spell: Spell) =>
  spell.level === 0 ? 'Cantrips' : `${ORDINAL[spell.level]}-level spells`;

function masteryAbout(name: string, text: string): NonNullable<ChoiceOption['about']> {
  const when = masteryWhen(name);
  return {
    title: `Mastery: ${name}`,
    text,
    ...(when ? { when } : {}),
    ...(masteryHasSave(text) ? { note: masterySaveNote() } : {}),
  };
}

function prereqFacts(
  entity: Feat | OptionalFeature | undefined,
  pctx: PrereqContext,
): Pick<ChoiceOption, 'unmet' | 'unknown' | 'detail'> {
  if (!entity?.prerequisites.length) return {};
  const r = checkPrereqs(entity.prerequisites, pctx);
  return {
    detail: `Prerequisite: ${prereqsText(entity.prerequisites)}`,
    ...(r.met ? {} : { unmet: r.unmet }),
    ...(r.unknown.length ? { unknown: r.unknown } : {}),
  };
}

/**
 * Everything an offer allows. `current` are the picks being changed: they are always listed,
 * and never marked as already had.
 */
export function offerOptions(
  offer: Offer,
  ctx: AutoContext,
  current: readonly string[] = [],
  settings: OptionsSettings = {},
): OfferOptions {
  const { character, sheet, catalog, index } = ctx;
  const ignore = !!settings.ignoreRules;
  const from = Array.isArray(offer.from) ? (offer.from as string[]) : undefined;
  const picked = new Set(character.log.flatMap((e) => e.choices.flatMap((r) => r.values)));
  const nameOf = (kind: EntityKind) => (id: string) =>
    index.get({ kind, id })?.name ?? readable(id.split('|')[0] ?? id);
  const score = (a: Ability) => sheet.abilities[a].score.value;

  let values: string[] = [];
  let label: (value: string) => string = readable;
  let describe: (value: string) => Omit<ChoiceOption, 'value' | 'label' | 'taken'> = () => ({});
  let taken = new Set<string>();
  let valueKind: EntityKind | undefined;
  let hint: string | undefined;

  switch (offer.kind) {
    case 'ability':
    case 'spellAbility': {
      values = from && !ignore ? from : [...ABILITIES];
      label = (a) => ABILITY_NAMES[a as Ability] ?? a;
      const effect = offer.effect?.type === 'abilityChoice' ? offer.effect : undefined;
      const max = effect?.max ?? 20;
      if (effect) hint = `+${effect.value} to each pick, up to ${max}.`;
      describe = (a) => {
        const now = score(a as Ability);
        const full = effect && now >= max && !current.includes(a);
        return {
          detail: `Score ${now}`,
          ...(full ? { unmet: [`Already ${now}; the most is ${max}`] } : {}),
        };
      };
      break;
    }
    case 'backgroundAbility': {
      const bg = index.get({ kind: 'background', id: offer.key.owner.id });
      const spreads = backgroundSpreads(bg?.abilityOptions ?? []);
      const mine = spreads.find((s) => sameSpread(s, current));
      // Scores before this pick: the sheet's, less the increases picked now.
      const before = (a: Ability) => score(a) - current.filter((v) => v === a).length;
      const result = (spread: readonly Ability[]) =>
        [...new Set(spread)]
          .map((a) => {
            const from = before(a);
            const to = Math.min(20, from + spread.filter((v) => v === a).length);
            return `${ABILITY_NAMES[a]} ${from} → ${to}`;
          })
          .join(' · ');
      return {
        joined: true,
        hint: 'Increase one score by 2 and another by 1, or three scores by 1. No score can go above 20.',
        options: spreads.map((s) => ({
          value: (s === mine ? current : s).join(),
          label: spreadLabel(s),
          detail: result(s),
        })),
      };
    }
    case 'proficiency': {
      const effect = offer.effect?.type === 'proficiencyChoice' ? offer.effect : undefined;
      const o = proficiencyOptions(
        ignore && effect
          ? { ...offer, from: 'any', effect: { ...effect, filter: undefined } as typeof effect }
          : offer,
        ctx,
      );
      values = o.options;
      taken = o.taken;
      label = (v) => index.get({ kind: 'item', id: v })?.name ?? readable(v);
      const languages = new Map(
        catalog
          .of('rule')
          .filter((r) => r.ruleKind === 'language')
          .map((r) => [r.name.toLowerCase(), r.languageType]),
      );
      describe = (v) => {
        if (v in SKILL_ABILITY)
          return { group: 'Skills', detail: ABILITY_NAMES[SKILL_ABILITY[v as Skill]] };
        const tool = index.get({ kind: 'item', id: v });
        if (tool) return { group: TOOL_GROUPS[tool.toolType ?? ''] ?? 'Tools' };
        const type = languages.get(v);
        if (type !== undefined) return { group: `${readable(type || 'other')} languages` };
        return {};
      };
      break;
    }
    case 'expertise':
      values = ignore ? [...SKILLS] : expertiseOptions(offer, sheet, catalog);
      describe = (v) =>
        v in SKILL_ABILITY ? { detail: ABILITY_NAMES[SKILL_ABILITY[v as Skill]] } : {};
      break;
    case 'resistance':
      values = from ?? [];
      break;
    case 'equipment': {
      values = from ?? [];
      const owner = offer.key.owner;
      const options =
        owner.kind === 'class'
          ? index.get({ kind: 'class', id: owner.id })?.startingEquipment
          : owner.kind === 'background'
            ? index.get({ kind: 'background', id: owner.id })?.equipment
            : undefined;
      label = (v) => `Option ${v}`;
      describe = (v) => {
        const option = options?.find((o) => o.key === v);
        return option ? { detail: equipmentOptionText(option, index) } : {};
      };
      break;
    }
    case 'option':
      if (offer.from && typeof offer.from === 'object' && !Array.isArray(offer.from)) {
        // Picked among what the character has (Agonizing Blast: a known cantrip).
        values = queryOptions(offer.from.query, sheet, catalog);
        if (/Cantrips$/.test(offer.from.query)) {
          valueKind = 'spell';
          label = nameOf('spell');
          describe = (id) => {
            const spell = index.get({ kind: 'spell', id });
            return spell ? { detail: spellDetail(spell) } : {};
          };
        }
        break;
      }
      values = from ?? [];
      label = (v) => optionLabel(offer, v);
      describe = (v) => optionWhat(offer, v, index);
      break;
    case 'featureOptions':
      valueKind =
        offer.effect?.type === 'featureOptions' ? offer.effect.optionKind : 'classFeature';
      values = from ?? [];
      label = nameOf(valueKind);
      break;
    case 'feat': {
      const categories = offer.effect?.type === 'featChoice' ? offer.effect.categories : [];
      const feats = catalog
        .of('feat')
        .filter((f) => ignore || !categories.length || categories.includes(f.category));
      const pctx = prereqContext(sheet, index);
      valueKind = 'feat';
      values = feats.map((f) => f.id);
      // Feats had already: picked, or given outright (a background's Origin feat). A repeatable
      // feat with versions (Magic Initiate's spell lists) is taken again with another version.
      const had = new Set([
        ...picked,
        ...sheet.features.filter((f) => f.ref.kind === 'feat').map((f) => f.ref.id),
      ]);
      taken = new Set(
        feats.filter((f) => had.has(f.id) && (!f.repeatable || f.variantOf)).map((f) => f.id),
      );
      label = nameOf('feat');
      describe = (id) => {
        const feat = index.get({ kind: 'feat', id });
        return {
          ...prereqFacts(feat, pctx),
          group: FEAT_GROUPS[feat?.category ?? ''] ?? 'Other feats',
        };
      };
      break;
    }
    case 'optionalFeature': {
      const types = offer.effect?.type === 'optionalFeatureChoice' ? offer.effect.featureTypes : [];
      const pctx = prereqContext(sheet, index);
      valueKind = 'optionalFeature';
      values = catalog
        .of('optionalFeature')
        .filter((o) => o.featureTypes.some((t) => types.includes(t)))
        .map((o) => o.id);
      taken = picked;
      label = nameOf('optionalFeature');
      describe = (id) => prereqFacts(index.get({ kind: 'optionalFeature', id }), pctx);
      break;
    }
    case 'spell':
      valueKind = 'spell';
      values = ignore ? catalog.of('spell').map((s) => s.id) : spellOptions(offer, ctx);
      taken = knownSpells(sheet);
      label = nameOf('spell');
      describe = (id) => {
        const spell = index.get({ kind: 'spell', id });
        if (!spell) return {};
        const { text: summary, more } = summaryOf(spell.entries);
        return {
          detail: spellDetail(spell),
          group: spellGroup(spell),
          ...(summary ? { summary } : {}),
          ...(more ? { more } : {}),
        };
      };
      break;
    case 'weaponMastery': {
      valueKind = 'item';
      values = ignore
        ? baseWeapons(catalog).map((w) => w.id)
        : weaponMasteryOptions(offer, sheet, catalog, carriedWeapons(ctx));
      taken = new Set(sheet.masteries.map((m) => m.value));
      label = nameOf('item');
      describe = (id) => {
        const item = index.get({ kind: 'item', id }) as Item | undefined;
        const w = item?.weapon;
        if (!item || !w) return {};
        const mastery = w.masteryId ? index.get({ kind: 'rule', id: w.masteryId }) : undefined;
        const text = mastery?.entries.find((e): e is string => typeof e === 'string');
        const properties = w.properties
          .map((p) => index.get({ kind: 'rule', id: p })?.name)
          .filter(Boolean)
          .join(', ');
        const damage = w.damage
          ? `${w.damage} ${w.damageType}${w.versatile ? ` (${w.versatile} two-handed)` : ''}`
          : '';
        return {
          group: `${readable(w.category)} weapons`,
          detail: [
            `${readable(w.category)} ${w.ranged ? 'ranged' : 'melee'}`,
            damage,
            distanceOf(item, isRangedWeapon(item)),
            properties,
          ]
            .filter(Boolean)
            .join(' · '),
          ...(mastery ? { about: masteryAbout(mastery.name, text ?? '') } : {}),
        };
      };
      break;
    }
  }

  const mine = new Set(current);
  const all = [...values, ...current.filter((v) => !values.includes(v))];
  const options: ChoiceOption[] = all.map((value) => ({
    value,
    label: label(value),
    ...(taken.has(value) && !mine.has(value) ? { taken: true } : {}),
    ...describe(value),
  }));
  // Common groups first (Standard languages before Rare ones); otherwise as listed.
  const rank = (o: ChoiceOption) => {
    const i = GROUP_ORDER.indexOf(o.group ?? '');
    return i < 0 ? GROUP_ORDER.length : i;
  };
  return {
    options: options
      .map((o, i) => ({ o, i }))
      .sort((a, b) => rank(a.o) - rank(b.o) || a.i - b.i)
      .map(({ o }) => o),
    ...(valueKind ? { valueKind } : {}),
    ...(hint ? { hint } : {}),
  };
}
