// The creation wizard's model (plan §9.3 step 4.4). A draft is a real Character with `draft`
// set, saved on every change; these pure helpers make its level 1 choices, set aside the picks
// an earlier step's change no longer offers (and bring them back), and finish it.

import {
  ABILITIES,
  encodeChoiceKey,
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
  'levels',
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
  levels: 'Higher levels',
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

/**
 * The steps this draft shows: the spells step only when something gives spells, the higher
 * levels only when it starts above level 1 (plan step 5.4).
 */
export function wizardSteps(sheet: DerivedSheet | undefined): WizardStep[] {
  return WIZARD_STEPS.filter(
    (s) =>
      (s !== 'spells' || hasSpellStep(sheet)) && (s !== 'levels' || (sheet?.charLevel ?? 1) > 1),
  );
}

export function setStep(c: Character, step: WizardStep): Character {
  return c.draft?.step === step ? c : { ...c, draft: { ...c.draft, step } };
}

/**
 * The class at level 1. Picks stay; the ones the new class doesn't offer are set aside
 * (`changeDraft`). Standard array scores the player hasn't moved follow the class's primary
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

/** Picks a changed draft no longer offers (their owner is gone, or no longer applies). */
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

/**
 * A change from an earlier step (a class, background or species; plan step 4C.1). The picks the
 * changed draft no longer offers are set aside on the draft, not deleted, and picks set aside
 * before come back once what offered them is chosen again: switching to another class and back
 * keeps the first one's skills and equipment.
 */
export function changeDraft(
  c: Character,
  change: (c: Character) => Character,
  index: ContentIndex,
  registry?: FeatureEffectsMap,
): Character {
  const next = change(c);
  const gone = new Set(droppedPicks(next, index, registry).map((d) => d.key));
  return restorePicks(setAside(next, gone), index, registry);
}

function setAside(c: Character, keys: ReadonlySet<string>): Character {
  if (!keys.size) return c;
  const n = structuredClone(c);
  const moved: ChoiceRecord[] = [];
  for (const entry of n.log) {
    moved.push(...entry.choices.filter((r) => keys.has(encodeChoiceKey(r.key))));
    entry.choices = entry.choices.filter((r) => !keys.has(encodeChoiceKey(r.key)));
  }
  const kept = (n.draft?.setAside ?? []).filter((r) => !keys.has(encodeChoiceKey(r.key)));
  n.draft = { step: 'class', ...n.draft, setAside: [...kept, ...moved] };
  return n;
}

/** Put back the set-aside picks the draft offers again (not ones made anew meanwhile). */
function restorePicks(c: Character, index: ContentIndex, registry?: FeatureEffectsMap): Character {
  const aside = c.draft?.setAside ?? [];
  const first = c.log[0];
  if (!aside.length || !first) return c;
  const have = new Set(c.log.flatMap((e) => e.choices.map((r) => encodeChoiceKey(r.key))));
  const candidates = aside.filter((r) => !have.has(encodeChoiceKey(r.key)));
  if (!candidates.length) return c;
  const trial = structuredClone(c);
  trial.log[0]!.choices.push(...structuredClone(candidates));
  const missing = new Set(droppedPicks(trial, index, registry).map((d) => d.key));
  const back = candidates.filter((r) => !missing.has(encodeChoiceKey(r.key)));
  if (!back.length) return c;
  const backKeys = new Set(back.map((r) => encodeChoiceKey(r.key)));
  const n = structuredClone(c);
  n.log[0]!.choices.push(...structuredClone(back));
  n.draft = {
    step: 'class',
    ...n.draft,
    setAside: aside.filter((r) => !backKeys.has(encodeChoiceKey(r.key))),
  };
  return n;
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

/**
 * Switch a draft between the 2024 and the 2014 rules (step 8.5). A class already chosen is
 * swapped for its counterpart in the other edition when there is one (the 2014 Fighter for the
 * 2024 one); the caller re-takes the levels.
 */
export function switchRuleset(
  c: Character,
  rules: '2014' | '2024',
  index: ContentIndex,
): Character {
  const { ruleset: _, ...rest } = c;
  const next: Character = rules === '2014' ? { ...rest, ruleset: '2014' } : rest;
  const classId = c.log[0]?.classRef.id;
  const current = classId ? index.get({ kind: 'class', id: classId }) : undefined;
  if (!current) return next;
  const twin =
    rules === '2014'
      ? current.edition === '2014'
        ? undefined
        : index
            .all()
            .find(
              (e) =>
                e.kind === 'class' && e.edition === '2014' && e.supersededBy?.includes(current.id),
            )
      : current.edition === '2014'
        ? (current.supersededBy ?? [])
            .map((id) => index.get({ kind: 'class', id }))
            .find((e) => !!e)
        : undefined;
  return twin ? chooseClass(next, { kind: 'class', id: twin.id }, index) : next;
}
