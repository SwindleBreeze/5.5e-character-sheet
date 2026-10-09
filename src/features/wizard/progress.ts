// What each wizard step still needs (plan §9.3b, step 4B.5). A step's required picks must be made
// before moving on: the next step and Create stay closed, and the step lists what is left. A pick
// counts only when something can fill it (content that offers nothing for it never blocks), and
// "Ignore rules" in a picker still lets any value through.

import type { AutoContext } from '../../engine/build/autoChoose.ts';
import {
  anyItemKey,
  grantPool,
  pickedEquipment,
  startingEquipmentOwners,
} from '../../engine/build/equipment.ts';
import { POINT_BUY_BUDGET, pointBuyCost } from '../../engine/build/scores.ts';
import { WIZARD_STEPS, type WizardStep } from '../../engine/build/wizard.ts';
import { offerOptions } from '../../engine/choices/options.ts';
import type { Pending } from '../../engine/choices/reconcile.ts';
import type { Offer } from '../../engine/collect/types.ts';
import type { DerivedFeature, DerivedSheet } from '../../engine/derive/types.ts';
import { matchesSpellFilter } from '../../engine/spells/filter.ts';
import { refKey, type Character, type Species } from '../../schema/index.ts';
import { choiceTitle } from '../choices/labels.ts';

const SPELL_KINDS = new Set(['spell', 'spellAbility']);

export const isSpellOffer = (offer: Offer) => SPELL_KINDS.has(offer.kind);

/** The feature at the root of what brought this one in (a feat a species picked: the species). */
export function rootOf(f: DerivedFeature, all: readonly DerivedFeature[]): DerivedFeature {
  let current = f;
  const seen = new Set<string>();
  while (current.pickedIn && !seen.has(refKey(current.ref))) {
    seen.add(refKey(current.ref));
    const parent = all.find((x) => refKey(x.ref) === refKey(current.pickedIn!.ref));
    if (!parent) break;
    current = parent;
  }
  return current;
}

/**
 * The step where a pick is made: the class's own skills, tools and equipment on the class step;
 * everything a background or species brings (its feat's spells too) on theirs; class spells on
 * the spells step; the rest of what class features offer on the class features step.
 */
export function stepOf(offer: Offer, sheet: DerivedSheet): WizardStep {
  const ownerKind = offer.source.ref.kind;
  if (offer.kind === 'equipment') return ownerKind === 'background' ? 'background' : 'class';
  // A pick a higher level brings is made on its level's card (plan step 5.4).
  const choice = sheet.features.flatMap((f) => f.choices).find((c) => c.offer === offer);
  if (choice && choice.entryIndex > 0) return 'levels';
  const owner = sheet.features.find(
    (f) => refKey(f.ref) === refKey(offer.source.ref) && f.n === offer.source.n,
  );
  const root = (owner ? rootOf(owner, sheet.features) : undefined)?.ref.kind ?? ownerKind;
  if (root === 'background') return 'background';
  if (root === 'species') return 'species';
  if (isSpellOffer(offer)) return 'spells';
  if (ownerKind === 'class' && offer.kind === 'proficiency') return 'class';
  return 'choices';
}

/**
 * The features with picks on a step, and which of their picks: top-level ones only (a feat a
 * class pick chose opens under that pick).
 */
export function picksOnStep(
  sheet: DerivedSheet,
  step: WizardStep,
): {
  features: DerivedFeature[];
  only: (c: { offer: Offer }) => boolean;
} {
  const only = (c: { offer: Offer }) => stepOf(c.offer, sheet) === step;
  const all = sheet.features;
  // Shown under its pick only when that pick is on this step too: Magician, picked for Primal
  // Order on the class features step, has its cantrip on the spells step, by itself.
  const underPick = (f: DerivedFeature) => {
    if (!f.pickedIn) return false;
    const by = all.find((x) => refKey(x.ref) === refKey(f.pickedIn!.ref));
    return !!by?.choices.some((c) => c.values.includes(f.ref.id) && only(c));
  };
  return { features: all.filter((f) => !underPick(f) && f.choices.some(only)), only };
}

/** Whether a pick has anything left to pick from (not had already, prerequisites met). */
export function fillable(p: Pending, ctx: AutoContext): boolean {
  if (p.offer.kind === 'equipment') return Array.isArray(p.offer.from) && p.offer.from.length > 0;
  const current =
    ctx.sheet.features.flatMap((f) => f.choices).find((c) => c.offer === p.offer)?.values ?? [];
  return offerOptions(p.offer, ctx, current).options.some(
    (o) => !current.includes(o.value) && !o.taken && !o.unmet?.length,
  );
}

/** A species' lineages, ancestries or other versions in what the sources offer. */
export function variantsOf(species: Species | undefined, ctx: AutoContext): Species[] {
  if (!species) return [];
  return ctx.catalog.of('species').filter((s) => s.variantOf === species.id);
}

/**
 * What a species calls its versions: `Lineage`, `Ancestry` or `Legacy`, from the versions' names
 * (`Elf; High Elf Lineage`) or else a trait of the species (Dragonborn's "Draconic Ancestry");
 * `Type` when neither says.
 */
