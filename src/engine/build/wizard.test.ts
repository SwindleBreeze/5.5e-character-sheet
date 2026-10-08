import { beforeAll, describe, expect, it } from 'vitest';
import type { Character, ContentEntity, EquipmentOption } from '../../schema/index.ts';
import { fixtureContent } from '../../test/fixtureIndex.ts';
import { FIXTURE_FEATURE_EFFECTS } from '../../test/fixtureFeatureEffects.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import { derive } from '../derive/derive.ts';
import { setPick } from '../play/features.ts';
import { applyEquipment, STANDARD_ARRAY } from './build.ts';
import { createCatalog, type Catalog } from './catalog.ts';
import {
  anyItemKey,
  equipmentOptionText,
  equipmentTypeItems,
  grantPool,
  syncStartingEquipment,
  unpickedAnyItems,
} from './equipment.ts';
import {
  assignFromSet,
  dropLowest,
  pointBuyCost,
  primaryText,
  rollScores,
  startingScores,
  usesSet,
} from './scores.ts';
import {
  changeDraft,
  chooseBackground,
  chooseClass,
  chooseSpecies,
  finishDraft,
  newDraft,
  wizardSteps,
} from './wizard.ts';

let index: ContentIndex;
let catalog: Catalog;
beforeAll(async () => {
  const content = await fixtureContent();
  index = content.index;
  catalog = createCatalog(
    Object.values(content.entities).flat() as ContentEntity[],
    new Set(['TST']),
  );
});

const registry = FIXTURE_FEATURE_EFFECTS;
const brute = { kind: 'class', id: 'brute|tst' } as const;
const lorekeeper = { kind: 'class', id: 'lorekeeper|tst' } as const;
const arenaHand = { kind: 'background', id: 'arena hand|tst' } as const;
const mossling = { kind: 'species', id: 'mossling|tst' } as const;

describe('ability scores (2024 Generate Your Scores)', () => {
  it('point buy: 8 is free, 15 costs 9, 27 points in all', () => {
    const eights = startingScores('pointBuy', []);
    expect(pointBuyCost(eights)).toBe(0);
    expect(pointBuyCost({ ...eights, str: 15, dex: 15, con: 15 })).toBe(27);
    expect(pointBuyCost({ ...eights, str: 13, dex: 14 })).toBe(12);
    expect(pointBuyCost({ ...eights, str: 16 })).toBe(Infinity);
  });

  it('the standard array, primary abilities first, assigned by swapping', () => {
    const scores = startingScores('standard', ['dex', 'wis']);
    expect(scores).toEqual({ dex: 15, wis: 14, con: 13, str: 12, int: 10, cha: 8 });
    expect(usesSet(scores, STANDARD_ARRAY)).toBe(true);
    // Giving Charisma the 15 gives Dexterity the 8.
    const swapped = assignFromSet(scores, 'cha', 15);
    expect(swapped).toMatchObject({ cha: 15, dex: 8 });
    expect(usesSet(swapped, STANDARD_ARRAY)).toBe(true);
  });

  it('4d6 drop the lowest, six times; rolled scores placed like the array', () => {
    let n = 0;
    const dice = [6, 5, 1, 3]; // → 14
    const random = () => (dice[n++ % 4]! - 1) / 6;
    const rolls = rollScores(random);
    expect(rolls).toHaveLength(6);
    expect(rolls[0]).toEqual([6, 5, 1, 3]);
    expect(dropLowest([6, 5, 1, 3])).toBe(14);
    expect(startingScores('rolled', ['int'], [10, 18, 9, 12, 14, 7])).toMatchObject({
      int: 18,
      con: 14,
      dex: 12,
    });
    expect(primaryText({ primaryAbility: [['str'], ['dex']] })).toBe('Strength or Dexterity');
    expect(primaryText({ primaryAbility: [['dex', 'wis']] })).toBe('Dexterity and Wisdom');
  });
});

