import { beforeAll, describe, expect, it } from 'vitest';
import type { Character, ClassDef, Spell } from '../../schema/index.ts';
import { testCharacter } from '../../test/characters.ts';
import { fixtureIndex } from '../../test/fixtureIndex.ts';
import { FIXTURE_FEATURE_EFFECTS } from '../../test/fixtureFeatureEffects.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import { casterLevelShare, MULTICLASS_SLOTS, slotRow } from '../rules/slots.ts';
import { spellChoiceEffects } from '../spells/casters.ts';
import { levelsUpTo, matchesSpellFilter } from '../spells/filter.ts';
import { derive } from './derive.ts';
import type { DerivedSheet } from './types.ts';

let index: ContentIndex;

beforeAll(async () => {
  index = await fixtureIndex();
});

const run = (c: Character): DerivedSheet => derive(c, index, { registry: FIXTURE_FEATURE_EFFECTS });
const lore = { kind: 'class', id: 'lorekeeper|tst' } as const;
const pact = { kind: 'class', id: 'pactbinder|tst' } as const;
const spells = ['spell'] as const;

/** Lorekeeper 5 / Pactbinder 2, INT 16, CHA 13. */
function scholar(): Character {
  const c = testCharacter({
    classes: [
      { classId: 'lorekeeper|tst', levels: 5, subclassId: 'ink|lorekeeper|tst|tst' },
      { classId: 'pactbinder|tst', levels: 2 },
    ],
    scores: { str: 8, dex: 12, con: 14, int: 16, wis: 12, cha: 13 },
    choices: [
      {
        owner: lore,
        slot: 'cantrips.1',
        values: ['spark bolt|tst', 'glitter burst|tst'],
        valueKinds: [...spells],
      },
      {
        owner: lore,
        slot: 'spellbook.1',
        values: ['dim lantern|tst', 'ink cloud|tst'],
        valueKinds: [...spells],
      },
      {
        owner: pact,
        slot: 'cantrips.1',
        values: ['glitter burst|tst', 'spark bolt|tst'],
        valueKinds: [...spells],
        atLevel: 6,
      },
      {
        owner: pact,
        slot: 'spells.1',
        values: ['hex mark|tst', 'ink cloud|tst'],
        valueKinds: [...spells],
        atLevel: 6,
      },
    ],
  });
  c.state.prepared['lorekeeper|tst'] = ['ink cloud|tst', 'dim lantern|tst'];
  return c;
}