export function variantLabel(variants: readonly Species[], species?: Species): string {
  const words = ['Lineage', 'Ancestry', 'Legacy'];
  for (const word of words)
    if (variants.length && variants.every((v) => v.name.includes(word))) return word;
  const traits = (species?.entries ?? []).flatMap((e) =>
    typeof e === 'object' && e && 'name' in e && typeof e.name === 'string' ? [e.name] : [],
  );
  return words.find((word) => traits.some((t) => t.split(' ').includes(word))) ?? 'Type';
}

/** `a lineage`, `an ancestry`. */
export function aOrAn(word: string): string {
  return `${/^[aeiou]/i.test(word) ? 'an' : 'a'} ${word}`;
}

export interface StepTodo {
  step: WizardStep;
  text: string;
}

function pendingText(p: Pending, sheet: DerivedSheet): string {
  const source = p.offer.source.name;
  if (p.offer.kind === 'equipment') return `${source}: starting equipment`;
  const choice = sheet.features.flatMap((f) => f.choices).find((c) => c.offer === p.offer);
  const what = choice ? choiceTitle(choice) : 'a choice';
  const left = p.offer.kind === 'backgroundAbility' ? '' : ` (${p.count - p.have} more)`;
  // "Weapon Mastery: Weapon Mastery" says it once.
  return `${what === source ? what : `${source}: ${what}`}${left}`;
}

/** Prepared spells a Long Rest caster still has room for, when its list has any to give. */
function preparedShortfall(sheet: DerivedSheet, ctx: AutoContext): StepTodo[] {
  const out: StepTodo[] = [];
  for (const c of sheet.spellcasting.casters) {
    if (c.preparedChange !== 'restLong' || c.preparedMax <= 0) continue;
    const always = new Set(c.alwaysPrepared);
    const counted = c.prepared.filter((id) => !always.has(id));
    const left = c.preparedMax - counted.length;
    if (left <= 0) continue;
    const taken = new Set([...always, ...c.prepared]);
    const pool = c.spellbook
      ? c.spellbook
      : ctx.catalog
          .of('spell')
          .filter(
            (s) =>
              s.level >= 1 &&
              s.level <= c.maxSpellLevel &&
              (c.list.ids.includes(s.id) || c.list.filters.some((f) => matchesSpellFilter(s, f))),
          )
          .map((s) => s.id);
    if (pool.some((id) => !taken.has(id)))
      out.push({
        step: 'spells',
        text: `${c.name}: prepare ${left} more spell${left === 1 ? '' : 's'}`,
      });
  }
  return out;
}

/** Everything still to do, by step, in step order. */
export function wizardTodos(character: Character, ctx: AutoContext | undefined): StepTodo[] {
  const out: StepTodo[] = [];
  const first = character.log[0];
  if (!first || !ctx) return [{ step: 'class', text: 'Choose a class' }];
  const { sheet, index } = ctx;
  if (!first.origin?.backgroundRef) out.push({ step: 'background', text: 'Choose a background' });
  const speciesRef = first.origin?.speciesRef;
  let needsVariant = false;
  if (!speciesRef) out.push({ step: 'species', text: 'Choose a species' });
  else {
    const chosen = index.get({ kind: 'species', id: speciesRef.id });
    const variants = variantsOf(chosen, ctx);
    needsVariant = variants.length > 0;
    if (needsVariant)
      out.push({
        step: 'species',
        text: `Choose ${aOrAn(variantLabel(variants, chosen).toLowerCase())}`,
      });
  }
  for (const p of sheet.choices.pending) {
    const step = stepOf(p.offer, sheet);
    // A species' own picks show once its lineage is chosen (the lineage may change them).
    if (needsVariant && step === 'species') continue;
    if (fillable(p, ctx)) out.push({ step, text: pendingText(p, sheet) });
  }
  // "Any …" equipment entries and item groups: an item to pick, when any item fits.
  for (const owner of startingEquipmentOwners(character, index)) {
    const option = pickedEquipment(character, owner.ref, owner.options);
    option?.items.forEach((g, i) => {
      if (character.draft?.anyItems?.[anyItemKey(owner.ref, option.key, i)]) return;
      const pool = grantPool(g, ctx.catalog, index);
      if (!pool?.items.length) return;
      out.push({
        step: owner.ref.kind === 'background' ? 'background' : 'class',
        text: `${owner.name}: which ${pool.label.toLowerCase()}`,
      });
    });
  }
  if (character.scoreMethod === 'pointBuy') {
    const cost = pointBuyCost(character.baseScores);
    if (cost > POINT_BUY_BUDGET)
      out.push({ step: 'abilities', text: `Point buy: ${cost - POINT_BUY_BUDGET} points over` });
  }
  if (character.scoreMethod === 'rolled' && !character.draft?.rolls?.length)
    out.push({ step: 'abilities', text: 'Roll your scores' });
  out.push(...preparedShortfall(sheet, ctx));
  const order = (s: WizardStep) => WIZARD_STEPS.indexOf(s);
  return out.sort((a, b) => order(a.step) - order(b.step));
}
