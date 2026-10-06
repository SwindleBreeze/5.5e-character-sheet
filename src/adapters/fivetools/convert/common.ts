// Shared pieces of the per-kind converters.

import type { BaseEntity, ContentOrigin, Edition, EntityKind, Id } from '../../../schema/index.ts';
import { normalizeEntries } from '../entries.ts';
import { entityEdition } from '../editions.ts';
import { asArray, isObject, num, type RawEntity } from '../raw.ts';
import type { ReportBuilder } from '../report.ts';
import { VERSION_OF } from '../versions.ts';

export interface ConvertContext {
  origin: ContentOrigin;
  report: ReportBuilder;
  sourceEdition: Map<string, Edition>;
  /** Edition of each class and subclass, so their features inherit it. */
  parentEdition: Map<Id, Edition>;
}

export function editionOf(raw: RawEntity, ctx: ConvertContext, parentId?: Id): Edition {
  return (
    entityEdition(raw) ??
    (parentId !== undefined ? ctx.parentEdition.get(parentId) : undefined) ??
    ctx.sourceEdition.get(String(raw.source)) ??
    'unknown'
  );
}

/** Ids from `reprintedAs` (strings or `{ uid }` objects), parsed with the kind's UID rules. */
export function supersededBy(raw: RawEntity, toId: (uid: string) => Id): Id[] | undefined {
  const ids = asArray(raw.reprintedAs)
    .map((r) =>
      typeof r === 'string' ? r : isObject(r) && typeof r.uid === 'string' ? r.uid : null,
    )
    .filter((r): r is string => r !== null)
    .map(toId);
  return ids.length ? ids : undefined;
}

/** Fields every entity has. `variantOfId` builds the parent's id for `_versions` records. */
export function baseFields<K extends EntityKind>(
  raw: RawEntity,
  kind: K,
  id: Id,
  ctx: ConvertContext,
  opts: {
    edition?: Edition;
    reprintId?: (uid: string) => Id;
    variantOfId?: (name: string, source: string) => Id;
  } = {},
): BaseEntity & { kind: K } {
  const out: BaseEntity & { kind: K } = {
    id,
    kind,
    name: String(raw.name ?? ''),
    source: String(raw.source ?? ''),
    edition: opts.edition ?? editionOf(raw, ctx),
    entries: normalizeEntries(raw.entries),
    effects: [],
    origin: ctx.origin,
  };
  const page = num(raw.page);
  if (page !== undefined) out.page = page;
  if (opts.reprintId) {
    const sup = supersededBy(raw, opts.reprintId);
    if (sup) out.supersededBy = sup;
  }
  const versionOf = raw[VERSION_OF];
  if (opts.variantOfId && isObject(versionOf)) {
    out.variantOf = opts.variantOfId(String(versionOf.name), String(versionOf.source));
  }
  return out;
}

export function consumesOf(raw: RawEntity): { name: string; amount?: number } | undefined {
  const c = raw.consumes;
  if (!isObject(c) || typeof c.name !== 'string') return undefined;
  const amount = num(c.amount);
  return amount !== undefined ? { name: c.name, amount } : { name: c.name };
}
