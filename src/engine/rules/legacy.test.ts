import { beforeAll, describe, expect, it } from 'vitest';
import type { Character, ContentEntity } from '../../schema/index.ts';
import { SHOW_2014 } from '../../sources/sourceFilter.ts';
import { testCharacter } from '../../test/characters.ts';
import { FIXTURE_FEATURE_EFFECTS } from '../../test/fixtureFeatureEffects.ts';
import { fixtureContent } from '../../test/fixtureIndex.ts';
import { createCatalog, type Catalog } from '../build/catalog.ts';
import { offerOptions } from '../choices/options.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import { derive } from '../derive/derive.ts';
import type { DerivedSheet } from '../derive/types.ts';
import { LEGACY_ORIGIN_FEAT_SLOT } from './legacy.ts';

let index: ContentIndex;
let catalog: Catalog;
beforeAll(async () => {
  const content = await fixtureContent();
  index = content.index;
  catalog = createCatalog(
    Object.values(content.entities).flat() as ContentEntity[],
    new Set(['TST', 'OLD', SHOW_2014]),
  );
});

const sheetOf = (c: Character) => derive(c, index, { registry: FIXTURE_FEATURE_EFFECTS });
const choices = (s: DerivedSheet) => s.features.flatMap((f) => f.choices);
const options = (c: Character, slot: string) => {
  const sheet = sheetOf(c);
  const choice = choices(sheet).find((x) => x.offer.key.slot === slot);
  if (!choice) throw new Error(`no ${slot} choice`);
  return offerOptions(choice.offer, { character: c, sheet, catalog, index }).options.map(
    (o) => o.value,
  );
};
const brute = (spec: { levels?: number; speciesId?: string; backgroundId?: string }) =>
  testCharacter({
    classes: [{ classId: 'brute|tst', levels: spec.levels ?? 1 }],
    speciesId: spec.speciesId ?? 'mossling|tst',
    backgroundId: spec.backgroundId ?? 'arena hand|tst',
    scores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  });

describe('2014 options on a 2024 character (step 8.2)', () => {
  it('a 2014 species gives no ability increases: the background does', () => {
    const c = brute({ speciesId: 'cragling|old' });
    const sheet = sheetOf(c);
    expect(sheet.abilities.str.score.value).toBe(10);
    expect(sheet.abilities.con.score.value).toBe(10);
    const kinds = choices(sheet).map((x) => x.offer.kind);
    expect(kinds).toContain('backgroundAbility');
    expect(choices(sheet).some((x) => x.offer.key.slot === 'abilitySet')).toBe(false);
    // A plain bonus too: Stoneborn's +2 CON.
    expect(sheetOf(brute({ speciesId: 'stoneborn|old' })).abilities.con.score.value).toBe(10);
    expect(
      sheetOf({ ...brute({ speciesId: 'stoneborn|old' }), legacyAbilities: true }).abilities.con
        .score.value,
    ).toBe(12);
  });

  it('kept on request, the species increases replace the background’s', () => {
    const c: Character = { ...brute({ speciesId: 'cragling|old' }), legacyAbilities: true };
    const sheet = sheetOf(c);
    // Cragling: +2 STR and +1 CON, or +1 to three of STR, CON and WIS (a choice of sets).
    expect(choices(sheet).some((x) => x.offer.key.slot === 'abilitySet')).toBe(true);
    expect(choices(sheet).map((x) => x.offer.kind)).not.toContain('backgroundAbility');
    // A 2024 species ignores the switch.
    const mossling: Character = { ...brute({}), legacyAbilities: true };
    expect(choices(sheetOf(mossling)).map((x) => x.offer.kind)).toContain('backgroundAbility');
  });

  it('a 2014 background offers free ability increases and an Origin feat', () => {
    const c = brute({ backgroundId: 'old sailor|old' });
    const sheet = sheetOf(c);
    const ability = choices(sheet).find((x) => x.offer.kind === 'backgroundAbility');
    expect(ability?.offer.from).toEqual(['str', 'dex', 'con', 'int', 'wis', 'cha']);
    expect(ability?.offer.count).toBe(3);
    const feats = options(c, LEGACY_ORIGIN_FEAT_SLOT);
    expect(feats).toContain('spark initiate|tst');
    expect(feats).not.toContain('arena veteran|tst'); // a General feat
    // Its own proficiencies still come with it.
    expect(sheet.skills.perception.proficiency).toBe('proficient');
  });

  it('a 2014 feat has no category: it is offered as a General feat', () => {
    const c = brute({ levels: 4 });
    const feats = options(c, 'feat');
    expect(feats).toContain('old grit|old');
    expect(feats).toContain('arena veteran|tst');
    expect(feats).not.toContain('spark initiate|tst'); // an Origin feat
  });
});
