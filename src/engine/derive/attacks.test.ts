import { beforeAll, describe, expect, it } from 'vitest';
import type { Character, InventoryItem } from '../../schema/index.ts';
import { testCharacter, type TestChoice } from '../../test/characters.ts';
import { fixtureIndex } from '../../test/fixtureIndex.ts';
import { FIXTURE_FEATURE_EFFECTS } from '../../test/fixtureFeatureEffects.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
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
  it('weapons in hand first, then carried ones, then the Unarmed Strike', () => {
    const d = run(
      brute([row('arc bow|tst'), row('net blade|tst', 'mainHand'), row('shiv|tst', 'offHand')]),
    );
    expect(d.attacks.map(summary)).toEqual([
      { name: 'net blade', ready: true, ability: 'str', toHit: 7, damage: '1d8 + 4' },
      { name: 'shiv', ready: true, ability: 'str', toHit: 7, damage: '1d4' },
      { name: 'arc bow', ready: false, ability: 'dex', toHit: 4, damage: '1d6 + 1' },
      { name: 'Unarmed Strike', ready: true, ability: 'str', toHit: 7, damage: '5' },
    ]);
    const [blade, shiv, bow] = d.attacks;
    expect(blade).toMatchObject({
      proficient: true,
      versatileDice: '1d10',
      damageType: 'slashing',
      distance: '5 ft.',
      mastery: { name: 'Snare' },
      notes: ['Versatile', 'Finesse'],
      critRange: 20,
    });
    // The Light off-hand attack adds no ability modifier to damage.
    expect(shiv?.damageBonus.parts).toEqual([]);
    expect(shiv?.distance).toBe('5 ft. or 20/60 ft.');
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
