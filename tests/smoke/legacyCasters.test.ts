// Golden checks for the 2014 Sorcerer, Warlock and Wizard subclasses on 2024 characters (plan
// step 8.3) on real data: each one quick-built at a level or two, with "Show 2014 content" on
// and every book switched on. Opt-in:
//   FIVETOOLS_DATA=./5etools-src npx vitest run --config vitest.smoke.config.ts tests/smoke/legacyCasters.test.ts
// Checks numbers and names only; it never prints or stores content.

import { beforeAll, describe, expect, it } from 'vitest';
import { importFivetools } from '../../src/adapters/fivetools/index.ts';
import { createCatalog, type Catalog } from '../../src/engine/build/catalog.ts';
import { quickBuild } from '../../src/engine/build/quickBuild.ts';
import { createContentIndex, type ContentIndex } from '../../src/engine/content/contentIndex.ts';
import { derive } from '../../src/engine/derive/derive.ts';
import type { DerivedSheet } from '../../src/engine/derive/types.ts';
import { featureEffects } from '../../src/engine/featureEffects/index.ts';
import { toggle } from '../../src/engine/play/reducers.ts';
import type { ContentEntity } from '../../src/schema/index.ts';
import { SHOW_2014 } from '../../src/sources/sourceFilter.ts';
import { nodeFileSource } from './nodeFileSource.ts';

const root = process.env.FIVETOOLS_DATA;

