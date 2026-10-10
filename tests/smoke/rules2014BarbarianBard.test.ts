// Golden checks for the 2014 Barbarian and Bard on 2014 rules (plan step 8.6): the class
// features and the subclasses a 2024 book reprints, built at a few levels with every book on and
// the 2014 originals preferred, their numbers read the way the mapping gives them. Opt-in:
//   FIVETOOLS_DATA=./5etools-src npx vitest run --config vitest.smoke.config.ts tests/smoke/rules2014BarbarianBard.test.ts
// Checks numbers and names only; it never prints or stores content.

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
import { PREFER_2014, SHOW_2014 } from '../../src/sources/sourceFilter.ts';
import { nodeFileSource } from './nodeFileSource.ts';

const root = process.env.FIVETOOLS_DATA;

describe.skipIf(!root)('the 2014 Barbarian and Bard on 2014 rules', () => {
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

  const sheetOf = (c: Character) => derive(c, index, { registry });
  /** A half-orc soldier of a 2014 class (and subclass) on 2014 rules. */
  function character(cls: string, levels: number, subclassId?: string): Character {
    return quickBuild(
      {
        name: 'Golden',
        speciesId: 'half-orc|phb',
        backgroundId: 'soldier|phb',
        classes: [{ classId: `${cls}|phb`, levels, ...(subclassId ? { subclassId } : {}) }],
        ruleset: '2014',
      },
      { index, catalog, registry, now: 1 },
    );
  }
  /** Switch these toggles on (`id` or `id:option`). */
  function withToggles(c: Character, toggles: string[], settled = true): DerivedSheet {
    let s = sheetOf(c);
    for (const t of toggles) {
      const [id, option] = t.split(':');
      c = toggle(c, s, id!, true, { free: true, ...(option ? { option } : {}) });
      s = sheetOf(c);
    }
    if (settled) expect(s.choices.pending).toEqual([]);
    return s;
  }
  const build = (cls: string, levels: number, subclassId?: string, toggles: string[] = []) =>
    withToggles(character(cls, levels, subclassId), toggles);
  /** Re-pick the subclass-feature option `from` as `to` instead. */
  function repick(c: Character, from: string, to: string): Character {
    const pick = sheetOf(c)
      .features.flatMap((f) => f.choices)
      .find((x) => x.values.includes(from))!;
    return setPick(c, decodeChoiceKey(pick.key), {
      values: [to],
      labels: [],
      valueKinds: ['subclassFeature'],
      entryIndex: pick.entryIndex,
    });
  }
  const resource = (s: DerivedSheet, name: string) => s.resources.find((r) => r.name === name);
  const act = (s: DerivedSheet, name: string) => s.actions.find((a) => a.name === name);
  const values = (list: { value: string }[]) => list.map((v) => v.value).sort();
  /** The Rage bonus on the first melee and first ranged attack. */
  const rageBonus = (s: DerivedSheet, range: 'melee' | 'ranged') =>
    s.attacks
      .find((a) => a.range === range && a.ability === 'str')
      ?.damageBonus.parts.find((p) => p.label === 'Rage')?.value;

  it('Barbarian: Rage, by the 2014 table', () => {
    const one = build('barbarian', 1);
    expect(resource(one, 'Rage')).toMatchObject({ recharge: 'long' });
    expect(resource(one, 'Rage')?.max.value).toBe(2);
    expect(resource(build('barbarian', 3), 'Rage')?.max.value).toBe(3);
    expect(resource(build('barbarian', 12), 'Rage')?.max.value).toBe(5);
    expect(resource(build('barbarian', 19), 'Rage')?.max.value).toBe(6);
    const raging = build('barbarian', 1, undefined, ['rage']);
    expect(values(raging.defenses.resistances)).toEqual(['bludgeoning', 'piercing', 'slashing']);
    expect(raging.saves.str.advantage.length).toBe(1);
    expect(rageBonus(raging, 'melee')).toBe(2);
    expect(rageBonus(build('barbarian', 9, undefined, ['rage']), 'melee')).toBe(3);
    expect(rageBonus(build('barbarian', 16, undefined, ['rage']), 'melee')).toBe(4);
    // Level 20: unlimited, so no counter, and the switch costs only the bonus action.
    const twenty = build('barbarian', 20);
    expect(resource(twenty, 'Rage')).toBeUndefined();
    expect(twenty.toggles.find((t) => t.toggleId === 'rage')?.costs.length).toBe(1);
    const raging20 = build('barbarian', 20, undefined, ['rage']);
    expect(values(raging20.defenses.resistances)).toEqual(['bludgeoning', 'piercing', 'slashing']);
  });

  it('Barbarian: the other class features', () => {
    const one = build('barbarian', 1);
    // Unarmored Defense: no armor in the starting gear.
    const { dex, con } = one.abilities;
    expect(one.ac.calculation).toContain('Unarmored Defense');
    expect(one.ac.value).toBeGreaterThanOrEqual(10 + dex.mod + con.mod);
    const two = build('barbarian', 2);
    expect(two.saves.dex.situational?.map((x) => x.against)).toEqual(['effects you can see']);
    expect(two.saves.dex.advantage).toEqual([]);
    const reckless = build('barbarian', 2, undefined, ['reckless-attack']);
    expect(reckless.defenses.attacked.map((a) => a.mode)).toEqual(['advantage']);
    const five = build('barbarian', 5);
    expect(five.attacksPerAction.value).toBe(2);
    expect(five.speed.walk?.value).toBe(40);
    expect(build('barbarian', 7).initiative.advantage.length).toBe(1);
    // Primal Champion: +4 Strength and Constitution, up to 24.
    const nineteen = build('barbarian', 19).abilities;
    const twenty = build('barbarian', 20).abilities;
    for (const a of ['str', 'con'] as const)
      expect(twenty[a].score.value).toBe(Math.min(24, nineteen[a].score.value + 4));
  });

  it('Barbarian: Path of the Berserker', () => {
    const sub = 'berserker|barbarian|phb|phb';
    expect(act(build('barbarian', 3, sub, ['rage', 'frenzy']), 'Frenzy Attack')?.actionType).toBe(
      'bonus',
    );
    expect(act(build('barbarian', 3, sub, ['rage']), 'Frenzy Attack')).toBeUndefined();
    const six = build('barbarian', 6, sub, ['rage']);
    expect(values(six.defenses.conditionImmunities)).toEqual(['charmed', 'frightened']);
    const ten = build('barbarian', 10, sub);
    expect(act(ten, 'Intimidating Presence')).toMatchObject({
      actionType: 'action',
      saveDc: 8 + 4 + ten.abilities.cha.mod,
    });
    expect(resource(ten, 'Intimidating Presence')).toBeUndefined();
  });

  it('Barbarian: Path of the Totem Warrior', () => {
    const sub = 'totem warrior|barbarian|phb|phb';
    // The quick-builder picks the Bear each time.
    const bear = build('barbarian', 3, sub, ['rage']);
    expect(bear.defenses.resistances.length).toBe(12);
    expect(values(bear.defenses.resistances)).not.toContain('psychic');
    expect(build('barbarian', 6, sub).inventory.carrySize).toBe('L');

    const opt = (name: string, level: number, src = 'phb') =>
      `${name}|barbarian|phb|totem warrior|phb|${level}|${src}`;
    let c = character('barbarian', 14, sub);
    c = repick(c, opt('bear', 3), opt('elk', 3, 'scag'));
    c = repick(c, opt('bear', 6), opt('tiger', 6, 'scag'));
    c = repick(c, opt('bear', 14), opt('eagle', 14));
    const calm = withToggles(c, [], false);
    expect(calm.speed.fly).toBeUndefined();
    // The Tiger's two skills are offered as a new pick.
    expect(calm.choices.pending.map((p) => p.count)).toEqual([2]);
    const s = withToggles(c, ['rage'], false);
    expect(s.speed.walk?.value).toBe(calm.speed.walk!.value + 15);
    expect(s.speed.fly?.value).toBe(s.speed.walk?.value);
  });

  it('Barbarian: Path of the Zealot', () => {
    const sub = 'zealot|barbarian|phb|xge';
    const fury = (level: number) =>
      build('barbarian', level, sub, ['rage']).attacks[0]?.riders.find(
        (r) => r.id === 'divine-fury',
      );
    // The quick-builder picks Necrotic.
    expect(fury(3)).toMatchObject({ dice: '1d6 + 1', damageType: 'necrotic' });
    expect(fury(10)?.dice).toBe('1d6 + 5');
    expect(build('barbarian', 3, sub).attacks[0]?.riders.find((r) => r.id === 'divine-fury')).toBe(
      undefined,
    );
    const ten = build('barbarian', 10, sub);
    expect(resource(ten, 'Zealous Presence')).toMatchObject({ recharge: 'long' });
    expect(act(ten, 'Zealous Presence')?.actionType).toBe('bonus');
  });

  it('Bard: Bardic Inspiration, by Bard level', () => {
    const insp = (level: number) => resource(build('bard', level), 'Bardic Inspiration');
    const one = build('bard', 1);
    expect(insp(1)).toMatchObject({ die: '1d6', recharge: 'long' });
    expect(insp(1)?.max.value).toBe(Math.max(1, one.abilities.cha.mod));
    expect(insp(5)).toMatchObject({ die: '1d8', recharge: 'short' });
    expect(insp(5)?.restoreWith).toEqual([]);
    expect(insp(10)?.die).toBe('1d10');
    expect(insp(15)?.die).toBe('1d12');
  });

  it('Bard: the other class features', () => {
    const two = build('bard', 2);
    // Jack of All Trades: half of +2 on Initiative and on plain checks too.
    expect(two.initiative.proficiency).toBe('half');
    expect(two.checks.str.proficiency).toBe('half');
    expect(act(two, 'Song of Rest')?.roll).toBe('1d6');
    expect(act(build('bard', 9), 'Song of Rest')?.roll).toBe('1d8');
    expect(act(build('bard', 17), 'Song of Rest')?.roll).toBe('1d12');
    const expert = (level: number) =>
      Object.values(build('bard', level).skills).filter((k) => k.proficiency === 'expertise')
        .length;
    expect(expert(3)).toBe(2);
    expect(expert(10)).toBe(4);
    expect(act(build('bard', 6), 'Countercharm')?.actionType).toBe('action');
  });

  it('Bard: College of Lore and College of Valor', () => {
    const lore = 'lore|bard|phb|phb';
    const three = build('bard', 3, lore);
    expect(act(three, 'Cutting Words')).toMatchObject({ actionType: 'reaction', roll: '1d6' });
    expect(act(build('bard', 14, lore), 'Peerless Skill')?.roll).toBe('1d10');
    const valor = 'valor|bard|phb|phb';
    const v3 = build('bard', 3, valor);
    expect(values(v3.proficiencies.armor)).toEqual(expect.arrayContaining(['medium', 'shield']));
    expect(values(v3.proficiencies.weapons)).toContain('martial');
    expect(v3.attacksPerAction.value).toBe(1);
    expect(build('bard', 6, valor).attacksPerAction.value).toBe(2);
  });

  it('Bard: College of Glamour', () => {
    const sub = 'glamour|bard|phb|xge';
    const three = build('bard', 3, sub);
    expect(act(three, 'Mantle of Inspiration')).toMatchObject({ actionType: 'bonus', roll: '5' });
    expect(act(build('bard', 5, sub), 'Mantle of Inspiration')?.roll).toBe('8');
    expect(act(build('bard', 15, sub), 'Mantle of Inspiration')?.roll).toBe('14');
    expect(resource(three, 'Enthralling Performance')).toMatchObject({ recharge: 'short' });
    expect(act(three, 'Enthralling Performance')?.saveDc).toBe(8 + 2 + three.abilities.cha.mod);
    const six = build('bard', 6, sub);
    expect(resource(six, 'Mantle of Majesty')).toMatchObject({ recharge: 'long' });
    expect(resource(six, 'Mantle of Majesty')?.restoreWith).toEqual([]);
    expect(resource(build('bard', 14, sub), 'Unbreakable Majesty')).toMatchObject({
      recharge: 'short',
    });
  });

  it('Bard: College of Spirits', () => {
    const sub = 'spirits|bard|phb|vrgr';
    const three = build('bard', 3, sub);
    expect(act(three, 'Tales from Beyond')).toMatchObject({
      actionType: 'bonus',
      roll: '1d6',
      saveDc: 8 + 2 + three.abilities.cha.mod,
    });
    expect(act(build('bard', 10, sub), 'Tales from Beyond')?.roll).toBe('1d10');
    expect(resource(build('bard', 6, sub), 'Spirit Session')).toMatchObject({ recharge: 'long' });
  });
});
