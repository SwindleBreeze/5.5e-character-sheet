import { beforeAll, describe, expect, it } from 'vitest';
import type { Character } from '../../schema/index.ts';
import { testCharacter } from '../../test/characters.ts';
import { fixtureIndex } from '../../test/fixtureIndex.ts';
import { FIXTURE_FEATURE_EFFECTS } from '../../test/fixtureFeatureEffects.ts';
import { face, fixedRng } from '../../test/rng.ts';
import { GRANTED_SLOT } from '../collect/collect.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import { derive } from '../derive/derive.ts';
import type { DerivedSheet } from '../derive/types.ts';
import {
  addCondition,
  applyDamage,
  castSpell,
  concentrationDc,
  deathSave,
  endTurn,
  heal,
  longRest,
  removeCondition,
  restoreResource,
  restoreSlot,
  setConcentration,
  setDeathSaves,
  setExhaustion,
  setHeroicInspiration,
  setHitDiceUsed,
  setOverride,
  setTempHp,
  shortRest,
  spendResource,
  toggle,
  useAction,
  spendFreeCast,
  useItemCharge,
  useRider,
} from './reducers.ts';

let index: ContentIndex;

beforeAll(async () => {
  index = await fixtureIndex();
});

const sheet = (c: Character): DerivedSheet =>
  derive(c, index, { registry: FIXTURE_FEATURE_EFFECTS });

const FURY = 'classFeature:fury|brute|tst|1|tst#furies';
const BREATH = 'classFeature:catch breath|brute|tst|2|tst#catch-breath';

/** Brute 5, CON 14: 50 HP; 3 Furies, 2 Catch Breath. */
function brute(): Character {
  return testCharacter({ classes: [{ classId: 'brute|tst', levels: 5 }], scores: { con: 14 } });
}

/** Lorekeeper 5 / Pactbinder 2 with a Glyph Ward of 13. */
function caster(): Character {
  const c = testCharacter({
    classes: [
      { classId: 'lorekeeper|tst', levels: 5 },
      { classId: 'pactbinder|tst', levels: 2 },
    ],
    scores: { con: 14, int: 16 },
  });
  c.state.wardHp = 13;
  return c;
}

