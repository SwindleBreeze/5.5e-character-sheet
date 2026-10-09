// Golden checks for the 2014 Ranger and Rogue subclasses on 2024 characters (plan step 8.3):
// Horizon Walker, Monster Slayer, Swarmkeeper, Drakewarden, Inquisitive, Mastermind, Scout and
// Swashbuckler, with "Show 2014 content" on and every book switched on. Opt-in:
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
import { SHOW_2014 } from '../../src/sources/sourceFilter.ts';
import { nodeFileSource } from './nodeFileSource.ts';

const root = process.env.FIVETOOLS_DATA;

/** Each subclass's book. */
const SRC: Record<string, string> = {
  'horizon walker': 'xge',
  'monster slayer': 'xge',
  swarmkeeper: 'tce',
  drakewarden: 'ftd',
  inquisitive: 'xge',
  mastermind: 'xge',
  scout: 'xge',
  swashbuckler: 'xge',
};

describe.skipIf(!root)('2014 subclasses on 2024 characters: Ranger and Rogue', () => {
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
        classes: [{ classId: `${cls}|xphb`, levels, subclassId: `${sub}|${cls}|xphb|${SRC[sub]}` }],
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
  const rider = (s: DerivedSheet, id: string) =>
    s.attacks.flatMap((a) => a.riders).find((r) => r.id === id);
  const values = (list: { value: string }[]) => list.map((v) => v.value).sort();
  const wisDc = (s: DerivedSheet) => 8 + s.abilities.wis.mod + s.pb.value;

  it('Ranger: Horizon Walker', () => {
    const three = build('ranger', 3, 'horizon walker');
    expect(resource(three, 'Detect Portal')?.max.value).toBe(1);
    expect(resource(three, 'Detect Portal')?.recharge).toBe('short');
    expect(act(three, 'Planar Warrior')?.actionType).toBe('bonus');
    expect(rider(three, 'planar-warrior')).toMatchObject({ dice: '1d8', damageType: 'force' });
    const eleven = build('ranger', 11, 'horizon walker');
    expect(rider(eleven, 'planar-warrior')?.dice).toBe('2d8');
    const ethereal = eleven.spellcasting.granted.find((g) => g.spellId === 'etherealness|xphb');
    expect(ethereal?.usesMax).toBe(1);
    expect(act(build('ranger', 15, 'horizon walker'), 'Spectral Defense')?.actionType).toBe(
      'reaction',
    );
  });

  it('Ranger: Monster Slayer', () => {
    const three = build('ranger', 3, 'monster slayer');
    expect(resource(three, "Hunter's Sense")?.max.value).toBe(Math.max(1, three.abilities.wis.mod));
    expect(rider(three, 'slayers-prey')).toBeUndefined();
    const prey3 = build('ranger', 3, 'monster slayer', ['slayers-prey']);
    expect(rider(prey3, 'slayers-prey')?.dice).toBe('1d6');
    const eleven = build('ranger', 11, 'monster slayer');
    expect(act(eleven, "Magic-User's Nemesis")?.saveDc).toBe(wisDc(eleven));
    expect(resource(eleven, "Magic-User's Nemesis")?.recharge).toBe('short');
    expect(act(build('ranger', 15, 'monster slayer'), "Slayer's Counter")).toBeUndefined();
    const prey15 = build('ranger', 15, 'monster slayer', ['slayers-prey']);
    expect(act(prey15, "Slayer's Counter")?.actionType).toBe('reaction');
  });

  it('Ranger: Swarmkeeper', () => {
    const three = build('ranger', 3, 'swarmkeeper');
    expect(rider(three, 'gathered-swarm')).toMatchObject({ dice: '1d6', damageType: 'piercing' });
    expect(act(three, 'Gathered Swarm')?.saveDc).toBe(wisDc(three));
    const seven = build('ranger', 7, 'swarmkeeper', ['writhing-tide']);
    expect(resource(seven, 'Writhing Tide')?.max.value).toBe(3);
    expect(seven.speed.fly?.value).toBe(10);
    const fifteen = build('ranger', 15, 'swarmkeeper');
    expect(rider(fifteen, 'gathered-swarm')?.dice).toBe('1d8');
    expect(resource(fifteen, 'Swarming Dispersal')?.max.value).toBe(5);
  });

  it('Ranger: Drakewarden', () => {
    const three = build('ranger', 3, 'drakewarden');
    expect(resource(three, 'Drake Companion')?.max.value).toBe(1);
    expect(resource(three, 'Drake Companion')?.restoreWith[0]?.costs).toEqual([
      'a level 1+ spell slot',
    ]);
    const seven = build('ranger', 7, 'drakewarden', ['drake-summoned:fire']);
    expect(values(seven.defenses.resistances)).toEqual(['fire']);
    const eleven = build('ranger', 11, 'drakewarden');
    expect(act(eleven, "Drake's Breath")?.roll).toBe('8d6');
    expect(act(eleven, "Drake's Breath")?.saveDc).toBe(wisDc(eleven));
    const fifteen = build('ranger', 15, 'drakewarden');
    expect(act(fifteen, "Drake's Breath")?.roll).toBe('10d6');
    expect(resource(fifteen, 'Reflexive Resistance')?.max.value).toBe(5);
  });

  it('Rogue: Inquisitive', () => {
    const three = build('rogue', 3, 'inquisitive');
    expect(act(three, 'Insightful Fighting')?.actionType).toBe('bonus');
    expect(act(three, 'Eye for Detail')?.actionType).toBe('bonus');
    const thirteen = build('rogue', 13, 'inquisitive');
    expect(thirteen.skills.perception.situational?.[0]?.mode).toBe('advantage');
    expect(resource(thirteen, 'Unerring Eye')?.max.value).toBe(
      Math.max(1, thirteen.abilities.wis.mod),
    );
    expect(rider(thirteen, 'eye-for-weakness')).toBeUndefined();
    expect(rider(build('rogue', 17, 'inquisitive'), 'eye-for-weakness')?.dice).toBe('3d6');
  });

  it('Rogue: Mastermind', () => {
    const three = build('rogue', 3, 'mastermind');
    const tools = values(three.proficiencies.tools);
    expect(tools).toEqual(expect.arrayContaining(['disguise kit|xphb', 'forgery kit|xphb']));
    const plain = build('rogue', 3, 'scout');
    expect(three.proficiencies.languages.length).toBe(plain.proficiencies.languages.length + 2);
    expect(tools.length).toBe(values(plain.proficiencies.tools).length + 3);
    expect(act(three, 'Help (Master of Tactics)')?.actionType).toBe('bonus');
    expect(act(build('rogue', 13, 'mastermind'), 'Misdirection')?.actionType).toBe('reaction');
  });

  it('Rogue: Scout', () => {
    const three = build('rogue', 3, 'scout');
    expect(three.skills.nature.proficiency).toBe('expertise');
    expect(three.skills.survival.proficiency).toBe('expertise');
    expect(act(three, 'Skirmisher')?.actionType).toBe('reaction');
    expect(three.speed.walk?.value).toBe(30);
    const thirteen = build('rogue', 13, 'scout');
    expect(thirteen.speed.walk?.value).toBe(40);
    expect(thirteen.initiative.mode).toBe('advantage');
  });

  it('Rogue: Swashbuckler', () => {
    const three = build('rogue', 3, 'swashbuckler');
    const scout = build('rogue', 3, 'scout');
    expect(three.initiative.bonus.value).toBe(
      scout.initiative.bonus.value + Math.max(0, three.abilities.cha.mod),
    );
    expect(act(build('rogue', 9, 'swashbuckler'), 'Panache')?.actionType).toBe('action');
    const seventeen = build('rogue', 17, 'swashbuckler');
    expect(resource(seventeen, 'Master Duelist')?.max.value).toBe(1);
    expect(resource(seventeen, 'Master Duelist')?.recharge).toBe('short');
  });
});
