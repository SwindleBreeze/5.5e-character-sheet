// Golden checks for the 2024 supplement subclasses of the Paladin, Ranger, Rogue and Sorcerer
// (plan §10.2, step 6.16): Noble Genies, Winter Walker, Hollow Warden, Scion of the Three,
// Phantom, Spellfire and Shadow. Opt-in:
//   FIVETOOLS_DATA=./5etools-src npx vitest run --config vitest.smoke.config.ts <this file>
// Checks numbers only; it never prints or stores content.

import { beforeAll, describe, expect, it } from 'vitest';
import { importFivetools } from '../../src/adapters/fivetools/index.ts';
import { createCatalog, type Catalog } from '../../src/engine/build/catalog.ts';
import { quickBuild } from '../../src/engine/build/quickBuild.ts';
import { createContentIndex, type ContentIndex } from '../../src/engine/content/contentIndex.ts';
import { derive } from '../../src/engine/derive/derive.ts';
import type { DerivedSheet } from '../../src/engine/derive/types.ts';
import { featureEffects } from '../../src/engine/featureEffects/index.ts';
import { setPick } from '../../src/engine/play/features.ts';
import { toggle } from '../../src/engine/play/reducers.ts';
import { decodeChoiceKey, type Character, type ContentEntity } from '../../src/schema/index.ts';
import { nodeFileSource } from './nodeFileSource.ts';

const root = process.env.FIVETOOLS_DATA;

