// Reconciling the character's choice records with what its content offers now (plan §4.4).
// Pure and non-destructive: it never writes; it tells derive which picks count and tells the
// "Needs attention" list what to show.

import { encodeChoiceKey, refKey, type Character, type Ref } from '../../schema/index.ts';
import { COPIED_SLOT, entityOfferSlots, GRANTED_SLOT } from '../collect/collect.ts';
import type { Collected, Offer, RecordAt } from '../collect/types.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import { valueKind } from '../content/refs.ts';

export type RecordStatus =
  | 'ok'
  /** The owner is not in the loaded content; its snapshot stands in. */
  | 'ownerMissing'
  /** The owner is missing but a reprint offering the same slot is loaded. */
  | 'aliased'
  /** The owner no longer offers this slot (or no longer applies to the character). */
  | 'slotMissing'
  /** More or fewer picks than the slot allows now. */
  | 'countMismatch'
  /** A picked value is no longer among the options. */
  | 'valueInvalid';

export interface Reconciled {
  key: string;
  at: RecordAt;
  status: RecordStatus;
  offer?: Offer;
  /** For `aliased`: the reprint that offers the slot now. */
  alias?: Ref;
  /** For `valueInvalid`: the values that are not valid. */
  invalid?: string[];
  /** For `countMismatch`: how many picks the slot allows. */
  expected?: number;
}

export interface Pending {
  offer: Offer;
  count: number;
  /** Picks already made (fewer than `count`). */
  have: number;
}

export interface Reconciliation {
  records: Reconciled[];
  byKey: Map<string, Reconciled>;
  pending: Pending[];
}

export function reconcile(
  collected: Collected,
  character: Character,
  index: ContentIndex,
  countOf: (offer: Offer) => number,
): Reconciliation {
  const offers = new Map(collected.offers.map((o) => [encodeChoiceKey(o.key), o]));
  const records: Reconciled[] = [];

  for (const [key, at] of collected.records) {
    const owner = at.record.key.owner;
    const offer = offers.get(key);
    const r: Reconciled = { key, at, status: 'ok' };
    if (offer) r.offer = offer;

    if (!index.get(owner)) {
      const alias = (character.snapshots[refKey(owner)]?.supersededBy ?? [])
        .map((id) => index.get({ kind: owner.kind, id }))
        .find(
          (e) =>
            e &&
            (at.record.key.slot === GRANTED_SLOT || entityOfferSlots(e).has(at.record.key.slot)),
        );
      if (alias) {
        r.status = 'aliased';
        r.alias = { kind: alias.kind, id: alias.id };
      } else {
        r.status = 'ownerMissing';
      }
    } else if (at.record.key.slot === GRANTED_SLOT || at.record.key.slot === COPIED_SLOT) {
      r.status = 'ok';
    } else if (!offer) {
      r.status = 'slotMissing';
    } else {
      const values = at.record.values;
      const invalid = values.filter((v, i) => {
        if (Array.isArray(offer.from) && !offer.from.includes(v)) return true;
        const kind = valueKind(at.record.valueKinds, i);
        return (
          !!kind && !index.get({ kind, id: v }) && !character.snapshots[refKey({ kind, id: v })]
        );
      });
      const count = countOf(offer);
      if (invalid.length) {
        r.status = 'valueInvalid';
        r.invalid = invalid;
      } else if (values.length !== count) {
        r.status = 'countMismatch';
        r.expected = count;
      }
    }
    records.push(r);
  }

  const byKey = new Map(records.map((r) => [r.key, r]));
  const pending: Pending[] = [];
  for (const [key, offer] of offers) {
    const count = countOf(offer);
    if (count <= 0) continue;
    const r = byKey.get(key);
    const have = r ? r.at.record.values.length : 0;
    if (!r || (r.status === 'countMismatch' && have < count)) pending.push({ offer, count, have });
  }
  return { records, byKey, pending };
}

/**
 * The picks that count for an offer: none when the record is unusable, the first `count`
 * when there are too many, invalid values left out (plan §4.4).
 */
export function usableValues(r: Reconciled | undefined): string[] {
  if (!r) return [];
  switch (r.status) {
    case 'ok':
    case 'ownerMissing':
    case 'aliased':
      return r.at.record.values;
    case 'countMismatch':
      return r.at.record.values.slice(0, r.expected);
    case 'valueInvalid':
      return r.at.record.values.filter((v) => !r.invalid?.includes(v));
    case 'slotMissing':
      return [];
  }
}