describe('starting equipment', () => {
  const anyWeapon: EquipmentOption = {
    key: 'A',
    items: [
      { special: 'Any weaponSimple', quantity: 1 },
      { itemId: 'torch|tst', quantity: 2 },
    ],
    valueCp: 1534,
  };

  it('"any …" entries: in words, the items they can be, and the item picked', () => {
    expect(equipmentOptionText(anyWeapon, index)).toBe('Any simple weapon, 2 × Torch, 1534 CP');
    expect(equipmentTypeItems(catalog, 'weaponSimple').map((i) => i.id)).toEqual([
      'shiv|tst',
      'walking staff|tst',
    ]);
    const picked = applyEquipment(newDraft(0), anyWeapon, index, 0, { picks: { 0: 'shiv|tst' } });
    expect(picked.inventory.map((r) => [r.name, r.itemRef?.id, r.equipped])).toEqual([
      ['Shiv', 'shiv|tst', 'mainHand'],
      ['Torch', 'torch|tst', undefined],
    ]);
    expect(picked.currency).toMatchObject({ gp: 15, sp: 3, cp: 4 });
    // Not picked yet: a row named by its kind.
    expect(applyEquipment(newDraft(0), anyWeapon, index, 0).inventory[0]?.name).toBe(
      'Any simple weapon',
    );
  });

  it('an item group is one item of the group, picked (a Druidic Focus: which one)', () => {
    const focus = { itemId: 'lantern focus|tst', quantity: 1 };
    expect(grantPool(focus, catalog, index)).toEqual({
      label: 'Lantern Focus',
      items: [expect.objectContaining({ id: 'torch|tst' }), expect.anything()],
    });
    expect(grantPool({ itemId: 'torch|tst', quantity: 1 }, catalog, index)).toBeUndefined();
    const option = { key: 'A', items: [focus], valueCp: 0 };
    const picked = applyEquipment(newDraft(0), option, index, 0, { picks: { 0: 'torch|tst' } });
    expect(picked.inventory.map((r) => [r.name, r.itemRef?.id])).toEqual([['Torch', 'torch|tst']]);
  });

  it('a draft’s inventory and coins follow its picks, made again each time', () => {
    let c = chooseBackground(chooseClass(newDraft(0), brute), arenaHand);
    const pick = (owner: typeof brute | typeof arenaHand, key: string) =>
      (c = syncStartingEquipment(
        setPick(
          c,
          { owner, slot: 'equipment' },
          {
            values: [key],
            labels: [key],
            entryIndex: 0,
            via: 'creation',
          },
        ),
        index,
      ));
    pick(brute, 'A');
    pick(arenaHand, 'A');
    expect(c.inventory.map((r) => [r.name, r.quantity, r.equipped ?? '-'])).toEqual([
      ['Net Blade', 1, 'mainHand'],
      ['Shiv', 2, '-'],
      ['Torch', 2, '-'],
    ]);
    expect(c.currency).toMatchObject({ gp: 18, sp: 0, cp: 0 });
    // Gold instead: the class's items go, the purse is the options' coins.
    pick(brute, 'B');
    expect(c.inventory.map((r) => r.name)).toEqual(['Torch']);
    expect(c.currency.gp).toBe(70);
    // Rows the player added are kept.
    c = syncStartingEquipment(
      {
        ...c,
        inventory: [
          ...c.inventory,
          { uid: 'mine', name: 'Lucky coin', quantity: 1, attuned: false },
        ],
      },
      index,
    );
    expect(c.inventory.map((r) => r.name)).toEqual(['Lucky coin', 'Torch']);
  });

  it('lists "any …" entries still without an item', () => {
    const c = chooseClass(newDraft(0), brute);
    expect(unpickedAnyItems(c, index)).toEqual([]);
    expect(anyItemKey(brute, 'A', 0)).toBe('class:brute|tst#A#0');
  });
});