describe('spellcasting (P11)', () => {
  it('each caster has its DC, attack, cantrips and spells', () => {
    const d = run(scholar());
    const [keeper, binder] = d.spellcasting.casters;
    expect(keeper).toMatchObject({
      key: 'lorekeeper|tst',
      ability: 'int',
      preparedChange: 'restLong',
      dc: { value: 14 },
      attack: { bonus: { value: 6 } },
      maxSpellLevel: 3,
      cantrips: ['spark bolt|tst', 'glitter burst|tst'],
      cantripsMax: 3,
      prepared: ['ink cloud|tst', 'dim lantern|tst'],
      preparedMax: 7,
      spellbook: ['dim lantern|tst', 'ink cloud|tst'],
      list: { filters: ['class=Lorekeeper'], ids: [] },
    });
    expect(binder).toMatchObject({
      key: 'pactbinder|tst',
      ability: 'cha',
      preparedChange: 'level',
      dc: { value: 12 },
      maxSpellLevel: 1,
      cantrips: ['glitter burst|tst', 'spark bolt|tst'],
      // Level-up casters' spells are their picks.
      prepared: ['hex mark|tst', 'ink cloud|tst'],
      preparedMax: 3,
    });
    expect(binder?.spellbook).toBeUndefined();
  });

  it('a lone slot caster uses its own table; Pact Magic stays apart', () => {
    const c = scholar();
    c.state.slotsUsed = [1, 0, 1];
    c.state.pactSlotsUsed = 1;
    const d = run(c);
    expect(d.spellcasting.slots).toEqual([
      { level: 1, max: 4, used: 1 },
      { level: 2, max: 2, used: 0 },
      { level: 3, max: 1, used: 1 },
    ]);
    expect(d.spellcasting.pact).toEqual({ level: 1, max: 2, used: 1 });
  });

  it('several slot casters use the multiclass table', () => {
    const c = testCharacter({
      classes: [
        { classId: 'brute|tst', levels: 7, subclassId: 'spark|brute|tst|tst' },
        { classId: 'lorekeeper|tst', levels: 1 },
      ],
    });
    // Third caster 7 → 2, full caster 1 → 1: caster level 3.
    expect(run(c).spellcasting.slots.map((s) => [s.level, s.max])).toEqual([
      [1, 4],
      [2, 2],
    ]);
    const alone = testCharacter({
      classes: [{ classId: 'brute|tst', levels: 7, subclassId: 'spark|brute|tst|tst' }],
    });
    expect(run(alone).spellcasting.slots.map((s) => [s.level, s.max])).toEqual([[1, 3]]);
    expect(
      run(alone).spellcasting.casters.map((x) => [x.key, x.cantripsMax, x.preparedMax]),
    ).toEqual([['spark|brute|tst|tst', 1, 4]]);
  });

  it('cantrips that attack or call for a save become attacks, with scaling and spell bonuses', () => {
    const d = run(scholar());
    const spellAttacks = d.attacks.filter((a) => a.kind === 'spell');
    expect(
      spellAttacks.map((a) => [
        a.id,
        a.toHit?.bonus.value,
        a.save?.dc.value,
        a.damageDice,
        a.damageBonus.value,
      ]),
    ).toEqual([
      // Keen Mind adds INT to Lorekeeper evocations; at character level 7 Spark Bolt is 2d8.
      ['spell:lorekeeper|tst:spark bolt|tst', 6, undefined, '2d8', 3],
      ['spell:lorekeeper|tst:glitter burst|tst', undefined, 14, '', 3],
      ['spell:pactbinder|tst:glitter burst|tst', undefined, 12, '', 0],
      ['spell:pactbinder|tst:spark bolt|tst', 4, undefined, '2d8', 0],
    ]);
  });

  it('spells from species and feats keep their own ability and uses', () => {
    const species = { kind: 'species', id: 'mossling|tst' } as const;
    const initiate = { kind: 'feat', id: 'spark initiate; gladiator|tst' } as const;
    const c = testCharacter({
      classes: [{ classId: 'brute|tst', levels: 3 }],
      speciesId: 'mossling|tst',
      backgroundId: 'arena hand|tst',
      scores: { str: 10, dex: 10, con: 10, int: 14, wis: 16, cha: 10 },
      choices: [
        { owner: species, slot: 'spellsSet', values: ['1'] },
        { owner: initiate, slot: 'spells.0.ability', values: ['int'] },
        {
          owner: initiate,
          slot: 'spells.0.known.0',
          values: ['glitter burst|tst', 'spark bolt|tst'],
          valueKinds: [...spells],
        },
      ],
    });
    const d = run(c);
    expect(d.spellcasting.casters).toEqual([]);
    // Each with its own spell attack roll (checked here by its bonus).
    expect(d.spellcasting.granted.map((g) => g.attack?.bonus.value)).toEqual([5, 4, 4]);
    expect(d.spellcasting.granted.map(({ attack: _roll, ...g }) => g)).toEqual([
      {
        spellId: 'dim lantern|tst',
        source: species,
        sourceName: 'Mossling',
        mode: 'innate',
        ability: 'wis',
        dc: 13,
        attackBonus: 5,
        uses: { count: 1, recharge: 'long' },
        usesMax: 1,
        usesKey: 'species:mossling|tst#spell:dim lantern|tst',
        usesUsed: 0,
      },
      {
        spellId: 'glitter burst|tst',
        source: initiate,
        sourceName: 'Spark Initiate; Gladiator',
        mode: 'known',
        ability: 'int',
        dc: 12,
        attackBonus: 4,
      },
      {
        spellId: 'spark bolt|tst',
        source: initiate,
        sourceName: 'Spark Initiate; Gladiator',
        mode: 'known',
        ability: 'int',
        dc: 12,
        attackBonus: 4,
      },
    ]);
    expect(d.attacks.filter((a) => a.kind === 'spell').map((a) => a.name)).toEqual([
      'Glitter Burst',
      'Spark Bolt',
    ]);
  });

  it('too many prepared spells is a warning, not a block', () => {
    const c = scholar();
    c.state.prepared['lorekeeper|tst'] = Array.from({ length: 9 }, (_, i) => `spell ${i}|tst`);
    const d = run(c);
    expect(d.issues.find((i) => i.code === 'overPrepared')?.message).toBe(
      'Lorekeeper: 9 spells prepared, the limit is 7.',
    );
    expect(d.spellcasting.casters[0]?.prepared).toHaveLength(9);
  });
});