describe('damage, healing and death saves', () => {
  it('temporary HP first, then the ward, then HP', () => {
    const c = caster();
    c.state.tempHp = 5;
    const s = sheet(c);
    expect(s.hp.max.value).toBe(46);
    const hit = applyDamage(c, s, 20);
    expect(hit.state).toMatchObject({ tempHp: 0, wardHp: 0, damage: 2 });
    expect(c.state.tempHp).toBe(5); // the input is not changed
  });

  it('at 0 HP: a failure per hit, two for a critical, three for massive damage', () => {
    const c = brute();
    const s = sheet(c);
    const down = applyDamage(c, s, 55);
    expect(down.state).toMatchObject({ damage: 50, deathSaves: { successes: 0, failures: 0 } });
    expect(applyDamage(down, s, 3).state.deathSaves.failures).toBe(1);
    expect(applyDamage(down, s, 3, { critical: true }).state.deathSaves.failures).toBe(2);
    expect(applyDamage(down, s, 50).state.deathSaves.failures).toBe(3);
    // Instant death: what is left over after 0 HP is at least the maximum.
    expect(applyDamage(c, s, 100).state.deathSaves.failures).toBe(3);
    expect(applyDamage(c, s, 99).state.deathSaves.failures).toBe(0);
    expect(applyDamage(c, s, 0)).toBe(c);
  });

  it('healing stops at the maximum and clears death saves from 0 HP', () => {
    const c = brute();
    const s = sheet(c);
    expect(heal(applyDamage(c, s, 10), s, 25).state.damage).toBe(0);
    const dying = applyDamage(applyDamage(c, s, 50), s, 1);
    expect(dying.state.deathSaves.failures).toBe(1);
    expect(heal(dying, s, 4).state).toMatchObject({
      damage: 46,
      deathSaves: { successes: 0, failures: 0 },
    });
  });

  it('temporary HP keep the larger amount unless replaced', () => {
    const c = setTempHp(brute(), 8);
    expect(setTempHp(c, 5).state.tempHp).toBe(8);
    expect(setTempHp(c, 12).state.tempHp).toBe(12);
    expect(setTempHp(c, 3, { replace: true }).state.tempHp).toBe(3);
  });

  it('death saving throws', () => {
    const c = brute();
    const s = sheet(c);
    const down = applyDamage(c, s, 50);
    expect(deathSave(down, s, 20).state).toMatchObject({
      damage: 49,
      deathSaves: { successes: 0, failures: 0 },
    });
    expect(deathSave(down, s, 1).state.deathSaves.failures).toBe(2);
    expect(deathSave(down, s, 10).state.deathSaves.successes).toBe(1);
    expect(deathSave(down, s, 9).state.deathSaves.failures).toBe(1);
    expect(deathSave(c, s, 1)).toBe(c);
  });

  it('concentration DC: half the damage, at least 10, at most 30', () => {
    expect([concentrationDc(5), concentrationDc(30), concentrationDc(100)]).toEqual([10, 15, 30]);
  });

  it('Concentration ends at 0 HP (Unconscious) and with a condition that Incapacitates', () => {
    const c = brute();
    c.state.concentration = { kind: 'spell', id: 'dim lantern|tst' };
    const s = sheet(c);
    expect(applyDamage(c, s, 49).state.concentration).not.toBeNull();
    expect(applyDamage(c, s, 50).state.concentration).toBeNull();
    expect(addCondition(c, 'condition/prone|xphb').state.concentration).not.toBeNull();
    for (const id of ['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']) {
      expect(addCondition(c, `condition/${id}|xphb`).state.concentration, id).toBeNull();
    }
  });
});