describe('the wizard’s draft', () => {
  it('a new draft is on the first step with the standard array, which follows the class', () => {
    const d = newDraft(0);
    expect(d.draft).toEqual({ step: 'class' });
    expect(d.log).toEqual([]);
    const c = chooseClass(d, lorekeeper, index);
    expect(c.log).toEqual([
      { charLevel: 1, classRef: lorekeeper, classLevel: 1, hp: { mode: 'max' }, choices: [] },
    ]);
    expect(c.baseScores.int).toBe(15);
    expect(chooseClass(c, brute, index).baseScores.str).toBe(15);
    // Once the player moves a score, a new class leaves them be.
    const moved = { ...c, baseScores: assignFromSet(c.baseScores, 'cha', 15) };
    expect(chooseClass(moved, brute, index).baseScores).toEqual(moved.baseScores);
  });

  it('background and species can come in either order', () => {
    const c = chooseSpecies(chooseClass(newDraft(0), brute), mossling);
    expect(c.log[0]?.origin).toEqual({ speciesRef: mossling });
    expect(chooseBackground(c, arenaHand).log[0]?.origin).toEqual({
      speciesRef: mossling,
      backgroundRef: arenaHand,
    });
    expect(derive(c, index, { registry }).features.map((f) => f.name)).toContain('Mossling');
  });

  it('a change sets aside the picks it no longer offers, and switching back restores them', () => {
    let c = chooseBackground(chooseClass(newDraft(0), brute), arenaHand);
    c = setPick(
      c,
      { owner: brute, slot: 'skills' },
      {
        values: ['athletics', 'intimidation'],
        labels: ['Athletics', 'Intimidation'],
        entryIndex: 0,
      },
    );
    c = setPick(
      c,
      { owner: arenaHand, slot: 'ability' },
      {
        values: ['str', 'str', 'con'],
        labels: [],
        entryIndex: 0,
      },
    );
    const change = (x: Character, f: (x: Character) => Character) =>
      changeDraft(x, f, index, registry);
    const lore = change(c, (x) => chooseClass(x, lorekeeper));
    // The Brute's skills go aside; the background's increases stay.
    expect(lore.log[0]?.choices.map((r) => r.key.owner.id)).toEqual(['arena hand|tst']);
    expect(lore.draft?.setAside?.map((r) => `${r.key.owner.id}#${r.key.slot}`)).toEqual([
      'brute|tst#skills',
    ]);
    // Back to the Brute: its skills come back, as they were.
    const back = change(lore, (x) => chooseClass(x, brute));
    expect(
      back.log[0]?.choices.find((r) => r.key.owner.id === 'brute|tst' && r.key.slot === 'skills')
        ?.values,
    ).toEqual(['athletics', 'intimidation']);
    expect(back.draft?.setAside).toEqual([]);
    // A pick made anew meanwhile wins over the one set aside.
    const anew = setPick(
      lore,
      { owner: brute, slot: 'skills' },
      { values: ['survival'], labels: ['Survival'], entryIndex: 0 },
    );
    expect(
      change(anew, (x) => chooseClass(x, brute)).log[0]?.choices.filter(
        (r) => r.key.owner.id === 'brute|tst' && r.key.slot === 'skills',
      ),
    ).toHaveLength(1);
    // Nothing to set aside: the draft is only changed.
    expect(change(c, (x) => chooseSpecies(x, mossling)).draft?.setAside).toBeUndefined();
  });

  it('the spells step shows only when something gives spells', () => {
    const steps = (c: ReturnType<typeof newDraft>) =>
      wizardSteps(c.log.length ? derive(c, index, { registry }) : undefined);
    expect(steps(newDraft(0))).not.toContain('spells');
    expect(steps(chooseClass(newDraft(0), brute))).not.toContain('spells');
    expect(steps(chooseClass(newDraft(0), lorekeeper))).toContain('spells');
  });

  it('finishing: the draft mark goes and snapshots are stored', () => {
    const c = chooseSpecies(chooseBackground(chooseClass(newDraft(0), brute), arenaHand), mossling);
    const done = finishDraft({ ...c, name: ' ' }, index, registry, 5);
    expect(done.draft).toBeUndefined();
    expect(done.name).toBe('New character');
    expect(Object.keys(done.snapshots)).toEqual(
      expect.arrayContaining([
        'class:brute|tst',
        'species:mossling|tst',
        'background:arena hand|tst',
      ]),
    );
  });

  it('a background’s increases must fit its +2/+1 or +1/+1/+1', () => {
    const c = setPick(
      chooseBackground(chooseClass(newDraft(0), brute), arenaHand),
      {
        owner: arenaHand,
        slot: 'ability',
      },
      { values: ['str', 'str', 'str'], labels: [], entryIndex: 0 },
    );
    expect(derive(c, index, { registry }).issues.map((i) => i.code)).toContain('backgroundAbility');
    const ok = setPick(
      c,
      { owner: arenaHand, slot: 'ability' },
      {
        values: ['str', 'con', 'cha'],
        labels: [],
        entryIndex: 0,
      },
    );
    expect(derive(ok, index, { registry }).issues.map((i) => i.code)).not.toContain(
      'backgroundAbility',
    );
  });
});
