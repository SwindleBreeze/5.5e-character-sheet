import { beforeAll, describe, expect, it } from 'vitest';
import type { Character } from '../../schema/index.ts';
import { testCharacter } from '../../test/characters.ts';
import { FIXTURE_FEATURE_EFFECTS } from '../../test/fixtureFeatureEffects.ts';
import { fixtureIndex } from '../../test/fixtureIndex.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import { derive } from '../derive/derive.ts';
import { applyDamage, longRest, shortRest, spendResource, toggle } from './reducers.ts';
import { canRest, hitDieFixed, restSummary } from './rests.ts';

let index: ContentIndex;
beforeAll(async () => {
  index = await fixtureIndex();
});

const sheet = (c: Character) => derive(c, index, { registry: FIXTURE_FEATURE_EFFECTS });
const nameOf = (ref: { id: string }) => ref.id.split('|')[0]!;
const FURY = 'classFeature:fury|brute|tst|1|tst#furies';
const BREATH = 'classFeature:catch breath|brute|tst|2|tst#catch-breath';

/** Brute 5, CON 14: 50 HP, 5d12; hurt, with Furies and Catch Breath spent and Fury on. */
function tired(): Character {
  let c = testCharacter({ classes: [{ classId: 'brute|tst', levels: 5 }], scores: { con: 14 } });
  const s = sheet(c);
  c = applyDamage(c, s, 30);
  c = spendResource(spendResource(c, s, BREATH, 2), s, FURY, 1);
  c = toggle(c, s, 'fury', true);
  c.state.hitDiceUsed = { 12: 2 };
  c.state.exhaustion = 2;
  c.state.tempHp = 4;
  return c;
}

describe('rests', () => {
  it('a Long Rest says what comes back and what ends', () => {
    const c = tired();
    const s = sheet(c);
    expect(restSummary(c, longRest(c, s), s, nameOf)).toEqual({
      spent: [],
      back: [
        'Hit Points: 30 back (full)',
        'Hit Dice: 2 d12 back',
        'Furies: 2 back',
        'Catch Breath: 2 back',
      ],
      ends: ['Temporary Hit Points end (4)', 'Exhaustion: level 2 → 1', 'Fury ends'],
    });
  });

  it('a Short Rest: the Hit Dice spent, what they healed, one use of Catch Breath', () => {
    const c = tired();
    const s = sheet(c);
    expect(restSummary(c, shortRest(c, s, [{ faces: 12, rolls: [6] }]), s, nameOf)).toEqual({
      spent: ['Hit Dice: 1 d12 (2 of 5 left)'],
      back: ['Hit Points: 8 back (28 of 50)', 'Catch Breath: 1 back'],
      ends: [],
    });
  });

  it('the fixed value of a Hit Die, and resting needs at least 1 HP', () => {
    expect([6, 8, 10, 12].map(hitDieFixed)).toEqual([4, 5, 6, 7]);
    const c = tired();
    expect(canRest(sheet(c))).toBe(true);
    const down = applyDamage(c, sheet(c), 100);
    expect(canRest(sheet(down))).toBe(false);
  });
});
