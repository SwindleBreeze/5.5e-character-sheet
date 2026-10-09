// Golden checks for the 2014 druid circles and fighter archetypes on 2024 characters (plan step
// 8.3): one build per subclass at a few levels, with "Show 2014 content" on and every book, its
// numbers read the way the mapping gives them. Opt-in:
//   FIVETOOLS_DATA=./5etools-src npx vitest run --config vitest.smoke.config.ts tests/smoke/legacyDruidFighter.test.ts
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

describe.skipIf(!root)('2014 druid and fighter subclasses golden checks', () => {
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

  /** A human soldier of one class and 2014 subclass, with these toggles (and forms) on. */
  function build(
    cls: string,
    levels: number,
    subclassId: string,
    toggles: [string, string?][] = [],
  ): DerivedSheet {
    let c = quickBuild(
      {
        name: 'Golden',
        speciesId: 'human|xphb',
        backgroundId: 'soldier|xphb',
        classes: [{ classId: `${cls}|xphb`, levels, subclassId }],
      },
      { index, catalog, registry, now: 1 },
    );
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
  const wisUses = (s: DerivedSheet) => Math.max(1, s.abilities.wis.mod);
  const conUses = (s: DerivedSheet) => Math.max(1, s.abilities.con.mod);

  it('Circle of Dreams', () => {
    const dreams = 'dreams|druid|xphb|xge';
    const d3 = build('druid', 3, dreams);
    expect(resource(d3, 'Balm of the Summer Court')).toMatchObject({ recharge: 'long' });
    expect(resource(d3, 'Balm of the Summer Court')?.max.value).toBe(3);
    const d14 = build('druid', 14, dreams);
    expect(resource(d14, 'Hidden Paths')?.max.value).toBe(wisUses(d14));
    expect(act(d14, 'Hidden Paths (another creature)')?.costs[0]?.label).toBe('1 Hidden Paths');
    expect(resource(d14, 'Walker in Dreams')?.max.value).toBe(1);
  });

  it('Circle of the Shepherd', () => {
    const shepherd = 'shepherd|druid|xphb|xge';
    const s3 = build('druid', 3, shepherd);
    expect(values(s3.proficiencies.languages)).toContain('sylvan');
    expect(resource(s3, 'Spirit Totem')).toMatchObject({ recharge: 'short' });
    const bear = build('druid', 10, shepherd, [['spirit-totem', 'bear']]);
    expect(act(bear, 'Bear Spirit temporary HP')?.roll).toBe('15');
    expect(bear.saves.str.mode).toBe('advantage');
    expect(act(bear, 'Guardian Spirit')?.roll).toBe('5');
    const unicorn = build('druid', 10, shepherd, [['spirit-totem', 'unicorn']]);
    expect(act(unicorn, 'Unicorn Spirit healing')?.roll).toBe('10');
    expect(resource(build('druid', 14, shepherd), 'Faithful Summons')?.max.value).toBe(1);
  });

  it('Circle of Spores', () => {
    const spores = 'spores|druid|xphb|tce';
    const s3 = build('druid', 3, spores);
    const dc = 8 + 2 + s3.abilities.wis.mod;
    expect(act(s3, 'Halo of Spores')).toMatchObject({ roll: '1d4', saveDc: dc });
    const on = build('druid', 6, spores, [['symbiotic-entity']]);
    expect(act(on, 'Halo of Spores')?.roll).toBe('2d6');
    expect(on.toggles.find((t) => t.toggleId === 'symbiotic-entity')?.onActivate).toEqual([
      { tempHp: '24' },
    ]);
    expect(on.attacks.flatMap((a) => a.riders).some((r) => r.id === 'symbiotic-entity')).toBe(true);
    expect(resource(on, 'Fungal Infestation')?.max.value).toBe(wisUses(on));
    expect(act(build('druid', 10, spores), 'Halo of Spores')?.roll).toBe('1d8');
    expect(act(build('druid', 10, spores, [['symbiotic-entity']]), 'Spreading Spores')?.roll).toBe(
      '2d8',
    );
    const s14 = build('druid', 14, spores);
    expect(values(s14.defenses.conditionImmunities)).toEqual([
      'blinded',
      'deafened',
      'frightened',
      'poisoned',
    ]);
  });

  it('Circle of Wildfire', () => {
    const wildfire = 'wildfire|druid|xphb|tce';
    const w3 = build('druid', 3, wildfire);
    expect(act(w3, 'Summon Wildfire Spirit')).toMatchObject({
      roll: '2d6',
      saveDc: 8 + 2 + w3.abilities.wis.mod,
    });
    expect(act(w3, 'Enhanced Bond')).toBeUndefined();
    const w10 = build('druid', 10, wildfire, [['wildfire-spirit']]);
    expect(act(w10, 'Enhanced Bond')?.roll).toBe('1d8');
    expect(resource(w10, 'Cauterizing Flames')?.max.value).toBe(4);
    expect(act(w10, 'Cauterizing Flames')?.roll).toBe(`2d10 + ${w10.abilities.wis.mod}`);
    expect(resource(build('druid', 14, wildfire), 'Blazing Revival')?.max.value).toBe(1);
  });

  it('Cavalier', () => {
    const cavalier = 'cavalier|fighter|xphb|xge';
    const c3 = build('fighter', 3, cavalier);
    expect(resource(c3, 'Unwavering Mark')?.max.value).toBe(Math.max(1, c3.abilities.str.mod));
    expect(act(c3, 'Unwavering Mark')).toMatchObject({ roll: '1', actionType: 'bonus' });
    const c15 = build('fighter', 15, cavalier);
    expect(act(c15, 'Unwavering Mark')?.roll).toBe('7');
    expect(resource(c15, 'Warding Maneuver')?.max.value).toBe(conUses(c15));
    expect(act(c15, 'Ferocious Charger')?.saveDc).toBe(8 + 5 + c15.abilities.str.mod);
  });

  it('Samurai', () => {
    const samurai = 'samurai|fighter|xphb|xge';
    const s3 = build('fighter', 3, samurai);
    expect(resource(s3, 'Fighting Spirit')?.max.value).toBe(3);
    expect(act(s3, 'Fighting Spirit')?.outcomes).toEqual([{ tempHp: '5' }]);
    const s10 = build('fighter', 10, samurai);
    expect(act(s10, 'Fighting Spirit')?.outcomes).toEqual([{ tempHp: '10' }]);
    expect(s10.saves.wis.proficiency).toBe('proficient');
    expect(act(build('fighter', 15, samurai), 'Fighting Spirit')?.outcomes).toEqual([
      { tempHp: '15' },
    ]);
    expect(resource(build('fighter', 18, samurai), 'Strength before Death')?.max.value).toBe(1);
  });

  it('Echo Knight', () => {
    const echo = 'echo knight|fighter|xphb|egw';
    const e3 = build('fighter', 3, echo);
    expect(act(e3, 'Manifest Echo')?.actionType).toBe('bonus');
    expect(resource(e3, 'Unleash Incarnation')?.max.value).toBe(conUses(e3));
    const e15 = build('fighter', 15, echo);
    expect(resource(e15, 'Shadow Martyr')).toMatchObject({ recharge: 'short' });
    expect(act(e15, 'Reclaim Potential')?.outcomes).toEqual([
      { tempHp: `2d6 + ${e15.abilities.con.mod}` },
    ]);
  });

  it('Rune Knight', () => {
    const rune = 'rune knight|fighter|xphb|tce';
    const runes = (s: DerivedSheet) => s.resources.filter((r) => r.name.endsWith(' Rune'));
    const might = (s: DerivedSheet) =>
      s.attacks[0]!.riders.find((r) => r.id === 'giants-might')?.dice;
    const r3 = build('fighter', 3, rune, [['giants-might']]);
    expect(values(r3.proficiencies.tools)).toContain("smith's tools|xphb");
    expect(values(r3.proficiencies.languages)).toContain('giant');
    expect(act(r3, 'Rune Magic save DC')?.saveDc).toBe(8 + 2 + r3.abilities.con.mod);
    expect(resource(r3, "Giant's Might")?.max.value).toBe(2);
    expect(r3.saves.str.mode).toBe('advantage');
    expect(might(r3)).toBe('1d6');
    expect(runes(r3).map((r) => r.max.value)).toEqual([1, 1]);
    expect(resource(build('fighter', 7, rune), 'Runic Shield')?.max.value).toBe(3);
    expect(might(build('fighter', 10, rune, [['giants-might']]))).toBe('1d8');
    expect(runes(build('fighter', 15, rune)).map((r) => r.max.value)).toEqual([2, 2, 2, 2, 2]);
    expect(might(build('fighter', 18, rune, [['giants-might']]))).toBe('1d10');
  });
});
