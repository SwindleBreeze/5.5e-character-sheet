// Opt-in build matrix against a real local 5etools checkout (plan §9.2, step 3.10):
//   FIVETOOLS_DATA=./5etools-src-2.36.1 npm run test:smoke
// Every XPHB class at levels 1, 5 and 20 is quick-built and derived. Checks invariants only;
// it never prints or stores content.

import { beforeAll, describe, expect, it } from 'vitest';
import { importFivetools } from '../../src/adapters/fivetools/index.ts';
import { autoChoose } from '../../src/engine/build/autoChoose.ts';
import { createCatalog, type Catalog } from '../../src/engine/build/catalog.ts';
import { quickBuild } from '../../src/engine/build/quickBuild.ts';
import { createContentIndex, type ContentIndex } from '../../src/engine/content/contentIndex.ts';
import { offerOptions } from '../../src/engine/choices/options.ts';
import { refreshSnapshots } from '../../src/engine/content/snapshots.ts';
import { derive } from '../../src/engine/derive/derive.ts';
import { featureEffects } from '../../src/engine/featureEffects/index.ts';
import {
  encodeChoiceKey,
  refKey,
  type ClassDef,
  type ContentEntity,
} from '../../src/schema/index.ts';
import { nodeFileSource } from './nodeFileSource.ts';

const root = process.env.FIVETOOLS_DATA;
const LEVELS = [1, 5, 20];

