import { describe, expect, it } from 'vitest';
import type { ContentIndex } from '../../../engine/content/contentIndex.ts';
import type { DerivedSheet } from '../../../engine/derive/types.ts';
import type { Character, Item, Spell } from '../../../schema/index.ts';
import type { SpellEntry } from '../spells/entries.ts';
import { attackPart, togglePart, turnGroups } from './turn.ts';

const attack = (id: string, use: object, extra: object = {}) =>
  ({ id, name: id, kind: 'weapon', use, ready: true, ...extra }) as never;
const spell = (id: string, unit: string): SpellEntry => ({
  key: id,
  id,
  spell: { id, name: id, time: [{ amount: 1, unit }] } as unknown as Spell,
  from: { caster: { key: 'c', status: 'prepared' } },
  sourceName: 'Caster',
});

describe('the Actions tab by part of the turn', () => {
  it('attacks: the Attack action; the Light extra attack a Bonus Action unless Nick; cantrips by casting time', () => {
    expect(attackPart(attack('a', { kind: 'attackAction' }))).toBe('action');
    expect(attackPart(attack('b', { kind: 'lightExtra', nick: false }))).toBe('bonus');
    expect(attackPart(attack('c', { kind: 'lightExtra', nick: true }))).toBe('action');
    expect(attackPart(attack('d', { kind: 'cast', time: 'reaction' }))).toBe('reaction');
  });

  it('a switch goes where switching it on takes; with no action cost, under Other', () => {
    const t = (costs: object[]) => ({ costs }) as never;
    expect(togglePart(t([{ label: '1 Rage' }, { label: 'a Bonus Action', action: 'bonus' }]))).toBe(
      'bonus',
    );
    expect(togglePart(t([]))).toBe('other');
  });

  it('Bonus Action and Reaction spells are listed, once, unless they are attacks; potions by rules', () => {
    const sheet = {
      attacks: [
        attack(
          'fire bolt',
          { kind: 'cast', time: 'bonus' },
          { kind: 'spell', spellRef: { kind: 'spell', id: 'zap' } },
        ),
      ],
      actions: [],
      toggles: [],
    } as unknown as DerivedSheet;
    const potion = {
      kind: 'item',
      id: 'p',
      name: 'Draught',
      consumable: 'potion',
      entries: [],
    } as unknown as Item;
    const index = { get: () => potion } as unknown as ContentIndex;
    const character = {
      inventory: [{ uid: 'r', itemRef: { kind: 'item', id: 'p' }, quantity: 1 }],
    } as unknown as Character;
    const ready = [
      spell('heal word', 'bonus'),
      spell('heal word', 'bonus'),
      spell('ward', 'reaction'),
      spell('blast', 'action'),
      spell('zap', 'bonus'),
    ];
    const g = turnGroups(character, sheet, index, ready);
    expect(g.bonus.spells.map((e) => e.id)).toEqual(['heal word']);
    expect(g.reaction.spells.map((e) => e.id)).toEqual(['ward']);
    expect(g.action.spells).toEqual([]);
    expect(g.bonus.potions.map((p) => p.row.uid)).toEqual(['r']);
    const old = turnGroups({ ...character, ruleset: '2014' }, sheet, index, ready);
    expect(old.action.potions).toHaveLength(1);
    expect(old.bonus.potions).toHaveLength(0);
  });
});
