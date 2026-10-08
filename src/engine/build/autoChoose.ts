// Automatic picks (plan §9.2, step 3.10): a deterministic, sensible-enough value for any offer,
// so the quick-builder and "fill the rest automatically" can finish a character.

import {
  ABILITIES,
  SKILLS,
  type Ability,
  type Character,
  type EntityKind,
  type Feat,
  type Id,
} from '../../schema/index.ts';
import { expertiseOptions, queryOptions, weaponMasteryOptions } from '../choices/queries.ts';
import type { Offer } from '../collect/types.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import type { DerivedSheet } from '../derive/types.ts';
import { levelsUpTo, matchesSpellFilter } from '../spells/filter.ts';
import type { Catalog } from './catalog.ts';

export interface AutoContext {
  character: Character;
  sheet: DerivedSheet;
  catalog: Catalog;
  index: ContentIndex;
}

export interface AutoPick {
  values: string[];
  valueKinds?: EntityKind[];
  labels?: string[];
}

/** Abilities in the order this character wants them: highest score first. */
function abilityPriority(sheet: DerivedSheet): Ability[] {
  return [...ABILITIES].sort(
    (a, b) => sheet.abilities[b].score.value - sheet.abilities[a].score.value,
  );
}

function firstN<T>(options: readonly T[], n: number, taken: ReadonlySet<T> = new Set()): T[] {
  return options.filter((o) => !taken.has(o)).slice(0, n);
}

const lower = (values: readonly { value: string }[]) =>
  new Set(values.map((v) => v.value.toLowerCase()));

export function proficiencyOptions(
  offer: Offer,
  ctx: AutoContext,
): { options: string[]; taken: Set<string> } {
  const { sheet, catalog } = ctx;
  const effect = offer.effect?.type === 'proficiencyChoice' ? offer.effect : undefined;
  const categories = effect
    ? Array.isArray(effect.category)
      ? effect.category
      : [effect.category]
    : ['skill'];
  // One kind, or several joined with `|` (Monk: artisan's tools or a musical instrument).
  const kinds = effect?.filter?.split('|');
  // Half proficiency (Jack of All Trades) isn't having the skill.
  const skillsTaken = new Set<string>(
    SKILLS.filter((s) => ['proficient', 'expertise'].includes(sheet.skills[s].proficiency)),
  );
  const taken = new Set([
    ...skillsTaken,
    ...lower(sheet.proficiencies.tools),
    ...lower(sheet.proficiencies.languages),
  ]);
  if (Array.isArray(offer.from)) return { options: offer.from, taken };
  const options: string[] = [];
  for (const category of categories) {
    if (category === 'skill') options.push(...SKILLS);
    if (category === 'tool') {
      options.push(
        ...catalog
          .of('item')
          .filter(
            (i) =>
              i.itemKind === 'tool' && !i.rarity && (!kinds || kinds.includes(i.toolType ?? '')),
          )
          .map((i) => i.id),
      );
    }
    if (category === 'language') {
      options.push(
        ...catalog
          .of('rule')
          .filter(
            (r) => r.ruleKind === 'language' && (!kinds || kinds.includes(r.languageType ?? '')),
          )
          .map((r) => r.name.toLowerCase()),
      );
    }
  }
  return { options, taken };
}

/** Base weapons in the character's inventory (a +1 Longsword counts as a Longsword). */
export function carriedWeapons(ctx: AutoContext): Set<Id> {
  const out = new Set<Id>();
  for (const row of ctx.character.inventory) {
    if (!row.itemRef) continue;
    const item = ctx.index.get({ kind: 'item', id: row.itemRef.id });
    out.add(item?.baseItemId ?? row.itemRef.id);
  }
  return out;
}

/**
 * `level=castable` in a mapping's filter: cantrips and the levels the character has spell slots
 * for (Magical Discoveries: "a cantrip or a spell for which you have spell slots").
 */
function castable(filter: string, ctx: AutoContext): string {
  if (!filter.includes('level=castable')) return filter;
  const max = Math.max(0, ...ctx.sheet.spellcasting.casters.map((c) => c.maxSpellLevel));
  return filter.replace('level=castable', levelsUpTo(max, 0));
}

export function spellOptions(offer: Offer, ctx: AutoContext): Id[] {
  if (Array.isArray(offer.from)) return offer.from;
  const grant =
    offer.effect?.type === 'grantSpells'
      ? offer.effect.spells.find((g) => 'slot' in g.spell && g.spell.slot === offer.key.slot)
      : undefined;
  const filter = castable(grant && 'choose' in grant.spell ? (grant.spell.choose ?? '') : '', ctx);
  return ctx.catalog
    .of('spell')
    .filter((s) => matchesSpellFilter(s, filter))
    .map((s) => s.id);
}

