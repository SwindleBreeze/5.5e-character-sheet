import { beforeAll, describe, expect, it } from 'vitest';
import type { Character, ContentEntity, InventoryItem, Item, Rule } from '../../schema/index.ts';
import { testCharacter, type TestChoice } from '../../test/characters.ts';
import { fixtureContent, fixtureIndex } from '../../test/fixtureIndex.ts';
import { FIXTURE_FEATURE_EFFECTS } from '../../test/fixtureFeatureEffects.ts';
import { createContentIndex, type ContentIndex } from '../content/contentIndex.ts';
import { UNARMED_TRAITS, weaponTraits } from '../static/attackTraits.ts';
import { derive } from './derive.ts';
import { targetMatches } from './rolls.ts';
import type { DerivedAttack, DerivedSheet } from './types.ts';

let index: ContentIndex;

beforeAll(async () => {
  index = await fixtureIndex();
});

const run = (c: Character): DerivedSheet => derive(c, index, { registry: FIXTURE_FEATURE_EFFECTS });
const item = (id: string) => ({ kind: 'item', id }) as const;

function row(id: string, equipped?: InventoryItem['equipped'], extra: Partial<InventoryItem> = {}) {
  return { itemRef: item(id), name: id.split('|')[0], ...(equipped ? { equipped } : {}), ...extra };
}

function summary(a: DerivedAttack) {
  return {
    name: a.name,
    ready: a.ready,
    ability: a.ability,
    toHit: a.toHit?.bonus.value,
    damage: [a.damageDice, a.damageBonus.value || ''].filter(Boolean).join(' + '),
  };
}

/** Brute 5 with STR 18 (mod +4), DEX 13; masteries: Net Blade and Shiv. */
function brute(inventory: Partial<InventoryItem>[], extra: TestChoice[] = []): Character {
  return testCharacter({
    classes: [{ classId: 'brute|tst', levels: 5 }],
    scores: { str: 18, dex: 13, con: 14, int: 8, wis: 10, cha: 10 },
    choices: [
      {
        owner: { kind: 'classFeature', id: 'weapon mastery|brute|tst|1|tst' },
        slot: 'mastery',
        values: ['net blade|tst', 'shiv|tst'],
        valueKinds: ['item'],
      },
      ...extra,
    ],
    inventory,
  });
}

