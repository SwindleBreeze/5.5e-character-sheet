// What a choice can be (plan §9.2, step 3.20): every value an offer allows, with a readable
// label, for the picker on the Features tab. Values the character already has from something
// else are marked, so a player doesn't take the same skill twice.

import {
  ABILITIES,
  ABILITY_NAMES,
  type Ability,
  type Background,
  type EntityKind,
} from '../../schema/index.ts';
import {
  knownSpells,
  proficiencyOptions,
  spellOptions,
  type AutoContext,
} from '../build/autoChoose.ts';
import type { Offer } from '../collect/types.ts';
import { queryOptions } from './queries.ts';

export interface ChoiceOption {
  value: string;
  label: string;
  /** The character already has it from something else. */
  taken?: boolean;
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

/** The same pick in any order: background increases are compared this way. */
export const sameSpread = (a: readonly string[], b: readonly string[]) =>
  [...a].sort().join() === [...b].sort().join();

/**
 * Everything an offer allows. `current` are the picks being changed: they are always listed,
 * and never marked as already had.
 */
export function offerOptions(
  offer: Offer,
  ctx: AutoContext,
  current: readonly string[] = [],
): OfferOptions {
  const { character, sheet, catalog, index } = ctx;
  const from = Array.isArray(offer.from) ? (offer.from as string[]) : undefined;
  const picked = new Set(character.log.flatMap((e) => e.choices.flatMap((r) => r.values)));
  const nameOf = (kind: EntityKind) => (id: string) =>
    index.get({ kind, id })?.name ?? readable(id.split('|')[0] ?? id);

  let values: string[] = [];
  let label: (value: string) => string = readable;
  let taken = new Set<string>();
  let valueKind: EntityKind | undefined;

  switch (offer.kind) {
    case 'ability':
    case 'spellAbility':
      values = from ?? [...ABILITIES];
      label = (a) => ABILITY_NAMES[a as Ability] ?? a;
      break;
    case 'backgroundAbility': {
      const bg = index.get({ kind: 'background', id: offer.key.owner.id });
      const spreads = backgroundSpreads(bg?.abilityOptions ?? []);
      const mine = spreads.find((s) => sameSpread(s, current));
      return {
        joined: true,
        options: spreads.map((s) => ({
          value: (s === mine ? current : s).join(),
          label: spreadLabel(s),
        })),
      };
    }
    case 'proficiency': {
      const o = proficiencyOptions(offer, ctx);
      values = o.options;
      taken = o.taken;
      label = (v) => index.get({ kind: 'item', id: v })?.name ?? readable(v);
      break;
    }
    case 'expertise':
      values = from ?? queryOptions('proficientSkillsWithoutExpertise', sheet, catalog);
      break;
    case 'resistance':
    case 'equipment':
      values = from ?? [];
      break;
    case 'option':
      values = from ?? [];
      label = (v) => offer.labels?.[values.indexOf(v)] ?? v;
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
        .filter((f) => !categories.length || categories.includes(f.category));
      valueKind = 'feat';
      values = feats.map((f) => f.id);
      taken = new Set(feats.filter((f) => !f.repeatable && picked.has(f.id)).map((f) => f.id));
      label = nameOf('feat');
      break;
    }
    case 'optionalFeature': {
      const types = offer.effect?.type === 'optionalFeatureChoice' ? offer.effect.featureTypes : [];
      valueKind = 'optionalFeature';
      values = catalog
        .of('optionalFeature')
        .filter((o) => o.featureTypes.some((t) => types.includes(t)))
        .map((o) => o.id);
      taken = picked;
      label = nameOf('optionalFeature');
      break;
    }
    case 'spell':
      valueKind = 'spell';
      values = spellOptions(offer, ctx);
      taken = knownSpells(sheet);
      label = nameOf('spell');
      break;
    case 'weaponMastery':
      valueKind = 'item';
      values =
        typeof offer.from === 'object' && 'query' in offer.from
          ? queryOptions(offer.from.query, sheet, catalog)
          : (from ?? queryOptions('proficientWeapons', sheet, catalog));
      taken = new Set(sheet.masteries.map((m) => m.value));
      label = nameOf('item');
      break;
  }

  const mine = new Set(current);
  const all = [...values, ...current.filter((v) => !values.includes(v))];
  return {
    options: all.map((value) => ({
      value,
      label: label(value),
      ...(taken.has(value) && !mine.has(value) ? { taken: true } : {}),
    })),
    ...(valueKind ? { valueKind } : {}),
  };
}
