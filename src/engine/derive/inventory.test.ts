import { beforeAll, describe, expect, it } from 'vitest';
import type { Character, InventoryItem } from '../../schema/index.ts';
import { testCharacter } from '../../test/characters.ts';
import { FIXTURE_FEATURE_EFFECTS } from '../../test/fixtureFeatureEffects.ts';
import { fixtureIndex } from '../../test/fixtureIndex.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import { derive } from './derive.ts';
import type { DerivedSheet } from './types.ts';

let index: ContentIndex;
beforeAll(async () => {
  index = await fixtureIndex();
});

const run = (c: Character): DerivedSheet => derive(c, index, { registry: FIXTURE_FEATURE_EFFECTS });
const item = (id: string) => ({ kind: 'item', id }) as const;
const row = (
  uid: string,
  id: string,
  extra: Partial<InventoryItem> = {},
): Partial<InventoryItem> => ({
  uid,
  itemRef: item(id),
  name: index.get(item(id))?.name ?? id,
  ...extra,
});
const messages = (d: DerivedSheet) => d.issues.map((i) => i.message);

/** Brute 1 (light and medium armor, Bucklers), STR 12. */
const brute = (inventory: Partial<InventoryItem>[], scores = { str: 12, dex: 14 }) =>
  testCharacter({
    classes: [{ classId: 'brute|tst', levels: 1 }],
    speciesId: 'mossling|tst',
    backgroundId: 'arena hand|tst',
    scores,
    inventory,
  });

describe('weight and carrying capacity (2024)', () => {
  it('items and coins against Strength × 15; a weightless container’s contents don’t count', () => {
    const c = brute([
      row('pack', 'backpack|tst'),
      row('torches', 'torch|tst', { quantity: 3, containerUid: 'pack' }),
      row('sack', 'sack of holding|tst', { containerUid: 'pack' }),
      row('mail', 'arena mail|tst', { containerUid: 'sack' }),
      row('bow', 'arc bow|tst', { containerUid: 'sack' }),
    ]);
    c.currency = { cp: 0, sp: 20, ep: 0, gp: 80, pp: 0 };
    const inv = run(c).inventory;
    // Backpack 5 + 3 torches + Sack 5; the Sack's contents (50 + 2) weigh nothing; 100 coins: 2.
    expect(inv.weight.value).toBe(15);
    expect(inv.weight.parts.map((p) => [p.label, p.value])).toEqual([
      ['Items', 13],
      ['100 coins (50 to the pound)', 2],
    ]);
    expect(inv.carry.value).toBe(180);
    expect(inv.dragLiftPush).toBe(360);
    expect(inv.carrySize).toBe('S'); // A Mossling with no size picked is Small: also × 15
    // The Backpack holds 30 lb.: 3 torches and the 5 lb. Sack, not what the Sack holds.
    expect(inv.containers.pack).toEqual({ contents: 8, capacity: 30, weightless: false });
    expect(inv.containers.sack).toEqual({ contents: 52, capacity: 500, weightless: true });
  });

  it('a full container, and more than you can carry or drag', () => {
    const full = brute([
      row('pack', 'backpack|tst'),
      row('mail', 'arena mail|tst', { containerUid: 'pack' }),
    ]);
    expect(messages(run(full))).toContain('Backpack holds 30 lb.; it has 50 lb. in it.');

    const heavy = brute([row('mail', 'arena mail|tst', { quantity: 4 })], { str: 8, dex: 10 });
    const walk = run(heavy).speed.walk!;
    expect(run(heavy).issues).toContainEqual({
      severity: 'info',
      code: 'overCapacity',
      message:
        'You have 200 lb.; you can carry 120 lb. Past that you can only drag, lift or push it, so your Speed is at most 5 feet while you carry it all.',
    });
    // The Speed on the sheet follows: at most 5 feet, and why.
    expect(walk.value).toBe(5);
    expect(walk.parts.at(-1)).toEqual({
      label: 'Carrying 200 lb., more than you can carry (120 lb.): at most 5 ft.',
      value: 5 - walk.parts.slice(0, -1).reduce((sum, p) => sum + p.value, 0),
    });

    heavy.inventory[0]!.quantity = 5;
    expect(messages(run(heavy))).toContain(
      'You have 250 lb.; you can drag, lift or push at most 240 lb., so your Speed is 0 while you carry it all. Drop or stow something to move.',
    );
    expect(run(heavy).speed.walk!.value).toBe(0);

    // A group that doesn't count weight: no slowing, no warning.
    heavy.ignoreWeight = true;
    expect(run(heavy).speed.walk!.value).toBe(
      run(brute([], { str: 8, dex: 10 })).speed.walk!.value,
    );
    expect(run(heavy).issues.map((i) => i.code)).not.toContain('overDragLimit');

    // The player's own Speed wins.
    heavy.ignoreWeight = false;
    heavy.overrides = { 'speed.walk': 25 };
    expect(run(heavy).speed.walk!.value).toBe(25);
  });

  it('a container that holds items by count: a Quiver holds Arrows and nothing else', () => {
    const d = run(
      brute([
        row('quiver', 'quiver|tst'),
        row('arrows', 'arrow|tst', { quantity: 24, containerUid: 'quiver' }),
        row('torch', 'torch|tst', { containerUid: 'quiver' }),
      ]),
    );
    expect(d.inventory.containers.quiver?.counts).toEqual([
      { itemId: 'arrow|tst', name: 'Arrow', count: 24, max: 20 },
    ]);
    expect(messages(d)).toContain('Quiver holds 20 Arrow; it has 24 in it.');
    expect(messages(d)).toContain('Torch doesn’t go in Quiver; it holds Arrow.');
  });

  it('Powerful Build counts one size larger', () => {
    const c = testCharacter({
      classes: [{ classId: 'brute|tst', levels: 1 }],
      speciesId: 'stoneborn|old',
      backgroundId: 'arena hand|tst',
      scores: { str: 10 },
    });
    const inv = run(c).inventory;
    expect(inv.carrySize).toBe('L');
    expect(inv.carry.value).toBe(300);
    expect(inv.carry.parts[0]?.label).toBe('Strength 10 × 30 (Large, counted one size larger)');
  });
});