describe('attacks (P3, P4, mastery)', () => {
  it('weapons in hand first, then stowed ones, then the Unarmed Strike', () => {
    const d = run(
      brute([row('arc bow|tst'), row('net blade|tst', 'mainHand'), row('shiv|tst', 'offHand')]),
    );
    // A weapon in the off hand attacks like any other: the Net Blade isn't Light, so there is
    // no Light extra attack, and the Shiv keeps its ability modifier.
    expect(d.attacks.map(summary)).toEqual([
      { name: 'net blade', ready: true, ability: 'str', toHit: 7, damage: '1d8 + 4' },
      { name: 'shiv', ready: true, ability: 'str', toHit: 7, damage: '1d4 + 4' },
      { name: 'arc bow', ready: false, ability: 'dex', toHit: 4, damage: '1d6 + 1' },
      { name: 'Unarmed Strike', ready: true, ability: 'str', toHit: 7, damage: '5' },
    ]);
    expect(d.attacks.map((a) => a.use.kind)).toEqual([
      'attackAction',
      'attackAction',
      'attackAction',
      'attackAction',
    ]);
    const [blade, shiv, bow] = d.attacks;
    // Both hands are full, so the Net Blade can't be swung two-handed.
    expect(blade?.versatileDice).toBeUndefined();
    expect(blade).toMatchObject({
      proficient: true,
      damageType: 'slashing',
      distance: '5 ft.',
      mastery: { name: 'Snare' },
      notes: ['Versatile', 'Finesse'],
      critRange: 20,
    });
    expect(shiv?.distance).toBe('5 ft. or 20/60 ft.');
    expect(shiv?.propertyIds).toEqual([
      'itemProperty/f|tst',
      'itemProperty/l|tst',
      'itemProperty/t|tst',
    ]);
    expect(bow).toMatchObject({ range: 'ranged', distance: '60/240 ft.' });
    expect(bow?.mastery).toBeUndefined();
    expect(d.attacksPerAction).toMatchObject({ value: 2, parts: [{ label: 'Extra Attack' }] });
    expect(d.masteries.map((m) => m.value)).toEqual(['net blade|tst', 'shiv|tst']);
  });

  it('a versatile weapon in both hands uses its larger die', () => {
    const d = run(brute([row('net blade|tst', 'bothHands')]));
    expect(d.attacks[0]?.damageDice).toBe('1d10');
    expect(d.attacks[0]?.versatileDice).toBeUndefined();
  });

  it('an active toggle adds damage to matching attacks only', () => {
    const c = brute([row('net blade|tst', 'mainHand'), row('arc bow|tst')]);
    c.state.activeToggles.fury = {};
    const d = run(c);
    expect(d.attacks.map(summary).map((a) => a.damage)).toEqual(['1d8 + 5', '1d6 + 1', '6']);
    expect(d.attacks[0]?.damageBonus.parts.map((p) => p.label)).toEqual(['STR modifier', 'Fury']);
  });

  it('magic variants add to hit and damage', () => {
    const d = run(
      brute([
        row('net blade|tst', 'mainHand', {
          variantRef: item('+1 arena weapon|tst'),
          name: '+1 Net Blade',
        }),
      ]),
    );
    expect(summary(d.attacks[0]!)).toMatchObject({ toHit: 8, damage: '1d8 + 5' });
    expect(d.attacks[0]?.toHit?.bonus.parts.map((p) => p.label)).toEqual([
      'STR modifier',
      '+1 Arena Weapon',
      'Proficiency',
    ]);
  });

  it('Martial Arts: Dexterity and the larger die for unarmed strikes and Monk weapons', () => {
    const c = testCharacter({
      classes: [{ classId: 'wanderer|tst', levels: 7 }],
      scores: { str: 10, dex: 16, con: 12, int: 10, wis: 14, cha: 8 },
      inventory: [row('walking staff|tst', 'bothHands'), row('net blade|tst')],
    });
    const d = run(c);
    expect(d.attacks.map(summary)).toEqual([
      { name: 'walking staff', ready: true, ability: 'dex', toHit: 6, damage: '1d8 + 3' },
      { name: 'net blade', ready: false, ability: 'dex', toHit: 3, damage: '1d8 + 3' },
      { name: 'Unarmed Strike', ready: true, ability: 'dex', toHit: 6, damage: '1d6 + 3' },
    ]);
    expect(d.attacks[2]?.notes).toEqual(['Martial Arts die']);
    expect(d.attacks[1]?.proficient).toBe(false);

    // Not while wearing armor.
    c.inventory.push({
      uid: 'v',
      name: 'Vest',
      quantity: 1,
      attuned: false,
      itemRef: item('padded vest|tst'),
      equipped: 'armor',
    });
    expect(summary(run(c).attacks[2]!)).toMatchObject({ ability: 'str', damage: '1' });
  });

  it('a toggled ability (Pact Blade) and an opt-in rider (Hex Strike)', () => {
    const c = testCharacter({
      classes: [{ classId: 'pactbinder|tst', levels: 2 }],
      scores: { str: 8, dex: 12, con: 12, int: 10, wis: 10, cha: 16 },
      inventory: [row('shiv|tst', 'mainHand')],
    });
    expect(summary(run(c).attacks[0]!)).toMatchObject({ ability: 'dex', toHit: 3 });
    c.state.activeToggles['pact-blade'] = {};
    const d = run(c);
    expect(summary(d.attacks[0]!)).toMatchObject({ ability: 'cha', toHit: 5, damage: '1d4 + 3' });
    expect(d.attacks[0]?.riders).toEqual([
      {
        id: 'hex-strike',
        name: 'Hex Strike',
        dice: '1d6',
        damageType: 'necrotic',
        oncePerTurn: true,
        optIn: true,
      },
    ]);
    // Hex Strike is for weapons only.
    expect(d.attacks.at(-1)?.riders).toEqual([]);
  });

  it('attack roll targets', () => {
    const shiv = weaponTraits(index.get(item('shiv|tst'))!, 'off');
    expect(targetMatches('attack:all', { type: 'attack', traits: shiv })).toBe(true);
    expect(targetMatches('attack:melee', { type: 'attack', traits: shiv })).toBe(true);
    expect(targetMatches('attack:offHand', { type: 'attack', traits: shiv })).toBe(true);
    expect(targetMatches('attack:ranged', { type: 'attack', traits: shiv })).toBe(false);
    expect(targetMatches('attack:unarmed', { type: 'attack', traits: UNARMED_TRAITS })).toBe(true);
    expect(targetMatches('save:all', { type: 'attack', traits: shiv })).toBe(false);
  });
});