describe.skipIf(!root)('quick-builder (local data)', () => {
  let index: ContentIndex;
  let catalog: Catalog;
  let classes: ClassDef[];

  beforeAll(async () => {
    const result = await importFivetools(nodeFileSource(root!), { now: 1 });
    const all = Object.values(result.entities).flat() as ContentEntity[];
    index = createContentIndex(all);
    catalog = createCatalog(all, new Set(['XPHB', 'XDMG']));
    classes = catalog.of('class').filter((c) => c.source === 'XPHB');
  });

  it('builds every XPHB class at levels 1, 5 and 20 with nothing left to fill', () => {
    expect(classes).toHaveLength(12);
    const species = catalog.of('species');
    const backgrounds = catalog.of('background');
    const problems: string[] = [];
    classes.forEach((cls, i) => {
      for (const levels of LEVELS) {
        const label = `${cls.name} ${levels}`;
        const registry = featureEffects();
        const deps = { index, catalog, registry, now: 0 };
        let sheet;
        let character;
        try {
          character = quickBuild(
            {
              name: label,
              classes: [{ classId: cls.id, levels }],
              speciesId: species[i % species.length]!.id,
              backgroundId: backgrounds[i % backgrounds.length]!.id,
            },
            deps,
          );
          sheet = derive(character, index, { registry });
        } catch (err) {
          problems.push(`${label}: threw ${(err as Error).message}`);
          continue;
        }
        if (sheet.charLevel !== levels) problems.push(`${label}: level ${sheet.charLevel}`);
        if (sheet.hp.max.value < levels) problems.push(`${label}: HP ${sheet.hp.max.value}`);
        if (levels >= cls.subclassLevel && !sheet.classes[0]?.subclassId)
          problems.push(`${label}: no subclass`);
        for (const issue of sheet.issues.filter((x) => x.severity === 'warn'))
          problems.push(`${label}: issue ${issue.code} ${issue.message}`);
        for (const r of sheet.choices.attention)
          problems.push(`${label}: attention ${r.status} ${r.key}`);
        // Step 3.23: a snapshot of every feature, stable once taken.
        const snap = refreshSnapshots(character, index, sheet, 0);
        if (refreshSnapshots(snap, index, sheet, 1) !== snap)
          problems.push(`${label}: snapshots change`);
        for (const f of sheet.features)
          if (!snap.snapshots[refKey(f.ref)])
            problems.push(`${label}: no snapshot ${refKey(f.ref)}`);
        // Step 3.20: every pick the Features tab offers has something to pick from.
        for (const f of sheet.features)
          for (const c of f.choices) {
            const { options } = offerOptions(
              c.offer,
              { character, sheet, catalog, index },
              c.values,
            );
            if (!options.length) problems.push(`${label}: nothing to pick for ${c.key}`);
          }
        for (const p of sheet.choices.pending) {
          const pick = autoChoose(p.offer, p.count - p.have, { character, sheet, catalog, index });
          if (pick.values.length)
            problems.push(`${label}: fillable ${encodeChoiceKey(p.offer.key)}`);
        }
      }
    });
    expect(problems).toEqual([]);
  });

  it('offers the level 1–3 class picks the 2024 rules give (plan §9.3 step 4.2)', () => {
    const registry = featureEffects();
    const deps = { index, catalog, registry, now: 0 };
    const options = (classId: string, levels: number, slot: string, owner: string) => {
      const character = quickBuild(
        {
          name: classId,
          classes: [{ classId, levels }],
          speciesId: 'human|xphb',
          backgroundId: 'sage|xphb',
        },
        deps,
      );
      const sheet = derive(character, index, { registry });
      const choice = sheet.features
        .flatMap((f) => f.choices)
        .find((c) => c.offer.key.slot === slot && c.offer.key.owner.id.startsWith(owner));
      if (!choice) throw new Error(`${classId}: no ${owner} ${slot}`);
      return offerOptions(
        choice.offer,
        { character, sheet, catalog, index },
        choice.values,
      ).options.map((o) => o.value);
    };
    // Weapon Mastery: Rogue's proficiencies include Finesse or Light Martial weapons.
    const rogue = options('rogue|xphb', 1, 'mastery', 'weapon mastery|rogue');
    expect(rogue).toEqual(expect.arrayContaining(['rapier|xphb', 'scimitar|xphb', 'dagger|xphb']));
    expect(rogue).not.toContain('longsword|xphb');
    // Barbarian: Simple, or Martial Melee; never a focus, a feature's weapon or a firearm.
    const barbarian = options('barbarian|xphb', 1, 'mastery', 'weapon mastery|barbarian');
    expect(barbarian).toEqual(expect.arrayContaining(['greataxe|xphb', 'shortbow|xphb']));
    expect(barbarian).not.toContain('longbow|xphb');
    const fighter = options('fighter|xphb', 1, 'mastery', 'weapon mastery|fighter');
    expect(fighter).toContain('longbow|xphb');
    for (const odd of ['staff|xphb', 'psychic blade|xphb', 'antimatter rifle|xdmg'])
      expect(fighter).not.toContain(odd);
    // Thieves' Cant and one other language from the Standard and Rare tables.
    expect(options('rogue|xphb', 1, 'language', "thieves' cant|rogue")).toContain('elvish');
    // Scholar: one of six skills the Wizard is proficient in (Sage gives Arcana and History).
    expect(options('wizard|xphb', 2, 'expertise', 'scholar|wizard')).toEqual(
      expect.arrayContaining(['arcana', 'history']),
    );
    expect(options('barbarian|xphb', 3, 'skills', 'primal knowledge|barbarian')).toHaveLength(6);
    expect(options('ranger|xphb', 2, 'languages', 'deft explorer|ranger')).toContain('sylvan');
    // Tool text in the class data becomes a pick (Bard: three musical instruments).
    expect(options('bard|xphb', 1, 'tools', 'bard|xphb')).toContain('lute|xphb');
  });

  it('offers the level 4–20 class picks the 2024 rules give (plan §9.4 step 5.8)', () => {
    const registry = featureEffects();
    const deps = { index, catalog, registry, now: 0 };
    const sheetOf = (classId: string, levels: number) => {
      const character = quickBuild(
        {
          name: classId,
          classes: [{ classId, levels }],
          speciesId: 'human|xphb',
          backgroundId: 'sage|xphb',
        },
        deps,
      );
      return { character, sheet: derive(character, index, { registry }) };
    };
    const choiceOf = (sheet: ReturnType<typeof derive>, slot: string, owner: string) =>
      sheet.features
        .flatMap((f) => f.choices)
        .find((c) => c.offer.key.slot === slot && c.offer.key.owner.id.startsWith(owner));
    // Expertise again: Rogue 6, Bard 9, Ranger 9.
    for (const [cls, level] of [
      ['rogue', 6],
      ['bard', 9],
      ['ranger', 9],
    ] as const)
      expect(
        choiceOf(sheetOf(`${cls}|xphb`, level).sheet, 'expertise', `expertise|${cls}|xphb|${level}`)
          ?.values,
      ).toHaveLength(2);
    // Blessed Strikes: one of Divine Strike and Potent Spellcasting, the other not had.
    const cleric = sheetOf('cleric|xphb', 7).sheet;
    const strikes = choiceOf(cleric, 'options.0', 'blessed strikes')!;
    expect(strikes.offer.from).toEqual([
      'divine strike|cleric|xphb|7|xphb',
      'potent spellcasting|cleric|xphb|7|xphb',
    ]);
    const names = cleric.features.map((f) => f.name);
    expect(names.filter((n) => n === 'Divine Strike' || n === 'Potent Spellcasting')).toHaveLength(
      1,
    );
    // Mystic Arcanum: a level 6 Warlock spell at 11, one free cast per Long Rest.
    const warlock = sheetOf('warlock|xphb', 11);
    const arcanum = choiceOf(warlock.sheet, 'arcanum.11', 'warlock')!;
    const options = offerOptions(
      arcanum.offer,
      { ...warlock, catalog, index },
      arcanum.values,
    ).options;
    expect(options.length).toBeGreaterThan(0);
    for (const o of options) expect(index.get({ kind: 'spell', id: o.value })?.level).toBe(6);
    const granted = warlock.sheet.spellcasting.granted.find((g) => g.spellId === arcanum.values[0]);
    expect(granted).toMatchObject({ usesMax: 1 });
    // Magical Secrets: the Cleric, Druid and Wizard lists join the Bard's.
    const bard = sheetOf('bard|xphb', 10).sheet.spellcasting.casters[0]!;
    expect(bard.list.filters).toEqual(
      expect.arrayContaining(['class=Cleric', 'class=Druid', 'class=Wizard']),
    );
    // Spell Mastery and Signature Spells: picked, always prepared.
    const wizard = sheetOf('wizard|xphb', 20).sheet;
    expect(choiceOf(wizard, 'mastery.1', 'spell mastery')?.values).toHaveLength(1);
    expect(choiceOf(wizard, 'signature', 'signature spells')?.values).toHaveLength(2);
  });

  it('species spells come at their character level (High Elf: Detect Magic at 3)', () => {
    const registry = featureEffects();
    const granted = (levels: number) => {
      const c = quickBuild(
        {
          name: 'Elf',
          classes: [{ classId: 'fighter|xphb', levels }],
          speciesId: 'elf; high elf lineage|xphb',
          backgroundId: 'soldier|xphb',
        },
        { index, catalog, registry, now: 0 },
      );
      return derive(c, index, { registry }).spellcasting.granted.map((g) => g.spellId);
    };
    expect(granted(1)).not.toContain('detect magic|xphb');
    expect(granted(3)).toContain('detect magic|xphb');
    expect(granted(3)).not.toContain('misty step|xphb');
    expect(granted(5)).toContain('misty step|xphb');
  });
});
