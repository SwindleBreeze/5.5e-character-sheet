// Golden checks for the six 2024 Artificer subclasses on real data (plan §10.2, step 6.16):
// quick builds at a few levels, their counters, actions, toggles and attacks read the way the
// 2024 rules give them. Opt-in:
//   FIVETOOLS_DATA=./5etools-src npx vitest run --config vitest.smoke.config.ts tests/smoke/supArtificerSubclasses.test.ts
// Checks numbers only; it never prints or stores content.

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
import { nodeFileSource } from './nodeFileSource.ts';

const root = process.env.FIVETOOLS_DATA;

describe.skipIf(!root)('Artificer subclasses (local data)', () => {
  let index: ContentIndex;
  let catalog: Catalog;

  beforeAll(async () => {
    const result = await importFivetools(nodeFileSource(root!), { now: 1 });
    const all = Object.values(result.entities).flat() as ContentEntity[];
    index = createContentIndex(all);
    catalog = createCatalog(all, new Set(['XPHB', 'EFA', 'FRHoF', 'RHW', 'AU', 'ABH', 'LFL']));
  });

  /** A human soldier Artificer of a subclass, quick-built, with `toggle[:option]` switched on. */
  function build(sub: string, levels: number, toggles: string[] = []): DerivedSheet {
    const registry = featureEffects();
    const source = sub === 'reanimator' ? 'rhw' : 'efa';
    let c = quickBuild(
      {
        name: 'Golden',
        speciesId: 'human|xphb',
        backgroundId: 'soldier|xphb',
        classes: [
          { classId: 'artificer|efa', levels, subclassId: `${sub}|artificer|efa|${source}` },
        ],
      },
      { index, catalog, registry, now: 1 },
    );
    let s = derive(c, index, { registry });
    for (const t of toggles) {
      const [id = t, option] = t.split(':');
      c = toggle(c, s, id, true, { free: true, ...(option ? { option } : {}) });
      s = derive(c, index, { registry });
    }
    expect(s.choices.pending).toEqual([]);
    return s;
  }
  const resource = (s: DerivedSheet, name: string) => s.resources.find((r) => r.name === name);
  const actionOf = (s: DerivedSheet, name: string) => s.actions.find((a) => a.name === name);
  const attack = (s: DerivedSheet, name: string) => s.attacks.find((a) => a.name === name);
  const intMod = (s: DerivedSheet) => s.abilities.int.mod;
  const values = (list: { value: string }[]) => list.map((v) => v.value);
  const freeCasts = (s: DerivedSheet, id: string) =>
    s.spellcasting.granted.find((g) => g.spellId === id && g.mode === 'innate')?.usesMax;

  it('Alchemist: tools, Experimental Elixir, Chemical Mastery', () => {
    const three = build('alchemist', 3);
    expect(values(three.proficiencies.tools)).toEqual(
      expect.arrayContaining(["alchemist's supplies|xphb", 'herbalism kit|xphb']),
    );
    expect(resource(three, 'Experimental Elixir')?.max.value).toBe(2);
    expect(resource(build('alchemist', 5), 'Experimental Elixir')?.max.value).toBe(3);
    const eleven = build('alchemist', 11);
    expect(resource(eleven, 'Experimental Elixir')?.max.value).toBe(4);
    expect(actionOf(eleven, 'Experimental Elixir: Healing')?.roll).toBe(`3d8 + ${intMod(eleven)}`);
    expect(freeCasts(eleven, 'lesser restoration|xphb')).toBe(Math.max(1, intMod(eleven)));

    const twenty = build('alchemist', 20);
    expect(resource(twenty, 'Experimental Elixir')?.max.value).toBe(5);
    expect(values(twenty.defenses.resistances)).toEqual(expect.arrayContaining(['acid', 'poison']));
    expect(values(twenty.defenses.conditionImmunities)).toContain('poisoned');
    expect(actionOf(twenty, 'Alchemical Eruption')?.roll).toBe('2d8');
  });

  it('Armorer: heavy armor, the three models, Improved Arsenal, Perfected Armor', () => {
    const three = build('armorer', 3);
    expect(values(three.proficiencies.armor)).toContain('heavy');
    expect(attack(three, 'Force Demolisher')).toBeUndefined();
    expect(three.attacksPerAction.value).toBe(1);

    const dread = build('armorer', 3, ['arcane-armor:dreadnaught']);
    const demolisher = attack(dread, 'Force Demolisher')!;
    expect(demolisher.damageDice).toBe('1d10');
    expect(demolisher.damageType).toBe('force');
    expect(resource(dread, 'Giant Stature')?.max.value).toBe(Math.max(1, intMod(dread)));

    const five = build('armorer', 5, ['arcane-armor:guardian']);
    expect(five.attacksPerAction.value).toBe(2);
    expect(attack(five, 'Thunder Pulse')?.damageDice).toBe('1d8');
    expect(actionOf(five, 'Defensive Field')?.actionType).toBe('bonus');

    // Improved Arsenal: +1 to hit and damage with the model's weapon.
    const eleven = build('armorer', 11, ['arcane-armor:infiltrator']);
    const launcher = attack(eleven, 'Lightning Launcher')!;
    const ability = Math.max(eleven.abilities.dex.mod, intMod(eleven));
    expect(launcher.toHit?.bonus.value).toBe(ability + eleven.pb.value + 1);
    expect(launcher.damageBonus.value).toBe(ability + 1);
    expect(launcher.riders.find((r) => r.id === 'lightning-launcher')?.dice).toBe('1d6');
    expect(eleven.speed.walk?.value).toBe(35);
    expect(eleven.skills.stealth.mode).toBe('advantage');
    expect(attack(eleven, 'Shortbow')?.riders.find((r) => r.id === 'lightning-launcher')).toBe(
      undefined,
    );

    const twenty = build('armorer', 20, ['arcane-armor:dreadnaught', 'giant-stature']);
    expect(attack(twenty, 'Force Demolisher')?.damageDice).toBe('2d6');
    expect(twenty.saves.str.mode).toBe('advantage');
    expect(
      attack(build('armorer', 20, ['arcane-armor:guardian']), 'Thunder Pulse')?.damageDice,
    ).toBe('1d10');
    const infiltrator = build('armorer', 20, ['arcane-armor:infiltrator']);
    expect(attack(infiltrator, 'Lightning Launcher')?.damageDice).toBe('2d6');
    expect(resource(infiltrator, 'Infiltrator Flight')?.max.value).toBe(
      Math.max(1, intMod(infiltrator)),
    );
  });

  it('Artillerist: Eldritch Cannon, Arcane Firearm, Explosive Cannon', () => {
    const three = build('artillerist', 3);
    expect(values(three.proficiencies.weapons)).toContain('longbow|xphb');
    expect(resource(three, 'Eldritch Cannon')).toMatchObject({ recharge: 'long' });
    expect(resource(three, 'Eldritch Cannon')?.max.value).toBe(1);
    expect(actionOf(three, 'Cannon: Flamethrower')?.roll).toBe('2d8');
    expect(actionOf(three, 'Cannon: Flamethrower')?.saveDc).toBe(
      8 + intMod(three) + three.pb.value,
    );
    expect(actionOf(build('artillerist', 5), 'Arcane Firearm')?.roll).toBe('1d8');

    const eleven = build('artillerist', 11);
    expect(actionOf(eleven, 'Cannon: Force Ballista')?.roll).toBe('3d8');
    expect(actionOf(eleven, 'Cannon: Protector')?.roll).toBe(
      `2d8 + ${Math.max(1, intMod(eleven))}`,
    );
    expect(actionOf(eleven, 'Cannon: Detonate')?.roll).toBe('3d10');
  });

  it('Battle Smith: Battle Ready, Steel Defender, Arcane Jolt', () => {
    const three = build('battle smith', 3, ['battle-ready']);
    expect(values(three.proficiencies.weapons)).toContain('martial');
    expect(attack(three, 'Spear')?.ability).toBe(
      intMod(three) >= three.abilities.str.mod ? 'int' : 'str',
    );
    expect(actionOf(three, 'Command Steel Defender')?.actionType).toBe('bonus');
    expect(build('battle smith', 5).attacksPerAction.value).toBe(2);

    const eleven = build('battle smith', 11, ['battle-ready']);
    expect(resource(eleven, 'Arcane Jolt')?.max.value).toBe(Math.max(1, intMod(eleven)));
    expect(attack(eleven, 'Spear')?.riders.find((r) => r.id === 'arcane-jolt')?.dice).toBe('2d6');
    expect(attack(build('battle smith', 11), 'Spear')?.riders).toEqual([]);

    const twenty = build('battle smith', 20, ['battle-ready']);
    expect(attack(twenty, 'Spear')?.riders.find((r) => r.id === 'arcane-jolt')?.dice).toBe('4d6');
    expect(actionOf(twenty, 'Arcane Jolt: Restorative Energy')?.roll).toBe('4d6');
  });

  it('Cartographer: Atlas, Mapping Magic, Guided Precision, Superior Atlas', () => {
    const three = build('cartographer', 3, ['atlas-map']);
    expect(three.initiative.dice).toEqual([expect.objectContaining({ dice: '1d4' })]);
    expect(freeCasts(three, 'faerie fire|xphb')).toBe(Math.max(1, intMod(three)));

    const five = build('cartographer', 5);
    expect(attack(five, 'Dagger')?.riders.find((r) => r.id === 'guided-precision')?.dice).toBe(
      String(intMod(five)),
    );
    expect(freeCasts(build('cartographer', 20), 'find the path|xphb')).toBeUndefined();
    expect(freeCasts(build('cartographer', 20, ['atlas-map']), 'find the path|xphb')).toBe(1);
  });

  it('Reanimator: Jolt to Life, Reanimated Companion, Refined Reanimation', () => {
    const three = build('reanimator', 3);
    expect(resource(three, 'Jolt to Life')?.max.value).toBe(Math.max(0, intMod(three)));
    expect(actionOf(three, 'Jolt to Life')?.roll).toBe('2d4');
    expect(resource(three, 'Reanimated Companion')?.max.value).toBe(1);
    expect(actionOf(build('reanimator', 11), 'Jolt to Life')?.roll).toBe('3d4');

    const twenty = build('reanimator', 20);
    expect(actionOf(twenty, 'Jolt to Life')?.roll).toBe('4d4');
    expect(freeCasts(twenty, 'raise dead|xphb')).toBe(1);
    expect(actionOf(twenty, 'Life Transfer')?.actionType).toBe('reaction');
  });
});
