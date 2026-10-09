// Golden checks for the 2014 cleric domains on a 2024 Cleric (plan step 8.3): one build per
// domain at a level or two, with every book and "Show 2014 content" on, its numbers read the way
// the mapping gives them. Opt-in:
//   FIVETOOLS_DATA=./5etools-src npx vitest run --config vitest.smoke.config.ts tests/smoke/legacyCleric.test.ts
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

describe.skipIf(!root)('2014 cleric domains on a 2024 Cleric (local data)', () => {
  let index: ContentIndex;
  let catalog: Catalog;

  beforeAll(async () => {
    const result = await importFivetools(nodeFileSource(root!), { now: 1 });
    const all = Object.values(result.entities).flat() as ContentEntity[];
    index = createContentIndex(all);
    const books = result.sources.filter((s) => s.origin !== 'homebrew').map((s) => s.code);
    catalog = createCatalog(all, new Set([...books, SHOW_2014]));
  });

  /** A human soldier cleric of one 2014 domain (`name|source`), with these toggles on. */
  function build(levels: number, sub: string, toggles: [string, string?][] = []) {
    const registry = featureEffects();
    let c = quickBuild(
      {
        name: 'Golden',
        speciesId: 'human|xphb',
        backgroundId: 'soldier|xphb',
        classes: [
          { classId: 'cleric|xphb', levels, subclassId: sub.replace('|', '|cleric|xphb|') },
        ],
      },
      { index, catalog, registry, now: 1 },
    );
    let s = derive(c, index, { registry });
    for (const [t, option] of toggles) {
      c = toggle(c, s, t, true, { free: true, ...(option ? { option } : {}) });
      s = derive(c, index, { registry });
    }
    expect(s.choices.pending).toEqual([]);
    return s;
  }
  const resource = (s: DerivedSheet, name: string) => s.resources.find((r) => r.name === name);
  const act = (s: DerivedSheet, name: string) => s.actions.find((a) => a.name === name);
  const cost = (s: DerivedSheet, name: string) => act(s, name)?.costs[0]?.label;
  const values = (list: { value: string }[]) => list.map((v) => v.value).sort();
  const wisUses = (s: DerivedSheet) => Math.max(1, s.abilities.wis.mod);
  const proficient = (s: DerivedSheet) =>
    Object.entries(s.skills)
      .filter(([, v]) => v.proficiency === 'proficient' || v.proficiency === 'expertise')
      .map(([k]) => k);
  const CD = '1 Channel Divinity';

  it('Nature and Tempest (PHB)', () => {
    const n3 = build(3, 'nature|phb');
    expect(values(n3.proficiencies.armor)).toContain('heavy');
    expect(proficient(n3).some((k) => ['animal handling', 'nature', 'survival'].includes(k))).toBe(
      true,
    );
    expect(act(n3, 'Charm Animals and Plants')).toMatchObject({
      actionType: 'action',
      saveDc: 8 + 2 + n3.abilities.wis.mod,
    });
    expect(cost(n3, 'Charm Animals and Plants')).toBe(CD);
    expect(act(build(6, 'nature|phb'), 'Dampen Elements')?.actionType).toBe('reaction');
    expect(act(build(17, 'nature|phb'), 'Master of Nature')?.actionType).toBe('bonus');

    const t3 = build(3, 'tempest|phb');
    expect(values(t3.proficiencies.weapons)).toContain('martial');
    expect(resource(t3, 'Wrath of the Storm')).toMatchObject({ recharge: 'long' });
    expect(resource(t3, 'Wrath of the Storm')?.max.value).toBe(wisUses(t3));
    expect(act(t3, 'Wrath of the Storm')).toMatchObject({ actionType: 'reaction', roll: '2d8' });
    expect(cost(t3, 'Destructive Wrath')).toBe(CD);
    const t17 = build(17, 'tempest|phb', [['stormborn']]);
    expect(t17.speed.fly?.value).toBe(t17.speed.walk?.value);
  });

  it('Death (DMG)', () => {
    const d3 = build(3, 'death|dmg');
    expect(values(d3.proficiencies.weapons)).toContain('martial');
    const rider = d3.attacks.flatMap((a) => a.riders).find((r) => r.id === 'touch-of-death');
    expect(rider).toMatchObject({ dice: '11', damageType: 'necrotic' });
    expect(rider?.cost?.label).toBe(CD);
  });

  it('Ambition, Knowledge, Solidarity, Strength and Zeal (Amonkhet)', () => {
    const a3 = build(3, 'ambition (psa)|psa');
    expect(resource(a3, 'Warding Flare')?.max.value).toBe(wisUses(a3));
    expect(act(a3, 'Invoke Duplicity')?.actionType).toBe('action');
    expect(cost(a3, 'Invoke Duplicity')).toBe(CD);
    expect(cost(build(6, 'ambition (psa)|psa'), 'Cloak of Shadows')).toBe(CD);

    const k6 = build(6, 'knowledge (psa)|psa');
    const experts = Object.entries(k6.skills).filter(([, v]) => v.proficiency === 'expertise');
    expect(experts).toHaveLength(2);
    for (const [skill] of experts)
      expect(['arcana', 'history', 'nature', 'religion']).toContain(skill);
    expect(cost(k6, 'Knowledge of the Ages')).toBe(CD);
    expect(act(k6, 'Read Thoughts')?.saveDc).toBe(8 + 3 + k6.abilities.wis.mod);
    expect(resource(build(17, 'knowledge (psa)|psa'), 'Visions of the Past')).toMatchObject({
      recharge: 'short',
    });

    const so6 = build(6, 'solidarity (psa)|psa');
    expect(values(so6.proficiencies.armor)).toContain('heavy');
    expect(act(so6, "Solidarity's Action")?.actionType).toBe('bonus');
    expect(act(so6, 'Preserve Life')?.roll).toBe('30');
    expect(act(so6, "Oketra's Blessing")?.actionType).toBe('reaction');

    const st6 = build(6, 'strength (psa)|psa');
    expect(cost(st6, 'Feat of Strength')).toBe(CD);
    expect(act(st6, "Rhonas's Blessing")?.actionType).toBe('reaction');

    const z3 = build(3, 'zeal (psa)|psa');
    expect(resource(z3, 'Priest of Zeal')?.max.value).toBe(wisUses(z3));
    expect(cost(z3, 'Consuming Fervor')).toBe(CD);
    expect(resource(build(17, 'zeal (psa)|psa'), 'Blaze of Glory')?.max.value).toBe(1);
  });

  it('Forge (Xanathar’s)', () => {
    const f3 = build(3, 'forge|xge');
    expect(values(f3.proficiencies.tools)).toContain("smith's tools|xphb");
    expect(resource(f3, 'Blessing of the Forge')?.max.value).toBe(1);
    const armored = build(3, 'forge|xge', [['blessing-of-the-forge', 'armor']]);
    expect(armored.ac.value).toBe(f3.ac.value + 1);
    const f6 = build(6, 'forge|xge');
    expect(values(f6.defenses.resistances)).toContain('fire');
    expect(values(build(17, 'forge|xge').defenses.immunities)).toContain('fire');
  });

  it('Order, Peace and Twilight (Tasha’s)', () => {
    const o6 = build(6, 'order|tce');
    expect(proficient(o6).some((k) => ['intimidation', 'persuasion'].includes(k))).toBe(true);
    expect(act(o6, "Order's Demand")?.saveDc).toBe(8 + 3 + o6.abilities.wis.mod);
    expect(resource(o6, 'Embodiment of the Law')?.max.value).toBe(wisUses(o6));

    const p3 = build(3, 'peace|tce');
    expect(resource(p3, 'Emboldening Bond')?.max.value).toBe(2);
    expect(act(p3, 'Emboldening Bond')?.roll).toBe('1d4');
    expect(act(p3, 'Balm of Peace')?.roll).toBe(`2d6 + ${p3.abilities.wis.mod}`);

    const tw3 = build(3, 'twilight|tce');
    expect(tw3.senses.map((x) => x.value)).toContainEqual({ sense: 'darkvision', range: 300 });
    expect(resource(tw3, 'Eyes of Night')?.max.value).toBe(1);
    expect(act(tw3, 'Twilight Sanctuary')?.roll).toBe('1d6 + 3');
    const tw6 = build(6, 'twilight|tce', [['steps-of-night']]);
    expect(resource(tw6, 'Steps of Night')?.max.value).toBe(3);
    expect(tw6.speed.fly?.value).toBe(tw6.speed.walk?.value);
  });
});
