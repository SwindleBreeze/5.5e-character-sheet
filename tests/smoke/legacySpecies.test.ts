// Golden checks for the 2014 species on 2024 characters (plan step 8.3) on real data: a 2024
// fighter of each species, quick-built with every book and "Show 2014 content" on, its numbers
// read the way the species' traits give them. Opt-in:
//   FIVETOOLS_DATA=./5etools-src-2.36.1 npm run test:smoke
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
import type { Character, ContentEntity } from '../../src/schema/index.ts';
import { SHOW_2014 } from '../../src/sources/sourceFilter.ts';
import { nodeFileSource } from './nodeFileSource.ts';

const root = process.env.FIVETOOLS_DATA;

describe.skipIf(!root)('2014 species golden checks (local data)', () => {
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

  /** A soldier fighter of this species, quick-built, with these toggles switched on. */
  function build(
    speciesId: string,
    levels: number,
    toggles: string[] = [],
  ): { c: Character; s: DerivedSheet } {
    let c = quickBuild(
      {
        name: 'Golden',
        speciesId,
        backgroundId: 'soldier|xphb',
        classes: [{ classId: 'fighter|xphb', levels }],
      },
      { index, catalog, registry, now: 1 },
    );
    let s = derive(c, index, { registry });
    for (const t of toggles) {
      c = toggle(c, s, t, true, { rollAmount: () => 0 });
      s = derive(c, index, { registry });
    }
    expect(s.choices.pending).toEqual([]);
    return { c, s };
  }
  const resource = (s: DerivedSheet, name: string) => s.resources.find((r) => r.name === name);
  const act = (s: DerivedSheet, name: string) => s.actions.find((a) => a.name === name);
  const attack = (s: DerivedSheet, name: string) => s.attacks.find((a) => a.name === name);
  const sense = (s: DerivedSheet, name: string) =>
    s.senses.find((x) => x.value.sense === name)?.value.range;
  const situational = (roll: { situational?: { against: string }[] }) =>
    (roll.situational ?? []).map((x) => x.against);
  /** The same character with nothing worn or held. */
  const undressed = (c: Character): Character => ({
    ...c,
    inventory: c.inventory.map((r) => {
      const row = { ...r };
      delete row.equipped;
      return row;
    }),
  });
  const bareSheet = (c: Character) => derive(undressed(c), index, { registry });
  /** The sheet of a plain 2024 human fighter, to compare against. */
  const human = (levels: number) => build('human|xphb', levels).s;

  it('every 2014 species builds with no pick left and no warning', () => {
    const out: string[] = [];
    for (const sp of catalog.of('species').filter((x) => x.edition === '2014')) {
      const { s } = build(sp.id, 5);
      for (const i of s.issues.filter((x) => x.severity !== 'info'))
        out.push(`${sp.id}: ${i.code}`);
    }
    expect(out).toEqual([]);
  });

  it('Draconblood and Ravenite dragonborn: breath weapon by level, their once-per-rest trait', () => {
    const one = build('dragonborn (draconblood; green)|egw', 1).s;
    const breath = act(one, 'Breath Weapon (Poison)')!;
    expect(breath.roll).toBe('2d6');
    expect(breath.saveDc).toBe(8 + one.abilities.con.mod + 2);
    expect(resource(one, 'Breath Weapon (Poison)')).toMatchObject({
      max: { value: 1 },
      recharge: 'short',
    });
    expect(resource(one, 'Forceful Presence')?.max.value).toBe(1);
    expect(
      act(build('dragonborn (draconblood; green)|egw', 6).s, 'Breath Weapon (Poison)')?.roll,
    ).toBe('3d6');
    const raven = build('dragonborn (ravenite; red)|egw', 16).s;
    expect(act(raven, 'Breath Weapon (Fire)')?.roll).toBe('5d6');
    expect(act(raven, 'Vengeful Assault')?.actionType).toBe('reaction');
  });

  it('Gem dragonborn: breath weapon uses and dice, telepathy, Gem Flight', () => {
    const { s } = build('dragonborn (gem; amethyst)|ftd', 5, ['gem-flight']);
    expect(resource(s, 'Breath Weapon')?.max.value).toBe(3);
    expect(act(s, 'Breath Weapon (Force)')?.roll).toBe('2d10');
    expect(sense(s, 'telepathy')).toBe(30);
    expect(resource(s, 'Gem Flight')?.max.value).toBe(1);
    expect(s.speed.fly?.value).toBe(s.speed.walk?.value);
    expect(build('dragonborn (gem; amethyst)|ftd', 4).s.speed.fly).toBeUndefined();
  });

  it('Natural armor: the best calculation without armor', () => {
    const dex = (s: DerivedSheet) => s.abilities.dex.mod;
    for (const [id, base] of [
      ['autognome|aag', 13],
      ['thri-kreen|aag', 13],
      ['lizardfolk|mpmm', 13],
      ['locathah|lr', 12],
      ['goblin|psz', 11],
    ] as const) {
      const { c } = build(id, 1);
      const bare = bareSheet(c);
      expect([id, bare.ac.value]).toEqual([id, base + dex(bare)]);
    }
    const lox = build('loxodon|ggr', 1).c;
    const bare = bareSheet(lox);
    expect(bare.ac.value).toBe(12 + bare.abilities.con.mod);
  });

  it('Tortle: AC 17 without armor, Shell Defense, Claws', () => {
    const { c } = build('tortle|mpmm', 3);
    const bare = undressed(c);
    const s = derive(bare, index, { registry });
    expect(s.ac.value).toBe(17);
    expect(attack(s, 'Unarmed Strike')).toMatchObject({
      damageDice: '1d6',
      damageType: 'slashing',
    });
    const shell = toggle(bare, s, 'shell-defense', true, { rollAmount: () => 0 });
    const inShell = derive(shell, index, { registry });
    expect(inShell.ac.value).toBe(21);
    expect(inShell.saves.str.mode).toBe('advantage');
    expect(inShell.saves.dex.mode).toBe('disadvantage');
  });

  it('Flat AC bonuses: Lizardfolk (DMG) and Troglodyte', () => {
    const plain = human(1).ac.value;
    expect(build('lizardfolk|dmg', 1).s.ac.value).toBe(plain + 3);
    expect(build('troglodyte|dmg', 1).s.ac.value).toBe(plain + 1);
  });

  it('Extra hit points per level: Kaladesh dwarf, Stensia human', () => {
    const plain = human(5).hp.max.value;
    const con = (s: DerivedSheet) => s.abilities.con.mod * 5;
    const dwarf = build('dwarf (kaladesh)|psk', 5).s;
    expect(dwarf.hp.max.value - con(dwarf)).toBe(plain - con(human(5)) + 5);
    const stensia = build('human (innistrad; stensia)|psi', 5).s;
    expect(stensia.hp.max.value - con(stensia)).toBe(plain - con(human(5)) + 10);
    expect(dwarf.saves.con.situational?.length).toBeGreaterThan(0);
  });

  it('Natural weapons on the Unarmed Strike', () => {
    for (const [id, die, type] of [
      ['aarakocra|dmg', '1d4', 'slashing'],
      ['aarakocra|mpmm', '1d6', 'slashing'],
      ['centaur|mpmm', '1d6', 'bludgeoning'],
      ['gnoll|dmg', '1d4', 'piercing'],
      ['leonin|mot', '1d4', 'slashing'],
      ['minotaur|mpmm', '1d6', 'piercing'],
      ['minotaur (amonkhet)|psa', '1d6', 'bludgeoning'],
      ['satyr|mpmm', '1d6', 'bludgeoning'],
      ['tabaxi|mpmm', '1d6', 'slashing'],
    ] as const) {
      const unarmed = attack(build(id, 1).s, 'Unarmed Strike');
      expect([id, unarmed?.damageDice, unarmed?.damageType]).toEqual([id, die, type]);
    }
  });

  it('Natural weapons as their own attacks: Naga, Vampire, Gifted Aetherborn', () => {
    const naga = build('naga|psa', 1).s;
    expect(attack(naga, 'Bite')).toMatchObject({ damageDice: '1d4', damageType: 'piercing' });
    expect(attack(naga, 'Constrict')).toMatchObject({
      damageDice: '1d6',
      damageType: 'bludgeoning',
    });
    const vampire = attack(build('vampire|psz', 1).s, 'Blood Thirst')!;
    expect(vampire.damageBonus.value).toBe(1);
    expect(vampire.riders.find((r) => r.name === 'Blood Thirst')?.dice).toBe('1d6');
    expect(attack(build('variant; gifted aetherborn|psk', 1).s, 'Drain Life')?.damageDice).toBe(
      '1d6',
    );
  });

  it('Traits with uses: counters by Proficiency Bonus or once per rest', () => {
    for (const [id, name, level, max] of [
      ['astral elf|aag', 'Starlight Step', 5, 3],
      ['autognome|aag', 'Built for Success', 9, 4],
      ['deep gnome|mpmm', 'Svirfneblin Camouflage', 1, 2],
      ['eladrin|mpmm', 'Fey Step', 5, 3],
      ['firbolg|mpmm', 'Hidden Step', 5, 3],
      ['genasi (earth)|mpmm', 'Merge with Stone', 5, 3],
      ['giff|aag', 'Astral Spark', 5, 3],
      ['goblin|mpmm', 'Fury of the Small', 5, 3],
      ['hadozee|aag', 'Hadozee Dodge', 5, 3],
      ['harengon|mpmm', 'Rabbit Hop', 5, 3],
      ['hobgoblin|mpmm', 'Fey Gift', 5, 3],
      ['hobgoblin|mpmm', 'Fortune from the Many', 5, 3],
      ['kender|dsotdq', 'Taunt', 5, 3],
      ['kender|dsotdq', 'Fearless', 5, 1],
      ['kenku|mpmm', 'Kenku Recall', 5, 3],
      ['kobold; defiance|mpmm', 'Draconic Cry', 5, 3],
      ['leonin|mot', 'Daunting Roar', 5, 1],
      ['lizardfolk|mpmm', 'Hungry Jaws', 5, 3],
      ['half-orc|phb', 'Relentless Endurance', 5, 1],
      ['orc (ixalan)|psx', 'Relentless Endurance', 5, 1],
      ['minotaur (amonkhet)|psa', 'Relentless Endurance', 5, 1],
      ['shadar-kai|mpmm', 'Blessing of the Raven Queen', 5, 3],
      ['human (mark of sentinel)|erlw', 'Vigilant Guardian', 5, 1],
      ['vedalken|ggr', 'Partially Amphibious', 5, 1],
      ['tabaxi|mpmm', 'Feline Agility', 5, 1],
    ] as const) {
      expect([id, name, resource(build(id, level).s, name)?.max.value]).toEqual([id, name, max]);
    }
  });

  it('Actions with a roll or a save DC', () => {
    const hadozee = build('hadozee|aag', 5).s;
    expect(act(hadozee, 'Hadozee Dodge')?.roll).toBe('1d6 + 3');
    const leonin = build('leonin|mot', 5).s;
    expect(act(leonin, 'Daunting Roar')?.saveDc).toBe(8 + leonin.abilities.con.mod + 3);
    const minotaur = build('minotaur|mpmm', 5).s;
    expect(act(minotaur, 'Hammering Horns')?.saveDc).toBe(8 + minotaur.abilities.str.mod + 3);
    // The DC ability is picked with the species: one of Int, Wis, Cha.
    const kender = build('kender|dsotdq', 5).s;
    const mental = (['int', 'wis', 'cha'] as const).map((a) => 8 + kender.abilities[a].mod + 3);
    expect(mental).toContain(act(kender, 'Taunt')?.saveDc);
    expect(act(build('eladrin|mpmm', 5).s, 'Fey Step')?.saveDc).toBeDefined();
    expect(act(build('lizardfolk|mpmm', 5).s, 'Hungry Jaws')?.outcomes.length).toBe(1);
  });

  it('Simic Hybrid: a second enhancement at 5th level, Acid Spit when picked', () => {
    const picks = (c: Character) =>
      c.log
        .flatMap((e) => e.choices)
        .filter((r) => r.key.owner.id === 'simic hybrid|ggr')
        .map((r) => r.key.slot);
    expect(picks(build('simic hybrid|ggr', 1).c)).toContain('enhancement');
    expect(picks(build('simic hybrid|ggr', 1).c)).not.toContain('enhancement-5');
    const { c } = build('simic hybrid|ggr', 11);
    expect(picks(c)).toContain('enhancement-5');
    const spit: Character = structuredClone(c);
    for (const r of spit.log.flatMap((e) => e.choices))
      if (r.key.slot === 'enhancement-5') r.values = ['acid-spit'];
    const s = derive(spit, index, { registry });
    expect(resource(s, 'Acid Spit')?.max.value).toBe(Math.max(1, s.abilities.con.mod));
    expect(act(s, 'Acid Spit')?.roll).toBe('3d10');
    expect(act(s, 'Acid Spit')?.saveDc).toBe(8 + s.abilities.con.mod + 4);
  });

  it('Saves and checks: advantages and d4s', () => {
    const vedalken = build('vedalken|ggr', 1).s;
    expect([vedalken.saves.int.mode, vedalken.saves.wis.mode, vedalken.saves.cha.mode]).toEqual([
      'advantage',
      'advantage',
      'advantage',
    ]);
    const deep = build('deep gnome|mpmm', 1).s;
    expect(situational(deep.saves.wis)).toContain('spells');
    const giff = build('giff|aag', 1).s;
    expect(giff.saves.str.mode).toBe('advantage');
    expect(giff.skills.athletics.mode).toBe('advantage');
    const sentinel = build('human (mark of sentinel)|erlw', 1).s;
    expect(sentinel.skills.insight.dice.map((d) => d.dice)).toEqual(['1d4']);
    expect(sentinel.skills.perception.dice.map((d) => d.dice)).toEqual(['1d4']);
    const ibis = build('aven (ibis-headed)|psa', 5).s;
    const intSkills = (['arcana', 'history', 'investigation', 'nature', 'religion'] as const).map(
      (k) => ibis.skills[k].proficiency,
    );
    expect(intSkills).not.toContain('none');
    expect(intSkills).toContain('half');
    expect(build('human (keldon)|psd', 1).s.saves.str.proficiency).toBe('proficient');
    // Hare-Trigger: the Proficiency Bonus on top of Dexterity.
    const hare = build('harengon|mpmm', 5).s;
    expect(hare.initiative.bonus.value).toBe(hare.abilities.dex.mod + 3);
  });

  it('Speeds: flight lost in armor, Ixalan goblin climbing and resistances', () => {
    const owl = build('owlin|scc', 1);
    const armored = owl.s.speed.fly;
    const bare = bareSheet(owl.c).speed.fly;
    expect(bare?.value).toBe(30);
    // The soldier's starting armor is Medium or Heavy.
    expect(armored).toBeUndefined();
    const goblin = build('goblin (ixalan)|psx', 1);
    const free = bareSheet(goblin.c);
    expect(free.speed.climb?.value).toBe(25);
    expect(free.defenses.resistances.map((r) => r.value).sort()).toEqual(['fire', 'psychic']);
  });

  it('Free casts the data leaves uncounted, and spells it leaves out', () => {
    expect(
      resource(build('human (mark of passage)|erlw', 1).s, 'Misty Step (Magical Passage)')?.max
        .value,
    ).toBe(1);
    expect(resource(build('aarakocra|mpmm', 3).s, 'Gust Of Wind (Wind Caller)')?.max.value).toBe(1);
    const warding = build('dwarf (mark of warding)|erlw', 3).s;
    expect(warding.spellcasting.granted.map((g) => g.spellId)).toContain('arcane lock|phb');
    const storm = build('half-elf (variant; mark of storm)|erlw', 3).s;
    expect(storm.spellcasting.granted.map((g) => g.spellId)).toContain('gust of wind|phb');
  });

  it('Telepathy and condition immunities', () => {
    expect(sense(build('thri-kreen|aag', 1).s, 'telepathy')).toBe(120);
    expect(sense(build('halfling (ghostwise)|scag', 1).s, 'telepathy')).toBe(30);
    expect(build('grimlock|dmg', 1).s.defenses.conditionImmunities.map((c) => c.value)).toContain(
      'blinded',
    );
    const twin = build('khenra|psa', 1, ['no-living-twin']).s;
    expect(twin.defenses.conditionImmunities.map((c) => c.value)).toContain('frightened');
  });
});
