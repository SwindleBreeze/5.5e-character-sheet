import { beforeAll, describe, expect, it } from 'vitest';
import type { Character, Currency, InventoryItem } from '../../schema/index.ts';
import { testCharacter } from '../../test/characters.ts';
import { FIXTURE_FEATURE_EFFECTS } from '../../test/fixtureFeatureEffects.ts';
import { fixtureIndex } from '../../test/fixtureIndex.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import { derive } from '../derive/derive.ts';
import {
  coinValueCp,
  loseAmmo,
  drawWeapon,
  equipItem,
  moveItem,
  newRow,
  payCoins,
  recoverAmmo,
  removeItem,
  setChargesLeft,
  setQuantity,
  unstackHeld,
  setCurrency,
  spendAmmo,
  unpackItem,
  chooseGroupItem,
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

  it('drawing a stowed weapon to attack: a free hand first, else the main hand', () => {
    const c = character([
      row('blade', 'net blade|tst', { equipped: 'mainHand' }),
      row('shiv', 'shiv|tst'),
      row('bow', 'arc bow|tst'),
    ]);
    expect(slots(drawWeapon(c, 'shiv', index))).toMatchObject({
      blade: 'mainHand',
      shiv: 'offHand',
    });
    // A Two-Handed bow takes both hands; one already in hand stays put.
    expect(slots(drawWeapon(c, 'bow', index))).toMatchObject({ blade: '-', bow: 'bothHands' });
    expect(drawWeapon(c, 'blade', index)).toBe(c);
  });

  it('one from a stack, out of its container; stowing keeps it out', () => {
    const c = character([
      row('pack', 'backpack|tst'),
      row('shivs', 'shiv|tst', { quantity: 3, containerUid: 'pack' }),
    ]);
    const next = equipItem(c, 'shivs', 'mainHand', index, uid);
    const [, held, stack] = next.inventory;
    // The one in hand keeps the row; the rest stay in the pack.
    expect(held).toMatchObject({ uid: 'shivs', quantity: 1, equipped: 'mainHand' });
    expect(held?.containerUid).toBeUndefined();
    expect(stack).toMatchObject({ quantity: 2, containerUid: 'pack' });
    expect(stack?.equipped).toBeUndefined();
    expect(equipItem(next, 'shivs', null, index).inventory[1]?.equipped).toBeUndefined();
  });

  it('worn and held items are one each: more go to Carried', () => {
    // Saved with two Shivs in one hand: one stays, the other is carried.
    const pair = character([row('shivs', 'shiv|tst', { quantity: 2, equipped: 'mainHand' })]);
    const fixed = unstackHeld(pair, uid);
    expect(fixed.inventory.map((r) => [r.uid, r.quantity, r.equipped ?? '-'])).toEqual([
      ['shivs', 1, 'mainHand'],
      [expect.stringMatching(/^new-/), 1, '-'],
    ]);
    expect(unstackHeld(fixed)).toBe(fixed);
    // Then one in each hand.
    expect(slots(equipItem(fixed, fixed.inventory[1]!.uid, 'offHand', index))).toMatchObject({
      shivs: 'mainHand',
    });
    // Raising a held row's quantity adds to the carried stack.
    const more = setQuantity(fixed, 'shivs', 3, uid);
    expect(more.inventory.map((r) => [r.quantity, r.equipped ?? '-'])).toEqual([
      [1, 'mainHand'],
      [3, '-'],
    ]);
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

describe('item groups', () => {
  it('a group row becomes the one item of the group picked', () => {
    const c = character([row('focus', 'lantern focus|tst', { notes: 'from my teacher' })]);
    const next = chooseGroupItem(c, 'focus', 'torch|tst', index);
    expect(next.inventory[0]).toMatchObject({
      uid: 'focus',
      name: 'Torch',
      itemRef: item('torch|tst'),
      notes: 'from my teacher',
    });
    // Only an item of that group.
    expect(chooseGroupItem(c, 'focus', 'shiv|tst', index)).toBe(c);
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

describe('ammunition', () => {
  it('each attack expends one; a bundle is opened first; half is recovered, rounded down', () => {
    const c = character([
      row('bundle', 'arrows (20)|tst'),
      row('magic', 'arrow|tst', { quantity: 3, variantRef: item('+1 arena ammunition|tst') }),
    ]);
    let next = spendAmmo(c, 'bundle', 'arrow|tst', index, () => 'opened');
    expect(next.inventory.map((r) => [r.uid, r.name, r.quantity])).toEqual([
      ['opened', 'Arrow', 19],
      ['magic', 'arrow', 3],
    ]);
    next = spendAmmo(next, 'opened', 'arrow|tst', index);
    next = spendAmmo(next, 'opened', 'arrow|tst', index);
    next = spendAmmo(next, 'magic', 'arrow|tst', index);
    expect(next.state.ammoUsed).toEqual({ opened: 3, magic: 1 });

    const back = recoverAmmo(next, ['opened', 'magic']);
    expect(back.inventory.map((r) => r.quantity)).toEqual([18, 2]);
    expect(back.state.ammoUsed).toBeUndefined();
    expect(loseAmmo(next, ['opened']).state.ammoUsed).toEqual({ magic: 1 });
    expect(removeItem(next, 'magic').state.ammoUsed).toEqual({ opened: 3 });
    // Nothing to spend: no change.
    const empty = character([row('none', 'arrow|tst', { quantity: 0 })]);
    expect(spendAmmo(empty, 'none', 'arrow|tst', index)).toBe(empty);
  });
});