describe.skipIf(!root)('2014 Sorcerer, Warlock and Wizard subclasses (local data)', () => {
  let index: ContentIndex;
  let catalog: Catalog;

  beforeAll(async () => {
    const result = await importFivetools(nodeFileSource(root!), { now: 1 });
    const all = Object.values(result.entities).flat() as ContentEntity[];
    index = createContentIndex(all);
    const books = result.sources.filter((s) => s.origin !== 'homebrew').map((s) => s.code);
    catalog = createCatalog(all, new Set([...books, SHOW_2014]));
  });

  /** A human soldier of one class, quick-built, with these toggles (`id` or `id:option`) on. */
  function build(subId: string, levels: number, toggles: string[] = []) {
    const registry = featureEffects();
    const classId = `${subId.split('|')[1]}|xphb`;
    let c = quickBuild(
      {
        name: 'Golden',
        speciesId: 'human|xphb',
        backgroundId: 'soldier|xphb',
        classes: [{ classId, levels, subclassId: subId }],
      },
      { index, catalog, registry, now: 1 },
    );
    let s = derive(c, index, { registry });
    for (const t of toggles) {
      const [id, option] = t.split(':');
      c = toggle(c, s, id!, true, { free: true, ...(option ? { option } : {}) });
      s = derive(c, index, { registry });
    }
    expect(s.choices.pending).toEqual([]);
    expect(s.issues.filter((i) => i.severity !== 'info')).toEqual([]);
    return s;
  }
  const resource = (s: DerivedSheet, name: string) => s.resources.find((r) => r.name === name);
  const values = (list: { value: string }[]) => list.map((v) => v.value).sort();
  const action = (s: DerivedSheet, name: string) => s.actions.find((a) => a.name === name);
  const weapon = (s: DerivedSheet) => s.attacks.find((a) => a.kind === 'weapon')!;

  it('Sorcerer: Pyromancer', () => {
    const SUB = 'pyromancer (psk)|sorcerer|xphb|psk';
    expect(action(build(SUB, 3), 'Heart of Fire')?.roll).toBe('1');
    const six = build(SUB, 6);
    expect(values(six.defenses.resistances)).toEqual(['fire']);
    expect(action(six, 'Heart of Fire')?.roll).toBe('3');
    const eighteen = build(SUB, 18);
    expect(values(eighteen.defenses.immunities)).toContain('fire');
    expect(action(eighteen, "Pyromancer's Fury")?.roll).toBe('18');
  });

  it('Sorcerer: Divine Soul', () => {
    const SUB = 'divine soul|sorcerer|xphb|xge';
    const three = build(SUB, 3);
    expect(resource(three, 'Favored by the Gods')?.recharge).toBe('short');
    expect(action(three, 'Favored by the Gods')?.roll).toBe('2d4');
    expect(build(SUB, 14, ['otherworldly-wings']).speed.fly?.value).toBe(30);
    expect(resource(build(SUB, 18), 'Unearthly Recovery')?.max.value).toBe(1);
  });

  it('Sorcerer: Storm Sorcery', () => {
    const SUB = 'storm|sorcerer|xphb|xge';
    const three = build(SUB, 3);
    expect(values(three.proficiencies.languages)).toContain('primordial');
    expect(action(three, 'Tempestuous Magic')?.actionType).toBe('bonus');
    const six = build(SUB, 6);
    expect(values(six.defenses.resistances)).toEqual(['lightning', 'thunder']);
    expect(action(six, 'Heart of the Storm')?.roll).toBe('3');
    const eighteen = build(SUB, 18);
    expect(action(eighteen, "Storm's Fury")?.saveDc).toBe(
      eighteen.spellcasting.casters[0]!.dc.value,
    );
    expect(eighteen.speed.fly?.value).toBe(60);
    expect(values(eighteen.defenses.immunities)).toEqual(
      expect.arrayContaining(['lightning', 'thunder']),
    );
    expect(resource(eighteen, 'Wind Soul')?.recharge).toBe('short');
  });

  it('Sorcerer: Lunar Sorcery', () => {
    const SUB = 'lunar|sorcerer|xphb|dsotdq';
    const three = build(SUB, 3, ['lunar-phase:new-moon']);
    expect(resource(three, 'Lunar Embodiment')?.max.value).toBe(1);
    expect(three.spellcasting.casters[0]!.cantrips).toContain('sacred flame|xphb');
    const free = three.spellcasting.granted.filter((g) => g.source.id.startsWith('lunar'));
    expect(free.map((g) => g.spellId)).toEqual(['ray of sickness|phb']);
    const six = build(SUB, 6);
    expect(resource(six, 'Lunar Embodiment')?.max.value).toBe(3);
    expect(resource(six, 'Lunar Boons')?.max.value).toBe(3);
    const crescent = build(SUB, 14, ['lunar-phase:crescent-moon']);
    expect(values(crescent.defenses.resistances)).toEqual(['necrotic', 'radiant']);
    expect(build(SUB, 14, ['lunar-phase:new-moon']).skills.stealth.mode).toBe('advantage');
    const full = build(SUB, 18, ['lunar-phase:full-moon']);
    expect(action(full, 'Lunar Phenomenon (Full Moon)')?.roll).toBe('3d8');
    expect(action(full, 'Lunar Phenomenon (New Moon)')).toBeUndefined();
    expect(resource(full, 'Lunar Phenomenon (New Moon)')?.restoreWith).toHaveLength(1);
  });

  it('Warlock: The Undying', () => {
    const SUB = 'undying|warlock|xphb|scag';
    const three = build(SUB, 3);
    expect(action(three, 'Among the Dead')?.saveDc).toBe(three.spellcasting.casters[0]!.dc.value);
    expect(resource(build(SUB, 6), 'Defy Death')?.recharge).toBe('long');
    const fourteen = build(SUB, 14);
    expect(action(fourteen, 'Indestructible Life')?.outcomes[0]).toEqual({ heal: '1d8 + 14' });
  });

  it('Warlock: The Hexblade', () => {
    const SUB = 'hexblade|warlock|xphb|xge';
    const off = build(SUB, 3);
    const on = build(SUB, 3, ['hexblades-curse']);
    expect(values(off.proficiencies.armor)).toEqual(expect.arrayContaining(['medium', 'shield']));
    expect(values(off.proficiencies.weapons)).toContain('martial');
    expect(resource(off, "Hexblade's Curse")?.recharge).toBe('short');
    expect(weapon(off).critRange).toBe(20);
    expect(weapon(on).critRange).toBe(19);
    expect(weapon(on).damageBonus.value).toBe(weapon(off).damageBonus.value + 2);
    expect(action(build(SUB, 10), 'Armor of Hexes')).toBeUndefined();
    expect(action(build(SUB, 10, ['hexblades-curse']), 'Armor of Hexes')?.roll).toBe('1d6');
    expect(action(build(SUB, 6), 'Accursed Specter')?.roll).toBe('3');
  });

  it('Warlock: The Fathomless', () => {
    const SUB = 'fathomless|warlock|xphb|tce';
    const three = build(SUB, 3);
    expect(three.speed.swim?.value).toBe(40);
    expect(resource(three, 'Tentacle of the Deeps')?.max.value).toBe(2);
    expect(action(three, 'Tentacle of the Deeps')?.roll).toBe('1d8');
    const ten = build(SUB, 10);
    expect(values(ten.defenses.resistances)).toEqual(['cold']);
    expect(action(ten, 'Guardian Coil')?.roll).toBe('2d8');
    expect(action(ten, 'Grasping Tentacles')?.outcomes[0]).toEqual({ tempHp: '10' });
    expect(resource(build(SUB, 14), 'Fathomless Plunge')?.recharge).toBe('short');
  });

  it('Warlock: The Genie', () => {
    const SUB = 'genie|warlock|xphb|tce';
    const three = build(SUB, 3);
    expect(resource(three, 'Bottled Respite')?.max.value).toBe(1);
    // The quick build picks the first kind (Dao).
    const wrath = weapon(three).riders.find((r) => r.name === "Genie's Wrath");
    expect(wrath).toMatchObject({ dice: '2', damageType: 'bludgeoning', optIn: true });
    const six = build(SUB, 6, ['elemental-gift']);
    expect(values(six.defenses.resistances)).toEqual(['bludgeoning']);
    expect(six.speed.fly?.value).toBe(30);
    expect(resource(six, 'Elemental Gift')?.max.value).toBe(3);
    expect(resource(build(SUB, 14), 'Limited Wish')?.recharge).toBe('none');
  });

  it('Wizard: War Magic', () => {
    const SUB = 'war|wizard|xphb|xge';
    const three = build(SUB, 3);
    const plain = build('evoker|wizard|xphb|xphb', 3);
    expect(three.initiative.bonus.value).toBe(
      plain.initiative.bonus.value + three.abilities.int.mod,
    );
    expect(action(three, 'Arcane Deflection')?.actionType).toBe('reaction');
    const six = build(SUB, 6);
    expect(resource(six, 'Power Surge')?.max.value).toBe(Math.max(1, six.abilities.int.mod));
    const off = build(SUB, 10);
    const on = build(SUB, 10, ['durable-magic']);
    expect(on.ac.value).toBe(off.ac.value + 2);
    expect(on.saves.str.bonus.value).toBe(off.saves.str.bonus.value + 2);
    expect(action(build(SUB, 14), 'Deflecting Shroud')?.roll).toBe('7');
  });

  it('Wizard: Chronurgy Magic', () => {
    const SUB = 'chronurgy|wizard|xphb|egw';
    const three = build(SUB, 3);
    expect(resource(three, 'Chronal Shift')?.max.value).toBe(2);
    const six = build(SUB, 6);
    expect(resource(six, 'Momentary Stasis')?.max.value).toBe(Math.max(1, six.abilities.int.mod));
    expect(resource(build(SUB, 10), 'Arcane Abeyance')?.recharge).toBe('short');
    expect(action(build(SUB, 14), 'Convergent Future')?.actionType).toBe('reaction');
  });

  it('Wizard: Graviturgy Magic', () => {
    const SUB = 'graviturgy|wizard|xphb|egw';
    expect(action(build(SUB, 3), 'Adjust Density')?.actionType).toBe('action');
    const ten = build(SUB, 10);
    expect(resource(ten, 'Violent Attraction')?.max.value).toBe(Math.max(1, ten.abilities.int.mod));
    const fourteen = build(SUB, 14);
    expect(action(fourteen, 'Event Horizon')?.roll).toBe('2d10');
    expect(resource(fourteen, 'Event Horizon')?.restoreWith).toHaveLength(1);
  });

  it('Wizard: Order of Scribes', () => {
    const SUB = 'scribes|wizard|xphb|tce';
    const three = build(SUB, 3);
    expect(action(three, 'Wizardly Quill')?.actionType).toBe('bonus');
    expect(resource(three, 'Awakened Spellbook (quick ritual)')?.max.value).toBe(1);
    const six = build(SUB, 6);
    expect(resource(six, 'Manifest Mind casts')?.max.value).toBe(3);
    expect(resource(six, 'Manifest Mind')?.restoreWith).toHaveLength(1);
    const fourteen = build(SUB, 14);
    expect(fourteen.skills.arcana.mode).toBe('advantage');
    expect(action(fourteen, 'One with the Word')?.roll).toBe('3d6');
  });
});
