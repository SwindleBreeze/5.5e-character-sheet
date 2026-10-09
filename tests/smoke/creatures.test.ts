// Opt-in checks of the creature subset (plan §10.3, step 7.6) against a real local 5etools
// checkout: FIVETOOLS_DATA=<path> npm run test:smoke. Counts and shapes only; no content.

import { beforeAll, describe, expect, it } from 'vitest';
import { importFivetools, type ImportResult } from '../../src/adapters/fivetools/index.ts';
import {
  evalWritten,
  scaledAc,
  scaledHp,
  scaleEntries,
  type ScaleContext,
} from '../../src/engine/extras/scaling.ts';
import { formIssue, formsTableAt, type WildShapeRules } from '../../src/engine/extras/wildShape.ts';
import type { ClassFeature, Creature } from '../../src/schema/index.ts';
import { nodeFileSource } from './nodeFileSource.ts';

const root = process.env.FIVETOOLS_DATA;

const ctx = (more: Partial<ScaleContext> = {}): ScaleContext => ({
  classLevels: {},
  charLevel: 5,
  pb: 3,
  mods: { str: 0, dex: 2, con: 1, int: 3, wis: 3, cha: 0 },
  spellAttack: 6,
  spellDc: 14,
  ...more,
});

describe.skipIf(!root)('creatures (local data)', () => {
  let result: ImportResult;
  let creatures: Creature[];
  const get = (id: string) => {
    const c = creatures.find((x) => x.id === id);
    if (!c) throw new Error(`missing ${id}`);
    return c;
  };

  beforeAll(async () => {
    result = await importFivetools(nodeFileSource(root!), { now: 1 });
    creatures = result.entities.creature ?? [];
  });

  it('keeps a few hundred of the bestiary, Beasts and summons from the 2024 books', () => {
    expect(creatures.length).toBeGreaterThan(400);
    expect(creatures.length).toBeLessThan(1000);
    const xmm = creatures.filter((c) => c.source === 'XMM');
    expect(xmm.filter((c) => c.creatureType === 'beast').length).toBeGreaterThan(80);
    expect(xmm.filter((c) => c.familiar).length).toBeGreaterThan(20);
    const xphb = creatures.filter((c) => c.source === 'XPHB' && !c.variantOf);
    expect(xphb.filter((c) => c.summon).length).toBeGreaterThanOrEqual(15);
  });

  it('links summons to their spell or class', () => {
    expect(get('bestial spirit|xphb').summon).toEqual({
      spellId: 'summon beast|xphb',
      spellLevel: 2,
    });
    expect(get('beast of the land|xphb').summon).toEqual({ classId: 'ranger|xphb' });
    expect(get('steel defender|efa').summon).toEqual({ classId: 'artificer|efa' });
    expect(get('otherworldly steed (fey)|xphb').variantOf).toBe('otherworldly steed|xphb');
    expect(get('wolf|xmm')).toMatchObject({ creatureType: 'beast', cr: '1/4' });
    expect(get('pseudodragon|xmm').familiar).toBe(true);
  });

  it('works out the written AC and HP of the 2024 summons', () => {
    const land = get('bestial spirit (land)|xphb');
    expect(scaledAc(land, ctx({ spellLevel: 2 })).value).toBe(13);
    expect(scaledHp(land, ctx({ spellLevel: 4 })).value).toBe(40);
    const steed = get('otherworldly steed|xphb');
    expect(scaledAc(steed, ctx({ spellLevel: 2 })).value).toBe(12);
    expect(scaledHp(steed, ctx({ spellLevel: 2 }))).toMatchObject({ value: 25, hitDice: '2d10' });
    const beast = get('beast of the land|xphb');
    const ranger = ctx({ classLevels: { ranger: 5 } });
    expect(scaledAc(beast, ranger).value).toBe(16);
    expect(scaledHp(beast, ranger)).toMatchObject({ value: 30, hitDice: '5d8' });
    const defender = get('steel defender|efa');
    const artificer = ctx({ classLevels: { artificer: 3 } });
    expect(scaledAc(defender, artificer).value).toBe(15);
    expect(scaledHp(defender, artificer).value).toBe(20);

    // Most XPHB summons' AC and HP come out as numbers at their lowest level.
    const summons = creatures.filter((c) => c.source === 'XPHB' && c.summon?.spellLevel);
    const worked = summons.filter((c) => {
      const at = ctx({ spellLevel: c.summon?.spellLevel ?? 1 });
      const ac = c.ac[0]?.special;
      return (!ac || evalWritten(ac, at) !== undefined) && scaledHp(c, at).value !== undefined;
    });
    expect(worked.length / summons.length).toBeGreaterThan(0.6);
  });

  it('puts the spell level into every 2024 summon’s damage dice', () => {
    for (const c of creatures.filter((x) => x.source === 'XPHB' && x.summon?.spellLevel)) {
      const text = JSON.stringify(scaleEntries(c.entries, ctx({ spellLevel: 5 })));
      expect(text, c.id).not.toContain('summonSpellLevel');
      expect(text, c.id).not.toContain('hitYourSpellAttack');
    }
  });

  it('reads the Druid’s known forms table, and Beasts fit it', () => {
    const feature = (result.entities.classFeature ?? []).find(
      (f) => f.id === 'wild shape|druid|xphb|2|xphb',
    ) as ClassFeature;
    expect(formsTableAt(feature.entries, 2)).toEqual({ known: 4, maxCr: 0.25, fly: false });
    expect(formsTableAt(feature.entries, 5)).toEqual({ known: 6, maxCr: 0.5, fly: false });
    expect(formsTableAt(feature.entries, 8)).toEqual({ known: 8, maxCr: 1, fly: true });
    const rules = { level: 2, known: 4, maxCr: 0.25, fly: false } as WildShapeRules;
    const forms = creatures.filter((c) => c.source === 'XMM' && !formIssue(c, rules));
    expect(forms.length).toBeGreaterThan(10);
    expect(forms.map((c) => c.id)).toContain('wolf|xmm');
  });
});
