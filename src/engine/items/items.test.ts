import { beforeAll, describe, expect, it } from 'vitest';
import type { Item } from '../../schema/index.ts';
import { fixtureIndex } from '../../test/fixtureIndex.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import {
  armorDrawbacks,
  carryMultiplier,
  carrySize,
  chargesOf,
  equipSlots,
  needsAttunement,
  variantApplies,
  variantName,
} from './items.ts';

let index: ContentIndex;
beforeAll(async () => {
  index = await fixtureIndex();
});
const get = (id: string) => index.get({ kind: 'item', id })!;

const base = (name: string, raw: Item['variantBase']): Item => ({
  id: `${name.toLowerCase()}|xphb`,
  kind: 'item',
  name,
  source: 'XPHB',
  edition: '2024',
  entries: [],
  effects: [],
  origin: { adapter: '5etools', adapterVersion: 4, importedAt: 0 },
  itemKind: 'weapon',
  variantBase: { name, source: 'XPHB', ...raw },
});

const generic = (variant: Partial<NonNullable<Item['variant']>>, extra: Partial<Item> = {}) =>
  ({
    id: 'v|xdmg',
    kind: 'item',
    name: 'V',
    source: 'XDMG',
    edition: '2024',
    entries: [],
    effects: [],
    itemKind: 'variant',
    variant: { requires: [], inherits: {}, ...variant },
    ...extra,
  }) as Item;

describe('magic variants (5etools requires/excludes)', () => {
  const longsword = base('Longsword', {
    edition: 'one',
    type: 'M|XPHB',
    weapon: true,
    sword: true,
    weaponCategory: 'martial',
    property: ['V|XPHB'],
    dmgType: 'S',
  });
  const net = base('Net', { edition: 'one', type: 'R|XPHB', weapon: true, net: true });
  const plate = base('Plate Armor', { edition: 'one', type: 'HA|XPHB', armor: true });

  it('needs one `requires` filter matched in full', () => {
    const swordOnly = generic({ requires: [{ sword: true }] });
    expect(variantApplies(longsword, swordOnly)).toBe(true);
    expect(variantApplies(net, swordOnly)).toBe(false);
    // One of several filters is enough; within a filter every key must match.
    const armorTypes = generic({ requires: [{ type: 'MA|XPHB' }, { type: 'HA|XPHB' }] });
    expect(variantApplies(plate, armorTypes)).toBe(true);
    const named = generic({ requires: [{ name: 'Longsword', source: 'XPHB' }] });
    expect(variantApplies(longsword, named)).toBe(true);
    expect(
      variantApplies(longsword, generic({ requires: [{ name: 'Longsword', source: 'PHB' }] })),
    ).toBe(false);
    // A list value matches any item of the base's list (properties).
    expect(variantApplies(longsword, generic({ requires: [{ property: 'V|XPHB' }] }))).toBe(true);
  });

  it('a single `excludes` match rules it out', () => {
    const weapons = generic({ requires: [{ weapon: true }], excludes: { net: true } });
    expect(variantApplies(longsword, weapons)).toBe(true);
    expect(variantApplies(net, weapons)).toBe(false);
    const notNamed = generic({ requires: [{ weapon: true }], excludes: { name: ['Net', 'Whip'] } });
    expect(variantApplies(net, notNamed)).toBe(false);
  });

  it('follows the edition rule, and only base items take variants', () => {
    const classic = generic({ requires: [{ weapon: true }], edition: 'classic' });
    expect(variantApplies(longsword, classic)).toBe(false);
    const noEdition = base('Pitchfork', { type: 'M', weapon: true });
    expect(variantApplies(noEdition, classic)).toBe(true);
    const classicBase = base('Old Sword', { edition: 'classic', type: 'M', weapon: true });
    expect(variantApplies(classicBase, generic({ requires: [{ weapon: true }] }))).toBe(false);
    expect(variantApplies(classicBase, classic)).toBe(true);
    const { variantBase: _, ...magic } = longsword;
    expect(variantApplies(magic, generic({ requires: [{ weapon: true }] }))).toBe(false);
  });

  it('names the specific item', () => {
    expect(variantName(longsword, generic({ namePrefix: '+1 ' }))).toBe('+1 Longsword');
    expect(variantName(plate, generic({ nameSuffix: ' of Etherealness' }))).toBe(
      'Plate Armor of Etherealness',
    );
    expect(
      variantName(plate, generic({ nameSuffix: ' Mail', inherits: { nameRemove: ' Armor' } })),
    ).toBe('Plate Mail');
  });

  it('works on imported fixture content', () => {
    const plusOne = get('+1 arena weapon|tst');
    const echo = get('echo weapon|tst');
    const old = get('+1 old weapon|tst');
    expect(variantApplies(get('net blade|tst'), plusOne)).toBe(true);
    expect(variantApplies(get('arc bow|tst'), echo)).toBe(false); // R|TST, not M|TST
    expect(variantApplies(get('shiv|tst'), echo)).toBe(true);
    // Net Blade is a 2024 item: no classic variants. The Shiv has no edition: any.
    expect(variantApplies(get('net blade|tst'), old)).toBe(false);
    expect(variantApplies(get('shiv|tst'), old)).toBe(true);
    expect(variantApplies(get("delver's kit|tst"), plusOne)).toBe(false);
    expect(variantName(get('shiv|tst'), echo)).toBe('Shiv of Echoes');
  });
});

