// Golden checks for the 2014 Druid and Fighter on 2014 rules (plan step 8.6): one build per
// subclass at a few levels, with the 2014 originals preferred and every book, its numbers read
// the way the mapping gives them. Opt-in:
//   FIVETOOLS_DATA=./5etools-src npx vitest run --config vitest.smoke.config.ts tests/smoke/rules2014DruidFighter.test.ts
// Checks numbers and names only; it never prints or stores content.

import { beforeAll, describe, expect, it } from 'vitest';
import { importFivetools } from '../../src/adapters/fivetools/index.ts';
import { createCatalog, type Catalog } from '../../src/engine/build/catalog.ts';
import { quickBuild } from '../../src/engine/build/quickBuild.ts';
import { createContentIndex, type ContentIndex } from '../../src/engine/content/contentIndex.ts';
import { derive } from '../../src/engine/derive/derive.ts';
import type { DerivedSheet } from '../../src/engine/derive/types.ts';
import { featureEffects } from '../../src/engine/featureEffects/index.ts';
import { RULES_2014_DRUID_FIGHTER } from '../../src/engine/featureEffects/rules2014/druidFighter.ts';
import { toggle } from '../../src/engine/play/reducers.ts';
import { parseRefKey, type ContentEntity, type RefKey } from '../../src/schema/index.ts';
import { PREFER_2014, SHOW_2014 } from '../../src/sources/sourceFilter.ts';
import { nodeFileSource } from './nodeFileSource.ts';

const root = process.env.FIVETOOLS_DATA;

