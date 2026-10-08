// How a spell can be cast right now (plan §9.2, step 3.18), following the 2024 rules:
// - a cantrip needs no slot;
// - a level 1+ spell takes a slot of its level or higher, and a higher slot casts it at that
//   level; Pact Magic slots and the other slots cast each other's spells;
// - a spell with the Ritual tag can be cast as a Ritual without a slot (10 minutes longer, not
//   at a higher level) if it is prepared, or, for a Wizard, if it is in the spellbook;
// - spells from feats, species and items have their own free uses; a feat's or species'
//   spell can also be cast with a slot, an item's (paid from its charges) can't.
// - an item's spell paid in charges is cast while the item has that many charges left.

import type { DerivedGrantedSpell, DerivedSheet } from '../derive/types.ts';
import type { Spell } from '../../schema/index.ts';
import { slotChoices } from './costs.ts';

export type CastWay =
  | { kind: 'cantrip' }
  | { kind: 'slot'; level: number; pact?: boolean; left: number }
  | { kind: 'ritual' }
  /** A free cast: the grant's own uses, or (`charges`) that many of the item's charges. */
  | { kind: 'free'; level: number; left?: number; charges?: number }
  | { kind: 'atWill'; level: number };

/** Where the character has a spell from. */
export interface SpellSource {
  /** A caster's spell: prepared (or known), always prepared, or only in the spellbook. */
  caster?: { key: string; status: 'prepared' | 'always' | 'spellbook' };
  /** A spell granted by a feat, species, item… */
  granted?: DerivedGrantedSpell;
}

export function isConcentration(spell: Spell): boolean {
  return spell.duration.some((d) => d.concentration);
}

/** Free uses of a granted spell that are left, or undefined when it has none to count. */
function freeLeft(sheet: DerivedSheet, g: DerivedGrantedSpell): number | undefined {
  if (g.usesMax !== undefined) return g.usesMax - (g.usesUsed ?? 0);
  if (g.chargesRow !== undefined)
    return Math.floor((g.chargesLeft ?? 0) / Math.max(1, g.cost ?? 1));
  if (g.resourceKey) {
    const r = sheet.resources.find((x) => x.key === g.resourceKey);
    return r ? Math.floor((r.max.value - r.used) / Math.max(1, g.cost ?? 1)) : 0;
  }
  return undefined;
}

export function castWays(sheet: DerivedSheet, spell: Spell, from: SpellSource): CastWay[] {
  if (spell.level === 0) return [{ kind: 'cantrip' }];
  const out: CastWay[] = [];
  const g = from.granted;
  const level = g?.castAtLevel ?? spell.level;

  if (g?.uses === 'atWill') out.push({ kind: 'atWill', level });
  else if (g && (g.usesKey || g.resourceKey || g.chargesRow)) {
    const left = freeLeft(sheet, g) ?? 0;
    if (left > 0)
      out.push({ kind: 'free', level, left, ...(g.chargesRow ? { charges: g.cost ?? 1 } : {}) });
  }

  const prepared = from.caster?.status === 'prepared' || from.caster?.status === 'always';
  // A feat's or species' spell (its own counter) is also cast with slots; an item's isn't.
  // An item's spells are cast with the item, never with the character's slots.
  const fromItem = g?.source.kind === 'item';
  const slotsAllowed = prepared || (g && !fromItem && !g.resourceKey && g.uses !== 'ritual');
  if (slotsAllowed) {
    for (const s of slotChoices(sheet, spell.level)) out.push({ kind: 'slot', ...s });
  }

  const ritualAllowed =
    prepared ||
    from.caster?.status === 'spellbook' ||
    (g && !fromItem && !g.resourceKey) ||
    g?.uses === 'ritual';
  if (spell.ritual && ritualAllowed) out.push({ kind: 'ritual' });
  return out;
}

/** `Level 2 slot (3 left)`, `Pact Magic slot, level 3 (1 left)`, `Ritual (+10 minutes)`. */
export function castWayLabel(way: CastWay): string {
  switch (way.kind) {
    case 'cantrip':
      return 'Cast (no slot)';
    case 'slot':
      return way.pact
        ? `Pact Magic slot, level ${way.level} (${way.left} left)`
        : `Level ${way.level} slot (${way.left} left)`;
    case 'ritual':
      return 'As a Ritual (10 minutes longer, no slot)';
    case 'free':
      if (way.charges !== undefined)
        return `${way.charges} ${way.charges === 1 ? 'charge' : 'charges'} (enough for ${way.left})`;
      return way.left !== undefined ? `Free use (${way.left} left)` : 'Free use';
    case 'atWill':
      return 'At will';
  }
}