describe('items', () => {
  it('where each item can go', () => {
    expect(equipSlots(get('arena mail|tst'))).toEqual(['armor']);
    expect(equipSlots(get('buckler|tst'))).toEqual(['shield']);
    // Two-Handed: both hands. Versatile: one hand or both. Light: one hand.
    expect(equipSlots(get('arc bow|tst'))).toEqual(['bothHands']);
    expect(equipSlots(get('net blade|tst'))).toEqual(['mainHand', 'offHand', 'bothHands']);
    expect(equipSlots(get('shiv|tst'))).toEqual(['mainHand', 'offHand']);
    expect(equipSlots(get('torch|tst'))).toEqual(['mainHand', 'offHand', 'worn']);
    expect(equipSlots(get("delver's kit|tst"))).toEqual([]);
    expect(equipSlots(undefined)).toEqual(['mainHand', 'offHand', 'bothHands', 'worn']);
  });

  it('Attunement from the item or its variant', () => {
    expect(needsAttunement(get('cloak of cheers|tst'))).toBe(true);
    expect(needsAttunement(get('shiv|tst'))).toBe(false);
    expect(needsAttunement(get('shiv|tst'), get('echo weapon|tst'))).toBe('by a gladiator');
  });

  it('charges, with dice to roll for the maximum', () => {
    const row = { uid: 'r', name: 'Shiv of Echoes', quantity: 1, attuned: true };
    expect(chargesOf(row, get('shiv|tst'), get('echo weapon|tst'))).toEqual({
      used: 0,
      dice: '1d3',
      recharge: 'dawn',
      amount: '1d3',
    });
    expect(
      chargesOf({ ...row, chargesMax: 2, chargesUsed: 1 }, get('shiv|tst'), get('echo weapon|tst')),
    ).toMatchObject({ max: 2, used: 1 });
    expect(chargesOf(row, get('shiv|tst'))).toBeNull();
  });

  it('armor drawbacks, which a variant can lift', () => {
    expect(armorDrawbacks(get('arena mail|tst'))).toEqual({ strReq: 15, stealthDis: true });
    const mithral = generic({ inherits: { stealth: false, strength: null } });
    expect(armorDrawbacks(get('arena mail|tst'), mithral)).toEqual({ stealthDis: false });
  });

  it('carrying capacity by size, Powerful Build counting one larger', () => {
    expect(carryMultiplier(carrySize('M', 0))).toBe(15);
    expect(carryMultiplier(carrySize('S', 0))).toBe(15);
    expect(carryMultiplier(carrySize('T', 0))).toBe(7.5);
    expect(carryMultiplier(carrySize('M', 1))).toBe(30);
    expect(carryMultiplier(carrySize('S', 1))).toBe(15);
    expect(carrySize('G', 1)).toBe('G');
  });
});
