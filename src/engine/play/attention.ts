// "Needs attention" (plan §4.4, step 3.23): choices still to make, picks the content no longer
// fits, content that isn't loaded or has a newer printing, and broken rules. Each item has a
// stable key, so a player can ignore it until it changes. Pure.

import { encodeChoiceKey, refKey, sameRef, type Character, type Ref } from '../../schema/index.ts';
import type { Pending, Reconciled } from '../choices/reconcile.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import { valueKind } from '../content/refs.ts';
import type { DerivedSheet, RuleIssue } from '../derive/types.ts';

export interface AttentionItem {
  /** Stable while the item is the same: what "ignore" remembers. */
  key: string;
  /** `warn` items count on the header's chip. */
  severity: 'warn' | 'info';
  pending?: Pending;
  record?: Reconciled;
  issue?: RuleIssue;
  /** Content that isn't loaded, and the loaded reprint that can stand in for it. */
  reprint?: { from: Ref; to: Ref; name: string };
}

export function attentionItems(
  sheet: DerivedSheet,
  character: Character,
  index: ContentIndex,
): AttentionItem[] {
  const out: AttentionItem[] = [];
  const reprints = new Set<string>();
  const reprint = (from: Ref, to: Ref) => {
    const key = `reprint:${refKey(from)}`;
    if (reprints.has(key)) return;
    reprints.add(key);
    out.push({
      key,
      severity: 'warn',
      reprint: { from, to, name: index.get(to)?.name ?? to.id },
    });
  };

  for (const p of sheet.choices.pending) {
    out.push({ key: `pending:${encodeChoiceKey(p.offer.key)}`, severity: 'warn', pending: p });
  }
  for (const r of sheet.choices.attention) {
    if (r.status === 'aliased' && r.alias) reprint(r.at.record.key.owner, r.alias);
    else out.push({ key: `record:${r.key}:${r.status}`, severity: 'warn', record: r });
  }
  // Content shown from a snapshot whose newer printing is loaded (a species, a feat…).
  for (const f of sheet.features) {
    if (!f.fromSnapshot) continue;
    const to = (character.snapshots[refKey(f.ref)]?.supersededBy ?? [])
      .map((id) => ({ kind: f.ref.kind, id }))
      .find((ref) => index.get(ref));
    if (to) reprint(f.ref, to);
  }
  for (const i of sheet.issues) {
    out.push({ key: `issue:${i.code}:${i.message}`, severity: i.severity, issue: i });
  }
  return out;
}

/** The count on the header's chip: what needs a look and isn't ignored. */
export function attentionCount(items: readonly AttentionItem[], character: Character): number {
  const ignored = new Set(character.ui.ignoredAttention ?? []);
  return items.filter((i) => i.severity === 'warn' && !ignored.has(i.key)).length;
}

export function setIgnored(c: Character, key: string, ignore: boolean): Character {
  const rest = (c.ui.ignoredAttention ?? []).filter((k) => k !== key);
  const ignoredAttention = ignore ? [...rest, key] : rest;
  const ui = { ...c.ui };
  if (ignoredAttention.length) ui.ignoredAttention = ignoredAttention;
  else delete ui.ignoredAttention;
  return { ...c, ui };
}

/** Remove a pick (one its owner no longer offers). */
export function removeRecord(c: Character, key: string): Character {
  return {
    ...c,
    log: c.log.map((e) => ({
      ...e,
      choices: e.choices.filter((r) => encodeChoiceKey(r.key) !== key),
    })),
  };
}

/**
 * Use a reprint in place of content that isn't loaded (plan §4.4, "Update to new version"):
 * every place the character names `from` names `to` instead, picks made for it included, and
 * its spent uses carry over.
 */
export function updateToReprint(c: Character, from: Ref, to: Ref): Character {
  const n = structuredClone(c);
  const swap = (ref: Ref) => (sameRef(ref, from) ? { ...to } : ref);
  for (const e of n.log) {
    e.classRef = swap(e.classRef);
    if (e.subclassRef) e.subclassRef = swap(e.subclassRef);
    if (e.origin) {
      e.origin = {
        speciesRef: swap(e.origin.speciesRef),
        backgroundRef: swap(e.origin.backgroundRef),
      };
    }
    for (const r of e.choices) {
      r.key = { ...r.key, owner: swap(r.key.owner) };
      r.values = r.values.map((v, i) =>
        valueKind(r.valueKinds, i) === from.kind && v === from.id ? to.id : v,
      );
    }
  }
  for (const row of n.inventory) {
    if (row.itemRef) row.itemRef = swap(row.itemRef);
    if (row.variantRef) row.variantRef = swap(row.variantRef);
  }
  if (from.kind === 'spell') {
    for (const [k, ids] of Object.entries(n.state.prepared)) {
      n.state.prepared[k] = ids.map((id) => (id === from.id ? to.id : id));
    }
  }
  if (n.state.concentration) n.state.concentration = swap(n.state.concentration);
  if (n.details.deity?.ref)
    n.details.deity = { ...n.details.deity, ref: swap(n.details.deity.ref) };
  const old = refKey(from);
  for (const [k, used] of Object.entries(n.state.resourcesUsed)) {
    if (k.startsWith(`${old}#`) || k.startsWith(`${old}@`)) {
      delete n.state.resourcesUsed[k];
      n.state.resourcesUsed[refKey(to) + k.slice(old.length)] = used;
    }
  }
  return n;
}
