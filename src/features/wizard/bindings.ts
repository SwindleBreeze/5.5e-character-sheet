// What every wizard step gets (plan §9.3, step 4.4), and where each pick is made.

import type { AllContent } from '../../content/hooks.ts';
import type { AutoContext } from '../../engine/build/autoChoose.ts';
import type { WizardStep } from '../../engine/build/wizard.ts';
import type { Offer } from '../../engine/collect/types.ts';
import type { DerivedFeature, DerivedSheet } from '../../engine/derive/types.ts';
import { refKey, type Character } from '../../schema/index.ts';
import type { CharacterUpdate } from '../sheet/useCharacterActions.ts';

export interface WizardBindings {
  character: Character;
  /** Missing until a class is chosen. */
  sheet: DerivedSheet | undefined;
  /** Everything imported (names), and what the enabled sources offer (pickers). */
  content: AllContent;
  /** A change on the current step; the draft's starting equipment follows it. */
  apply: (update: CharacterUpdate) => void;
  /**
   * A change to the class, background or species: when it would remove picks, they are listed
   * and removed only once the player confirms.
   */
  change: (update: CharacterUpdate) => void;
  /** Go to a step. */
  go: (step: WizardStep) => void;
}

export function choiceContext(b: WizardBindings, sheet: DerivedSheet): AutoContext {
  return {
    character: b.character,
    sheet,
    catalog: b.content.catalog,
    index: b.content.index,
  };
}

const SPELL_KINDS = new Set(['spell', 'spellAbility']);

export const isSpellOffer = (offer: Offer) => SPELL_KINDS.has(offer.kind);

/**
 * The feature at the root of what brought this one in (a feat picked by a species' choice:
 * the species).
 */
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

/** The step where an offer's pick is made. */
export function stepOf(offer: Offer, sheet: DerivedSheet): WizardStep {
  if (offer.kind === 'equipment') return 'equipment';
  if (isSpellOffer(offer)) return 'spells';
  const owner = sheet.features.find(
    (f) => refKey(f.ref) === refKey(offer.source.ref) && f.n === offer.source.n,
  );
  const root = owner ? rootOf(owner, sheet.features) : undefined;
  const kind = root?.ref.kind ?? offer.source.ref.kind;
  if (kind === 'background') return 'background';
  if (kind === 'species') return 'species';
  return 'choices';
}
