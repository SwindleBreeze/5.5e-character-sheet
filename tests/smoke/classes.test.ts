// Golden checks per class on real data (plan §10.2, steps 6.3–6.14 and 6.17): one build per
// subclass at a few levels, its numbers read the way the 2024 rules give them. Opt-in:
//   FIVETOOLS_DATA=./5etools-src-2.36.1 npm run test:smoke
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
import { decodeChoiceKey } from '../../src/schema/index.ts';
import type { ContentEntity } from '../../src/schema/index.ts';
import { nodeFileSource } from './nodeFileSource.ts';

const root = process.env.FIVETOOLS_DATA;

describe.skipIf(!root)('class golden checks (local data)', () => {
  let index: ContentIndex;
  let catalog: Catalog;

  beforeAll(async () => {
    const result = await importFivetools(nodeFileSource(root!), { now: 1 });
    const all = Object.values(result.entities).flat() as ContentEntity[];
    index = createContentIndex(all);
    catalog = createCatalog(all, new Set(['XPHB']));
  });

  /** A human soldier of one class, quick-built, with these toggles switched on. */
  function build(cls: string, levels: number, sub?: string, toggles: string[] = []): DerivedSheet {
    const registry = featureEffects();
    const classId = `${cls}|xphb`;
    let c = quickBuild(
      {
        name: 'Golden',
        speciesId: 'human|xphb',
        backgroundId: 'soldier|xphb',
        classes: [{ classId, levels, ...(sub ? { subclassId: `${sub}|${cls}|xphb|xphb` } : {}) }],
      },
      { index, catalog, registry, now: 1 },
    );
    let s = derive(c, index, { registry });
    for (const t of toggles) {
      c = toggle(c, s, t, true, { free: true });
      s = derive(c, index, { registry });
    }
    expect(s.choices.pending).toEqual([]);
    return s;
  }
  const resource = (s: DerivedSheet, name: string) => s.resources.find((r) => r.name === name);
  const attack = (s: DerivedSheet, name: string) => s.attacks.find((a) => a.name === name)!;
  const values = (list: { value: string }[]) => list.map((v) => v.value).sort();

  it('Barbarian: Rage, Unarmored Defense, Extra Attack and the four paths', () => {
    const one = build('barbarian', 1, undefined, ['rage']);
    expect(resource(one, 'Rage')?.max.value).toBe(2);
    // Strength 17 at level 1: +3, and +2 Rage damage.
    expect(attack(one, 'Greataxe').damageBonus.value).toBe(5);
    expect(values(one.defenses.resistances)).toEqual(['bludgeoning', 'piercing', 'slashing']);
    expect(one.saves.str.mode).toBe('advantage');
    // 10 + Dexterity + Constitution, no armor.
    expect(one.ac.value).toBe(10 + one.abilities.dex.mod + one.abilities.con.mod);

    const five = build('barbarian', 5);
    expect(five.attacksPerAction.value).toBe(2);
    expect(five.speed.walk?.value).toBe(40);
    expect(five.saves.dex.mode).toBe('advantage');

    const berserker = build('barbarian', 11, 'berserker', ['rage', 'reckless-attack']);
    expect(resource(berserker, 'Rage')?.max.value).toBe(4);
    expect(berserker.initiative.mode).toBe('advantage');
    expect(values(berserker.defenses.conditionImmunities)).toEqual(['charmed', 'frightened']);
    expect(attack(berserker, 'Greataxe').riders.find((r) => r.name === 'Frenzy')?.dice).toBe('3d6');

    const zealot = build('barbarian', 3, 'zealot', ['rage']);
    expect(resource(zealot, 'Warrior of the Gods')).toMatchObject({ die: '1d12' });
    expect(resource(zealot, 'Warrior of the Gods')?.max.value).toBe(4);
    expect(attack(zealot, 'Greataxe').riders.find((r) => r.id === 'divine-fury')?.dice).toBe(
      '1d6 + 1',
    );

    const twenty = build('barbarian', 20, 'zealot');
    expect(resource(twenty, 'Rage')?.max.value).toBe(6);
    expect(resource(twenty, 'Warrior of the Gods')?.max.value).toBe(7);
    expect(twenty.abilities.str.score.value).toBeGreaterThanOrEqual(21);
  });

  it('Bard: Bardic Inspiration, Jack of All Trades and the four colleges', () => {
    const one = build('bard', 1);
    expect(resource(one, 'Bardic Inspiration')).toMatchObject({ die: '1d6', recharge: 'long' });
    expect(resource(one, 'Bardic Inspiration')?.max.value).toBe(Math.max(1, one.abilities.cha.mod));

    const five = build('bard', 5);
    expect(resource(five, 'Bardic Inspiration')).toMatchObject({ die: '1d8', recharge: 'short' });
    // Half proficiency (round down) on a skill the Bard isn't proficient in.
    const [skill, roll] = Object.entries(five.skills).find(([, v]) => v.proficiency === 'half')!;
    expect(roll.bonus.value, skill).toBe(five.abilities[roll.ability].mod + 1);

    const lore = build('bard', 6, 'lore');
    expect(
      Object.values(lore.skills).filter(
        (v) => v.proficiency === 'proficient' || v.proficiency === 'expertise',
      ).length,
    ).toBeGreaterThanOrEqual(
      Object.values(five.skills).filter(
        (v) => v.proficiency === 'proficient' || v.proficiency === 'expertise',
      ).length + 3,
    );
    // Magical Discoveries: two spells picked through the college's own data.
    const discoveries = lore.features
      .find((f) => f.name === 'College of Lore')!
      .choices.flatMap((c) => c.values);
    expect(discoveries).toHaveLength(2);
    for (const id of discoveries)
      expect(index.get({ kind: 'spell', id })!.level).toBeLessThanOrEqual(3);

    expect(build('bard', 6, 'valor').attacksPerAction.value).toBe(2);
    const twenty = build('bard', 20, 'glamour');
    expect(resource(twenty, 'Bardic Inspiration')?.die).toBe('1d12');
    expect(resource(twenty, 'Mantle of Majesty')?.max.value).toBe(1);
  });

  it('Cleric: Channel Divinity and its actions, Blessed Strikes and the four domains', () => {
    const two = build('cleric', 2);
    expect(resource(two, 'Channel Divinity')).toMatchObject({ recharge: 'shortOne' });
    expect(resource(two, 'Channel Divinity')?.max.value).toBe(2);
    const spark = (s: DerivedSheet) => s.actions.find((a) => a.name === 'Divine Spark')!;
    expect(spark(two).roll).toBe(`1d8 + ${two.abilities.wis.mod}`);
    expect(spark(two).saveDc).toBe(8 + two.abilities.wis.mod + 2);
    // One action per feature, not one more for spending Channel Divinity.
    expect(two.actions.filter((a) => a.name === 'Turn Undead')).toHaveLength(1);
    // Divine Order: Protector, the first option.
    expect(values(two.proficiencies.armor)).toContain('heavy');

    const seven = build('cleric', 7, 'light');
    expect(spark(seven).roll).toBe(`2d8 + ${seven.abilities.wis.mod}`);
    expect(resource(seven, 'Channel Divinity')?.max.value).toBe(3);
    expect(resource(seven, 'Warding Flare')?.recharge).toBe('short');
    const strike = (s: DerivedSheet) =>
      s.attacks.flatMap((a) => a.riders).find((r) => r.id === 'divine-strike')?.dice;
    expect(strike(seven)).toBe('1d8');

    const war = build('cleric', 17, 'war');
    expect(strike(war)).toBe('2d8');
    expect(values(war.defenses.resistances)).toEqual(['bludgeoning', 'piercing', 'slashing']);
    expect(resource(war, 'War Priest')?.recharge).toBe('short');
    expect(resource(build('cleric', 18, 'life'), 'Channel Divinity')?.max.value).toBe(4);
  });

  it('Druid: Wild Shape and the circles that hang off it', () => {
    const two = build('druid', 2);
    expect(resource(two, 'Wild Shape')).toMatchObject({ recharge: 'shortOne' });
    expect(resource(two, 'Wild Shape')?.max.value).toBe(2);
    expect(resource(build('druid', 6, 'land'), 'Wild Shape')?.max.value).toBe(3);
    expect(resource(build('druid', 17, 'land'), 'Wild Shape')?.max.value).toBe(4);

    const plain = build('druid', 6, 'moon');
    const shaped = build('druid', 6, 'moon', ['wild-shape']);
    // Improved Circle Forms: Wisdom added to Constitution saves while in a form.
    expect(shaped.saves.con.bonus.value).toBe(
      plain.saves.con.bonus.value + plain.abilities.wis.mod,
    );

    const sea = build('druid', 10, 'sea', ['wrath-of-the-sea']);
    expect(sea.speed.swim?.value).toBe(sea.speed.walk?.value);
    expect(sea.speed.fly?.value).toBe(sea.speed.walk?.value);
    expect(values(sea.defenses.resistances)).toEqual(['cold', 'lightning', 'thunder']);

    const stars = build('druid', 14, 'stars', ['starry-form']);
    expect(values(stars.defenses.resistances)).toEqual(['bludgeoning', 'piercing', 'slashing']);
    // Spends Wild Shape through its switch, not through a second action too.
    expect(stars.actions.filter((a) => a.name === 'Starry Form')).toEqual([]);
  });

  it('Fighter: Second Wind, Action Surge, Indomitable, attacks and the four subclasses', () => {
    const one = build('fighter', 1);
    expect(resource(one, 'Second Wind')?.max.value).toBe(2);
    expect(one.actions.find((a) => a.name === 'Second Wind')?.outcomes).toEqual([
      { heal: '1d10 + 1' },
    ]);
    expect(build('fighter', 5).attacksPerAction.value).toBe(2);
    expect(build('fighter', 11).attacksPerAction.value).toBe(3);

    const twenty = build('fighter', 20, 'champion');
    expect(twenty.attacksPerAction.value).toBe(4);
    expect(resource(twenty, 'Action Surge')?.max.value).toBe(2);
    expect(resource(twenty, 'Indomitable')?.max.value).toBe(3);
    expect(attack(twenty, 'Greatsword').critRange).toBe(18);
    expect(twenty.deathSave.mode).toBe('advantage');
    expect(build('fighter', 3, 'champion').initiative.mode).toBe('advantage');

    const master = build('fighter', 10, 'battle master');
    expect(resource(master, 'Superiority Dice')).toMatchObject({ die: '1d10', recharge: 'short' });
    expect(resource(master, 'Superiority Dice')?.max.value).toBe(5);
    // Maneuvers spend from it.
    const maneuver = master.actions.find((a) => a.name === 'Ambush')!;
    expect(maneuver.costs[0]?.resourceKey).toBe(resource(master, 'Superiority Dice')?.key);

    const psi = build('fighter', 11, 'psi warrior');
    expect(resource(psi, 'Psionic Energy Dice')).toMatchObject({
      die: '1d10',
      recharge: 'shortOne',
    });
    expect(resource(psi, 'Psionic Energy Dice')?.max.value).toBe(8);
    expect(psi.actions.filter((a) => a.name === 'Psionic Strike')).toEqual([]);
    expect(attack(psi, 'Greatsword').riders.find((r) => r.id === 'psionic-strike')?.dice).toBe(
      `1d10 + ${psi.abilities.int.mod}`,
    );
  });

  it('Monk: Martial Arts, Focus Points, Unarmored Defense and Movement, the four subclasses', () => {
    const unarmed = (s: DerivedSheet) => attack(s, 'Unarmed Strike');
    const one = build('monk', 1);
    expect(one.ac.value).toBe(10 + one.abilities.dex.mod + one.abilities.wis.mod);
    expect(unarmed(one).damageDice).toBe('1d6');
    expect(unarmed(one).ability).toBe('dex');

    const five = build('monk', 5, 'open hand');
    expect(resource(five, 'Focus Points')).toMatchObject({ recharge: 'short' });
    expect(resource(five, 'Focus Points')?.max.value).toBe(5);
    expect(unarmed(five).damageDice).toBe('1d8');
    expect(five.speed.walk?.value).toBe(40);
    expect(five.attacksPerAction.value).toBe(2);
    expect(five.actions.find((a) => a.name === 'Stunning Strike')?.saveDc).toBe(
      8 + five.abilities.wis.mod + 3,
    );
    // Flurry of Blows: one action, paid with a Focus Point.
    const flurry = five.actions.filter((a) => a.name === 'Flurry of Blows');
    expect(flurry).toHaveLength(1);
    expect(flurry[0]!.costs[0]?.resourceKey).toBe(resource(five, 'Focus Points')?.key);

    const elements = build('monk', 11, 'elements', ['elemental-attunement']);
    expect(elements.speed.fly?.value).toBe(elements.speed.walk?.value);
    expect(unarmed(elements).damageDice).toBe('1d10');

    const twenty = build('monk', 20, 'mercy');
    expect(twenty.speed.walk?.value).toBe(60);
    expect(Object.values(twenty.saves).every((r) => r.proficiency !== 'none')).toBe(true);
    expect(unarmed(twenty).riders.find((r) => r.id === 'hand-of-harm')?.dice).toBe(
      `1d12 + ${twenty.abilities.wis.mod}`,
    );
  });

  it('Paladin: Lay on Hands, Channel Divinity, Aura of Protection, Radiant Strikes, the four oaths', () => {
    const one = build('paladin', 1);
    expect(resource(one, 'Lay on Hands')).toMatchObject({ pool: true, recharge: 'long' });
    expect(resource(one, 'Lay on Hands')?.max.value).toBe(5);

    const six = build('paladin', 6, 'glory');
    const five = build('paladin', 5, 'glory');
    // Aura of Protection: the Charisma modifier (at least +1) on every save.
    expect(six.saves.wis.bonus.value).toBe(
      five.saves.wis.bonus.value + Math.max(1, six.abilities.cha.mod),
    );
    expect(resource(six, 'Channel Divinity')?.max.value).toBe(2);
    expect(build('paladin', 7, 'glory').speed.walk?.value).toBe(40);

    const plain = build('paladin', 3, 'devotion');
    const sacred = build('paladin', 3, 'devotion', ['sacred-weapon']);
    expect(attack(sacred, 'Longsword').toHit!.bonus.value).toBe(
      attack(plain, 'Longsword').toHit!.bonus.value + Math.max(1, plain.abilities.cha.mod),
    );

    const eleven = build('paladin', 11, 'ancients');
    expect(resource(eleven, 'Channel Divinity')?.max.value).toBe(3);
    expect(attack(eleven, 'Longsword').riders.find((r) => r.id === 'radiant-strikes')?.dice).toBe(
      '1d8',
    );
    expect(values(eleven.defenses.resistances)).toEqual(['necrotic', 'psychic', 'radiant']);
    expect(values(eleven.defenses.conditionImmunities)).toEqual(['frightened']);
  });

  it("Ranger: Favored Enemy's free casts, Roving, Tireless and the four subclasses", () => {
    const mark = (s: DerivedSheet) =>
      s.spellcasting.granted.find((g) => g.spellId === "hunter's mark|xphb" && g.usesMax)?.usesMax;
    expect(mark(build('ranger', 1))).toBe(2);
    expect(mark(build('ranger', 9, 'hunter'))).toBe(4);

    const six = build('ranger', 6, 'hunter');
    expect(six.speed.walk?.value).toBe(40);
    expect(six.speed.climb?.value).toBe(40);
    expect(six.speed.swim?.value).toBe(40);

    const gloom = build('ranger', 11, 'gloom stalker');
    const three = build('ranger', 3, 'gloom stalker');
    expect(three.initiative.bonus.value).toBe(three.abilities.dex.mod + three.abilities.wis.mod);
    expect(resource(gloom, 'Dreadful Strike')?.max.value).toBe(
      Math.max(1, gloom.abilities.wis.mod),
    );
    expect(attack(gloom, 'Scimitar').riders.find((r) => r.id === 'dreadful-strike')?.dice).toBe(
      '2d8',
    );
    expect(gloom.saves.wis.proficiency).toBe('proficient');

    const fey = build('ranger', 3, 'fey wanderer');
    expect(attack(fey, 'Scimitar').riders.find((r) => r.id === 'dreadful-strikes')?.dice).toBe(
      '1d4',
    );
    expect(resource(build('ranger', 18, 'hunter'), 'Tireless')?.max.value).toBeGreaterThanOrEqual(
      1,
    );
    expect(build('ranger', 18, 'hunter').senses.map((x) => x.value.sense)).toContain('blindsight');
  });

  it('Rogue: Sneak Attack, Reliable Talent, Cunning Strike and the four subclasses', () => {
    const sneak = (s: DerivedSheet, name: string) =>
      attack(s, name).riders.find((r) => r.id === 'sneak-attack')?.dice;
    const one = build('rogue', 1);
    // A Finesse weapon or a Ranged one, not others.
    expect(sneak(one, 'Dagger')).toBe('1d6');
    const ranged = one.attacks.find((a) => a.range === 'ranged' && a.kind === 'weapon');
    if (ranged) expect(sneak(one, ranged.name)).toBe('1d6');
    expect(sneak(one, 'Unarmed Strike')).toBeUndefined();

    const seven = build('rogue', 7, 'thief');
    expect(sneak(seven, 'Dagger')).toBe('4d6');
    const proficient = Object.values(seven.skills).find((v) => v.proficiency === 'proficient')!;
    const untrained = Object.values(seven.skills).find((v) => v.proficiency === 'none')!;
    expect(proficient.floor).toBe(10);
    expect(untrained.floor).toBeUndefined();
    expect(seven.speed.climb?.value).toBe(seven.speed.walk?.value);
    expect(seven.actions.find((a) => a.name === 'Cunning Strike')?.saveDc).toBe(
      8 + seven.abilities.dex.mod + 3,
    );

    const soulknife = build('rogue', 5, 'soulknife');
    const blade = attack(soulknife, 'Psychic Blade');
    expect(blade).toMatchObject({ damageDice: '1d6', damageType: 'psychic', ability: 'dex' });
    expect(sneak(soulknife, 'Psychic Blade')).toBe('3d6');
    expect(resource(soulknife, 'Psionic Energy Dice')).toMatchObject({ die: '1d8' });

    const fifteen = build('rogue', 15, 'assassin');
    expect(fifteen.saves.wis.proficiency).toBe('proficient');
    expect(fifteen.saves.cha.proficiency).toBe('proficient');
    expect(fifteen.initiative.mode).toBe('advantage');
  });

  it('Sorcerer: Innate Sorcery, Sorcery Points, Sorcerous Restoration and the four subclasses', () => {
    const caster = (s: DerivedSheet) => s.spellcasting.casters.find((c) => c.name === 'Sorcerer')!;
    const plain = build('sorcerer', 2);
    const innate = build('sorcerer', 2, undefined, ['innate-sorcery']);
    expect(resource(plain, 'Innate Sorcery')?.max.value).toBe(2);
    expect(caster(innate).dc.value).toBe(caster(plain).dc.value + 1);
    expect(resource(plain, 'Sorcery Points')?.max.value).toBe(2);

    const draconic = build('sorcerer', 6, 'draconic');
    const wild = build('sorcerer', 6, 'wild magic');
    expect(draconic.hp.max.value).toBe(wild.hp.max.value + 6);
    expect(draconic.ac.value).toBe(10 + draconic.abilities.dex.mod + draconic.abilities.cha.mod);
    expect(draconic.defenses.resistances).toHaveLength(1);
    expect(resource(draconic, 'Sorcerous Restoration')?.max.value).toBe(1);
    expect(resource(build('sorcerer', 20, 'clockwork'), 'Sorcery Points')?.max.value).toBe(20);
    expect(values(build('sorcerer', 6, 'aberrant').defenses.resistances)).toEqual(['psychic']);
  });

  it('Warlock: Magical Cunning, the four patrons, and the pact weapon invocations', () => {
    expect(resource(build('warlock', 2), 'Magical Cunning')?.max.value).toBe(1);
    const celestial = build('warlock', 5, 'celestial');
    expect(resource(celestial, 'Healing Light')).toMatchObject({ die: '1d6', pool: true });
    expect(resource(celestial, 'Healing Light')?.max.value).toBe(6);
    expect(values(build('warlock', 10, 'great old one').defenses.resistances)).toEqual(['psychic']);
    expect(build('warlock', 10, 'fiend').defenses.resistances).toHaveLength(1);
    expect(values(build('warlock', 10, 'archfey').defenses.conditionImmunities)).toEqual([
      'charmed',
    ]);

    // Pact of the Blade and Thirsting Blade, picked as the level 5 invocations.
    const registry = featureEffects();
    let c = quickBuild(
      {
        name: 'Blade',
        speciesId: 'human|xphb',
        backgroundId: 'soldier|xphb',
        classes: [{ classId: 'warlock|xphb', levels: 5, subclassId: 'fiend|warlock|xphb|xphb' }],
      },
      { index, catalog, registry, now: 1 },
    );
    let s = derive(c, index, { registry });
    // Every invocation pick: Pact of the Blade and Thirsting Blade in, Devouring Blade out
    // (the quick-builder picks alphabetically, without checking prerequisites).
    const picks = s.features
      .flatMap((f) => f.choices)
      .filter((x) => x.offer.kind === 'optionalFeature');
    picks.forEach((pick, i) => {
      const keep = pick.values.filter((v) => !v.includes('blade|'));
      const add = i === 0 ? ['pact of the blade|xphb', 'thirsting blade|xphb'] : [];
      c = setPick(c, decodeChoiceKey(pick.key), {
        values: [...add, ...keep].slice(0, Math.max(pick.values.length, add.length)),
        labels: [],
        valueKinds: ['optionalFeature'],
        entryIndex: pick.entryIndex,
      });
    });
    s = derive(c, index, { registry });
    c = toggle(c, s, 'pact-weapon', true, { free: true });
    s = derive(c, index, { registry });
    expect(s.attacksPerAction.value).toBe(2);
    const melee = s.attacks.find((a) => a.kind === 'weapon' && a.range === 'melee')!;
    expect(melee.ability).toBe('cha');
  });

  it('Wizard: Arcane Recovery and the four subclasses', () => {
    const one = build('wizard', 1);
    expect(resource(one, 'Arcane Recovery')?.max.value).toBe(1);
    expect(one.actions.find((a) => a.name === 'Arcane Recovery')?.outcomes).toEqual([
      expect.objectContaining({ regainSlot: expect.anything() }),
    ]);

    const abjurer = build('wizard', 6, 'abjurer');
    expect(abjurer.hp.ward?.max.value).toBe(2 * 6 + abjurer.abilities.int.mod);
    expect(resource(build('wizard', 3, 'diviner'), 'Portent')?.max.value).toBe(2);
    expect(resource(build('wizard', 14, 'diviner'), 'Portent')?.max.value).toBe(3);
    expect(resource(build('wizard', 10, 'illusionist'), 'Illusory Self')?.recharge).toBe('short');
  });
});