describe.skipIf(!root)('supplement subclasses: Paladin, Ranger, Rogue, Sorcerer', () => {
  let index: ContentIndex;
  let catalog: Catalog;
  const registry = featureEffects();

  beforeAll(async () => {
    const result = await importFivetools(nodeFileSource(root!), { now: 1 });
    const all = Object.values(result.entities).flat() as ContentEntity[];
    index = createContentIndex(all);
    catalog = createCatalog(all, new Set(['XPHB', 'EFA', 'FRHoF', 'RHW', 'AU', 'ABH', 'LFL']));
  });

  function character(cls: string, levels: number, subclassId: string): Character {
    return quickBuild(
      {
        name: 'Golden',
        speciesId: 'human|xphb',
        backgroundId: 'soldier|xphb',
        classes: [{ classId: `${cls}|xphb`, levels, subclassId }],
      },
      { index, catalog, registry, now: 1 },
    );
  }

  /** A human soldier quick-built, with these toggles (`id` or `id:option`) switched on. */
  function build(cls: string, levels: number, sub: string, toggles: string[] = []) {
    let c = character(cls, levels, sub);
    let s = derive(c, index, { registry });
    for (const t of toggles) {
      const [id, option] = t.split(':');
      c = toggle(c, s, id!, true, { free: true, ...(option ? { option } : {}) });
      s = derive(c, index, { registry });
    }
    expect(s.choices.pending).toEqual([]);
    return s;
  }
  const resource = (s: DerivedSheet, name: string) => s.resources.find((r) => r.name === name);
  const act = (s: DerivedSheet, name: string) => s.actions.find((a) => a.name === name);
  const values = (list: { value: string }[]) => list.map((v) => v.value).sort();

  it('Paladin: Oath of the Noble Genies', () => {
    const sub = 'noble genies|paladin|xphb|frhof';
    const three = build('paladin', 3, sub, ['djinnis-escape']);
    expect(act(three, "Dao's Crush")?.saveDc).toBe(8 + three.abilities.cha.mod + 2);
    expect(act(three, "Dao's Crush")?.costs[0]?.label).toBe('1 Channel Divinity');
    expect(act(three, "Efreeti's Fury")?.roll).toBe('2d4');
    expect(values(three.defenses.resistances)).toEqual(['bludgeoning', 'piercing', 'slashing']);
    expect(values(three.defenses.conditionImmunities)).toEqual(['grappled', 'prone', 'restrained']);

    const eleven = build('paladin', 11, sub, ['elemental-shielding:fire']);
    expect(values(eleven.defenses.resistances)).toEqual(['fire']);

    const twenty = build('paladin', 20, sub, ['noble-scion']);
    expect(resource(twenty, 'Elemental Rebuke')?.max.value).toBe(
      Math.max(1, twenty.abilities.cha.mod),
    );
    expect(act(twenty, 'Elemental Rebuke')?.roll).toBe(`2d10 + ${twenty.abilities.cha.mod}`);
    expect(twenty.speed.fly?.value).toBe(60);
    expect(resource(twenty, 'Noble Scion')?.restoreWith[0]?.costs).toEqual([
      'a level 5+ spell slot',
    ]);
  });

  it('Ranger: Winter Walker and Hollow Warden', () => {
    const winter = 'winter walker|ranger|xphb|frhof';
    const three = build('ranger', 3, winter);
    expect(values(three.defenses.resistances)).toEqual(['cold']);
    expect(act(three, "Hunter's Rime")?.outcomes).toEqual([{ tempHp: '1d10 + 3' }]);
    const eleven = build('ranger', 11, winter);
    expect(resource(eleven, 'Chilling Retribution')?.max.value).toBe(
      Math.max(1, eleven.abilities.wis.mod),
    );
    expect(act(eleven, 'Fortifying Soul')?.roll).toBe('1d10 + 11');
    const twenty = build('ranger', 20, winter, ['frozen-haunt']);
    // The level 19 Epic Boon the quick-builder picks may add its own immunity.
    expect(values(twenty.defenses.immunities)).toContain('cold');
    expect(values(twenty.defenses.conditionImmunities)).toEqual([
      'grappled',
      'prone',
      'restrained',
    ]);

    const hollow = 'hollow warden|ranger|xphb|rhw';
    const plain3 = build('ranger', 3, hollow);
    const wrath3 = build('ranger', 3, hollow, ['wrath-of-the-wild']);
    expect(wrath3.ac.value).toBe(plain3.ac.value + 1);
    expect(act(wrath3, 'Unnerving Aura')?.saveDc).toBe(8 + wrath3.abilities.wis.mod + 2);
    const plain11 = build('ranger', 11, hollow);
    const wrath11 = build('ranger', 11, hollow, ['wrath-of-the-wild']);
    expect(wrath11.ac.value).toBe(plain11.ac.value + 2);
    expect(act(plain11, 'Hungering Might')).toBeUndefined();
    expect(act(wrath11, 'Hungering Might')).toBeDefined();
    const seven = build('ranger', 7, hollow);
    const five = build('ranger', 5, hollow);
    expect(seven.saves.con.bonus.value).toBe(
      five.saves.con.bonus.value + Math.max(1, seven.abilities.wis.mod),
    );
    const fifteen = build('ranger', 15, hollow, ['wrath-of-the-wild']);
    expect(values(fifteen.defenses.conditionImmunities)).toEqual(['exhaustion']);
    expect(act(fifteen, 'Persistent Wrath')?.outcomes).toEqual([{ heal: '30' }]);
  });

  it('Rogue: Scion of the Three and Phantom', () => {
    const scion = 'scion of the three|rogue|xphb|frhof';
    const three = build('rogue', 3, scion);
    // The quick-builder picks Minor Illusion (Bane): Psychic.
    expect(values(three.defenses.resistances)).toEqual(['psychic']);
    expect(resource(three, 'Bloodthirst')?.max.value).toBe(Math.max(1, three.abilities.int.mod));
    let c = character('rogue', 3, scion);
    const pick = derive(c, index, { registry })
      .features.flatMap((f) => f.choices)
      .find((x) => x.values.includes('minor illusion|xphb'))!;
    c = setPick(c, decodeChoiceKey(pick.key), {
      values: ['chill touch|xphb'],
      labels: [],
      valueKinds: ['spell'],
      entryIndex: pick.entryIndex,
    });
    expect(values(derive(c, index, { registry }).defenses.resistances)).toEqual(['necrotic']);
    const seventeen = build('rogue', 17, scion);
    expect(resource(seventeen, 'Bloodthirst')?.recharge).toBe('shortOne');

    const phantom = 'phantom|rogue|xphb|rhw';
    const p3 = build('rogue', 3, phantom);
    expect(act(p3, 'Wails from the Grave')?.roll).toBe('1d6');
    expect(resource(p3, 'Wails from the Grave')?.max.value).toBe(Math.max(1, p3.abilities.dex.mod));
    const p5 = build('rogue', 5, phantom);
    expect(act(p5, 'Wails from the Grave')?.roll).toBe('2d6');
    const p11 = build('rogue', 11, phantom);
    expect(act(p11, 'Wails from the Grave')?.roll).toBe('3d6');
    expect(resource(p11, 'Soul Trinkets')?.max.value).toBe(2);
    expect(p11.saves.con.mode).toBe('advantage');
    expect(p11.deathSave.mode).toBe('advantage');
    const p20 = build('rogue', 20, phantom, ['ghost-walk']);
    expect(act(p20, 'Wails from the Grave')?.roll).toBe('5d6');
    expect(resource(p20, 'Soul Trinkets')?.max.value).toBe(4);
    expect(p20.speed.fly?.value).toBe(10);
  });

  it('Sorcerer: Spellfire and Shadow', () => {
    const spellfire = 'spellfire|sorcerer|xphb|frhof';
    const three = build('sorcerer', 3, spellfire);
    expect(act(three, 'Bolstering Flames')?.roll).toBe(`1d4 + ${three.abilities.cha.mod}`);
    expect(act(three, 'Radiant Fire')?.roll).toBe('1d4');
    const fourteen = build('sorcerer', 14, spellfire);
    expect(act(fourteen, 'Bolstering Flames')?.roll).toBe(
      `1d4 + ${fourteen.abilities.cha.mod + 14}`,
    );
    expect(act(fourteen, 'Radiant Fire')?.roll).toBe('1d8');
    const twenty = build('sorcerer', 20, spellfire, ['crown-of-spellfire']);
    expect(twenty.speed.fly?.value).toBe(60);
    expect(resource(twenty, 'Crown of Spellfire')?.restoreWith[0]?.costs).toEqual([
      '5 Sorcery Points',
    ]);

    const shadow = 'shadow|sorcerer|xphb|rhw';
    const s3 = build('sorcerer', 3, shadow);
    expect(s3.senses.map((x) => x.value)).toEqual(
      expect.arrayContaining([
        { sense: 'darkvision', range: 120 },
        { sense: 'blindsight', range: 10 },
      ]),
    );
    expect(act(s3, 'Strength of the Grave')?.outcomes).toEqual([
      { heal: String(s3.abilities.cha.mod + 3) },
    ]);
    const s20 = build('sorcerer', 20, shadow, ['umbral-form']);
    expect(s20.defenses.resistances).toHaveLength(11);
    expect(values(s20.defenses.resistances)).not.toContain('force');
    expect(values(s20.defenses.resistances)).not.toContain('radiant');
  });
});
