import { describe, expect, it } from 'vitest';
import type { Spell } from '../../../schema/index.ts';
import { spellNumbers } from './spellText.ts';

const spell = (extra: Partial<Spell>) =>
  ({ entries: [], damageTypes: [], ...extra }) as unknown as Spell;
const at = { dc: 14, attack: 6, charLevel: 5 };

describe('a spell’s numbers on its row', () => {
  it('a save: the abilities and the caster’s DC; its damage dice and type', () => {
    expect(
      spellNumbers(
        spell({
          saves: ['wis'],
          damageTypes: ['necrotic'],
          entries: ['Take {@damage 1d8} damage, or {@damage 1d12} when hurt.'],
        }),
        at,
      ),
    ).toEqual(['WIS save DC 14', '1d8 or 1d12 Necrotic']);
  });

  it('an attack with the caster’s bonus; a cantrip’s damage for the character’s level', () => {
    expect(
      spellNumbers(
        spell({
          attack: 'ranged',
          damageTypes: ['fire'],
          scaling: [{ label: 'damage', byLevel: { 1: '1d10', 5: '2d10', 11: '3d10' } }],
        }),
        at,
      ),
    ).toEqual(['spell attack +6', '2d10 Fire']);
  });

  it('a rider spell’s extra damage; healing; nothing to show', () => {
    expect(
      spellNumbers(
        spell({
          damageTypes: ['force'],
          entries: [{ type: 'entries', entries: ['Deal an extra {@damage 1d6} damage.'] }] as never,
        }),
        at,
      ),
    ).toEqual(['1d6 Force']);
    expect(
      spellNumbers(spell({ entries: ['A creature regains {@dice 2d4} Hit Points.'] }), at),
    ).toEqual(['heals 2d4']);
    expect(spellNumbers(spell({ entries: ['You can see in the dark.'] }), at)).toEqual([]);
  });
});
