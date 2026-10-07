// The creation wizard's model (plan §9.3 step 4.4). A draft is a real Character with `draft`
// set, saved on every change; these pure helpers make its level 1 choices, say which picks an
// earlier step's change would remove, and finish it.

import {
  ABILITIES,
  encodeChoiceKey,
  refKey,
  type Ability,
  type Character,
  type ChoiceRecord,
  type Ref,
} from '../../schema/index.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import { refreshSnapshots } from '../content/snapshots.ts';
import { derive } from '../derive/derive.ts';
import type { DerivedSheet } from '../derive/types.ts';
import type { FeatureEffectsMap } from '../featureEffects/types.ts';
import { valueKind } from '../content/refs.ts';
import { newCharacter } from './newCharacter.ts';
import { primaryOrder, startingScores } from './scores.ts';

export const WIZARD_STEPS = [
  'class',
  'background',
  'species',
  'abilities',
  'choices',
  'spells',
  'details',
  'review',
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];

export const STEP_TITLES: Readonly<Record<WizardStep, string>> = {
  class: 'Class',
  background: 'Background',
  species: 'Species',
  abilities: 'Ability scores',
  choices: 'Class features',
  spells: 'Spells',
  details: 'Details',
  review: 'Review',
};

export function isWizardStep(step: string): step is WizardStep {
  return (WIZARD_STEPS as readonly string[]).includes(step);
}

/** A new draft: no class yet, on the first step, with the standard array to start from. */
export function newDraft(now = Date.now()): Character {
  return {
    ...newCharacter('New character', now),
    baseScores: startingScores('standard', []),
    draft: { step: 'class' },
  };
}

/**
 * Whether the spells step has anything: a class (or its features) gives spells. A species' or
 * background feat's spells are picked on that step.
 */
export function hasSpellStep(sheet: DerivedSheet | undefined): boolean {
  if (!sheet) return false;
  const classOwned = new Set(['class', 'subclass', 'classFeature', 'subclassFeature']);
  return (
    sheet.spellcasting.casters.length > 0 ||
    sheet.features.some(
      (f) =>
        classOwned.has(f.ref.kind) &&
        f.choices.some((c) => c.offer.kind === 'spell' || c.offer.kind === 'spellAbility'),
    )
  );
}

/** The steps this draft shows: the spells step only when something gives spells. */
export function wizardSteps(sheet: DerivedSheet | undefined): WizardStep[] {
  return WIZARD_STEPS.filter((s) => s !== 'spells' || hasSpellStep(sheet));
}

export function setStep(c: Character, step: WizardStep): Character {
  return c.draft?.step === step ? c : { ...c, draft: { ...c.draft, step } };
}

/**
 * The class at level 1. Picks stay; the ones the new class doesn't offer are dropped apart
 * (`previewChange`). Standard array scores the player hasn't moved follow the class's primary
 * abilities.
 */
export function chooseClass(c: Character, classRef: Ref, index?: ContentIndex): Character {
  const n = structuredClone(c);
  const first = n.log[0];
  const before = first ? index?.get({ kind: 'class', id: first.classRef.id }) : undefined;
  const after = index?.get({ kind: 'class', id: classRef.id });
  const untouched = (scores: Character['baseScores'], primary: readonly Ability[]) => {
    const auto = startingScores('standard', primary);
    return ABILITIES.every((a) => scores[a] === auto[a]);
  };
  if (
    after &&
    n.scoreMethod === 'standard' &&
    (untouched(n.baseScores, primaryOrder(before)) || untouched(n.baseScores, []))
  )
    n.baseScores = startingScores('standard', primaryOrder(after));
  if (!first) {
    n.log = [{ charLevel: 1, classRef, classLevel: 1, hp: { mode: 'max' }, choices: [] }];
  } else {
    first.classRef = classRef;
    delete first.subclassRef;
  }
  return n;
}

function setOrigin(c: Character, patch: { speciesRef?: Ref; backgroundRef?: Ref }): Character {
  const n = structuredClone(c);
  const first = n.log[0];
  if (first) first.origin = { ...first.origin, ...patch };
  return n;
}

export function chooseBackground(c: Character, backgroundRef: Ref): Character {
  return setOrigin(c, { backgroundRef });
}

export function chooseSpecies(c: Character, speciesRef: Ref): Character {
  return setOrigin(c, { speciesRef });
}

export interface DroppedPick {
  /** The encoded choice key. */
  key: string;
  /** Whose pick it was. */
  owner: string;
  labels: string[];
}

/**
 * Picks a changed draft no longer offers (their owner is gone, or no longer applies): the
 * ones the wizard lists as "these picks will be removed" before a change is confirmed.
 */
export function droppedPicks(
  next: Character,
  index: ContentIndex,
  registry?: FeatureEffectsMap,
): DroppedPick[] {
  const sheet = derive(next, index, registry ? { registry } : {});
  return sheet.choices.attention
    .filter((r) => r.status === 'slotMissing')
    .map((r) => ({
      key: r.key,
      owner: index.get(r.at.record.key.owner)?.name ?? r.at.record.key.owner.id,
      labels: recordLabels(r.at.record, index),
    }));
}

function recordLabels(r: ChoiceRecord, index: ContentIndex): string[] {
  return r.values.map((v, i) => {
    const kind = valueKind(r.valueKinds, i);
    return (kind && index.get({ kind, id: v })?.name) || r.labels[i] || v;
  });
}

/** Remove these picks, and the items picked for starting equipment no longer offered. */
export function dropPicks(c: Character, keys: readonly string[]): Character {
  const gone = new Set(keys);
  const n = structuredClone(c);
  for (const entry of n.log)
    entry.choices = entry.choices.filter((r) => !gone.has(encodeChoiceKey(r.key)));
  const owners = new Set(
    (n.log[0]?.choices ?? [])
      .filter((r) => r.key.slot === 'equipment')
      .map((r) => refKey(r.key.owner)),
  );
  const anyItems = n.draft?.anyItems;
  if (n.draft && anyItems) {
    n.draft.anyItems = Object.fromEntries(
      Object.entries(anyItems).filter(([k]) => owners.has(k.split('#')[0] ?? '')),
    );
  }
  return n;
}

/**
 * Make a change from an earlier step: the changed draft, and the picks it would remove. With
 * none, the change can be applied as it is; otherwise after the player confirms, with
 * `dropPicks`.
 */
export function previewChange(
  c: Character,
  change: (c: Character) => Character,
  index: ContentIndex,
  registry?: FeatureEffectsMap,
): { next: Character; dropped: DroppedPick[] } {
  const next = change(c);
  return { next, dropped: droppedPicks(next, index, registry) };
}

/**
 * Finish creation: the draft mark goes, and snapshots of everything the character uses are
 * stored (plan §4.4), so it survives content that is removed later.
 */
export function finishDraft(
  c: Character,
  index: ContentIndex,
  registry?: FeatureEffectsMap,
  now = Date.now(),
): Character {
  const n = structuredClone(c);
  delete n.draft;
  if (!n.name.trim()) n.name = 'New character';
  const sheet = derive(n, index, registry ? { registry } : {});
  return refreshSnapshots(n, index, sheet, now);
}