describe('resources, slots, actions and toggles', () => {
  it('spending clamps to the maximum; restoring to nothing spent', () => {
    const c = brute();
    const s = sheet(c);
    const spent = spendResource(spendResource(c, s, FURY, 2), s, FURY, 5);
    expect(spent.state.resourcesUsed[FURY]).toBe(3);
    expect(restoreResource(spent, FURY, 1).state.resourcesUsed[FURY]).toBe(2);
    expect(restoreResource(spent, FURY, 9).state.resourcesUsed).toEqual({});
    expect(spendResource(c, s, 'nothing#here')).toBe(c);
  });

  it('casting spends a slot of the level, or a pact slot, and sets concentration', () => {
    const c = caster();
    const s = sheet(c);
    const lantern = { kind: 'spell', id: 'dim lantern|tst' } as const;
    const cast = castSpell(castSpell(c, s, { level: 3, concentration: lantern }), s, { level: 3 });
    expect(cast.state.slotsUsed).toEqual([0, 0, 1]);
    expect(cast.state.concentration).toEqual(lantern);
    const pact = castSpell(
      castSpell(castSpell(c, s, { level: 1, pact: true }), s, { level: 1, pact: true }),
      s,
      {
        level: 1,
        pact: true,
      },
    );
    expect(pact.state.pactSlotsUsed).toBe(2);
    expect(castSpell(c, s, { level: 0 }).state.slotsUsed).toEqual([]);
    expect(restoreSlot(cast, { level: 3 }).state.slotsUsed).toEqual([0, 0, 0]);
    expect(restoreSlot(pact, { level: 1, pact: true }).state.pactSlotsUsed).toBe(1);
    expect(setConcentration(cast, null).state.concentration).toBeNull();
  });

  it('an action pays its costs and applies its outcomes', () => {
    const c = brute();
    const hurt = applyDamage(c, sheet(c), 20);
    const s = sheet(hurt);
    const id = s.actions.find((a) => a.name === 'Catch Breath')!.id;
    const after = useAction(hurt, s, id, { rng: fixedRng([face(4, 8)]) });
    expect(after.state.resourcesUsed[BREATH]).toBe(1);
    expect(after.state.damage).toBe(11);

    // The sheet rolls through its own roller, so the player sees the dice.
    const rolled: [string, string][] = [];
    const shown = useAction(hurt, s, id, {
      rollAmount: (expr, label) => (rolled.push([expr, label]), 6),
    });
    expect(rolled).toEqual([['1d8 + 5', 'Catch Breath: healing']]);
    expect(shown.state.damage).toBe(14);
  });

  it('an action that regains a spell slot takes the highest spent one it may', () => {
    const c = castSpell(castSpell(caster(), sheet(caster()), { level: 1 }), sheet(caster()), {
      level: 3,
    });
    const s = sheet(c);
    const id = s.actions.find((a) => a.name === 'Lore Recovery')!.id;
    // Up to level 3 (half of Lorekeeper 5, rounded up).
    expect(useAction(c, s, id).state.slotsUsed).toEqual([1, 0, 0]);
    expect(useAction(c, s, id, { slotLevel: 1 }).state.slotsUsed).toEqual([0, 0, 1]);
  });

  it('toggles pay to switch on, switch off others of their group, and switch off', () => {
    const c = brute();
    const s = sheet(c);
    const on = toggle(c, s, 'fury', true);
    expect(on.state.activeToggles).toEqual({ fury: {} });
    expect(on.state.resourcesUsed[FURY]).toBe(1);
    expect(toggle(on, s, 'fury', false).state.activeToggles).toEqual({});

    const grouped = {
      ...s,
      toggles: [
        ...s.toggles.map((t) => ({ ...t, group: 'g' })),
        { ...s.toggles[0]!, toggleId: 'calm', group: 'g', costs: [] },
      ],
    };
    expect(toggle(on, grouped, 'calm', true, { option: 'x' }).state.activeToggles).toEqual({
      calm: { option: 'x' },
    });
  });

  it('granted spells spend their own counter', () => {
    const c = testCharacter({
      classes: [{ classId: 'brute|tst', levels: 3 }],
      speciesId: 'mossling|tst',
      backgroundId: 'arena hand|tst',
      choices: [
        { owner: { kind: 'species', id: 'mossling|tst' }, slot: 'spellsSet', values: ['1'] },
      ],
    });
    const s = sheet(c);
    const lantern = s.spellcasting.granted[0]!;
    const used = spendFreeCast(c, s, lantern);
    expect(used.state.resourcesUsed[lantern.usesKey!]).toBe(1);
    // Daily: back after a Long Rest, not a Short one.
    expect(shortRest(used, sheet(used)).state.resourcesUsed[lantern.usesKey!]).toBe(1);
    expect(longRest(used, sheet(used)).state.resourcesUsed[lantern.usesKey!]).toBeUndefined();
  });
});

