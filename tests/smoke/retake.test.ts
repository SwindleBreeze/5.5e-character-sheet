// A pick taken back can be picked again (play-test fix), on real data: a skill a Rogue also
// chose Expertise in, and a spell taken out of a Wizard's spellbook, aren't "already had" once
// unpicked. Opt-in:
//   FIVETOOLS_DATA=./5etools-src-2.36.1 npm run test:smoke
// Checks names and keys only; it never prints or stores content.

import { beforeAll, describe, expect, it } from 'vitest';
import { importFivetools } from '../../src/adapters/fivetools/index.ts';
import { createCatalog, type Catalog } from '../../src/engine/build/catalog.ts';
import { quickBuild } from '../../src/engine/build/quickBuild.ts';
import { offerOptions } from '../../src/engine/choices/options.ts';
import { createContentIndex, type ContentIndex } from '../../src/engine/content/contentIndex.ts';
import { derive } from '../../src/engine/derive/derive.ts';
import type { DerivedSheet } from '../../src/engine/derive/types.ts';
import { featureEffects } from '../../src/engine/featureEffects/index.ts';
import { setPick } from '../../src/engine/play/features.ts';
import { decodeChoiceKey, type Character, type ContentEntity } from '../../src/schema/index.ts';
import { nodeFileSource } from './nodeFileSource.ts';

const root = process.env.FIVETOOLS_DATA;

describe.skipIf(!root)('a pick taken back can be picked again (local data)', () => {
  let index: ContentIndex;
  let catalog: Catalog;
  const registry = featureEffects();

  beforeAll(async () => {
    const result = await importFivetools(nodeFileSource(root!), { now: 1 });
    const all = Object.values(result.entities).flat() as ContentEntity[];
    index = createContentIndex(all);
    catalog = createCatalog(all, new Set(['XPHB']));
  });

  const sheetOf = (c: Character) => derive(c, index, { registry });
  const build = (classId: string) =>
    quickBuild(
      {
        name: 'P',
        classes: [{ classId, levels: 1 }],
        backgroundId: 'soldier|xphb',
        speciesId: 'human|xphb',
      },
      { index, catalog, registry, now: 1 },
    );
  const choice = (sheet: DerivedSheet, key: string) =>
    sheet.features.flatMap((f) => f.choices).find((x) => x.key === key)!;
  /** Take `value` out of the pick, and say whether it is offered again (not marked taken). */
  const retake = (c: Character, key: string, value: string) => {
    const before = choice(sheetOf(c), key);
    const rest = before.values.filter((v) => v !== value);
    const after = setPick(c, decodeChoiceKey(key), { values: rest, labels: rest, entryIndex: 0 });
    const sheet = sheetOf(after);
    const now = choice(sheet, key);
    const { options } = offerOptions(
      now.offer,
      { character: after, sheet, catalog, index },
      now.values,
    );
    return { character: after, sheet, option: options.find((o) => o.value === value) };
  };

  it('a Rogue’s skill with Expertise in it', () => {
    const c = build('rogue|xphb');
    const sheet = sheetOf(c);
    const expertise = sheet.features
      .flatMap((f) => f.choices)
      .find((x) => x.offer.kind === 'expertise')!;
    const skill = expertise.values[0]!;
    const skills = sheet.features
      .flatMap((f) => f.choices)
      .find((x) => x.offer.kind === 'proficiency' && x.values.includes(skill))!;
    const { option, sheet: after } = retake(c, skills.key, skill);
    expect(option).toBeDefined();
    expect(option!.taken).toBeUndefined();
    expect(after.issues.map((i) => i.code)).toContain('expertiseWithoutProficiency');
  });

  it('a spell taken out of a Wizard’s spellbook', () => {
    const c = build('wizard|xphb');
    const book = sheetOf(c)
      .features.flatMap((f) => f.choices)
      .find((x) => x.key.includes('#spellbook'))!;
    const spell = book.values[0]!;
    expect(c.state.prepared['wizard|xphb']).toContain(spell);
    const { option, character } = retake(c, book.key, spell);
    expect(option!.taken).toBeUndefined();
    expect(character.state.prepared['wizard|xphb']).not.toContain(spell);
  });
});
