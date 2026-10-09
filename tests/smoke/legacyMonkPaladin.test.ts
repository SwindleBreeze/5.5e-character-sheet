// Golden checks for the 2014 Monk traditions and Paladin oaths on 2024 characters (plan step
// 8.3): one build per subclass at a level or two, its numbers read the way the mapping gives
// them. Opt-in:
//   FIVETOOLS_DATA=./5etools-src npx vitest run --config vitest.smoke.config.ts tests/smoke/legacyMonkPaladin.test.ts
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

describe.skipIf(!root)('2014 Monk and Paladin subclasses on 2024 characters', () => {
  let index: ContentIndex;
  let catalog: Catalog;
  const registry = featureEffects();

  beforeAll(async () => {
    const result = await importFivetools(nodeFileSource(root!), { now: 1 });
    const all = Object.values(result.entities).flat() as ContentEntity[];
    index = createContentIndex(all);
    const books = result.sources.filter((s) => s.origin !== 'homebrew').map((s) => s.code);
    catalog = createCatalog(all, new Set([...books, SHOW_2014]));
  });

  /** A human soldier quick-built, with these toggles (`id` or `id:option`) switched on. */
  function build(cls: string, levels: number, sub: string, toggles: string[] = []) {
    let c = quickBuild(
      {
        name: 'Golden',
        speciesId: 'human|xphb',
        backgroundId: 'soldier|xphb',
        classes: [{ classId: `${cls}|xphb`, levels, subclassId: `${sub}` }],
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
  const act = (s: DerivedSheet, name: string) => s.actions.find((a) => a.name === name);
  const values = (list: { value: string }[]) => list.map((v) => v.value).sort();
  const kiDc = (s: DerivedSheet, pb: number) => 8 + pb + s.abilities.wis.mod;
  const chaDc = (s: DerivedSheet, pb: number) => 8 + pb + s.abilities.cha.mod;
  const unarmed = (s: DerivedSheet) => s.attacks.find((a) => a.id === 'unarmed')!;

  it('Monk: Way of the Long Death', () => {
    const sub = 'long death|monk|xphb|scag';
    const three = build('monk', 3, sub);
    expect(act(three, 'Touch of Death')?.outcomes).toEqual([
      { tempHp: String(Math.max(1, three.abilities.wis.mod + 3)) },
    ]);
    const seventeen = build('monk', 17, sub);
    expect(act(seventeen, 'Hour of Reaping')?.saveDc).toBe(kiDc(seventeen, 6));
    expect(act(seventeen, 'Mastery of Death')?.costs[0]?.label).toBe('1 Focus Points');
    expect(act(seventeen, 'Touch of the Long Death')).toMatchObject({
      roll: '2d10',
      saveDc: kiDc(seventeen, 6),
    });
  });

  it('Monk: Way of the Drunken Master', () => {
    const sub = 'drunken master|monk|xphb|xge';
    const three = build('monk', 3, sub);
    expect(three.skills.performance.proficiency).toBe('proficient');
    expect(values(three.proficiencies.tools)).toContain("brewer's supplies|xphb");
    expect(act(three, 'Redirect Attack')).toBeUndefined();
    const eleven = build('monk', 11, sub);
    expect(act(eleven, 'Redirect Attack')?.actionType).toBe('reaction');
    expect(act(eleven, "Drunkard's Luck")?.costs[0]?.amount).toBe(2);
  });

  it('Monk: Way of the Kensei', () => {
    const sub = 'kensei|monk|xphb|xge';
    const weapons = (s: DerivedSheet) =>
      s.features.flatMap((f) => f.choices).filter((c) => c.offer.key.slot.startsWith('kensei'));
    const three = build('monk', 3, sub);
    expect(weapons(three).map((c) => c.values.length)).toEqual([1, 1]);
    const tools = values(three.proficiencies.tools);
    expect(
      tools.includes("calligrapher's supplies|xphb") || tools.includes("painter's supplies|xphb"),
    ).toBe(true);
    expect(build('monk', 3, sub, ['agile-parry']).ac.value).toBe(three.ac.value + 2);
    const shortbow = three.attacks.find((a) => a.name === 'Shortbow');
    expect(shortbow?.riders.find((r) => r.name === "Kensei's Shot")?.dice).toBe('1d4');

    const eleven = build('monk', 11, sub, ['sharpen-the-blade-3']);
    expect(weapons(eleven)).toHaveLength(4);
    expect(eleven.toggles.find((t) => t.toggleId === 'sharpen-the-blade-3')?.costs[0]?.amount).toBe(
      3,
    );
    const spear = eleven.attacks.find((a) => a.name === 'Spear');
    expect(spear?.riders.find((r) => r.name === 'Deft Strike')?.dice).toBe('1d10');
    expect(spear?.damageBonus.parts.some((p) => p.label === 'Sharpen the Blade')).toBe(true);
    expect(weapons(build('monk', 17, sub))).toHaveLength(5);
  });

  it('Monk: Way of the Sun Soul', () => {
    const sub = 'sun soul|monk|xphb|xge';
    const three = build('monk', 3, sub);
    const bolt = three.attacks.find((a) => a.name === 'Radiant Sun Bolt');
    expect(bolt).toMatchObject({ damageDice: '1d6', damageType: 'radiant', ability: 'dex' });
    expect(act(three, 'Radiant Sun Bolt (Bonus Action)')?.costs[0]?.amount).toBe(1);
    const eleven = build('monk', 11, sub);
    expect(act(eleven, 'Searing Arc Strike')).toMatchObject({ saveDc: kiDc(eleven, 4) });
    expect(act(eleven, 'Searing Arc Strike')?.costs[0]?.amount).toBe(2);
    expect(act(eleven, 'Searing Sunburst')?.roll).toBe('2d6');
    expect(act(build('monk', 17, sub), 'Sun Shield')?.roll).toBe(
      String(5 + three.abilities.wis.mod),
    );
  });

  it('Monk: Way of the Astral Self', () => {
    const sub = 'astral self|monk|xphb|tce';
    const three = build('monk', 3, sub, ['arms-of-the-astral-self']);
    expect(unarmed(three)).toMatchObject({ damageType: 'force', damageDice: '1d6' });
    expect(act(three, 'Arms of the Astral Self (summoning)')?.roll).toBe('2d6');
    const eleven = build('monk', 11, sub, ['arms-of-the-astral-self', 'visage-of-the-astral-self']);
    expect(eleven.senses.map((x) => x.value)).toContainEqual({ sense: 'darkvision', range: 120 });
    expect(eleven.skills.insight.mode).toBe('advantage');
    expect(act(eleven, 'Deflect Energy')?.roll).toBe(`1d10 + ${eleven.abilities.wis.mod}`);
    expect(unarmed(eleven).riders.find((r) => r.name === 'Empowered Arms')?.dice).toBe('1d10');
    const plain = build('monk', 17, sub);
    const awake = build('monk', 17, sub, ['awakened-astral-self']);
    expect(awake.ac.value).toBe(plain.ac.value + 2);
    expect(awake.toggles.find((t) => t.toggleId === 'awakened-astral-self')).toMatchObject({
      onActivate: [
        { toggleOn: 'arms-of-the-astral-self' },
        { toggleOn: 'visage-of-the-astral-self' },
      ],
    });
    expect(awake.toggles.find((t) => t.toggleId === 'awakened-astral-self')?.costs[0]?.amount).toBe(
      5,
    );
  });

  it('Monk: Way of the Ascendant Dragon', () => {
    const sub = 'ascendant dragon|monk|xphb|ftd';
    const three = build('monk', 3, sub);
    expect(resource(three, 'Breath of the Dragon')?.max.value).toBe(2);
    expect(resource(three, 'Breath of the Dragon')?.restoreWith).toEqual([
      { amount: '1', costs: ['2 Focus Points'] },
    ]);
    expect(act(three, 'Breath of the Dragon')).toMatchObject({
      roll: '2d6',
      saveDc: kiDc(three, 2),
    });
    expect(resource(three, 'Draconic Presence')?.max.value).toBe(1);
    const eleven = build('monk', 11, sub, ['wings-unfurled', 'aspect-of-the-wyrm:fire']);
    expect(act(eleven, 'Breath of the Dragon')?.roll).toBe('3d10');
    expect(eleven.speed.fly?.value).toBe(eleven.speed.walk?.value);
    expect(values(eleven.defenses.resistances)).toEqual(['fire']);
    const seventeen = build('monk', 17, sub);
    expect(act(seventeen, 'Augment Breath')?.roll).toBe('4d12');
    expect(seventeen.senses.map((x) => x.value)).toContainEqual({ sense: 'blindsight', range: 10 });
  });

  it('Paladin: Oathbreaker', () => {
    const sub = 'oathbreaker|paladin|xphb|dmg';
    const three = build('paladin', 3, sub);
    expect(act(three, 'Control Undead')?.saveDc).toBe(chaDc(three, 2));
    expect(act(three, 'Dreadful Aspect')?.costs[0]?.label).toBe('1 Channel Divinity');
    expect(three.spellcasting.casters[0]!.alwaysPrepared).toEqual(
      expect.arrayContaining(['hellish rebuke|phb', 'inflict wounds|phb']),
    );
    const seven = build('paladin', 7, sub);
    const melee = seven.attacks.find((a) => a.range === 'melee' && a.kind === 'weapon');
    expect(melee?.damageBonus.parts.find((p) => p.label === 'Aura of Hate')?.value).toBe(
      Math.max(1, seven.abilities.cha.mod),
    );
    const twenty = build('paladin', 20, sub, ['dread-lord']);
    expect(act(twenty, 'Dread Lord: Shadow Attack')?.roll).toBe(
      `3d10 + ${twenty.abilities.cha.mod}`,
    );
  });

  it('Paladin: Oath of the Crown', () => {
    const sub = 'crown|paladin|xphb|scag';
    const three = build('paladin', 3, sub);
    expect(act(three, 'Champion Challenge')?.saveDc).toBe(chaDc(three, 2));
    expect(act(three, 'Turn the Tide')?.roll).toBe(`1d6 + ${Math.max(1, three.abilities.cha.mod)}`);
    const twenty = build('paladin', 20, sub, ['exalted-champion']);
    expect(values(twenty.defenses.resistances)).toEqual(['bludgeoning', 'piercing', 'slashing']);
    expect(twenty.saves.wis.mode).toBe('advantage');
    expect(resource(twenty, 'Exalted Champion')?.max.value).toBe(1);
  });

  it('Paladin: Oath of Conquest', () => {
    const sub = 'conquest|paladin|xphb|xge';
    const three = build('paladin', 3, sub);
    expect(act(three, 'Guided Strike')?.roll).toBe('10');
    expect(act(three, 'Conquering Presence')?.saveDc).toBe(chaDc(three, 2));
    expect(act(build('paladin', 7, sub), 'Aura of Conquest')?.roll).toBe('3');
    const twenty = build('paladin', 20, sub, ['invincible-conqueror']);
    expect(act(twenty, 'Aura of Conquest')?.roll).toBe('10');
    expect(twenty.defenses.resistances).toHaveLength(13);
    const melee = twenty.attacks.find((a) => a.range === 'melee' && a.kind === 'weapon');
    expect(melee?.critRange).toBe(19);
  });

  it('Paladin: Oath of Redemption', () => {
    const sub = 'redemption|paladin|xphb|xge';
    const plain = build('paladin', 3, sub);
    const three = build('paladin', 3, sub, ['emissary-of-peace']);
    expect(three.skills.persuasion.bonus.value).toBe(plain.skills.persuasion.bonus.value + 5);
    expect(act(three, 'Rebuke the Violent')?.saveDc).toBe(chaDc(three, 2));
    expect(act(build('paladin', 15, sub), 'Protective Spirit')?.outcomes).toEqual([
      { heal: '1d6 + 7' },
    ]);
    expect(build('paladin', 20, sub).defenses.resistances).toHaveLength(13);
  });

  it('Paladin: Oath of the Watchers', () => {
    const sub = 'watchers|paladin|xphb|tce';
    const three = build('paladin', 3, sub, ['watchers-will']);
    expect(three.saves.int.mode).toBe('advantage');
    expect(act(three, 'Abjure the Extraplanar')?.saveDc).toBe(chaDc(three, 2));
    const plain = build('paladin', 6, sub);
    const seven = build('paladin', 7, sub);
    expect(seven.initiative.bonus.value).toBe(plain.initiative.bonus.value + 3);
    const twenty = build('paladin', 20, sub, ['mortal-bulwark']);
    expect(twenty.senses.map((x) => x.value)).toContainEqual({ sense: 'truesight', range: 120 });
    expect(resource(twenty, 'Mortal Bulwark')?.restoreWith).toEqual([
      { amount: '1', costs: ['a level 5+ spell slot'] },
    ]);
  });
});
