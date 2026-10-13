import { describe, expect, it } from 'vitest';
import type { Spell } from '../../../schema/index.ts';
import { howText, spellLanding } from './spellText.ts';

const spell = (extra: Partial<Spell>) =>
  ({ entries: [], damageTypes: [], ...extra }) as unknown as Spell;
const at = { dc: 14, attack: 6, charLevel: 5 };

const line = (s: Spell) => {
  const l = spellLanding(s, at);
  return [howText(l.how), [...l.dice, l.what, l.when].filter(Boolean).join(' ')];
};

describe('a spell’s numbers on its row', () => {
  it('a save: the target rolls against the caster’s DC; damage on a failed save', () => {
    expect(
      line(
        spell({
          saves: ['wis'],
          damageTypes: ['necrotic'],
          entries: ['Take {@damage 1d8} damage, or {@damage 1d12} when hurt.'],
        }),
      ),
    ).toEqual(['Target makes a WIS save, DC 14', '1d8 1d12 Necrotic on a failed save']);
  });

  it('an attack: you roll to hit with the caster’s bonus; a cantrip’s damage on a hit', () => {
    expect(
      line(
        spell({
          attack: 'ranged',
          damageTypes: ['fire'],
          scaling: [{ label: 'damage', byLevel: { 1: '1d10', 5: '2d10', 11: '3d10' } }],
        }),
      ),
    ).toEqual(['Roll to hit +6 vs AC', '2d10 Fire on a hit']);
  });

  it('a rider spell’s extra damage; healing; nothing to show', () => {
    expect(
      line(
        spell({
          damageTypes: ['force'],
          entries: [{ type: 'entries', entries: ['Deal an extra {@damage 1d6} damage.'] }] as never,
        }),
      ),
    ).toEqual(['No roll to hit or save', '1d6 Force']);
    expect(line(spell({ entries: ['A creature regains {@dice 2d4} Hit Points.'] }))).toEqual([
      'No roll to hit or save',
      '2d4 healing',
    ]);
    expect(line(spell({ entries: ['You can see in the dark.'] }))).toEqual([
      'No roll to hit or save',
      '',
    ]);
    // A save with no dice says so; with no caster, no DC.
    expect(howText(spellLanding(spell({ saves: ['con', 'str'] }), { charLevel: 1 }).how)).toBe(
      'Target makes a CON or STR save',
    );
  });
});
