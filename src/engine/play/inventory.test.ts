import { beforeAll, describe, expect, it } from 'vitest';
import type { Character, Currency, InventoryItem } from '../../schema/index.ts';
import { testCharacter } from '../../test/characters.ts';
import { FIXTURE_FEATURE_EFFECTS } from '../../test/fixtureFeatureEffects.ts';
import { fixtureIndex } from '../../test/fixtureIndex.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import { derive } from '../derive/derive.ts';
import {
  coinValueCp,
  equipItem,
  moveItem,
  newRow,
  payCoins,
  removeItem,
  setChargesLeft,
  setCurrency,
  unpackItem,
} from './inventory.ts';
import { longRest } from './reducers.ts';

let index: ContentIndex;
beforeAll(async () => {
  index = await fixtureIndex();
});

const item = (id: string) => ({ kind: 'item', id }) as const;
const row = (
  uid: string,
  id: string,
  extra: Partial<InventoryItem> = {},
): Partial<InventoryItem> => ({
  uid,
  itemRef: item(id),
  name: id.split('|')[0],
  ...extra,
});
const character = (inventory: Partial<InventoryItem>[]) =>
  testCharacter({ classes: [{ classId: 'brute|tst', levels: 1 }], inventory });
const slots = (c: Character) =>
  Object.fromEntries(c.inventory.map((r) => [r.uid, r.equipped ?? '-']));
let n = 0;
const uid = () => `new-${++n}`;

describe('equipping (one armor, one Shield, two hands)', () => {
  it('a second armor or shield replaces the first', () => {
    const c = character([
      row('mail', 'arena mail|tst', { equipped: 'armor' }),
      row('vest', 'padded vest|tst'),
    ]);
    expect(slots(equipItem(c, 'vest', 'armor', index))).toEqual({ mail: '-', vest: 'armor' });
  });

  it('two hands: what no longer fits is stowed', () => {
    const c = character([
      row('blade', 'net blade|tst', { equipped: 'mainHand' }),
      row('shiv', 'shiv|tst', { equipped: 'offHand' }),
      row('buckler', 'buckler|tst'),
      row('bow', 'arc bow|tst'),
    ]);
    // A Shield with both hands full frees the off hand.
    expect(slots(equipItem(c, 'buckler', 'shield', index))).toMatchObject({
      blade: 'mainHand',
      shiv: '-',
      buckler: 'shield',
    });
    // A Two-Handed bow takes both hands.
    expect(slots(equipItem(c, 'bow', 'bothHands', index))).toMatchObject({
      blade: '-',
      shiv: '-',
      bow: 'bothHands',
    });
  });

  it('a Versatile weapon in both hands moves to the main hand for a Shield', () => {
    const c = character([
      row('blade', 'net blade|tst', { equipped: 'bothHands' }),
      row('buckler', 'buckler|tst'),
    ]);
    expect(slots(equipItem(c, 'buckler', 'shield', index))).toEqual({
      blade: 'mainHand',
      buckler: 'shield',
    });
    // A Two-Handed one can't: it is stowed.
    const bow = character([
      row('bow', 'arc bow|tst', { equipped: 'bothHands' }),
      row('buckler', 'buckler|tst'),
    ]);
    expect(slots(equipItem(bow, 'buckler', 'shield', index))).toEqual({
      bow: '-',
      buckler: 'shield',
    });
  });

  it('one from a stack, out of its container; stowing keeps it out', () => {
    const c = character([
      row('pack', 'backpack|tst'),
      row('shivs', 'shiv|tst', { quantity: 3, containerUid: 'pack' }),
    ]);
    const next = equipItem(c, 'shivs', 'mainHand', index, uid);
    const [, stack, held] = next.inventory;
    expect(stack).toMatchObject({ uid: 'shivs', quantity: 2, containerUid: 'pack' });
    expect(held).toMatchObject({ quantity: 1, equipped: 'mainHand' });
    expect(held?.containerUid).toBeUndefined();
    expect(equipItem(next, held!.uid, null, index).inventory[2]?.equipped).toBeUndefined();
  });
});