describe('rests', () => {
  it('Short Rest: Hit Dice heal, short resources come back (one use for Catch Breath)', () => {
    let c = brute();
    let s = sheet(c);
    c = applyDamage(c, s, 30);
    c = spendResource(spendResource(c, s, BREATH, 2), s, FURY, 1);
    c = toggle(c, s, 'fury', true);
    s = sheet(c);
    const rested = shortRest(c, s, [{ faces: 12, rolls: [5, 7] }]);
    // Each die heals its roll + CON modifier (+2).
    expect(rested.state.damage).toBe(14);
    expect(rested.state.hitDiceUsed).toEqual({ 12: 2 });
    expect(rested.state.resourcesUsed).toEqual({ [FURY]: 2, [BREATH]: 1 });
    // Fury ends only on a Long Rest.
    expect(rested.state.activeToggles).toEqual({ fury: {} });
    // Each die heals at least 1, even with a negative CON modifier.
    const frail = testCharacter({
      classes: [{ classId: 'brute|tst', levels: 5 }],
      scores: { con: 6 },
    });
    const fs0 = sheet(frail);
    const hurt = applyDamage(frail, fs0, 20);
    expect(shortRest(hurt, sheet(hurt), [{ faces: 12, rolls: [1, 1] }]).state.damage).toBe(18);
    // Can't spend more dice than there are.
    expect(
      shortRest(c, s, [{ faces: 12, rolls: [1, 1, 1, 1, 1, 1, 1] }]).state.hitDiceUsed,
    ).toEqual({ 12: 5 });
  });

  it('Long Rest: everything back, one Exhaustion level less; gifts stay spent', () => {
    let c = brute();
    c.log[0]!.choices.push({
      key: { owner: { kind: 'reward', id: 'charm of sparks|tst' }, slot: GRANTED_SLOT },
      values: [],
      labels: [],
      madeAt: 0,
      via: 'manual',
    });
    let s = sheet(c);
    const charm = s.resources.find((r) => r.source.kind === 'reward')!.key;
    c = applyDamage(c, s, 30);
    c = spendResource(spendResource(c, s, FURY, 3), s, charm, 1);
    c = toggle(c, s, 'fury', true);
    c = setTempHp(c, 5);
    c = setExhaustion(c, 2);
    c.state.hitDiceUsed = { 12: 3 };
    c.state.deathSaves = { successes: 1, failures: 2 };
    c.state.concentration = { kind: 'spell', id: 'dim lantern|tst' };
    s = sheet(c);
    const rested = longRest(c, s);
    expect(rested.state).toMatchObject({
      damage: 0,
      tempHp: 0,
      hitDiceUsed: {},
      exhaustion: 1,
      deathSaves: { successes: 0, failures: 0 },
      concentration: null,
      activeToggles: {},
      resourcesUsed: { [charm]: 1 },
    });
  });
});

describe('small state changes', () => {
  it('conditions, exhaustion, inspiration, item charges and once-per-turn riders', () => {
    const c = brute();
    const prone = 'condition/prone|tst';
    const withProne = addCondition(c, prone);
    expect(withProne.state.conditions).toEqual([prone]);
    expect(addCondition(withProne, prone)).toBe(withProne);
    expect(removeCondition(withProne, prone).state.conditions).toEqual([]);
    expect(setExhaustion(c, 9).state.exhaustion).toBe(6);
    expect(setExhaustion(c, -1).state.exhaustion).toBe(0);
    expect(setHeroicInspiration(c, true).state.heroicInspiration).toBe(true);
    const wand = { ...c, inventory: [{ uid: 'w', name: 'Wand', quantity: 1, attuned: false }] };
    expect(useItemCharge(wand, 'w', 2).inventory[0]?.chargesUsed).toBe(2);
    expect(useItemCharge(wand, 'missing')).toBe(wand);
    const used = useRider(c, 'hex-strike');
    expect(used.state.turn.ridersUsed).toEqual(['hex-strike']);
    expect(useRider(used, 'hex-strike')).toBe(used);
    expect(endTurn(used).state.turn.ridersUsed).toEqual([]);
  });

  it('death-save marks, hit dice spent and overrides, set directly', () => {
    const c = brute();
    expect(setDeathSaves(c, { successes: 5, failures: -1 }).state.deathSaves).toEqual({
      successes: 3,
      failures: 0,
    });
    // Brute 5: five d12s.
    expect(setHitDiceUsed(c, sheet(c), 12, 9).state.hitDiceUsed[12]).toBe(5);
    expect(setHitDiceUsed(c, sheet(c), 8, 2).state.hitDiceUsed[8]).toBe(0);
    const overridden = setOverride(c, 'ac', 18);
    expect(sheet(overridden).ac.value).toBe(18);
    expect(setOverride(overridden, 'ac', undefined).overrides).toEqual({});
  });
});
