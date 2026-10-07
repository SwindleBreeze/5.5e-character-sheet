// The Features tab's list (plan §9.2, step 3.20): every entity whose effects apply to the
// character (items aside), with where it comes from, the picks it offers and its counters.

import {
  encodeChoiceKey,
  refKey,
  type ContentEntity,
  type Id,
  type Ref,
} from '../../schema/index.ts';
import { GRANTED_SLOT } from '../collect/collect.ts';
import type { EffectSource, Offer } from '../collect/types.ts';
import { nestedFeatureRefs, valueKind } from '../content/refs.ts';
import type { DeriveContext } from './context.ts';
import type {
  DerivedFeature,
  DerivedFeatureChoice,
  DerivedResource,
  FeatureGroup,
} from './types.ts';

const GROUPS: Partial<Record<Ref['kind'], FeatureGroup>> = {
  class: 'class',
  classFeature: 'class',
  subclass: 'subclass',
  subclassFeature: 'subclass',
  species: 'species',
  background: 'background',
  feat: 'feat',
  optionalFeature: 'optionalFeature',
  reward: 'gift',
};

const ownerKey = (ref: Ref, n?: number) => `${refKey(ref)}${n === undefined ? '' : `@${n}`}`;

const grantKey = (o: EffectSource) =>
  o.n === undefined
    ? { owner: o.ref, slot: GRANTED_SLOT }
    : { owner: o.ref, slot: GRANTED_SLOT, n: o.n };

/**
 * The feat or option progression of a class or subclass a slot belongs to
 * (`optfeat.<key>.<level>`, `featProgression.<key>.<level>`): its name and the level.
 */
function progressionOf(
  owner: ContentEntity | undefined,
  slot: string,
): { name: string; level?: number } | undefined {
  const m = /^(featProgression|optfeat)\.([^.]+)(?:\.(\d+))?$/.exec(slot);
  if (!m || (owner?.kind !== 'class' && owner?.kind !== 'subclass')) return undefined;
  const list = m[1] === 'optfeat' ? owner.optionalFeatureProgression : owner.featProgression;
  const name = list?.find((p) => p.key === m[2])?.name;
  if (!name) return undefined;
  return m[3] ? { name, level: Number(m[3]) } : { name };
}