describe('containers', () => {
  const c = () =>
    character([
      row('pack', 'backpack|tst'),
      row('sack', 'sack of holding|tst', { containerUid: 'pack' }),
      row('torch', 'torch|tst', { containerUid: 'sack', equipped: 'mainHand' }),
    ]);

  it('moving into a container stows; a container can’t go inside itself', () => {
    const torch = moveItem(c(), 'torch', 'pack').inventory[2]!;
    expect(torch).toMatchObject({ containerUid: 'pack' });
    expect(torch.equipped).toBeUndefined();
    const cycle = c();
    expect(moveItem(cycle, 'pack', 'sack')).toBe(cycle);
    expect(moveItem(cycle, 'pack', 'pack')).toBe(cycle);
    expect(moveItem(cycle, 'torch', null).inventory[2]?.containerUid).toBeUndefined();
  });

  it('removing a container puts its contents where it was', () => {
    const next = removeItem(c(), 'sack');
    expect(next.inventory.map((r) => [r.uid, r.containerUid])).toEqual([
      ['pack', undefined],
      ['torch', 'pack'],
    ]);
  });

  it('unpacking a pack: the contents go in its Backpack', () => {
    const c = character([row('kit', "delver's kit|tst", { quantity: 2 })]);
    const next = unpackItem(c, 'kit', index, uid);
    const [kit, pack, torches] = next.inventory;
    expect(kit).toMatchObject({ uid: 'kit', quantity: 1 });
    expect(pack).toMatchObject({ name: 'Backpack', quantity: 1, itemRef: item('backpack|tst') });
    expect(pack?.containerUid).toBeUndefined();
    expect(torches).toMatchObject({ name: 'Torch', quantity: 2, containerUid: pack?.uid });
    expect(unpackItem(next, 'kit', index, uid).inventory.some((r) => r.uid === 'kit')).toBe(false);
  });
});

describe('rows', () => {
  it('a variant row is named for the specific item', () => {
    const r = newRow({
      uid: 'r',
      item: index.get(item('net blade|tst')),
      variant: index.get(item('+1 arena weapon|tst')),
    });
    expect(r).toEqual({
      uid: 'r',
      name: '+1 Net Blade',
      quantity: 1,
      attuned: false,
      itemRef: item('net blade|tst'),
      variantRef: item('+1 arena weapon|tst'),
    });
    expect(newRow({ uid: 'c', name: ' Lucky coin ', custom: { weightLb: 0 } })).toEqual({
      uid: 'c',
      name: 'Lucky coin',
      quantity: 1,
      attuned: false,
      custom: { weightLb: 0 },
    });
  });

  it('charges left, and a Long Rest doesn’t recharge a dawn item', () => {
    const c = character([
      row('blade', 'shiv|tst', { variantRef: item('echo weapon|tst'), chargesMax: 3 }),
    ]);
    const spent = setChargesLeft(c, 'blade', 1, 3);
    expect(spent.inventory[0]?.chargesUsed).toBe(2);
    const sheet = derive(spent, index, { registry: FIXTURE_FEATURE_EFFECTS });
    expect(sheet.inventory.charges.blade).toEqual({
      max: 3,
      dice: '1d3',
      used: 2,
      recharge: 'dawn',
      amount: '1d3',
    });
    expect(longRest(spent, sheet).inventory[0]?.chargesUsed).toBe(2);
    expect(setChargesLeft(spent, 'blade', 3, 3).inventory[0]?.chargesUsed).toBeUndefined();
  });
});

describe('coins (1 PP = 10 GP = 20 EP = 100 SP = 1,000 CP)', () => {
  const purse = (p: Partial<Currency>): Currency => ({ cp: 0, sp: 0, ep: 0, gp: 0, pp: 0, ...p });

  it('pays with the coin asked for first, then the smallest', () => {
    expect(payCoins(purse({ gp: 10, cp: 500 }), 500, 'gp')).toEqual(purse({ gp: 5, cp: 500 }));
    expect(payCoins(purse({ gp: 10, cp: 500 }), 500)).toEqual(purse({ gp: 10 }));
  });

  it('breaks a larger coin and takes change in gold, silver and copper', () => {
    expect(payCoins(purse({ cp: 5, gp: 1 }), 7)).toEqual(purse({ cp: 8, sp: 9 }));
    expect(payCoins(purse({ pp: 1 }), 30)).toEqual(purse({ gp: 9, sp: 7 }));
    expect(payCoins(purse({ ep: 1, sp: 2 }), 35, 'sp')).toEqual(purse({ cp: 5, sp: 3 }));
  });

  it('refuses what the purse can’t cover', () => {
    expect(payCoins(purse({ gp: 1 }), 101)).toBeNull();
    expect(coinValueCp(purse({ cp: 1, sp: 1, ep: 1, gp: 1, pp: 1 }))).toBe(1161);
  });

  it('setting the purse keeps whole, non-negative counts', () => {
    const c = setCurrency(character([]), purse({ gp: 12.7, sp: -3 }));
    expect(c.currency).toEqual(purse({ gp: 12 }));
  });
});
