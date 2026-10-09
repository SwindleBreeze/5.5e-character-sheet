// Golden checks for the 2024 supplement species (plan §10.2, step 6.16) on real data: a fighter
// of each species, quick-built at a few levels, its numbers read the way the species' traits
// give them. Opt-in:
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
import { toggle } from '../../src/engine/play/reducers.ts';
import type { Character, ContentEntity } from '../../src/schema/index.ts';
import { nodeFileSource } from './nodeFileSource.ts';

const root = process.env.FIVETOOLS_DATA;

describe.skipIf(!root)('supplement species golden checks (local data)', () => {
  let index: ContentIndex;
  let catalog: Catalog;

  beforeAll(async () => {
    const result = await importFivetools(nodeFileSource(root!), { now: 1 });
    const all = Object.values(result.entities).flat() as ContentEntity[];
    index = createContentIndex(all);
    catalog = createCatalog(all, new Set(['XPHB', 'EFA', 'FRHoF', 'RHW', 'AU', 'ABH', 'LFL']));
  });

  /** A soldier fighter of this species, quick-built, with these toggles switched on (paid). */
  function build(
    speciesId: string,
    levels: number,
    toggles: string[] = [],
  ): { c: Character; s: DerivedSheet } {
    const registry = featureEffects();
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
      // Every die rolls 3, so temporary hit points read as a fixed number.
      c = toggle(c, s, t, true, { rollAmount: (expr) => evalDice(expr) });
      s = derive(c, index, { registry });
    }
    expect(s.choices.pending).toEqual([]);
    return { c, s };
  }
  const evalDice = (expr: string) =>
    expr
      .split('+')
      .map((p) => p.trim())
      .reduce((n, p) => {
        const m = /^(\d+)d\d+$/.exec(p);
        return n + (m ? 3 * Number(m[1]) : Number(p));
      }, 0);
  const resource = (s: DerivedSheet, name: string) => s.resources.find((r) => r.name === name);
  const actionNamed = (s: DerivedSheet, name: string) => s.actions.find((a) => a.name === name);
  const sense = (s: DerivedSheet, name: string) =>
    s.senses.find((x) => x.value.sense === name)?.value.range;

  it('Boggart: Fury of the Small rider and uses, Nimble Escape', () => {
    const { s } = build('boggart|lfl', 5);
    expect(resource(s, 'Fury of the Small')?.max.value).toBe(3);
    const unarmed = s.attacks.find((a) => a.name === 'Unarmed Strike')!;
    expect(unarmed.riders.find((r) => r.name === 'Fury of the Small')?.dice).toBe('3');
    expect(actionNamed(s, 'Nimble Escape')?.actionType).toBe('bonus');
  });

  it('Changeling: Shape-Shifter gives advantage on Charisma checks', () => {
    const { s } = build('changeling|efa', 3, ['shape-shifter']);
    expect(s.skills.persuasion.mode).toBe('advantage');
  });

  it('Dhampir: Vampiric Bite uses and damage', () => {
    const { s } = build('dhampir|rhw', 11);
    expect(resource(s, 'Vampiric Bite')?.max.value).toBe(4);
    // The bite is an attack: Strength to hit, Constitution to damage.
    const bite = s.attacks.find((a) => a.name === 'Vampiric Bite');
    expect(bite).toMatchObject({ ability: 'str', damageDice: '1d4', damageType: 'piercing' });
    expect(bite?.damageBonus.parts[0]).toMatchObject({ label: 'CON modifier' });
    expect(actionNamed(s, 'Vampiric Bite: Empower')).toBeDefined();
  });

  it('Hexblood: one Eerie Token per Long Rest', () => {
    const { s } = build('hexblood|rhw', 3);
    expect(resource(s, 'Eerie Token')?.max.value).toBe(1);
    expect(actionNamed(s, 'Eerie Token')?.actionType).toBe('bonus');
  });

  it('Kalashtar: Dual Mind and telepathy by level', () => {
    const one = build('kalashtar|efa', 1).s;
    expect(one.saves.wis.mode).toBe('advantage');
    expect(one.saves.cha.mode).toBe('advantage');
    expect(sense(one, 'telepathy')).toBe(10);
    expect(sense(build('kalashtar|efa', 11).s, 'telepathy')).toBe(110);
    expect(sense(build('kalashtar|efa', 20).s, 'telepathy')).toBe(200);
  });

  it('Khoravar: Lethargy Resilience', () => {
    const { s } = build('khoravar|efa', 5);
    expect(resource(s, 'Lethargy Resilience')?.max.value).toBe(1);
  });

  it('Lupin: Howl uses and DC', () => {
    const { s } = build('lupin|rhw', 5);
    expect(resource(s, 'Howl')?.max.value).toBe(3);
    expect(actionNamed(s, 'Howl')?.actionType).toBe('bonus');
  });

  it('Reborn: advantage on Death Saving Throws, Knowledge from a Past Life', () => {
    const { s } = build('reborn|rhw', 20);
    expect(s.deathSave.mode).toBe('advantage');
    expect(resource(s, 'Knowledge from a Past Life')?.max.value).toBe(6);
  });

  it('Shifter: Shifting and its four forms', () => {
    const base = build('shifter|efa', 5, ['shifting']);
    expect(resource(base.s, 'Shifting')?.max.value).toBe(3);
    expect(base.c.state.tempHp).toBe(6);

    const hide = build('shifter; beasthide|efa', 11, ['shifting']);
    const plain = build('shifter; beasthide|efa', 11).s;
    // Twice the Proficiency Bonus (8) and a d6 (3).
    expect(hide.c.state.tempHp).toBe(11);
    expect(hide.s.ac.value).toBe(plain.ac.value + 1);

    const tooth = build('shifter; longtooth|efa', 3, ['shifting']).s;
    const fangs = tooth.attacks.find((a) => a.name === 'Longtooth Fangs')!;
    expect(fangs.damageDice).toBe('1d6');
    expect(fangs.damageType).toBe('piercing');
    expect(fangs.damageBonus.value).toBe(tooth.abilities.str.mod);
    expect(actionNamed(tooth, 'Longtooth Fangs')?.actionType).toBe('bonus');

    const stride = build('shifter; swiftstride|efa', 5, ['shifting']).s;
    expect(stride.speed.walk?.value).toBe(40);

    const hunt = build('shifter; wildhunt|efa', 5, ['shifting']).s;
    expect(hunt.skills.perception.mode).toBe('advantage');
  });

  it('Warforged: Integrated Protection', () => {
    const plain = build('human|xphb', 5).s;
    const { s } = build('warforged|efa', 5);
    expect(s.ac.value).toBe(plain.ac.value + 1);
  });
});
