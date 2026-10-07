import { describe, expect, it } from 'vitest';
import type { DerivedGrantedSpell, DerivedSheet } from '../../../engine/derive/types.ts';
import type { Id, Spell } from '../../../schema/index.ts';
import type { SpellEntry } from './entries.ts';
import { castNotice, whereFrom } from './spellText.ts';

const spell = (level: number) => ({ id: 'mist step|tst', name: 'Mist Step', level }) as Spell;
const sheet = {
  resources: [{ key: 'focus', name: 'Focus Points' }],
} as unknown as DerivedSheet;

const granted = (g: Partial<DerivedGrantedSpell>): SpellEntry => ({
  key: 'g',
  id: 'mist step|tst' as Id,
  from: { granted: { spellId: 'mist step|tst', sourceName: 'Fey Lineage', ...g } as never },
  sourceName: 'Fey Lineage',
});

describe('why a spell can be cast', () => {
  it('a species spell: its free uses and their recharge, and spell slots too', () => {
    const e = granted({ usesMax: 1, uses: { count: 1, recharge: 'long' } });
    expect(whereFrom(e, spell(2), sheet)).toBe(
      'From Fey Lineage: once without a spell slot (back on a Long Rest). You can also cast it with a spell slot of its level or higher.',
    );
  });

  it('a spell paid from a resource, and a caster’s prepared spell', () => {
    expect(whereFrom(granted({ resourceKey: 'focus', cost: 2 }), spell(2), sheet)).toBe(
      'From Fey Lineage: each cast costs 2 Focus Points, not a spell slot.',
    );
    const prepared: SpellEntry = {
      key: 'p',
      id: 'mist step|tst' as Id,
      from: { caster: { key: 'wizard', status: 'prepared' } },
      sourceName: 'Wizard',
    };
    expect(whereFrom(prepared, spell(2), sheet)).toBe(
      'Prepared as a Wizard spell: cast with a spell slot of its level or higher.',
    );
  });

  it('what casting did: the slot and what is left, or the free use', () => {
    expect(castNotice({ kind: 'slot', level: 3, left: 2 }, spell(2), 'Wizard')).toBe(
      'Level 3 slot expended, 1 left · cast at level 3',
    );
    expect(castNotice({ kind: 'free', level: 2, left: 1 }, spell(2), 'Fey Lineage')).toBe(
      'Free use from Fey Lineage, 0 left',
    );
  });
});
