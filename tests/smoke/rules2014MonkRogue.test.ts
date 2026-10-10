// Golden checks for the 2014 Monk and Rogue on 2014 rules (plan step 8.6): builds at a few
// levels, with each subclass the step maps, their numbers read the way the mappings give them.
// Opt-in:
//   FIVETOOLS_DATA=./5etools-src npx vitest run --config vitest.smoke.config.ts tests/smoke/rules2014MonkRogue.test.ts
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
import { PREFER_2014, SHOW_2014 } from '../../src/sources/sourceFilter.ts';
import { nodeFileSource } from './nodeFileSource.ts';

const root = process.env.FIVETOOLS_DATA;

describe.skipIf(!root)('2014 Monk and Rogue on 2014 rules', () => {
  let index: ContentIndex;
  let catalog: Catalog;
  const registry = featureEffects();

  beforeAll(async () => {
    const result = await importFivetools(nodeFileSource(root!), { now: 1 });
    const all = Object.values(result.entities).flat() as ContentEntity[];
    index = createContentIndex(all);
    const books = result.sources.filter((s) => s.origin !== 'homebrew').map((s) => s.code);
    catalog = createCatalog(all, new Set([...books, SHOW_2014, PREFER_2014]));
  });

  /** A human soldier quick-built on 2014 rules, with these toggles switched on. */
  function build(cls: string, levels: number, sub?: string, toggles: string[] = []) {
    let c = quickBuild(
      {
        name: 'Golden',
        speciesId: 'human|phb',
        backgroundId: 'soldier|phb',
        classes: [{ classId: `${cls}|phb`, levels, ...(sub ? { subclassId: sub } : {}) }],
        ruleset: '2014',
      },
      { index, catalog, registry, now: 1 },
    );
    let s = derive(c, index, { registry });
    for (const id of toggles) {
      c = toggle(c, s, id, true, { free: true });
      s = derive(c, index, { registry });
    }
    expect(s.choices.pending).toEqual([]);
    expect(s.issues.filter((i) => i.severity !== 'info')).toEqual([]);
    return s;
  }
  const resource = (s: DerivedSheet, name: string) => s.resources.find((r) => r.name === name);
  const act = (s: DerivedSheet, name: string) => s.actions.filter((a) => a.name === name);
  const one = (s: DerivedSheet, name: string) => {
    const found = act(s, name);
    expect(found, name).toHaveLength(1);
    return found[0]!;
  };
  const values = (list: { value: string }[]) => list.map((v) => v.value).sort();
  /** A die plus a modifier, as the sheet writes it (`1d4`, `1d4 + 2`, `1d4 - 1`). */
  const plus = (dice: string, mod: number) =>
    mod === 0 ? dice : `${dice} ${mod < 0 ? '-' : '+'} ${Math.abs(mod)}`;
  const kiDc = (s: DerivedSheet, pb: number) => 8 + pb + s.abilities.wis.mod;
  const attack = (s: DerivedSheet, name: string) => s.attacks.find((a) => a.name === name);

  it('Monk: Ki, Martial Arts and the class features', () => {
    const one1 = build('monk', 1);
    expect(one1.ac.value).toBe(10 + one1.abilities.dex.mod + one1.abilities.wis.mod);
    expect(attack(one1, 'Unarmed Strike')?.damageDice).toBe('1d4');
    expect(one(one1, 'Martial Arts (Bonus Unarmed Strike)').actionType).toBe('bonus');

    const five = build('monk', 5);
    expect(resource(five, 'Ki')).toMatchObject({ recharge: 'short' });
    expect(resource(five, 'Ki')?.max.value).toBe(5);
    expect(attack(five, 'Unarmed Strike')?.damageDice).toBe('1d6');
    expect(five.speed.walk?.value).toBe(40);
    expect(one(five, 'Flurry of Blows').costs[0]?.label).toBe('1 Ki');
    expect(one(five, 'Stunning Strike').saveDc).toBe(kiDc(five, 3));
    expect(one(five, 'Deflect Missiles').roll).toBe(`1d10 + ${five.abilities.dex.mod + 5}`);
    expect(one(five, 'Slow Fall').roll).toBe('25');
    expect(one(five, 'Quickened Healing').costs[0]?.amount).toBe(2);

    const ten = build('monk', 10);
    expect(attack(ten, 'Unarmed Strike')?.damageDice).toBe('1d6');
    expect(ten.speed.walk?.value).toBe(50);
    expect(attack(build('monk', 11), 'Unarmed Strike')?.damageDice).toBe('1d8');
    expect(values(ten.defenses.immunities)).toEqual(['poison']);
    expect(values(ten.defenses.conditionImmunities)).toEqual(['disease', 'poisoned']);

    const eighteen = build('monk', 18, undefined, ['empty-body']);
    expect(eighteen.defenses.resistances).toHaveLength(12);
    expect(eighteen.toggles.find((t) => t.toggleId === 'empty-body')?.costs[0]?.amount).toBe(4);
    expect(one(eighteen, 'Empty Body (Astral Projection)').costs[0]?.amount).toBe(8);
    expect(Object.values(eighteen.saves).every((x) => x.proficiency === 'proficient')).toBe(true);
    expect(one(eighteen, 'Diamond Soul (Reroll)').costs[0]?.label).toBe('1 Ki');

    const twenty = build('monk', 20);
    expect(attack(twenty, 'Unarmed Strike')?.damageDice).toBe('1d10');
    expect(one(twenty, 'Perfect Self').outcomes).toHaveLength(1);
  });

  it('Monk: Way of Shadow pays its spells in Ki', () => {
    const sub = 'shadow|monk|phb|phb';
    const three = build('monk', 3, sub);
    const ki = resource(three, 'Ki')!;
    const darkness = three.spellcasting.granted.find((g) => g.spellId === 'darkness|phb');
    expect(darkness).toMatchObject({ resourceKey: ki.key, cost: 2 });
    expect(three.spellcasting.granted.map((g) => g.spellId).includes('minor illusion|phb')).toBe(
      true,
    );
    expect(one(build('monk', 6, sub), 'Shadow Step').actionType).toBe('bonus');
    expect(one(build('monk', 17, sub), 'Opportunist').actionType).toBe('reaction');
  });

  it('Monk: Way of the Four Elements', () => {
    const three = build('monk', 3, 'four elements|monk|phb|phb');
    expect(one(three, 'Elemental Discipline').saveDc).toBe(kiDc(three, 2));
  });

  it('Monk: Way of the Open Hand', () => {
    const sub = 'open hand|monk|phb|phb';
    const three = build('monk', 3, sub);
    expect(one(three, 'Open Hand Technique').saveDc).toBe(kiDc(three, 2));
    const six = build('monk', 6, sub);
    expect(resource(six, 'Wholeness of Body')?.max.value).toBe(1);
    expect(one(six, 'Wholeness of Body').outcomes).toEqual([{ heal: '18' }]);
    const seventeen = build('monk', 17, sub);
    expect(one(seventeen, 'Quivering Palm')).toMatchObject({
      roll: '10d10',
      saveDc: kiDc(seventeen, 6),
    });
    expect(one(seventeen, 'Quivering Palm').costs[0]?.amount).toBe(3);
  });

  it('Monk: Way of Mercy', () => {
    const sub = 'mercy|monk|phb|tce';
    const three = build('monk', 3, sub);
    expect(three.skills.insight.proficiency).toBe('proficient');
    expect(three.skills.medicine.proficiency).toBe('proficient');
    expect(values(three.proficiencies.tools)).toContain('herbalism kit|phb');
    expect(one(three, 'Hand of Healing').roll).toBe(plus('1d4', three.abilities.wis.mod));
    const harm = attack(three, 'Unarmed Strike')?.riders.find((r) => r.name === 'Hand of Harm');
    expect(harm?.dice).toBe(plus('1d4', three.abilities.wis.mod));
    const seventeen = build('monk', 17, sub);
    expect(one(seventeen, 'Hand of Ultimate Mercy').costs.map((c) => c.amount)).toEqual([1, 5]);
  });

  it('Rogue: Sneak Attack, Expertise and the class features', () => {
    const r1 = build('rogue', 1);
    const rapier = r1.attacks.find((a) => a.riders.some((r) => r.name === 'Sneak Attack'));
    expect(rapier?.riders.find((r) => r.name === 'Sneak Attack')?.dice).toBe('1d6');
    expect(values(r1.proficiencies.languages)).toContain("thieves' cant");
    const expert = (s: DerivedSheet) =>
      Object.values(s.skills).filter((x) => x.proficiency === 'expertise').length;
    expect(expert(r1)).toBe(2);
    const six = build('rogue', 6);
    expect(expert(six)).toBe(4);
    expect(one(six, 'Uncanny Dodge').actionType).toBe('reaction');
    const eleven = build('rogue', 11);
    const sneak = eleven.attacks.flatMap((a) => a.riders).find((r) => r.name === 'Sneak Attack');
    expect(sneak?.dice).toBe('6d6');
    expect(eleven.saves.wis.proficiency).not.toBe('proficient');
    const fifteen = build('rogue', 15);
    expect(fifteen.saves.wis.proficiency).toBe('proficient');
    expect(fifteen.saves.cha.proficiency).not.toBe('proficient');
    expect(resource(build('rogue', 20), 'Stroke of Luck')).toMatchObject({ recharge: 'short' });
  });

  it('Rogue: Thief, Assassin and Arcane Trickster', () => {
    const thief = build('rogue', 9, 'thief|rogue|phb|phb');
    expect(thief.speed.climb?.value).toBe(thief.speed.walk?.value);
    expect(one(thief, 'Fast Hands').actionType).toBe('bonus');
    const assassin = build('rogue', 17, 'assassin|rogue|phb|phb');
    expect(values(assassin.proficiencies.tools)).toEqual(
      expect.arrayContaining(['disguise kit|phb', "poisoner's kit|phb"]),
    );
    expect(one(assassin, 'Death Strike').saveDc).toBe(8 + 6 + assassin.abilities.dex.mod);
    const trickster = build('rogue', 17, 'arcane trickster|rogue|phb|phb');
    const caster = trickster.spellcasting.casters[0]!;
    expect(caster.ability).toBe('int');
    expect(one(trickster, 'Spell Thief').saveDc).toBe(caster.dc.value);
    expect(one(trickster, 'Versatile Trickster').actionType).toBe('bonus');
  });

  it('Rogue: Phantom', () => {
    const sub = 'phantom|rogue|phb|tce';
    const three = build('rogue', 3, sub);
    expect(resource(three, 'Wails from the Grave')?.max.value).toBe(2);
    expect(one(three, 'Wails from the Grave').roll).toBe('1d6');
    const nine = build('rogue', 9, sub);
    expect(resource(nine, 'Soul Trinkets')?.max.value).toBe(4);
    expect(one(nine, 'Wails from the Grave (Soul Trinket)').roll).toBe('3d6');
    const thirteen = build('rogue', 13, sub, ['ghost-walk']);
    expect(thirteen.speed.fly?.value).toBe(10);
  });

  it('Rogue: Soulknife gives both powers of each pick once', () => {
    const sub = 'soulknife|rogue|phb|tce';
    const three = build('rogue', 3, sub);
    expect(resource(three, 'Psionic Energy Dice')?.max.value).toBe(4);
    expect(resource(three, 'Psionic Energy Dice')?.die).toBe('1d6');
    expect(one(three, 'Psi-Bolstered Knack').roll).toBe('1d6');
    expect(one(three, 'Psychic Whispers').roll).toBe('1d6');
    expect(attack(three, 'Psychic Blade')?.damageDice).toBe('1d6');
    expect(attack(three, 'Psychic Blade (Bonus Action)')?.damageDice).toBe('1d4');
    const eleven = build('rogue', 11, sub);
    expect(resource(eleven, 'Psionic Energy Dice')?.max.value).toBe(8);
    expect(one(eleven, 'Homing Strikes').roll).toBe('1d10');
    expect(one(eleven, 'Psychic Teleportation').roll).toBe('1d10');
    const seventeen = build('rogue', 17, sub);
    expect(resource(seventeen, 'Psionic Energy Dice')?.die).toBe('1d12');
    expect(one(seventeen, 'Rend Mind').saveDc).toBe(8 + 6 + seventeen.abilities.dex.mod);
  });
});