describe('how attacks are made (2024 rules)', () => {
  it('the Light extra attack: a different Light weapon, no ability modifier to damage', () => {
    const d = run(brute([row('shiv|tst', 'mainHand'), row('shiv|tst', 'offHand')]));
    expect(d.attacks.map((a) => [a.id.replace(/^item:[^:]+/, 'item'), a.use])).toEqual([
      ['item', { kind: 'attackAction' }],
      ['item', { kind: 'attackAction' }],
      ['item:light', { kind: 'lightExtra', nick: false }],
      ['unarmed', { kind: 'attackAction' }],
    ]);
    const extra = d.attacks[2]!;
    expect(summary(extra)).toMatchObject({ toHit: 7, damage: '1d4' });
    expect(extra.damageBonus.parts).toEqual([]);
    // The Attack action can't make the extra attack; the Bonus Action does.
    const attack = d.actions.find((a) => a.name === 'Attack')!;
    expect(attack.attackIds).not.toContain(extra.id);
  });

  it('no Light extra attack without a second Light weapon in hand', () => {
    const d = run(brute([row('shiv|tst', 'offHand'), row('shiv|tst')]));
    expect(d.attacks.some((a) => a.use.kind === 'lightExtra')).toBe(false);
  });

  it('Nick: the extra attack is part of the Attack action', async () => {
    const { entities } = await fixtureContent();
    const all = Object.values(entities).flat() as ContentEntity[];
    const shiv = all.find((e) => e.kind === 'item' && e.id === 'shiv|tst') as Item;
    const quickcut = all.find((e) => e.kind === 'rule' && e.name === 'Quickcut') as Rule;
    const nickRule: Rule = { ...quickcut, id: 'mastery/nick|tst', name: 'Nick' };
    const nickShiv: Item = {
      ...shiv,
      id: 'nick shiv|tst',
      name: 'Nick Shiv',
      weapon: { ...shiv.weapon!, masteryId: nickRule.id },
    };
    const nickIndex = createContentIndex([...all, nickRule, nickShiv]);
    const c = testCharacter({
      classes: [{ classId: 'brute|tst', levels: 5 }],
      scores: { str: 18, dex: 13, con: 14, int: 8, wis: 10, cha: 10 },
      choices: [
        {
          owner: { kind: 'classFeature', id: 'weapon mastery|brute|tst|1|tst' },
          slot: 'mastery',
          values: ['nick shiv|tst', 'shiv|tst'],
          valueKinds: ['item'],
        },
      ],
      inventory: [row('shiv|tst', 'mainHand'), row('nick shiv|tst', 'offHand')],
    });
    const d = derive(c, nickIndex, { registry: FIXTURE_FEATURE_EFFECTS });
    const extra = d.attacks.find((a) => a.use.kind === 'lightExtra')!;
    expect(extra).toMatchObject({ name: 'nick shiv', use: { kind: 'lightExtra', nick: true } });
    expect(d.actions.find((a) => a.name === 'Attack')!.attackIds).toContain(extra.id);
  });

  it('Versatile: two hands only for a melee attack with a hand free', () => {
    const free = run(brute([row('net blade|tst', 'mainHand')]));
    expect(free.attacks[0]?.versatileDice).toBe('1d10');
    // A shield takes the other hand, whether the weapon is in hand or stowed.
    const shielded = run(brute([row('net blade|tst', 'mainHand'), row('buckler|tst', 'shield')]));
    expect(shielded.attacks[0]?.versatileDice).toBeUndefined();
    const stowed = run(brute([row('net blade|tst'), row('buckler|tst', 'shield')]));
    expect(stowed.attacks[0]?.versatileDice).toBeUndefined();
    expect(run(brute([row('net blade|tst')])).attacks[0]?.versatileDice).toBe('1d10');
  });

  it('Unarmed Strike: Grapple and Shove DC, and whether a hand is free to grapple', () => {
    const empty = run(brute([]));
    const strike = empty.attacks.find((a) => a.id === 'unarmed')!;
    expect(strike.grapple?.dc).toMatchObject({ value: 15 });
    expect(strike.grapple?.freeHand).toBe(true);
    const full = run(brute([row('arc bow|tst', 'bothHands')]));
    expect(full.attacks.find((a) => a.id === 'unarmed')!.grapple?.freeHand).toBe(false);
  });

  it('Opportunity Attack: melee attacks in hand and the Unarmed Strike', () => {
    const d = run(brute([row('net blade|tst', 'mainHand'), row('shiv|tst'), row('arc bow|tst')]));
    const oa = d.actions.find((a) => a.name === 'Opportunity Attack')!;
    expect(oa).toMatchObject({ actionType: 'reaction', standard: true });
    expect(oa.attackIds.map((id) => d.attacks.find((a) => a.id === id)!.name)).toEqual([
      'net blade',
      'Unarmed Strike',
    ]);
  });
});

