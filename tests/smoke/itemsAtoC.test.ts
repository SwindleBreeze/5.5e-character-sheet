// Golden checks for the 2024 Dungeon Master's Guide magic items +1… to C (plan §10.3, step 7.12)
// on real data: a level 5 human wizard or fighter with the item in use (worn or held, attuned),
// its numbers read the way the item's text gives them. Opt-in:
//   FIVETOOLS_DATA=./5etools-src npx vitest run --config vitest.smoke.config.ts tests/smoke/itemsAtoC.test.ts
// Checks numbers only; it never prints or stores content.

import { beforeAll, describe, expect, it } from 'vitest';
import { importFivetools } from '../../src/adapters/fivetools/index.ts';
import { createCatalog, type Catalog } from '../../src/engine/build/catalog.ts';
import { quickBuild } from '../../src/engine/build/quickBuild.ts';
import { createContentIndex, type ContentIndex } from '../../src/engine/content/contentIndex.ts';
import { derive } from '../../src/engine/derive/derive.ts';
import type { DerivedSheet } from '../../src/engine/derive/types.ts';
import { featureEffects } from '../../src/engine/featureEffects/index.ts';
import { equipSlots } from '../../src/engine/items/items.ts';
import { toggle } from '../../src/engine/play/reducers.ts';
import type { Character, ContentEntity } from '../../src/schema/index.ts';
import { nodeFileSource } from './nodeFileSource.ts';

const root = process.env.FIVETOOLS_DATA;

