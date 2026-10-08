import { beforeAll, describe, expect, it } from 'vitest';
import type { Creature, Spell } from '../../schema/index.ts';
import { fixtureSource } from '../../test/fivetoolsFixture.ts';
import { namedCreatureIds } from './convert/creature.ts';
import { importFivetools, type ImportResult } from './index.ts';

let r: ImportResult;
beforeAll(async () => {
  r = await importFivetools(fixtureSource(), { now: 1 });
});

const creature = (id: string) => {
  const found = (r.entities.creature ?? []).find((c) => c.id === id);
  if (!found) throw new Error(`no creature ${id}`);
  return found;
};

describe('creatures (fixture bestiary)', () => {
  it('keeps summons, familiars, Beasts and creatures player options name; nothing else', () => {
    const ids = (r.entities.creature ?? []).map((c) => c.id).sort();
    expect(ids).toEqual([
      'boom spirit (air)|tst',
      'boom spirit|tst',
      'cliff goat|tst',
      'dire badger|tst',
      'elder moss boar|tst',
      'glimmer moth|tst',
      'moss boar|old',
      'moss boar|tst',
      // Named by the Wanderer's Beast Form text; not a Beast.
      'pebble crab|tst',
      'storm hawk|tst',
      'swarm of gnats|tst',
      'trail hound|tst',
    ]);
  });

  it('converts a summon: who summons it, written AC and HP, and its sections', () => {
    const c = creature('boom spirit|tst');
    expect(c).toMatchObject({
      kind: 'creature',
      edition: '2024',
      size: ['M'],
      creatureType: 'elemental',
      ac: [{ special: "11 + the spell's level" }],
      hp: { special: '30 (Earth only) or 20 (Air only) + 10 for each spell level above 3' },
      speed: [
        { mode: 'walk', ft: 30 },
        { mode: 'fly', ft: 30, note: '(Air only)' },
      ],
      pbNote: 'equals your Proficiency Bonus',
      summon: { spellId: 'rolling boom|tst', spellLevel: 3 },
    });
    expect(c.entries.map((e) => (typeof e === 'string' ? e : 'name' in e ? e.name : ''))).toEqual([
      'Traits',
      'Actions',
      'Bonus Actions',
    ]);
    expect(c.entries[1]).toMatchObject({
      entries: [
        { type: 'item', name: 'Multiattack' },
        { type: 'item', name: 'Thump' },
      ],
    });
  });

  it('expands versions, resolves copies and reads reprints', () => {
    expect(creature('boom spirit (air)|tst')).toMatchObject({
      variantOf: 'boom spirit|tst',
      hp: { special: '20 + 10 for each spell level above 3' },
      summon: { spellId: 'rolling boom|tst' },
    });
    // A copy of a Beast is a Beast, with its own numbers.
    expect(creature('elder moss boar|tst')).toMatchObject({
      creatureType: 'beast',
      cr: '1/2',
      hp: { average: 22, formula: '4d8 + 4' },
    });
    expect(creature('moss boar|old')).toMatchObject({
      edition: '2014',
      supersededBy: ['moss boar|tst'],
    });
  });

  it('reads the stat block lines', () => {
    expect(creature('moss boar|tst')).toMatchObject({
      ac: [{ value: 11, note: 'natural armor' }],
      hp: { average: 11, formula: '2d8 + 2' },
      skills: { perception: '+1' },
      passive: 11,
      cr: '1/4',
      // Dexterity +1, plus a CR 1/4 creature's Proficiency Bonus of 2.
      initiative: 3,
    });
    expect(creature('glimmer moth|tst')).toMatchObject({ familiar: true, initiative: 2 });
    expect(creature('swarm of gnats|tst').swarm).toBe(true);
    expect(creature('pebble crab|tst')).toMatchObject({
      typeTags: ['golem'],
      defenses: { immune: 'Poison', conditionImmune: 'Poisoned' },
    });
    expect(creature('trail hound|tst').summon).toEqual({ classId: 'wanderer|tst' });
  });

  it('only player options name creatures', () => {
    const spell = { kind: 'spell', entries: ['A {@creature Wolf|XMM} and a {@creature Bat}.'] };
    const item = { kind: 'item', entries: ['A {@creature Lion|XMM}.'] };
    expect([...namedCreatureIds([spell, item] as unknown as Spell[])]).toEqual([
      'wolf|xmm',
      'bat|mm',
    ]);
  });

  it('counts creatures per source', () => {
    expect(r.sources.find((s) => s.code === 'TST')?.counts.creature).toBe(11);
    expect((r.entities.creature as Creature[]).every((c) => c.effects.length === 0)).toBe(true);
  });
});
