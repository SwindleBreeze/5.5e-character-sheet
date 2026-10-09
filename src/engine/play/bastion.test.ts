import { describe, expect, it } from 'vitest';
import { newCharacter } from '../build/newCharacter.ts';
import {
  addFacility,
  bastionOf,
  removeFacility,
  setBastionCount,
  setFacilityNote,
  setFacilityOrder,
  showsBastion,
} from './bastion.ts';

const forge = {
  uid: 'f1',
  ref: { kind: 'facility', id: 'spark forge|tst' },
  name: 'Spark Forge',
} as const;
const yard = {
  uid: 'f2',
  ref: { kind: 'facility', id: 'practice yard|tst' },
  name: 'Yard',
} as const;

describe('bastion', () => {
  it('has none until something is added, and none again once it is all removed', () => {
    let c = newCharacter('Ada', 0);
    expect(c.bastion).toBeUndefined();
    expect(bastionOf(c)).toEqual({ facilities: [], hirelings: 0, defenders: 0 });
    c = addFacility(c, forge);
    expect(c.bastion).toEqual({ facilities: [forge], hirelings: 0, defenders: 0 });
    c = removeFacility(c, 'f1');
    expect('bastion' in c).toBe(false);
  });

  it('the same facility can be added twice; each row has its own order and note', () => {
    let c = addFacility(addFacility(newCharacter('Ada', 0), forge), { ...forge, uid: 'f3' });
    c = addFacility(c, yard);
    c = setFacilityOrder(c, 'f1', 'craft');
    c = setFacilityNote(c, 'f3', 'Mending the shield.');
    expect(bastionOf(c).facilities).toEqual([
      { ...forge, order: 'craft' },
      { ...forge, uid: 'f3', note: 'Mending the shield.' },
      yard,
    ]);
    c = setFacilityOrder(c, 'f1', null);
    c = setFacilityNote(c, 'f3', '');
    expect(bastionOf(c).facilities.map((f) => Object.keys(f).sort())).toEqual([
      ['name', 'ref', 'uid'],
      ['name', 'ref', 'uid'],
      ['name', 'ref', 'uid'],
    ]);
  });

  it('hirelings and defenders are whole numbers from zero', () => {
    let c = setBastionCount(newCharacter('Ada', 0), 'defenders', 4);
    expect(c.bastion).toEqual({ facilities: [], hirelings: 0, defenders: 4 });
    c = setBastionCount(c, 'hirelings', 2.7);
    c = setBastionCount(c, 'defenders', -3);
    expect(bastionOf(c)).toMatchObject({ hirelings: 2, defenders: 0 });
    expect(setBastionCount(c, 'hirelings', Number.NaN).bastion).toBeUndefined();
  });

  it('shown from level 5, or before it when the character has one', () => {
    const c = newCharacter('Ada', 0);
    expect(showsBastion(c, 4)).toBe(false);
    expect(showsBastion(c, 5)).toBe(true);
    expect(showsBastion(setBastionCount(c, 'defenders', 1), 4)).toBe(true);
  });
});
