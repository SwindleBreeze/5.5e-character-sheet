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
});