describe.skipIf(!root)('2014 Druid and Fighter on 2014 rules golden checks', () => {
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

  /** A half-orc soldier on 2014 rules, of one class and subclass, with these toggles on. */
  function build(
    cls: string,
    levels: number,
    subclassId?: string,
    toggles: [string, string?][] = [],
  ): DerivedSheet {
    let c = quickBuild(
      {
        name: 'Golden',
        speciesId: 'half-orc|phb',
        backgroundId: 'soldier|phb',
        classes: [{ classId: `${cls}|phb`, levels, ...(subclassId ? { subclassId } : {}) }],
        ruleset: '2014',
      },
      { index, catalog, registry, now: 1 },
    );
    // A greatsword in hand, for the weapon attack checks.
    c = {
      ...c,
      inventory: [
        ...c.inventory.map(({ equipped: _e, ...r }) => r),
        {
          uid: 'greatsword',
          itemRef: { kind: 'item', id: 'greatsword|phb' },
          name: 'Greatsword',
          quantity: 1,
          equipped: 'bothHands',
          attuned: false,
        },
      ],
    };
    let s = derive(c, index, { registry });
    for (const [id, option] of toggles) {
      c = toggle(c, s, id, true, { free: true, ...(option ? { option } : {}) });
      s = derive(c, index, { registry });
    }
    expect(s.choices.pending).toEqual([]);
    expect(s.issues.filter((i) => i.severity !== 'info')).toEqual([]);
    return s;
  }
  const resource = (s: DerivedSheet, name: string) => s.resources.find((r) => r.name === name);
  const act = (s: DerivedSheet, name: string) => s.actions.find((a) => a.name === name);
  const values = (list: { value: string }[]) => list.map((v) => v.value).sort();
  const weapon = (s: DerivedSheet) => s.attacks.find((a) => a.name === 'Greatsword')!;
  /** A roll with a modifier, as the sheet writes it (`1d8`, `1d8 + 2`, `1d8 - 1`). */
  const plus = (dice: string, mod: number) =>
    mod > 0 ? `${dice} + ${mod}` : mod < 0 ? `${dice} - ${-mod}` : dice;

  it('every mapped key names a loaded feature', () => {
    const missing = Object.keys(RULES_2014_DRUID_FIGHTER).filter(
      (key) => !index.get(parseRefKey(key as RefKey)),
    );
    expect(missing).toEqual([]);
  });

  it('Druid: Wild Shape, Wild Companion and the 2014 circles mapped in 8.3', () => {
    const d2 = build('druid', 2);
    expect(resource(d2, 'Wild Shape')).toMatchObject({ recharge: 'short' });
    expect(resource(d2, 'Wild Shape')?.max.value).toBe(2);
    const shape = d2.toggles.find((t) => t.toggleId === 'wild-shape');
    expect(shape?.onActivate).toEqual([]);
    expect(act(d2, 'Wild Companion')?.costs[0]?.resourceKey).toBe(resource(d2, 'Wild Shape')?.key);
    expect(values(d2.proficiencies.languages)).toContain('druidic');
    expect(resource(build('druid', 20), 'Wild Shape')?.max.value).toBe(2);
    // Spores (8.3) spends this Wild Shape counter.
    const spores = build('druid', 2, 'spores|druid|phb|tce');
    const entity = spores.toggles.find((t) => t.toggleId === 'symbiotic-entity');
    expect(entity?.costs.map((c) => c.resourceKey)).toContain(resource(spores, 'Wild Shape')?.key);
  });

  it('Circle of the Land', () => {
    const land = 'land|druid|phb|phb';
    const l2 = build('druid', 2, land);
    expect(resource(l2, 'Natural Recovery')).toMatchObject({ recharge: 'long' });
    expect(act(l2, 'Natural Recovery')?.outcomes).toEqual([{ regainSlot: { maxLevel: 1 } }]);
    const l10 = build('druid', 10, land);
    expect(act(l10, 'Natural Recovery')?.outcomes).toEqual([{ regainSlot: { maxLevel: 5 } }]);
    expect(values(l10.defenses.immunities)).toContain('poison');
    expect(values(l10.defenses.conditionImmunities)).toContain('poisoned');
    const l14 = build('druid', 14, land);
    expect(act(l14, "Nature's Sanctuary")?.saveDc).toBe(8 + 5 + l14.abilities.wis.mod);
  });

  it('Circle of the Moon', () => {
    const moon = 'moon|druid|phb|phb';
    expect(act(build('druid', 2, moon), 'Combat Wild Shape healing')).toBeUndefined();
    const shaped = build('druid', 2, moon, [['wild-shape']]);
    expect(act(shaped, 'Combat Wild Shape healing')).toMatchObject({
      actionType: 'bonus',
      roll: '1d8',
    });
    const m10 = build('druid', 10, moon);
    expect(act(m10, 'Elemental Wild Shape')?.costs[0]).toMatchObject({
      resourceKey: resource(m10, 'Wild Shape')?.key,
      amount: 2,
    });
  });

  it('Circle of Stars', () => {
    const stars = 'stars|druid|phb|tce';
    const archer = build('druid', 2, stars, [['starry-form', 'archer']]);
    const wis = archer.abilities.wis.mod;
    expect(act(archer, 'Archer')?.roll).toBe(plus('1d8', wis));
    const guiding = archer.spellcasting.granted.find(
      (g) => g.spellId === 'guiding bolt|phb' && g.mode === 'innate',
    );
    expect(guiding).toBeDefined();
    const s6 = build('druid', 6, stars);
    expect(resource(s6, 'Cosmic Omen')?.max.value).toBe(3);
    const chalice = build('druid', 10, stars, [['starry-form', 'chalice']]);
    expect(act(chalice, 'Chalice')?.roll).toBe(plus('2d8', wis));
    expect(build('druid', 9, stars, [['starry-form', 'dragon']]).speed.fly).toBeUndefined();
    const dragon = build('druid', 10, stars, [['starry-form', 'dragon']]);
    expect(dragon.speed.fly?.value).toBe(20);
    expect(dragon.concentration.floor).toBe(10);
    const full = build('druid', 14, stars, [['starry-form', 'archer']]);
    expect(values(full.defenses.resistances)).toEqual(['bludgeoning', 'piercing', 'slashing']);
  });

  it('Fighter: Second Wind, Action Surge, Indomitable and Extra Attack', () => {
    const f1 = build('fighter', 1);
    expect(resource(f1, 'Second Wind')).toMatchObject({ recharge: 'short' });
    expect(resource(f1, 'Second Wind')?.max.value).toBe(1);
    expect(act(f1, 'Second Wind')?.outcomes).toEqual([{ heal: '1d10 + 1' }]);
    expect(resource(build('fighter', 2), 'Action Surge')?.max.value).toBe(1);
    const f9 = build('fighter', 9);
    expect(resource(f9, 'Indomitable')).toMatchObject({ recharge: 'long' });
    expect(resource(f9, 'Indomitable')?.max.value).toBe(1);
    expect(resource(build('fighter', 13), 'Indomitable')?.max.value).toBe(2);
    expect(build('fighter', 4).attacksPerAction.value).toBe(1);
    expect(build('fighter', 5).attacksPerAction.value).toBe(2);
    expect(build('fighter', 11).attacksPerAction.value).toBe(3);
    const f20 = build('fighter', 20);
    expect(f20.attacksPerAction.value).toBe(4);
    expect(resource(f20, 'Action Surge')?.max.value).toBe(2);
    expect(resource(f20, 'Indomitable')?.max.value).toBe(3);
  });

  it('Battle Master', () => {
    const bm = 'battle master|fighter|phb|phb';
    const dice = (s: DerivedSheet) => resource(s, 'Superiority Dice');
    const b3 = build('fighter', 3, bm);
    expect(dice(b3)).toMatchObject({ die: '1d8', recharge: 'short' });
    expect(dice(b3)?.max.value).toBe(4);
    expect(act(b3, 'Maneuver save DC')?.saveDc).toBe(
      8 + 2 + Math.max(b3.abilities.str.mod, b3.abilities.dex.mod),
    );
    expect(b3.proficiencies.tools.length).toBeGreaterThan(0);
    expect(dice(build('fighter', 7, bm))?.max.value).toBe(5);
    expect(dice(build('fighter', 10, bm))?.die).toBe('1d10');
    const b18 = build('fighter', 18, bm);
    expect(dice(b18)).toMatchObject({ die: '1d12' });
    expect(dice(b18)?.max.value).toBe(6);
  });

  it('Champion', () => {
    const champ = 'champion|fighter|phb|phb';
    expect(weapon(build('fighter', 3, champ)).critRange).toBe(19);
    const c7 = build('fighter', 7, champ);
    // Initiative is a Dexterity check: half the Proficiency Bonus (3, rounded down for now).
    expect(c7.initiative.proficiency).toBe('half');
    expect(c7.checks.con.proficiency).toBe('half');
    expect(weapon(build('fighter', 15, champ)).critRange).toBe(18);
    const c18 = build('fighter', 18, champ);
    expect(act(c18, 'Survivor')?.outcomes).toEqual([{ heal: `${5 + c18.abilities.con.mod}` }]);
    expect(c18.deathSave.mode).toBe('normal');
  });

  it('Eldritch Knight', () => {
    const ek = 'eldritch knight|fighter|phb|phb';
    const e3 = build('fighter', 3, ek);
    expect(act(e3, 'Summon bonded weapon')?.actionType).toBe('bonus');
    expect(act(e3, 'War Magic')).toBeUndefined();
    expect(e3.spellcasting.casters.length).toBe(1);
    expect(act(build('fighter', 7, ek), 'War Magic')?.actionType).toBe('bonus');
  });

  it('Purple Dragon Knight', () => {
    const pdk = 'purple dragon knight (banneret)|fighter|phb|scag';
    expect(act(build('fighter', 3, pdk), 'Rallying Cry')?.roll).toBe('3');
    const p7 = build('fighter', 7, pdk);
    expect(p7.skills.persuasion.proficiency).toBe('expertise');
  });

  it('Arcane Archer', () => {
    const aa = 'arcane archer|fighter|phb|xge';
    const a3 = build('fighter', 3, aa);
    expect(resource(a3, 'Arcane Shot')).toMatchObject({ recharge: 'short' });
    expect(resource(a3, 'Arcane Shot')?.max.value).toBe(2);
    expect(act(a3, 'Arcane Shot')?.saveDc).toBe(8 + 2 + a3.abilities.int.mod);
    expect(['arcana', 'nature'].some((k) => a3.skills[k as 'arcana'].proficiency !== 'none')).toBe(
      true,
    );
    expect(act(build('fighter', 7, aa), 'Curving Shot')?.actionType).toBe('bonus');
  });

  it('Psi Warrior: every power, whichever the data asks to pick', () => {
    const psi = 'psi warrior|fighter|phb|tce';
    const dice = (s: DerivedSheet) => resource(s, 'Psionic Energy Dice');
    const p3 = build('fighter', 3, psi);
    const int = p3.abilities.int.mod;
    expect(dice(p3)).toMatchObject({ die: '1d6', recharge: 'long' });
    expect(dice(p3)?.max.value).toBe(4);
    expect(resource(p3, 'Psionic Energy recovery')).toMatchObject({ recharge: 'short' });
    expect(act(p3, 'Protective Field')?.roll).toBe(plus('1d6', int));
    expect(weapon(p3).riders.find((r) => r.id === 'psionic-strike')?.dice).toBe(plus('1d6', int));
    expect(resource(p3, 'Telekinetic Movement')).toMatchObject({ recharge: 'short' });
    const p7 = build('fighter', 7, psi);
    expect(dice(p7)).toMatchObject({ die: '1d8' });
    expect(dice(p7)?.max.value).toBe(6);
    expect(resource(p7, 'Psi-Powered Leap')).toMatchObject({ recharge: 'short' });
    expect(act(p7, 'Telekinetic Thrust')?.saveDc).toBe(8 + 3 + int);
    expect(values(build('fighter', 10, psi).defenses.resistances)).toContain('psychic');
    const p17 = build('fighter', 17, psi);
    expect(dice(p17)).toMatchObject({ die: '1d12' });
    expect(dice(p17)?.max.value).toBe(12);
  });
});