describe('armor training (2024)', () => {
  it('armor without training: Disadvantage on Strength and Dexterity D20 Tests, no spells', () => {
    const d = run(
      brute([row('mail', 'arena mail|tst', { equipped: 'armor' })], { str: 16, dex: 14 }),
    );
    const why = 'Arena Mail without armor training';
    expect(d.saves.str.disadvantage).toContain(why);
    expect(d.saves.dex.mode).toBe('disadvantage');
    expect(d.checks.str.disadvantage).toContain(why);
    expect(d.skills.athletics.disadvantage).toContain(why);
    expect(d.skills.acrobatics.disadvantage).toContain(why);
    expect(d.initiative.disadvantage).toContain(why);
    expect(d.attacks.find((a) => a.id === 'unarmed')?.toHit?.disadvantage).toContain(why);
    // Constitution, Intelligence… are unaffected.
    expect(d.saves.con.disadvantage).toEqual([]);
    expect(d.skills.arcana.disadvantage).toEqual([]);
    // Arena Mail also gives Disadvantage on Stealth, trained or not.
    expect(d.skills.stealth.disadvantage).toEqual([why, 'Arena Mail']);
    expect(d.issues).toContainEqual({
      severity: 'warn',
      code: 'armorUntrained',
      message:
        'You lack heavy armor training for your Arena Mail: Disadvantage on D20 Tests that involve Strength or Dexterity, and you can’t cast spells.',
    });
  });

  it('trained armor: only its own drawbacks (Stealth; Speed below its Strength)', () => {
    const d = run(brute([row('vest', 'padded vest|tst', { equipped: 'armor' })]));
    expect(d.issues.map((i) => i.code)).not.toContain('armorUntrained');
    expect(d.saves.str.disadvantage).toEqual([]);
    expect(d.skills.stealth.disadvantage).toEqual([]);
    expect(d.ac.value).toBe(13); // 11 + DEX 2

    const mail = run(brute([row('mail', 'arena mail|tst', { equipped: 'armor' })]));
    expect(mail.speed.walk?.value).toBe(20); // STR 12 < 15: −10
  });

  it('a Shield without training gives no AC', () => {
    const trained = run(brute([row('b', 'buckler|tst', { equipped: 'shield' })]));
    expect(trained.ac.value).toBe(14); // 10 + DEX 2 + Buckler 2
    const lore = testCharacter({
      classes: [{ classId: 'lorekeeper|tst', levels: 1 }],
      scores: { dex: 14 },
      inventory: [row('b', 'buckler|tst', { equipped: 'shield' })],
    });
    const d = run(lore);
    expect(d.ac.value).toBe(12);
    expect(messages(d)).toContain('You lack Shield training: your Buckler gives no Armor Class.');
  });
});

describe('Attunement (2024)', () => {
  const echo = (extra: Partial<InventoryItem> = {}) =>
    row('blade', 'shiv|tst', {
      name: 'Shiv of Echoes',
      variantRef: item('echo weapon|tst'),
      equipped: 'mainHand',
      ...extra,
    });

  it('magic that needs Attunement works only when attuned', () => {
    const glad = (attuned: boolean) =>
      testCharacter({
        classes: [{ classId: 'gladiator|tst', levels: 1 }],
        scores: { str: 10, dex: 16 },
        inventory: [echo({ attuned })],
      });
    const hit = (d: DerivedSheet) =>
      d.attacks.find((a) => a.rowUid === 'blade')?.toHit?.bonus.value;
    // DEX +3, proficiency +2; the variant's +1 only when attuned.
    expect(hit(run(glad(false)))).toBe(5);
    expect(hit(run(glad(true)))).toBe(6);
    expect(run(glad(true)).inventory.unqualified).toEqual([]);
  });

  it('a prerequisite not met: no Attunement', () => {
    const d = run(brute([echo({ attuned: true })]));
    expect(d.inventory.unqualified).toEqual(['blade']);
    expect(messages(d)).toContain(
      'Shiv of Echoes requires Attunement by a gladiator, which you don’t meet; your Attunement to it ends.',
    );
  });

  it('no more than three, and never two copies', () => {
    const cloak = (uid: string) =>
      row(uid, 'cloak of cheers|tst', { attuned: true, equipped: 'worn' });
    const d = run(brute([cloak('a'), cloak('b'), row('c', 'torch|tst', { attuned: true })]));
    // The Torch needs no Attunement, so it doesn't count.
    expect(d.inventory.attuned).toBe(2);
    expect(messages(d)).toContain('You can’t attune to more than one copy of Cloak of Cheers.');
    const four = run(
      brute([
        cloak('a'),
        { uid: 'x', name: 'Custom ring', attuned: true },
        { uid: 'y', name: 'Custom amulet', attuned: true },
        { uid: 'z', name: 'Custom crown', attuned: true },
      ]),
    );
    expect(four.inventory.attuned).toBe(4);
    expect(messages(four)).toContain('4 items attuned; the limit is 3.');
  });
});
