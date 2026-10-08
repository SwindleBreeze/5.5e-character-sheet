// Golden checks for the 2024 supplement feats (plan §10.2, step 6.16) on real data: a human
// fighter whose origin feat or Ability Score Improvement is swapped for a supplement feat, its
// numbers read the way the feat's text gives them. Opt-in:
//   FIVETOOLS_DATA=./5etools-src-2.36.1 npx vitest run --config vitest.smoke.config.ts tests/smoke/supFeats.test.ts
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
import type { Character, ContentEntity } from '../../src/schema/index.ts';
import { nodeFileSource } from './nodeFileSource.ts';

const root = process.env.FIVETOOLS_DATA;

describe.skipIf(!root)('supplement feat golden checks (local data)', () => {
  let index: ContentIndex;
  let catalog: Catalog;

  beforeAll(async () => {
    const result = await importFivetools(nodeFileSource(root!), { now: 1 });
    const all = Object.values(result.entities).flat() as ContentEntity[];
    index = createContentIndex(all);
    catalog = createCatalog(all, new Set(['XPHB', 'EFA', 'FRHoF', 'RHW', 'AU', 'ABH', 'LFL']));
  });

  interface Spec {
    level: number;
    /** Replaces the human's origin feat (Alert). */
    origin?: string;
    /** Replaces the level 4 Ability Score Improvement (or the level 19 Epic Boon). */
    feat?: string;
    /** The ability `feat` increases, when it asks. */
    ability?: string;
    toggles?: string[];
  }

  /** A human soldier fighter with these feats picked. */
  function build({ level, origin, feat, ability, toggles = [] }: Spec): DerivedSheet {
    const registry = featureEffects();
    let c: Character = quickBuild(
      {
        name: 'Golden',
        speciesId: 'human|xphb',
        backgroundId: 'soldier|xphb',
        classes: [{ classId: 'fighter|xphb', levels: level }],
      },
      { index, catalog, registry, now: 1 },
    );
    let s = derive(c, index, { registry });
    const pick = (key: string, value: string, kind: 'feat' | 'ability') => {
      const ch = s.features.flatMap((f) => f.choices).find((x) => x.key === key)!;
      c = setPick(c, decodeChoiceKey(ch.key), {
        values: [value],
        labels: [],
        ...(kind === 'feat' ? { valueKinds: ['feat' as const] } : {}),
        entryIndex: ch.entryIndex,
      });
      s = derive(c, index, { registry });
    };
    if (origin) pick('species:human|xphb#feat', origin, 'feat');
    if (feat) {
      const slot = feat.startsWith('boon of')
        ? 'class:fighter|xphb#featProgression.epic-boon.19'
        : 'classFeature:ability score improvement|fighter|xphb|4|xphb#feat';
      pick(slot, feat, 'feat');
      if (ability) pick(`feat:${feat}#ability`, ability, 'ability');
    }
    for (const t of toggles) {
      c = toggle(c, s, t, true, { free: true });
      s = derive(c, index, { registry });
    }
    return s;
  }
  const resource = (s: DerivedSheet, name: string) => s.resources.find((r) => r.name === name);
  const act = (s: DerivedSheet, name: string) => s.actions.find((a) => a.name === name);
  const dice = (s: DerivedSheet, skill: keyof DerivedSheet['skills']) =>
    s.skills[skill].dice.map((d) => d.dice);
  const values = (list: { value: string }[]) => list.map((v) => v.value).sort();

  it('dragonmarks: check dice, Courier’s Speed, Aberrant Fortitude and its greater mark', () => {
    const passage = build({ level: 3, origin: 'mark of passage|efa' });
    expect(passage.speed.walk?.value).toBe(35);
    expect(dice(passage, 'athletics')).toEqual(['1d4']);
    expect(dice(passage, 'acrobatics')).toEqual(['1d4']);

    // Mark of Detection: both Magical Detection spells, one free cast each.
    const detection = build({ level: 3, origin: 'mark of detection|efa' });
    const free = detection.spellcasting.granted
      .filter((g) => g.usesMax === 1)
      .map((g) => g.spellId);
    expect(free).toEqual(
      expect.arrayContaining(['detect magic|xphb', 'detect poison and disease|xphb']),
    );
    // One free cast of each of the two Primal Connection spells.
    expect(
      resource(build({ level: 3, origin: 'mark of handling|efa' }), 'Mark of Handling')?.max.value,
    ).toBe(2);

    const aberrant = build({ level: 5, origin: 'aberrant dragonmark|efa' });
    expect(resource(aberrant, 'Aberrant Fortitude')).toMatchObject({ recharge: 'long' });
    expect(act(aberrant, 'Aberrant Fortitude')?.actionType).toBe('reaction');
    const greater = build({
      level: 5,
      origin: 'aberrant dragonmark|efa',
      feat: 'greater aberrant mark|efa',
    });
    expect(resource(greater, 'Aberrant Fortitude')).toMatchObject({ recharge: 'short' });
    expect(resource(greater, 'Mark of Inspiration')?.max.value).toBe(3);
  });

  it('origin feats: uses that scale with Proficiency Bonus', () => {
    const omens = build({ level: 5, origin: 'arcane omens|au' });
    expect(resource(omens, 'Helpful Premonition')?.max.value).toBe(3);
    expect(act(omens, 'Helpful Premonition')?.roll).toBe('1d4');
    const anatomy = build({ level: 11, origin: 'transmuted anatomy|au' });
    expect(anatomy.speed.walk?.value).toBe(35);
    expect(resource(anatomy, 'Resilient Anatomy')?.max.value).toBe(4);
    const hunter = build({ level: 5, origin: 'vampire hunter|abh' });
    expect(act(hunter, 'Vitality Ward')?.roll).toBe('3d6');
    expect(dice(build({ level: 3, origin: 'arcane eloquence|au' }), 'persuasion')).toEqual(['1d4']);
  });

  it('general feats: the ability they increase sets the numbers', () => {
    const commandant = build({
      level: 5,
      feat: 'purple dragon commandant|frhof',
      ability: 'str',
      toggles: ['bloodied'],
    });
    expect(resource(commandant, 'Encourage Ally')?.max.value).toBe(3);
    expect(act(commandant, 'Encourage Ally')?.roll).toBe(`2d6 + ${commandant.abilities.str.mod}`);
    // Last Stand: Advantage on attack rolls while Bloodied.
    expect(commandant.attacks.find((a) => a.name === 'Greatsword')?.toHit?.mode).toBe('advantage');

    const subterfuge = build({ level: 5, feat: 'spell subterfuge|au', ability: 'int' });
    expect(resource(subterfuge, 'Shrouding Spells')?.max.value).toBe(
      Math.max(0, subterfuge.abilities.int.mod),
    );

    const conjurer = build({
      level: 5,
      feat: 'conjuration adept|au',
      ability: 'int',
      toggles: ['persistent-conjuration'],
    });
    const plain = build({ level: 5, feat: 'conjuration adept|au', ability: 'int' });
    expect(conjurer.concentration.bonus.value - plain.concentration.bonus.value).toBe(
      conjurer.abilities.int.mod,
    );
  });

  it('epic boons: Bloodied resistances and riders, telepathy, Siphon Life', () => {
    const resilient = build({
      level: 19,
      feat: 'boon of desperate resilience|frhof',
      toggles: ['bloodied'],
    });
    expect(values(resilient.defenses.resistances)).toHaveLength(12);
    expect(values(resilient.defenses.resistances)).not.toContain('force');

    const bloodshed = build({ level: 20, feat: 'boon of bloodshed|frhof', toggles: ['bloodied'] });
    const rider = bloodshed.attacks
      .find((a) => a.name === 'Greatsword')
      ?.riders.find((r) => r.name === 'Power from Pain');
    expect(rider?.dice).toBe('6');

    const storm = build({
      level: 19,
      feat: 'boon of the furious storm|frhof',
      toggles: ['bloodied'],
    });
    expect(values(storm.defenses.immunities)).toEqual(['lightning', 'thunder']);

    const speaker = build({ level: 19, feat: 'boon of communication|frhof' });
    expect(speaker.senses.map((x) => x.value)).toContainEqual({ sense: 'telepathy', range: 120 });

    const drinker = build({ level: 19, feat: 'boon of the soul drinker|frhof' });
    expect(resource(drinker, 'Siphon Life')).toMatchObject({ recharge: 'short' });
    expect(act(drinker, 'Siphon Life')?.outcomes).toEqual([
      expect.objectContaining({ heal: expect.anything() }),
    ]);
  });
});