export function deriveFeatures(
  ctx: DeriveContext,
  countOf: (offer: Offer) => number,
  resources: readonly DerivedResource[],
): DerivedFeature[] {
  const { character, index, collected, recon } = ctx;
  const log = character.log;
  const owners = collected.owners.filter((o) => o.ref.kind !== 'item');
  const byKey = new Map(owners.map((o) => [ownerKey(o.ref, o.n), o]));

  // Features written inside another feature's text.
  const parentOf = new Map<string, string>();
  for (const o of owners) {
    const entity = index.get(o.ref);
    if (!entity) continue;
    for (const child of nestedFeatureRefs(entity)) {
      if (byKey.has(refKey(child)) && !parentOf.has(refKey(child)))
        parentOf.set(refKey(child), refKey(o.ref));
    }
  }

  // What brought each entity in: the pick that chose it, or the effect that grants it.
  const broughtBy = new Map<
    string,
    { source: EffectSource; entryIndex?: number; progression?: string }
  >();
  for (const { effect, source } of collected.effects) {
    if (effect.type === 'grantFeat') broughtBy.set(refKey(effect.feat), { source });
  }
  // A repeatable feat picked again is its next instance (`@2`, `@3`), each brought by its own
  // pick, in the order the picks were made (as collection numbers them).
  const taken = new Map<string, number>();
  const instanceKey = (ref: Ref) => {
    const e = index.get(ref);
    if (e?.kind !== 'feat' || !e.repeatable) return ownerKey(ref);
    const n = (taken.get(ref.id) ?? 0) + 1;
    taken.set(ref.id, n);
    return ownerKey(ref, n === 1 ? undefined : n);
  };
  for (const { record, entryIndex } of collected.records.values()) {
    const owner = byKey.get(ownerKey(record.key.owner, record.key.n));
    const progression = progressionOf(index.get(record.key.owner), record.key.slot)?.name;
    record.values.forEach((id, i) => {
      const kind = valueKind(record.valueKinds, i);
      if (!kind || !owner) return;
      const key = instanceKey({ kind, id });
      if (!broughtBy.has(key))
        broughtBy.set(key, {
          source: owner,
          entryIndex,
          ...(progression ? { progression } : {}),
        });
    });
  }

  const classEntry = (classId: Id, level: number) => {
    const i = log.findIndex((e) => e.classRef.id === classId && e.classLevel >= level);
    return i >= 0 ? i : log.length - 1;
  };

  const levelOf = (o: EffectSource): number | undefined => {
    const e = index.get(o.ref);
    if (e?.kind === 'classFeature' || e?.kind === 'subclassFeature') return e.level;
    if (e?.kind === 'class') return 1;
    if (e?.kind === 'subclass') {
      const i = log.findIndex((x) => x.subclassRef?.id === e.id);
      return i >= 0 ? log[i]!.classLevel : undefined;
    }
    return undefined;
  };

  const entryOf = (o: EffectSource, level: number | undefined, seen: Set<string>): number => {
    const key = refKey(o.ref);
    const grant = collected.records.get(encodeChoiceKey(grantKey(o)));
    if (grant) return grant.entryIndex;
    if (o.ref.kind === 'species' || o.ref.kind === 'background') return 0;
    if (o.classId && level !== undefined) return classEntry(o.classId, level);
    const by = broughtBy.get(ownerKey(o.ref, o.n));
    if (by?.entryIndex !== undefined) return by.entryIndex;
    if (by && !seen.has(refKey(by.source.ref))) {
      seen.add(key);
      return entryOf(by.source, levelOf(by.source), seen);
    }
    return Math.max(0, log.length - 1);
  };

  const offersByOwner = new Map<string, Offer[]>();
  for (const offer of collected.offers) {
    if (offer.kind === 'equipment') continue;
    const k = ownerKey(offer.source.ref, offer.source.n);
    offersByOwner.set(k, [...(offersByOwner.get(k) ?? []), offer]);
  }

  // A class's picks that come with one of its levels: `cantrips.3`, `spellbook.5`, `spells.2`,
  // `arcanum.11`.
  const slotLevel = (slot: string): number | undefined => {
    const m = /^(?:cantrips|spells|spellbook|arcanum)\.(\d+)$/.exec(slot);
    return m ? Number(m[1]) : undefined;
  };

  return owners.map((o) => {
    const key = ownerKey(o.ref, o.n);
    const level = levelOf(o);
    const entryIndex = entryOf(o, level, new Set());
    const choices: DerivedFeatureChoice[] = [];
    for (const offer of offersByOwner.get(key) ?? []) {
      const choiceKey = encodeChoiceKey(offer.key);
      const r = recon.byKey.get(choiceKey);
      const count = countOf(offer);
      if (count <= 0 && !r) continue;
      const progression = progressionOf(index.get(o.ref), offer.key.slot);
      const atLevel = slotLevel(offer.key.slot) ?? progression?.level;
      const choice: DerivedFeatureChoice = {
        key: choiceKey,
        offer,
        count,
        values: r?.at.record.values ?? [],
        labels: r?.at.record.labels ?? [],
        entryIndex:
          o.classId && atLevel !== undefined ? classEntry(o.classId, atLevel) : entryIndex,
      };
      if (r) choice.status = r.status;
      if (r?.at.record.valueKinds) choice.valueKinds = r.at.record.valueKinds;
      if (progression) choice.progression = progression;
      choices.push(choice);
    }
    const by = broughtBy.get(ownerKey(o.ref, o.n));
    const grant = collected.records.get(encodeChoiceKey(grantKey(o)));
    const f: DerivedFeature = {
      ref: o.ref,
      name: o.name,
      group: GROUPS[o.ref.kind] ?? 'other',
      choices,
      resourceKeys: resources.filter((r) => r.key.startsWith(`${key}#`)).map((r) => r.key),
      entryIndex,
    };
    if (o.n !== undefined) f.n = o.n;
    if (o.classId) f.classId = o.classId;
    if (o.subclassId) f.subclassId = o.subclassId;
    if (level !== undefined) f.level = level;
    const parent = parentOf.get(refKey(o.ref));
    if (parent) f.parent = parent;
    if (by && refKey(by.source.ref) !== refKey(o.ref))
      f.pickedIn = {
        ref: by.source.ref,
        name: by.source.name,
        ...(by.progression ? { progression: by.progression } : {}),
      };
    if (o.fromSnapshot) f.fromSnapshot = true;
    if (grant) f.grantKey = encodeChoiceKey(grant.record.key);
    return f;
  });
}
