import { describe, expect, it } from 'vitest';
import type { Item } from '../../schema/index.ts';
import { isMagic, shelfOf, stockShop } from './shop.ts';

const item = (name: string, extra: Partial<Item> = {}): Item =>
  ({
    kind: 'item',
    id: `${name.toLowerCase()}|tst`,
    name,
    source: 'TST',
    itemKind: 'gear',
    entries: [],
    effects: [],
    ...extra,
  }) as Item;

describe('the Shop’s shelves', () => {
  it('weapons by category and reach, armor by weight, tools by kind', () => {
    const weapon = (category: 'simple' | 'martial', ranged: boolean) =>
      shelfOf(
        item('W', {
          itemKind: 'weapon',
          weapon: { category, ranged, damage: '1d6', damageType: 'piercing', properties: [] },
        }),
      )?.shelf;
    expect(weapon('simple', false)).toBe('Simple melee weapons');
    expect(weapon('martial', true)).toBe('Martial ranged weapons');
    expect(shelfOf(item('A', { itemKind: 'ammo' }))?.shelf).toBe('Ammunition');
    expect(
      shelfOf(item('Mail', { itemKind: 'armor', armor: { category: 'heavy', ac: 16 } }))?.shelf,
    ).toBe('Heavy armor');
    expect(shelfOf(item('S', { itemKind: 'shield' }))?.shelf).toBe('Shields');
    expect(shelfOf(item('L', { itemKind: 'tool', toolType: 'instrument' }))).toEqual({
      group: 'tools',
      shelf: 'Musical instruments',
    });
  });

  it('gear by what it is for: light, containers, food, packs; mounts and treasure by type', () => {
    expect(shelfOf(item('Torch', { itemTags: ['light'] }))?.shelf).toBe('Light');
    expect(shelfOf(item('Sack', { container: true }))?.shelf).toBe('Containers');
    expect(shelfOf(item('Bread', { itemType: 'FD' }))?.shelf).toBe('Food, drink and lodging');
    const contents = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ itemId: `x${i}|tst`, quantity: 1 }));
    expect(shelfOf(item('Kit', { itemKind: 'pack', packContents: contents(3) }))?.shelf).toBe(
      'Equipment packs',
    );
    expect(shelfOf(item('Spikes', { itemKind: 'pack', packContents: contents(1) }))?.shelf).toBe(
      'Other gear',
    );
    expect(shelfOf(item('Rope'))?.shelf).toBe('Other gear');
    expect(shelfOf(item('Venom', { itemTags: ['poison'] }))?.shelf).toBe('Poisons');
    expect(shelfOf(item('Pony', { itemType: 'MNT' }))).toEqual({
      group: 'mounts',
      shelf: 'Mounts',
    });
    expect(shelfOf(item('Ruby', { itemType: '$G' }))?.group).toBe('treasure');
  });

  it('magic items by kind; magic variants apart; item groups not sold themselves', () => {
    expect(isMagic(item('Plain'))).toBe(false);
    expect(
      shelfOf(item('Staff', { rarity: 'rare', itemKind: 'weapon', itemTags: ['staff'] }))?.shelf,
    ).toBe('Staffs');
    expect(shelfOf(item('Ring', { rarity: 'rare', itemType: 'RG' }))).toEqual({
      group: 'magic',
      shelf: 'Rings',
    });
    expect(shelfOf(item('Brew', { rarity: 'common', consumable: 'potion' }))?.shelf).toBe(
      'Potions',
    );
    expect(shelfOf(item('Blade', { rarity: 'rare', itemKind: 'weapon' }))?.shelf).toBe(
      'Weapons and ammunition',
    );
    expect(shelfOf(item('Cloak', { rarity: 'uncommon', itemKind: 'wondrous' }))?.shelf).toBe(
      'Wondrous items and others',
    );
    expect(
      shelfOf(item('+1 Weapon', { itemKind: 'variant', variant: { requires: [], inherits: {} } }))
        ?.shelf,
    ).toBe('Magic variants');
    expect(shelfOf(item('Focus', { groupItemIds: ['a|tst'] }))).toBeNull();
  });

  it('stocks the groups in order, shelves sorted by name, empty ones left out', () => {
    const shop = stockShop([
      item('Torch', { itemTags: ['light'] }),
      item('Candle', { itemTags: ['light'] }),
      item('Ring', { rarity: 'rare', itemType: 'RG' }),
    ]);
    expect(shop.map((g) => [g.title, g.count])).toEqual([
      ['Adventuring gear', 2],
      ['Magic items', 1],
    ]);
    expect(shop[0]!.shelves).toEqual([
      { title: 'Light', items: [expect.objectContaining({ name: 'Candle' }), expect.anything()] },
    ]);
  });
});