describe('caster data', () => {
  it('turns a caster into level-gated choices', () => {
    const keeper = index.get(lore) as ClassDef;
    const effects = spellChoiceEffects(keeper.spellcasting!, keeper);
    const slots = effects.flatMap((e) =>
      e.type === 'atLevel'
        ? e.effects.flatMap((g) =>
            g.type === 'grantSpells'
              ? g.spells.map((s) => `${e.level}:${'slot' in s.spell ? s.spell.slot : ''}`)
              : [],
          )
        : [],
    );
    expect(slots.slice(0, 6)).toEqual([
      '1:cantrips.1',
      '1:spellbook.1',
      '2:spellbook.2',
      '3:spellbook.3',
      '4:cantrips.4',
      '4:spellbook.4',
    ]);
    const binder = index.get(pact) as ClassDef;
    expect(JSON.stringify(spellChoiceEffects(binder.spellcasting!, binder)[0])).toContain(
      '"choose":"level=1|class=Pactbinder"',
    );
  });

  it('caster level shares and the multiclass table', () => {
    expect([
      casterLevelShare('full', 5),
      casterLevelShare('artificer', 5),
      casterLevelShare('half', 5),
      casterLevelShare('third', 5),
      casterLevelShare('pact', 5),
    ]).toEqual([5, 3, 2, 1, 0]);
    expect(slotRow(MULTICLASS_SLOTS, 20)).toEqual([4, 3, 3, 3, 3, 2, 2, 1, 1]);
    expect(slotRow(MULTICLASS_SLOTS, 0)).toEqual([]);
  });

  it('spell filters', () => {
    const bolt = index.get({ kind: 'spell', id: 'spark bolt|tst' }) as Spell;
    const lantern = index.get({ kind: 'spell', id: 'dim lantern|tst' }) as Spell;
    expect(matchesSpellFilter(bolt, 'level=0|class=Lorekeeper')).toBe(true);
    expect(matchesSpellFilter(bolt, 'level=1|class=Lorekeeper')).toBe(false);
    expect(matchesSpellFilter(bolt, 'subclass=Brute: Spark')).toBe(true);
    expect(matchesSpellFilter(bolt, 'school=evocation')).toBe(true);
    expect(matchesSpellFilter(bolt, 'school=V;E|spell attack=r')).toBe(true);
    expect(matchesSpellFilter(lantern, 'components & miscellaneous=ritual')).toBe(true);
    expect(matchesSpellFilter(lantern, 'components & miscellaneous=concentration')).toBe(true);
    expect(matchesSpellFilter(lantern, 'source=TST')).toBe(true);
    expect(matchesSpellFilter(lantern, '')).toBe(true);
    expect(matchesSpellFilter(lantern, 'frobnicate=1')).toBe(false);
    expect(levelsUpTo(3)).toBe('level=1;2;3');
  });
});