export function knownSpells(sheet: DerivedSheet): Set<Id> {
  return new Set([
    ...sheet.spellcasting.casters.flatMap((c) => [
      ...c.cantrips,
      ...c.prepared,
      ...c.alwaysPrepared,
      ...(c.spellbook ?? []),
    ]),
    ...sheet.spellcasting.granted.map((g) => g.spellId),
  ]);
}

function featOptions(offer: Offer, ctx: AutoContext): Feat[] {
  const categories = offer.effect?.type === 'featChoice' ? offer.effect.categories : [];
  const taken = new Set(ctx.character.log.flatMap((e) => e.choices.flatMap((r) => r.values)));
  const feats = ctx.catalog
    .of('feat')
    .filter(
      (f) =>
        (!categories.length || categories.includes(f.category)) &&
        (f.repeatable || !taken.has(f.id)),
    );
  // The plain Ability Score Improvement feat first, when it is one of the options.
  return [
    ...feats.filter((f) => f.name === 'Ability Score Improvement'),
    ...feats.filter((f) => f.name !== 'Ability Score Improvement'),
  ];
}

/** A pick for `count` values of an offer; empty when nothing fits. */
export function autoChoose(offer: Offer, count: number, ctx: AutoContext): AutoPick {
  const { sheet, catalog, index } = ctx;
  const nameOf = (kind: EntityKind, id: Id) => index.get({ kind, id })?.name ?? id;
  switch (offer.kind) {
    case 'ability':
    case 'spellAbility': {
      const from = Array.isArray(offer.from) ? (offer.from as Ability[]) : [...ABILITIES];
      return {
        values: abilityPriority(sheet)
          .filter((a) => from.includes(a))
          .slice(0, count),
      };
    }
    case 'backgroundAbility': {
      const bg = index.get({ kind: 'background', id: offer.key.owner.id });
      const option = bg?.abilityOptions[0];
      if (!option) return { values: [] };
      const ranked = abilityPriority(sheet).filter((a) => option.from.includes(a));
      const weights = [...option.weights].sort((a, b) => b - a);
      return { values: weights.flatMap((w, i) => Array<Ability>(w).fill(ranked[i] ?? ranked[0]!)) };
    }
    case 'proficiency': {
      const { options, taken } = proficiencyOptions(offer, ctx);
      const values = firstN(options, count, taken);
      return { values: values.length >= count ? values : firstN(options, count) };
    }
    case 'expertise': {
      return { values: firstN(expertiseOptions(offer, sheet, catalog), count) };
    }
    case 'resistance':
    case 'option':
    case 'equipment': {
      const from = Array.isArray(offer.from)
        ? offer.from
        : offer.from && typeof offer.from === 'object'
          ? queryOptions(offer.from.query, sheet, catalog)
          : [];
      const values = firstN(from, count);
      if (
        typeof offer.from === 'object' &&
        !Array.isArray(offer.from) &&
        /Cantrips$/.test(offer.from.query)
      )
        return { values, valueKinds: ['spell'], labels: values.map((v) => nameOf('spell', v)) };
      const labels = offer.labels ? values.map((v) => offer.labels![from.indexOf(v)] ?? v) : values;
      return { values, labels };
    }
    case 'featureOptions': {
      const kind =
        offer.effect?.type === 'featureOptions' ? offer.effect.optionKind : 'classFeature';
      const values = firstN(Array.isArray(offer.from) ? offer.from : [], count);
      return { values, valueKinds: [kind], labels: values.map((v) => nameOf(kind, v)) };
    }
    case 'feat': {
      const values = featOptions(offer, ctx)
        .slice(0, count)
        .map((f) => f.id);
      return { values, valueKinds: ['feat'], labels: values.map((v) => nameOf('feat', v)) };
    }
    case 'optionalFeature': {
      const types = offer.effect?.type === 'optionalFeatureChoice' ? offer.effect.featureTypes : [];
      const taken = new Set(ctx.character.log.flatMap((e) => e.choices.flatMap((r) => r.values)));
      const values = firstN(
        catalog
          .of('optionalFeature')
          .filter((o) => o.featureTypes.some((t) => types.includes(t)))
          .map((o) => o.id),
        count,
        taken,
      );
      return {
        values,
        valueKinds: ['optionalFeature'],
        labels: values.map((v) => nameOf('optionalFeature', v)),
      };
    }
    case 'spell': {
      const values = firstN(spellOptions(offer, ctx), count, knownSpells(sheet));
      return {
        values,
        valueKinds: ['spell'],
        labels: values.map((v) => catalog.of('spell').find((s) => s.id === v)?.name ?? v),
      };
    }
    case 'weaponMastery': {
      const options = weaponMasteryOptions(offer, sheet, catalog, carriedWeapons(ctx));
      const values = firstN(options, count, new Set(sheet.masteries.map((m) => m.value)));
      return { values, valueKinds: ['item'], labels: values.map((v) => nameOf('item', v)) };
    }
  }
}
