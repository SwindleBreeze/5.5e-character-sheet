// Picks and gifts changed from the Features tab (plan §9.2, step 3.20). Pure: each returns a new
// character. Build decisions stay in the log (plan §4.4): a pick made later goes in the entry
// it belongs to, a changed pick is a `retrain`, a gift is a `manual` record in the top entry.

import {
  encodeChoiceKey,
  refKey,
  sameRef,
  type Character,
  type ChoiceKey,
  type ChoiceRecord,
  type Effect,
  type EntityKind,
  type Ref,
} from '../../schema/index.ts';
import { setChoice } from '../build/build.ts';
import { GRANTED_SLOT } from '../collect/collect.ts';
import { valueKind } from '../content/refs.ts';

export interface PickSpec {
  values: string[];
  labels: string[];
  valueKinds?: EntityKind[];
  /** The log entry for a first pick (a later change stays where the record is). */
  entryIndex: number;
  now?: number;
  /** How the pick is recorded, whatever it changes (a character still being created). */
  via?: ChoiceRecord['via'];
}

/** The entities a record picked: feats, optional features, a feature's chosen option. */
function pickedRefs(r: ChoiceRecord): Ref[] {
  return r.values.flatMap((id, i) => {
    const kind = valueKind(r.valueKinds, i);
    return kind ? [{ kind, id }] : [];
  });
}

const records = (c: Character) => c.log.flatMap((e) => e.choices);

/** Still picked by some record, or granted outright. */
function stillHeld(c: Character, ref: Ref): boolean {
  return records(c).some(
    (r) =>
      (r.key.slot === GRANTED_SLOT && sameRef(r.key.owner, ref)) ||
      pickedRefs(r).some((p) => sameRef(p, ref)),
  );
}

/**
 * Remove what these entities leave behind once nothing holds them: the picks they own (and,
 * in turn, what those picked) and their spent uses. Mutates `c`, a fresh copy.
 */
function dropOrphans(c: Character, refs: readonly Ref[]): void {
  const queue = [...refs];
  const done = new Set<string>();
  while (queue.length) {
    const ref = queue.pop()!;
    const key = refKey(ref);
    if (done.has(key) || stillHeld(c, ref)) continue;
    done.add(key);
    for (const entry of c.log) {
      entry.choices = entry.choices.filter((r) => {
        if (!sameRef(r.key.owner, ref)) return true;
        queue.push(...pickedRefs(r));
        return false;
      });
    }
    for (const k of Object.keys(c.state.resourcesUsed)) {
      if (k.startsWith(`${key}#`) || k.startsWith(`${key}@`)) delete c.state.resourcesUsed[k];
    }
  }
}

/**
 * Make or change a pick. A first pick goes in `entryIndex`, recorded as made at creation or on
 * that level-up; changing a pick replaces its values where the record is, as a retrain (adding
 * to an unfinished pick is not), unless `via` says otherwise. No values removes the pick.
 * Entities no longer picked take their own picks with them.
 */
export function setPick(c: Character, key: ChoiceKey, spec: PickSpec): Character {
  const encoded = encodeChoiceKey(key);
  const existing = records(c).find((r) => encodeChoiceKey(r.key) === encoded);
  const opts = {
    labels: spec.labels,
    ...(spec.valueKinds ? { valueKinds: spec.valueKinds } : {}),
    ...(spec.now !== undefined ? { now: spec.now } : {}),
  };
  if (!existing) {
    if (!spec.values.length) return c;
    return setChoice(c, key, spec.values, {
      ...opts,
      entryIndex: spec.entryIndex,
      via: spec.via ?? (spec.entryIndex === 0 ? 'creation' : 'levelUp'),
    });
  }
  // Nothing picked any more: the record goes, with what it brought in.
  if (!spec.values.length) {
    const n = structuredClone(c);
    for (const entry of n.log)
      entry.choices = entry.choices.filter((r) => encodeChoiceKey(r.key) !== encoded);
    dropOrphans(n, pickedRefs(existing));
    unprepareDropped(n, existing, spec.values);
    return n;
  }
  const kept = existing.values.every((v) => spec.values.includes(v));
  const via = spec.via ?? (kept ? undefined : 'retrain');
  const n = setChoice(c, key, spec.values, { ...opts, ...(via ? { via } : {}) });
  dropOrphans(
    n,
    pickedRefs(existing).filter((ref) => !spec.values.includes(ref.id)),
  );
  unprepareDropped(n, existing, spec.values);
  return n;
}

/**
 * A spell taken out of a caster's pick (a Wizard's spellbook) is no longer prepared by that
 * caster, unless another of its picks still holds it. Mutates `n`, a fresh copy.
 */
function unprepareDropped(n: Character, existing: ChoiceRecord, kept: readonly string[]): void {
  const caster = existing.key.owner.id;
  const prepared = n.state.prepared[caster];
  if (!prepared) return;
  const held = new Set(
    records(n)
      .filter((r) => r.key.owner.id === caster)
      .flatMap((r) => r.values),
  );
  const dropped = existing.values.filter(
    (v, i) => valueKind(existing.valueKinds, i) === 'spell' && !kept.includes(v) && !held.has(v),
  );
  if (dropped.length) n.state.prepared[caster] = prepared.filter((id) => !dropped.includes(id));
}

/** Add a charm, blessing or boon the DM gave (plan §6.12). Once: a second copy is ignored. */
export function addGift(c: Character, gift: Ref, name: string, now = Date.now()): Character {
  const top = c.log.length - 1;
  if (top < 0 || stillHeld(c, gift)) return c;
  const n = structuredClone(c);
  n.log[top]!.choices.push({
    key: { owner: gift, slot: GRANTED_SLOT },
    values: [],
    labels: [name],
    madeAt: now,
    via: 'manual',
  });
  return n;
}

/** Remove a gift (a used-up charm), with its picks and spent uses. */
export function removeGift(c: Character, gift: Ref): Character {
  const n = structuredClone(c);
  for (const entry of n.log) {
    entry.choices = entry.choices.filter(
      (r) => !(r.key.slot === GRANTED_SLOT && sameRef(r.key.owner, gift)),
    );
  }
  dropOrphans(n, [gift]);
  return n;
}

/** Add an effect of the player's own to a feature (plan step 7.5). */
export function addCustomEffect(c: Character, owner: Ref, effect: Effect, uid: string): Character {
  const n = structuredClone(c);
  n.customEffects = [...(n.customEffects ?? []), { uid, owner, effect }];
  return n;
}

/** Remove one of the player's own effects, and what a counter of it had spent. */
export function removeCustomEffect(c: Character, uid: string): Character {
  const n = structuredClone(c);
  const gone = n.customEffects?.find((e) => e.uid === uid);
  n.customEffects = (n.customEffects ?? []).filter((e) => e.uid !== uid);
  if (!n.customEffects.length) delete n.customEffects;
  if (gone?.effect.type === 'resource') {
    delete n.state.resourcesUsed[`${refKey(gone.owner)}#${gone.effect.resourceId}`];
  }
  return n;
}