describe.skipIf(!root)('magic items +1… to C golden checks (local data)', () => {
  let index: ContentIndex;
  let catalog: Catalog;

  beforeAll(async () => {
    const result = await importFivetools(nodeFileSource(root!), { now: 1 });
    const all = Object.values(result.entities).flat() as ContentEntity[];
    index = createContentIndex(all);
    catalog = createCatalog(all, new Set(['XPHB', 'XDMG']));
  });

  type ClassId = 'wizard|xphb' | 'fighter|xphb';

  /** A level 5 human sage of the class, with these items in use and these toggles on. */
  function build(classId: ClassId, items: string[] = [], toggles: string[] = []): DerivedSheet {
    const registry = featureEffects();
    let c: Character = quickBuild(
      {
        name: 'Golden',
        speciesId: 'human|xphb',
        backgroundId: 'sage|xphb',
        classes: [{ classId, levels: 5 }],
      },
      { index, catalog, registry, now: 1 },
    );
    items.forEach((id, n) => {
      const item = index.get({ kind: 'item', id });
      expect(item, id).toBeDefined();
      const slots = equipSlots(item);
      const slot = slots.includes('worn') && !item!.weapon ? 'worn' : slots[0]!;
      // Make room: one suit of armor, one Shield, and the hands for a weapon.
      for (const r of c.inventory) {
        if (slot === 'armor' || slot === 'shield') {
          if (r.equipped === slot) delete r.equipped;
        } else if (slot !== 'worn' && r.equipped && r.equipped !== 'armor' && r.equipped !== 'worn')
          delete r.equipped;
      }
      c.inventory.push({
        uid: `golden-${n}`,
        itemRef: { kind: 'item', id },
        name: item!.name,
        quantity: 1,
        attuned: true,
        equipped: slot,
      });
    });
    let s = derive(c, index, { registry });
    for (const t of toggles) {
      c = toggle(c, s, t, true, { free: true });
      s = derive(c, index, { registry });
    }
    return s;
  }
  const resource = (s: DerivedSheet, name: string) => s.resources.find((r) => r.name === name);
  const act = (s: DerivedSheet, name: string) => s.actions.find((a) => a.name === name);
  const attack = (s: DerivedSheet, name: string) => s.attacks.find((a) => a.name === name);
  const values = (list: { value: string }[]) => list.map((v) => v.value).sort();

  it('+N items: Wraps of Unarmed Power on Unarmed Strikes, the Rod of the Pact Keeper’s slot', () => {
    const plain = attack(build('fighter|xphb'), 'Unarmed Strike')!;
    const wrapped = attack(
      build('fighter|xphb', ['+2 wraps of unarmed power|xdmg']),
      'Unarmed Strike',
    )!;
    expect(wrapped.toHit!.bonus.value - plain.toHit!.bonus.value).toBe(2);
    expect(wrapped.damageBonus.value - plain.damageBonus.value).toBe(2);

    const rod = build('wizard|xphb', ['+1 rod of the pact keeper|xdmg']);
    expect(resource(rod, 'Rod of the Pact Keeper')).toMatchObject({ recharge: 'long' });
    expect(resource(rod, 'Rod of the Pact Keeper')?.max.value).toBe(1);
    expect(act(rod, 'Rod of the Pact Keeper: Regain a Slot')?.outcomes).toEqual([
      expect.objectContaining({ regainSlot: expect.anything() }),
    ]);
  });

  it('Armor of Invulnerability: resistances, and immunities with Metal Shell on', () => {
    const worn = build('fighter|xphb', ['armor of invulnerability|xdmg']);
    expect(values(worn.defenses.resistances)).toEqual(
      expect.arrayContaining(['bludgeoning', 'piercing', 'slashing']),
    );
    expect(values(worn.defenses.immunities)).toEqual([]);
    expect(resource(worn, 'Metal Shell')).toMatchObject({ recharge: 'dawn' });
    const shell = build(
      'fighter|xphb',
      ['armor of invulnerability|xdmg'],
      ['armor-of-invulnerability'],
    );
    expect(values(shell.defenses.immunities)).toEqual(['bludgeoning', 'piercing', 'slashing']);
  });

  it('Axe of the Dwarvish Lords: Darkvision, Constitution, the thrown rider, the elemental', () => {
    const base = build('fighter|xphb');
    const axe = build('fighter|xphb', ['axe of the dwarvish lords|xdmg']);
    expect(axe.senses.map((x) => x.value)).toContainEqual({ sense: 'darkvision', range: 60 });
    expect(axe.abilities.con.score.value).toBe(Math.min(20, base.abilities.con.score.value + 2));
    const rider = attack(axe, 'Axe of the Dwarvish Lords')?.riders.find(
      (r) => r.name === 'Ranged hit',
    );
    expect(rider?.dice).toBe('1d8');
    expect(resource(axe, 'Conjure Earth Elemental')).toMatchObject({ recharge: 'dawn' });
  });

  it('Belt of Dwarvenkind and Berserker Axe: Constitution, Darkvision, Hit Points', () => {
    const base = build('wizard|xphb');
    const belt = build('wizard|xphb', ['belt of dwarvenkind|xdmg']);
    expect(belt.abilities.con.score.value).toBe(Math.min(20, base.abilities.con.score.value + 2));
    expect(belt.senses.map((x) => x.value)).toContainEqual({ sense: 'darkvision', range: 60 });
    expect(values(belt.defenses.resistances)).toContain('poison');

    const berserker = build('wizard|xphb', ['berserker axe|xdmg']);
    expect(berserker.hp.max.value - base.hp.max.value).toBe(5);
  });

  it('Blackrazor and the Book of Vile Darkness: condition immunities, Blindsight, Vile Speech', () => {
    const sword = build('fighter|xphb', ['blackrazor|xdmg']);
    expect(values(sword.defenses.conditionImmunities)).toEqual(['charmed', 'frightened']);
    expect(sword.senses.map((x) => x.value)).toContainEqual({ sense: 'blindsight', range: 30 });

    const book = build('wizard|xphb', ['book of vile darkness|xdmg']);
    expect(values(book.defenses.conditionImmunities)).toEqual(['exhaustion']);
    expect(act(book, 'Vile Speech')?.roll).toBe('3d6');
  });

  it('Stealth: Boots and Cloak of Elvenkind, Cloak of the Bat give Advantage', () => {
    expect(build('wizard|xphb').skills.stealth.mode).toBe('normal');
    for (const id of [
      'boots of elvenkind|xdmg',
      'cloak of elvenkind|xdmg',
      'cloak of the bat|xdmg',
    ]) {
      expect(build('wizard|xphb', [id]).skills.stealth.mode, id).toBe('advantage');
    }
  });

  it('speeds: Cloak of the Manta Ray, Cloak of Arachnida, Broom of Flying, Cloak of the Bat', () => {
    expect(build('wizard|xphb', ['cloak of the manta ray|xdmg']).speed.swim?.value).toBe(60);
    const spider = build('wizard|xphb', ['cloak of arachnida|xdmg']);
    expect(spider.speed.climb?.value).toBe(spider.speed.walk?.value);
    expect(build('wizard|xphb', ['broom of flying|xdmg']).speed.fly).toBeUndefined();
    expect(
      build('wizard|xphb', ['broom of flying|xdmg'], ['broom-of-flying']).speed.fly?.value,
    ).toBe(50);
    expect(
      build('wizard|xphb', ['cloak of the bat|xdmg'], ['cloak-of-the-bat']).speed.fly?.value,
    ).toBe(40);
  });

  it('Bracers of Archery: bow proficiency and +2 damage with a Longbow', () => {
    const bow = attack(build('wizard|xphb', ['longbow|xphb']), 'Longbow')!;
    const bracers = attack(
      build('wizard|xphb', ['longbow|xphb', 'bracers of archery|xdmg']),
      'Longbow',
    )!;
    expect(bow.proficient).toBe(false);
    expect(bracers.proficient).toBe(true);
    expect(bracers.damageBonus.value - bow.damageBonus.value).toBe(2);
  });

  it('charges and daily uses: Cloak of Invisibility, Cubic Gate, Bag of Tricks, Dragon Scale Mail', () => {
    const cloak = build('wizard|xphb', ['cloak of invisibility|xdmg']);
    expect(act(cloak, 'Cloak of Invisibility')?.costs.map((c) => c.label)).toEqual(['1 charge']);

    const gate = build('wizard|xphb', ['cubic gate|xdmg']);
    const granted = gate.spellcasting.granted.filter((g) => g.source.kind === 'item');
    expect(granted.map((g) => g.spellId).sort()).toEqual(['gate|xphb', 'plane shift|xphb']);

    expect(
      resource(build('wizard|xphb', ['bag of tricks, gray|xdmg']), 'Bag of Tricks')?.max.value,
    ).toBe(3);
    const mail = build('fighter|xphb', ['black dragon scale mail|xdmg']);
    expect(resource(mail, 'Dragon Sense')).toMatchObject({ recharge: 'dawn' });
    expect(values(mail.defenses.resistances)).toContain('acid');
  });

  it('Chime of Opening: ten uses that pay for Knock', () => {
    const chime = build('wizard|xphb', ['chime of opening|xdmg']);
    expect(resource(chime, 'Chime of Opening')?.max.value).toBe(10);
    expect(chime.spellcasting.granted.map((g) => g.spellId)).toContain('knock|xphb');
  });
});
