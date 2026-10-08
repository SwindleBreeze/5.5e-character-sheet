// Golden checks for the 2024 supplement Warlock patrons and Wizard subclasses (plan §10.2,
// step 6.16) on real data: Undead, Vestige, Bladesinger, Conjurer, Enchanter, Necromancer and
// Transmuter, quick-built at a few levels. Opt-in:
//   FIVETOOLS_DATA=./5etools-src npx vitest run --config vitest.smoke.config.ts tests/smoke/supWarlockWizard.test.ts
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

describe.skipIf(!root)('supplement Warlock and Wizard golden checks (local data)', () => {
  let index: ContentIndex;
  let catalog: Catalog;

  beforeAll(async () => {
    const result = await importFivetools(nodeFileSource(root!), { now: 1 });
    const all = Object.values(result.entities).flat() as ContentEntity[];
    index = createContentIndex(all);
    catalog = createCatalog(all, new Set(['XPHB', 'EFA', 'FRHoF', 'RHW', 'AU', 'ABH', 'LFL']));
  });

  /** A human soldier of one class, quick-built, with these toggles (`id` or `id:option`) on. */
  function build(cls: string, levels: number, subId: string, toggles: string[] = []) {
    const registry = featureEffects();
    let c = quickBuild(
      {
        name: 'Golden',
        speciesId: 'human|xphb',
        backgroundId: 'soldier|xphb',
        classes: [{ classId: `${cls}|xphb`, levels, subclassId: subId }],
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
    return s;
  }
  const resource = (s: DerivedSheet, name: string) => s.resources.find((r) => r.name === name);
  const values = (list: { value: string }[]) => list.map((v) => v.value).sort();
  const action = (s: DerivedSheet, name: string) => s.actions.find((a) => a.name === name);

  const UNDEAD = 'undead|warlock|xphb|rhw';
  const VESTIGE = 'vestige|warlock|xphb|au';

  it('Warlock: Undead Patron and Form of Dread', () => {
    const three = build('warlock', 3, UNDEAD, ['form-of-dread']);
    expect(resource(three, 'Form of Dread')?.max.value).toBe(Math.max(1, three.abilities.cha.mod));
    expect(values(three.defenses.conditionImmunities)).toEqual(['frightened']);
    expect(three.toggles.find((t) => t.toggleId === 'form-of-dread')?.onActivate).toHaveLength(1);
    // Patron spells come from the subclass data.
    const warlock = three.spellcasting.casters.find((c) => c.alwaysPrepared.length);
    expect(warlock?.alwaysPrepared).toContain('ray of sickness|xphb');

    const ten = build('warlock', 10, UNDEAD);
    expect(values(ten.defenses.resistances)).toEqual(['necrotic']);
    expect(ten.defenses.immunities).toEqual([]);
    expect(resource(ten, 'Unholy Resuscitation')?.recharge).toBe('short');

    const twenty = build('warlock', 20, UNDEAD, ['form-of-dread']);
    // The quick build's Epic Boon adds an immunity of its own.
    expect(values(twenty.defenses.immunities)).toContain('necrotic');
    expect(values(twenty.defenses.resistances)).toEqual([
      'bludgeoning',
      'necrotic',
      'piercing',
      'slashing',
    ]);
    expect(twenty.speed.fly?.value).toBe(twenty.speed.walk?.value);
  });

  it('Warlock: Vestige Patron', () => {
    const three = build('warlock', 3, VESTIGE);
    expect(resource(three, "Vestige's Divine Power")?.recharge).toBe('long');

    const eleven = build('warlock', 11, VESTIGE, ['near-vestige']);
    expect(resource(eleven, "Vestige's Divine Power")?.recharge).toBe('short');
    expect(eleven.defenses.resistances).toHaveLength(1);
    expect(['fire', 'necrotic', 'radiant']).toContain(eleven.defenses.resistances[0]!.value);
    expect(resource(eleven, 'Vestige Recovery')?.max.value).toBe(1);
    expect(build('warlock', 11, VESTIGE).defenses.resistances).toEqual([]);

    expect(resource(build('warlock', 20, VESTIGE), 'Semblance of Life')?.max.value).toBe(1);
  });

  it('Wizard: Bladesinger', () => {
    const off = build('wizard', 3, 'bladesinger|wizard|xphb|frhof');
    const on = build('wizard', 3, 'bladesinger|wizard|xphb|frhof', ['bladesong']);
    const int = on.abilities.int.mod;
    expect(resource(on, 'Bladesong')?.max.value).toBe(Math.max(1, int));
    expect(on.ac.value).toBe(off.ac.value + Math.max(1, int));
    expect(on.speed.walk?.value).toBe((off.speed.walk?.value ?? 0) + 10);
    expect(on.skills.acrobatics.mode).toBe('advantage');
    expect(on.concentration.bonus.value).toBe(off.concentration.bonus.value + int);
    expect(values(on.proficiencies.weapons)).toContain('rapier|xphb');

    const six = build('wizard', 6, 'bladesinger|wizard|xphb|frhof');
    expect(six.attacksPerAction.value).toBe(2);
    expect(action(six, 'Song of Defense')).toBeUndefined();
    const ten = build('wizard', 10, 'bladesinger|wizard|xphb|frhof', ['bladesong']);
    expect(action(ten, 'Song of Defense')).toBeDefined();
    expect(
      action(build('wizard', 14, 'bladesinger|wizard|xphb|frhof'), 'Song of Victory'),
    ).toBeDefined();
  });

  it('Wizard: Conjurer, Enchanter, Necromancer and Transmuter', () => {
    const conjurer = build('wizard', 6, 'conjurer|wizard|xphb|au');
    const benign = resource(conjurer, 'Benign Transposition');
    expect(benign?.max.value).toBe(Math.max(1, conjurer.abilities.int.mod));
    expect(benign?.restoreWith).toHaveLength(1);

    const enchanter = build('wizard', 3, 'enchanter|wizard|xphb|au');
    const social = (['deception', 'intimidation', 'persuasion'] as const).filter(
      (k) => enchanter.skills[k].proficiency !== 'none',
    );
    expect(social.length).toBeGreaterThan(0);
    expect(resource(enchanter, 'Hypnotic Presence')?.max.value).toBe(
      Math.max(1, enchanter.abilities.int.mod),
    );
    expect(
      resource(build('wizard', 10, 'enchanter|wizard|xphb|au'), 'Instinctive Charm'),
    ).toBeDefined();

    const necro = build('wizard', 11, 'necromancer|wizard|xphb|au');
    expect(values(necro.defenses.resistances)).toEqual(['necrotic']);
    expect(action(necro, 'Harvest Undead')?.outcomes).toHaveLength(1);

    const stoneOff = build('wizard', 3, 'transmuter|wizard|xphb|au');
    const stoneOn = build('wizard', 3, 'transmuter|wizard|xphb|au', ['transmuters-stone']);
    expect(stoneOff.saves.con.proficiency).toBe('none');
    expect(stoneOn.saves.con.proficiency).toBe('proficient');
    const shaped = build('wizard', 3, 'transmuter|wizard|xphb|au', [
      'alter-self:change-appearance',
    ]);
    expect(shaped.skills.deception.mode).toBe('advantage');
    const eleven = build('wizard', 11, 'transmuter|wizard|xphb|au');
    expect(resource(eleven, 'Empowered Transmutation')?.max.value).toBe(
      Math.max(1, eleven.abilities.int.mod),
    );
    expect(resource(eleven, 'Shape-Shifter')?.max.value).toBe(1);
  });
});
