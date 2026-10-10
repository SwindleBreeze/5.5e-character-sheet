// Golden checks for the 2014 Wizard and Artificer on 2014 rules (plan step 8.6): the PHB Wizard
// with its schools and the Bladesinger, and the TCE Artificer with its four specialists, quick-built
// at a few levels with every book switched on and the 2014 originals preferred. Opt-in:
//   FIVETOOLS_DATA=./5etools-src npx vitest run --config vitest.smoke.config.ts <this file>
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
import { PREFER_2014, SHOW_2014 } from '../../src/sources/sourceFilter.ts';
import { nodeFileSource } from './nodeFileSource.ts';

const root = process.env.FIVETOOLS_DATA;

/** Each subclass's book. */
const SRC: Record<string, string> = {
  abjuration: 'phb',
  conjuration: 'phb',
  divination: 'phb',
  enchantment: 'phb',
  evocation: 'phb',
  illusion: 'phb',
  necromancy: 'phb',
  transmutation: 'phb',
  bladesinging: 'tce',
  alchemist: 'tce',
  armorer: 'tce',
  artillerist: 'tce',
  'battle smith': 'tce',
};

describe.skipIf(!root)('2014 rules: Wizard and Artificer', () => {
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

  /** A half-orc soldier on 2014 rules, with these toggles (`id` or `id:option`) switched on. */
  function build(classId: string, levels: number, sub?: string, toggles: string[] = []) {
    const subclassId = sub ? `${sub}|${classId}|${SRC[sub]}` : undefined;
    let c = quickBuild(
      {
        name: 'Golden',
        speciesId: 'half-orc|phb',
        backgroundId: 'soldier|phb',
        classes: [{ classId, levels, ...(subclassId ? { subclassId } : {}) }],
        ruleset: '2014',
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
    expect(s.issues.filter((i) => i.severity !== 'info')).toEqual([]);
    return s;
  }
  const wizard = (levels: number, sub?: string, toggles?: string[]) =>
    build('wizard|phb', levels, sub, toggles);
  const artificer = (levels: number, sub?: string, toggles?: string[]) =>
    build('artificer|tce', levels, sub, toggles);
  const resource = (s: DerivedSheet, name: string) => s.resources.find((r) => r.name === name);
  const act = (s: DerivedSheet, name: string) => s.actions.find((a) => a.name === name);
  const attack = (s: DerivedSheet, name: string) => s.attacks.find((a) => a.name === name);
  const granted = (s: DerivedSheet, id: string) =>
    s.spellcasting.granted.find((g) => g.spellId === id);
  const values = (list: { value: string }[]) => list.map((v) => v.value).sort();
  const intDc = (s: DerivedSheet) => 8 + s.abilities.int.mod + s.pb.value;
  const atLeastOne = (s: DerivedSheet) => Math.max(1, s.abilities.int.mod);

  it('Wizard: Arcane Recovery, Spell Mastery, Signature Spells', () => {
    const one = wizard(1);
    expect(resource(one, 'Arcane Recovery')?.max.value).toBe(1);
    expect(resource(one, 'Arcane Recovery')?.recharge).toBe('long');
    expect(act(one, 'Arcane Recovery')).toBeDefined();
    const eighteen = wizard(18, 'evocation');
    const mastery = eighteen.spellcasting.granted.filter((g) => g.uses === 'atWill');
    expect(mastery).toHaveLength(2);
    const twenty = wizard(20, 'evocation');
    const signature = twenty.spellcasting.granted.filter((g) => g.usesMax === 1);
    expect(signature).toHaveLength(2);
  });

  it('Wizard: Abjuration', () => {
    const two = wizard(2, 'abjuration');
    expect(two.hp.ward?.max.value).toBe(2 * 2 + two.abilities.int.mod);
    expect(act(wizard(6, 'abjuration'), 'Projected Ward')?.actionType).toBe('reaction');
    const fourteen = wizard(14, 'abjuration');
    expect(fourteen.hp.ward?.max.value).toBe(2 * 14 + fourteen.abilities.int.mod);
  });

  it('Wizard: Conjuration', () => {
    expect(act(wizard(2, 'conjuration'), 'Minor Conjuration')?.actionType).toBe('action');
    const six = wizard(6, 'conjuration');
    expect(resource(six, 'Benign Transposition')?.max.value).toBe(1);
    expect(resource(six, 'Benign Transposition')?.recharge).toBe('long');
    const ten = wizard(10, 'conjuration', ['focused-conjuration']);
    expect(ten.concentrationUnbreakable).toBeDefined();
  });

  it('Wizard: Divination', () => {
    expect(resource(wizard(2, 'divination'), 'Portent')?.max.value).toBe(2);
    expect(resource(wizard(13, 'divination'), 'Portent')?.max.value).toBe(2);
    expect(resource(wizard(14, 'divination'), 'Portent')?.max.value).toBe(3);
    const ten = wizard(10, 'divination');
    expect(resource(ten, 'The Third Eye')?.max.value).toBe(1);
    expect(resource(ten, 'The Third Eye')?.recharge).toBe('short');
  });

  it('Wizard: Enchantment', () => {
    const two = wizard(2, 'enchantment');
    expect(act(two, 'Hypnotic Gaze')?.saveDc).toBe(intDc(two));
    expect(act(wizard(6, 'enchantment'), 'Instinctive Charm')?.actionType).toBe('reaction');
    const fourteen = wizard(14, 'enchantment');
    expect(act(fourteen, 'Alter Memories')?.saveDc).toBe(intDc(fourteen));
  });

  it('Wizard: Illusion', () => {
    const two = wizard(2, 'illusion');
    // Minor Illusion on top of the cantrips the class picks.
    const cantrips = (s: DerivedSheet) => [
      ...s.spellcasting.casters.flatMap((c) => c.cantrips),
      ...s.spellcasting.granted.map((g) => g.spellId),
    ];
    expect(cantrips(two)).toContain('minor illusion|phb');
    expect(cantrips(two)).toHaveLength(cantrips(wizard(2, 'evocation')).length + 1);
    const ten = wizard(10, 'illusion');
    expect(resource(ten, 'Illusory Self')?.max.value).toBe(1);
    expect(resource(ten, 'Illusory Self')?.recharge).toBe('short');
  });

  it('Wizard: Necromancy', () => {
    expect(values(wizard(9, 'necromancy').defenses.resistances)).toEqual([]);
    expect(values(wizard(10, 'necromancy').defenses.resistances)).toEqual(['necrotic']);
    const fourteen = wizard(14, 'necromancy');
    expect(act(fourteen, 'Command Undead')?.saveDc).toBe(intDc(fourteen));
  });

  it('Wizard: Transmutation', () => {
    const six = wizard(6, 'transmutation');
    expect(six.speed.walk?.value).toBe(30);
    expect(wizard(6, 'transmutation', ['transmuters-stone:speed']).speed.walk?.value).toBe(40);
    const fire = wizard(6, 'transmutation', ['transmuters-stone:resistance-fire']);
    expect(values(fire.defenses.resistances)).toEqual(['fire']);
    const ten = wizard(10, 'transmutation');
    expect(granted(ten, 'polymorph|phb')?.usesMax).toBe(1);
    expect(resource(wizard(14, 'transmutation'), 'Master Transmuter')?.max.value).toBe(1);
  });

  it('Wizard: Bladesinging', () => {
    const two = wizard(2, 'bladesinging');
    expect(resource(two, 'Bladesong')?.max.value).toBe(2);
    expect(values(two.proficiencies.armor)).toContain('light');
    expect(two.skills.performance.proficiency).toBe('proficient');
    const song = wizard(2, 'bladesinging', ['bladesong']);
    expect(song.ac.value).toBe(two.ac.value + atLeastOne(two));
    expect(song.speed.walk?.value).toBe(40);
    expect(resource(wizard(13, 'bladesinging'), 'Bladesong')?.max.value).toBe(5);
    expect(wizard(6, 'bladesinging').attacksPerAction.value).toBe(2);
  });

  it('Artificer: class features', () => {
    const one = artificer(1);
    expect(act(one, 'Magical Tinkering')?.actionType).toBe('action');
    expect(resource(artificer(6), 'Flash of Genius')).toBeUndefined();
    const seven = artificer(7);
    expect(resource(seven, 'Flash of Genius')?.max.value).toBe(atLeastOne(seven));
    expect(act(seven, 'Flash of Genius')?.actionType).toBe('reaction');
    expect(artificer(9).inventory.attunementMax).toBe(3);
    expect(artificer(10).inventory.attunementMax).toBe(4);
    const eleven = artificer(11);
    expect(resource(eleven, 'Spell-Storing Item')?.max.value).toBe(
      Math.max(2, 2 * eleven.abilities.int.mod),
    );
    expect(artificer(14).inventory.attunementMax).toBe(5);
    expect(artificer(18).inventory.attunementMax).toBe(6);
    expect(act(artificer(20), 'Soul of Artifice')?.actionType).toBe('reaction');
  });

  it('Artificer: Alchemist', () => {
    const three = artificer(3, 'alchemist');
    expect(resource(three, 'Experimental Elixir')?.max.value).toBe(1);
    expect(resource(artificer(6, 'alchemist'), 'Experimental Elixir')?.max.value).toBe(2);
    const nine = artificer(9, 'alchemist');
    expect(granted(nine, 'lesser restoration|phb')?.usesMax).toBe(atLeastOne(nine));
    const fifteen = artificer(15, 'alchemist');
    expect(resource(fifteen, 'Experimental Elixir')?.max.value).toBe(3);
    expect(values(fifteen.defenses.resistances)).toEqual(['acid', 'poison']);
    expect(granted(fifteen, 'heal|phb')?.usesMax).toBe(1);
  });

  it('Artificer: Armorer', () => {
    const three = artificer(3, 'armorer');
    expect(values(three.proficiencies.armor)).toContain('heavy');
    expect(attack(three, 'Thunder Gauntlets')).toBeUndefined();
    const guardian = artificer(3, 'armorer', ['arcane-armor:guardian']);
    expect(attack(guardian, 'Thunder Gauntlets')?.damageDice).toBe('1d8');
    expect(resource(guardian, 'Defensive Field')?.max.value).toBe(2);
    const infiltrator = artificer(3, 'armorer', ['arcane-armor:infiltrator']);
    expect(attack(infiltrator, 'Lightning Launcher')?.range).toBe('ranged');
    expect(infiltrator.speed.walk?.value).toBe(35);
    expect(infiltrator.skills.stealth.mode).toBe('advantage');
    expect(artificer(5, 'armorer').attacksPerAction.value).toBe(2);
    const fifteen = artificer(15, 'armorer', ['arcane-armor:guardian']);
    expect(resource(fifteen, 'Guardian Pull')?.max.value).toBe(5);
    expect(act(fifteen, 'Guardian Pull')?.saveDc).toBe(intDc(fifteen));
  });

  it('Artificer: Artillerist', () => {
    const three = artificer(3, 'artillerist');
    expect(resource(three, 'Eldritch Cannon')?.max.value).toBe(1);
    expect(act(three, 'Cannon: Flamethrower')?.roll).toBe('2d8');
    expect(act(three, 'Cannon: Flamethrower')?.saveDc).toBe(intDc(three));
    const nine = artificer(9, 'artillerist');
    expect(act(nine, 'Cannon: Force Ballista')?.roll).toBe('3d8');
    expect(act(nine, 'Cannon: Detonate')?.roll).toBe('3d8');
    expect(act(nine, 'Arcane Firearm')?.roll).toBe('1d8');
  });

  it('Artificer: Battle Smith', () => {
    const three = artificer(3, 'battle smith');
    expect(values(three.proficiencies.weapons)).toContain('martial');
    expect(act(three, 'Command Steel Defender')?.actionType).toBe('bonus');
    expect(artificer(5, 'battle smith').attacksPerAction.value).toBe(2);
    const nine = artificer(9, 'battle smith');
    expect(resource(nine, 'Arcane Jolt')?.max.value).toBe(atLeastOne(nine));
    expect(act(nine, 'Arcane Jolt: Restorative Energy')?.roll).toBe('2d6');
    expect(act(artificer(15, 'battle smith'), 'Arcane Jolt: Restorative Energy')?.roll).toBe('4d6');
  });
});
