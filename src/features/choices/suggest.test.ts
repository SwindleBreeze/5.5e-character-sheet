import { beforeAll, describe, expect, it } from 'vitest';
import { createCatalog, type Catalog } from '../../engine/build/catalog.ts';
import { chooseBackground, chooseClass, newDraft } from '../../engine/build/wizard.ts';
import type { ContentIndex } from '../../engine/content/contentIndex.ts';
import { derive } from '../../engine/derive/derive.ts';
import type { Background, Character, ContentEntity } from '../../schema/index.ts';
import { fixtureContent } from '../../test/fixtureIndex.ts';
import { FIXTURE_FEATURE_EFFECTS } from '../../test/fixtureFeatureEffects.ts';
import { classFocus, originSuggestion, suggestion } from './suggest.ts';

let index: ContentIndex;
let catalog: Catalog;
beforeAll(async () => {
  const content = await fixtureContent();
  index = content.index;
  catalog = createCatalog(
    Object.values(content.entities).flat() as ContentEntity[],
    new Set(['TST']),
  );
});

const arenaHand = { kind: 'background', id: 'arena hand|tst' } as const;
function ctxOf(c: Character) {
  return {
    character: c,
    sheet: derive(c, index, { registry: FIXTURE_FEATURE_EFFECTS }),
    catalog,
    index,
  };
}

describe('what suits the class (plan step 4C.3)', () => {
  it('marks increases, skills and backgrounds that serve the primary ability', () => {
    const c = chooseBackground(
      chooseClass(newDraft(0), { kind: 'class', id: 'brute|tst' }),
      arenaHand,
    );
    const ctx = ctxOf(c);
    const offerOf = (kind: string) =>
      ctx.sheet.features.flatMap((f) => f.choices).find((x) => x.offer.kind === kind)!.offer;
    const spread = offerOf('backgroundAbility');
    expect(suggestion(spread, 'str,str,con', ctx)).toBe(
      'Raises Strength, the Brute’s primary ability',
    );
    expect(suggestion(spread, 'con,con,str', ctx)).toBeUndefined();
    const skills = ctx.sheet.features
      .flatMap((f) => f.choices)
      .find((x) => x.offer.kind === 'proficiency' && x.offer.key.owner.id === 'brute|tst')!.offer;
    expect(suggestion(skills, 'athletics', ctx)).toBe('Uses Strength, the Brute’s primary ability');
    expect(suggestion(skills, 'survival', ctx)).toBeUndefined();
    expect(originSuggestion(index.get(arenaHand) as Background, classFocus(c, index))).toBe(
      'Good for a Brute: raises Strength',
    );
    // No class yet: nothing to go by.
    expect(originSuggestion(index.get(arenaHand) as Background, undefined)).toBeUndefined();
  });
});
