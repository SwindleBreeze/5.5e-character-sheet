// A spellbook caster's own additions (plan §9.4, step 5.6): spells copied into the spellbook
// from scrolls and other books, kept as a manual record on the class (`COPIED_SLOT`). The 2024
// cost of copying is said, not charged.

import { COPIED_SLOT } from '../collect/collect.ts';
import type { Character, Id, Ref } from '../../schema/index.ts';

/** Copying a spell into a spellbook (2024): 2 hours and 50 GP per spell level. */
export function copyCost(level: number): { hours: number; gp: number } {
  const l = Math.max(1, level);
  return { hours: 2 * l, gp: 50 * l };
}

const isCopied = (owner: Ref) => (r: { key: { owner: Ref; slot: string } }) =>
  r.key.slot === COPIED_SLOT && r.key.owner.kind === owner.kind && r.key.owner.id === owner.id;

/** Spells copied into this class's spellbook. */
export function copiedSpells(c: Character, owner: Ref): Id[] {
  return c.log.flatMap((e) => e.choices.filter(isCopied(owner)).flatMap((r) => r.values));
}

/** Copy a spell into the spellbook: added to the record, made on the top level if new. */
export function copyToSpellbook(
  c: Character,
  owner: Ref,
  spellId: Id,
  label: string,
  now = Date.now(),
): Character {
  if (copiedSpells(c, owner).includes(spellId) || !c.log.length) return c;
  const n = structuredClone(c);
  for (const entry of n.log) {
    const r = entry.choices.find(isCopied(owner));
    if (r) {
      r.values.push(spellId);
      r.labels.push(label);
      r.valueKinds = ['spell'];
      return n;
    }
  }
  n.log.at(-1)!.choices.push({
    key: { owner, slot: COPIED_SLOT },
    values: [spellId],
    labels: [label],
    valueKinds: ['spell'],
    madeAt: now,
    via: 'manual',
  });
  return n;
}

/** Take a copied spell out of the spellbook (the record goes with its last spell). */
export function removeCopied(c: Character, owner: Ref, spellId: Id): Character {
  const n = structuredClone(c);
  for (const entry of n.log) {
    const r = entry.choices.find(isCopied(owner));
    if (!r) continue;
    const i = r.values.indexOf(spellId);
    if (i < 0) continue;
    r.values.splice(i, 1);
    r.labels.splice(i, 1);
    if (!r.values.length) entry.choices = entry.choices.filter((x) => x !== r);
  }
  return n;
}