describe('Two-Handed weapons', () => {
  it('held in one hand, ready only while the other hand is free', () => {
    const bow = (d: DerivedSheet) => d.attacks.find((a) => a.name === 'arc bow')?.ready;
    expect(bow(run(brute([row('arc bow|tst', 'bothHands')])))).toBe(true);
    expect(bow(run(brute([row('arc bow|tst', 'mainHand')])))).toBe(true);
    expect(bow(run(brute([row('arc bow|tst', 'mainHand'), row('buckler|tst', 'shield')])))).toBe(
      false,
    );
  });
});

describe('Ammunition (2024)', () => {
  const ammoOf = (d: DerivedSheet, name: string) => d.attacks.find((a) => a.name === name)?.ammo;

  it('what the weapon can fire: loose pieces, magic ones with their bonus, then bundles', () => {
    const d = run(
      brute([
        row('arc bow|tst', 'bothHands'),
        row('arrows (20)|tst', undefined, { uid: 'bundle', name: 'Arrows (20)' }),
        row('arrow|tst', undefined, { uid: 'loose', name: 'Arrow', quantity: 5 }),
        row('arrow|tst', undefined, {
          uid: 'magic',
          name: '+1 Arrow',
          quantity: 3,
          variantRef: item('+1 arena ammunition|tst'),
        }),
        row('arrow|tst', undefined, { uid: 'none', name: 'Arrow', quantity: 0 }),
      ]),
    );
    expect(ammoOf(d, 'arc bow')).toEqual({
      itemId: 'arrow|tst',
      name: 'Arrow',
      sources: [
        { rowUid: 'loose', name: 'Arrow', count: 5, bundle: false, hitBonus: 0, damageBonus: 0 },
        { rowUid: 'magic', name: '+1 Arrow', count: 3, bundle: false, hitBonus: 1, damageBonus: 1 },
        {
          rowUid: 'bundle',
          name: 'Arrows (20)',
          count: 20,
          bundle: true,
          hitBonus: 0,
          damageBonus: 0,
        },
      ],
      total: 28,
      used: [],
      noHandToLoad: false,
    });
    // Weapons without the Ammunition property have none.
    expect(d.attacks.find((a) => a.name === 'Unarmed Strike')?.ammo).toBeUndefined();
  });

  it('none to fire, and a one-handed weapon with no hand free to load it', () => {
    expect(ammoOf(run(brute([row('arc bow|tst', 'bothHands')])), 'arc bow')).toMatchObject({
      total: 0,
      sources: [],
    });
    const free = run(brute([row('wrist bow|tst', 'mainHand')]));
    expect(ammoOf(free, 'wrist bow')?.noHandToLoad).toBe(false);
    const shield = run(brute([row('wrist bow|tst', 'mainHand'), row('buckler|tst', 'shield')]));
    expect(ammoOf(shield, 'wrist bow')?.noHandToLoad).toBe(true);
    expect(shield.attacks.find((a) => a.name === 'wrist bow')?.notes).toContain('Loading');
  });
});
