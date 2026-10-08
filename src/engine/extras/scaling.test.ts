import { describe, expect, it } from 'vitest';
import type { Creature } from '../../schema/index.ts';
import {
  evalWritten,
  scaledAc,
  scaledHp,
  scaleEntries,
  scaleText,
  simplifyDice,
  writtenHitDice,
  type ScaleContext,
} from './scaling.ts';

const ctx: ScaleContext = {
  spellLevel: 4,
  classLevels: { wanderer: 5, lorekeeper: 3 },
  charLevel: 8,
  pb: 3,
  mods: { str: 0, dex: 2, con: 1, int: 4, wis: 3, cha: -1 },
  spellAttack: 7,
  spellDc: 15,
};

describe('evalWritten', () => {
  it.each([
    ["11 + the spell's level", 15],
    ['10 + 1 per spell level', 14],
    ['13 + the level of the spell (natural armor)', 17],
    ['13 plus your Wisdom modifier', 16],
    ['14 + PB (natural armor)', 17],
    ['20 + 10 for each spell level above 3', 30],
    ['40 + 15 for each spell level above 4th', 40],
    ['5 + 10 per spell level (it has a number of Hit Dice [d10s] equal to the spell level)', 45],
    ['5 plus five times your Wanderer level (the hound has Hit Dice [d8s])', 30],
    ['2 + your Intelligence modifier + five times your lorekeeper level', 21],
    ['5 + five times your level', 45],
    ['4 + four times your Wanderer level', 24],
  ])('%s → %d', (text, value) => {
    expect(evalWritten(text, ctx)).toBe(value);
  });

  it.each([
    '30 (Earth only) or 20 (Air only) + 10 for each spell level above 3',
    "11 + the spell's level + 2 (Defender only)",
    '10 (Medium or smaller), 20 (Large), 40 (Huge)',
    'half the hit point maximum of its summoner',
    '5 plus five times your Ranger level',
    '13 + your spellcasting ability modifier',
  ])('leaves “%s” as written', (text) => {
    expect(evalWritten(text, ctx)).toBeUndefined();
  });

  it('needs the spell level for spell formulas', () => {
    const { spellLevel: _, ...noLevel } = ctx;
    expect(evalWritten("11 + the spell's level", noLevel)).toBeUndefined();
  });

  it('reads the Hit Dice note', () => {
    expect(
      writtenHitDice(
        '5 plus five times your Wanderer level (the hound has a number of Hit Dice [d8s] equal to your Wanderer level)',
        ctx,
      ),
    ).toBe('5d8');
    expect(
      writtenHitDice("5 + 5 per spell level (Hit Dice [d4s] equal to the spell's level)", ctx),
    ).toBe('4d4');
    expect(writtenHitDice('20 + 5 for each spell level above 2', ctx)).toBeUndefined();
  });
});

describe('simplifyDice', () => {
  it.each([
    ['1d8 + 4 + 3', '1d8 + 7'],
    ['(5 - 4)d4 + 3', '1d4 + 3'],
    ['(5 - 3)d12 + 3', '2d12 + 3'],
    ['2d6 + 2 - 5', '2d6 - 3'],
    ['1d6 + 0', '1d6'],
    ['3 + 4', '7'],
  ])('%s → %s', (expr, out) => {
    expect(simplifyDice(expr)).toBe(out);
  });

  it('leaves what is not plain dice', () => {
    expect(simplifyDice('1d8 + mod')).toBeUndefined();
  });
});

describe('scaleText', () => {
  it('puts in the spell attack, damage at the spell level, and the save DC', () => {
    expect(
      scaleText(
        '{@atkr m} {@hitYourSpellAttack Bonus equals your spell attack modifier}, reach 5 ft. {@h}{@damage 1d8 + 2 + summonSpellLevel} Thunder damage.',
        ctx,
      ),
    ).toBe('{@atkr m} {@hit 7}, reach 5 ft. {@h}{@damage 1d8 + 6} Thunder damage.');
    expect(scaleText('{@actSave con} DC equals your spell save DC, one creature.', ctx)).toBe(
      '{@actSave con} {@dc 15}, one creature.',
    );
    expect(scaleText('{@actSave con} Your spell save DC, one creature.', ctx)).toBe(
      '{@actSave con} {@dc 15}, one creature.',
    );
  });

  it('adds an ability modifier to the dice it follows', () => {
    expect(scaleText('{@h}{@damage 1d6 + 2} plus your Wisdom modifier Piercing damage.', ctx)).toBe(
      '{@h}{@damage 1d6 + 5} Piercing damage.',
    );
  });

  it('works out scaled dice counts and the attacks of a Multiattack', () => {
    expect(scaleText('{@damage (summonSpellLevel - 3)d6 + 3|2d6 + 3}', ctx)).toBe(
      '{@damage 1d6 + 3}',
    );
    expect(
      scaleText("makes a number of attacks equal to half this spell's level (round down).", ctx),
    ).toBe(
      "makes a number of attacks equal to half this spell's level (round down) (2 at level 4).",
    );
  });

  it('leaves the text alone when the numbers are unknown', () => {
    const bare: ScaleContext = { classLevels: {}, charLevel: 1, pb: 2, mods: ctx.mods };
    const text =
      '{@hitYourSpellAttack Bonus equals your spell attack modifier} {@damage 1d8 + summonSpellLevel}';
    expect(scaleText(text, bare)).toBe(text);
    expect(scaleText('{@damage 1d6 + 2} Piercing', ctx)).toBe('{@damage 1d6 + 2} Piercing');
  });

  it('scales every string of an entry tree', () => {
    expect(
      scaleEntries(
        [
          {
            type: 'entries',
            name: 'Actions',
            entries: [{ type: 'item', name: 'Thump', entries: ['{@hitYourSpellAttack x}'] }],
          },
        ],
        ctx,
      ),
    ).toEqual([
      {
        type: 'entries',
        name: 'Actions',
        entries: [{ type: 'item', name: 'Thump', entries: ['{@hit 7}'] }],
      },
    ]);
  });
});

describe('scaled AC and HP', () => {
  const base = {
    id: 'x|tst',
    kind: 'creature',
    name: 'X',
    source: 'TST',
    edition: '2024',
    entries: [],
    effects: [],
    origin: { adapter: '5etools', adapterVersion: 7, importedAt: 1 },
    size: ['M'],
    creatureType: 'beast',
    speed: [],
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    senses: [],
    languages: [],
  } as const;

  it('works out a written AC and HP, with Hit Dice', () => {
    const c = {
      ...base,
      ac: [{ special: '13 plus your Wisdom modifier' }],
      hp: {
        special:
          '5 plus five times your Wanderer level (the hound has a number of Hit Dice [d8s] equal to your Wanderer level)',
      },
    } as unknown as Creature;
    expect(scaledAc(c, ctx)).toEqual({ value: 16, text: '13 plus your Wisdom modifier' });
    expect(scaledHp(c, ctx)).toMatchObject({ value: 30, hitDice: '5d8' });
  });

  it('keeps a plain stat block as it is', () => {
    const c = {
      ...base,
      ac: [{ value: 11, note: 'natural armor' }],
      hp: { average: 11, formula: '2d8 + 2' },
    } as unknown as Creature;
    expect(scaledAc(c, ctx)).toEqual({ value: 11, text: '11 (natural armor)' });
    expect(scaledHp(c, ctx)).toEqual({ value: 11, text: '11 (2d8 + 2)', hitDice: '2d8 + 2' });
  });
});
