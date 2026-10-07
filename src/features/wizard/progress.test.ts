import { beforeAll, describe, expect, it } from 'vitest';
import type { AutoContext } from '../../engine/build/autoChoose.ts';
import { createCatalog, type Catalog } from '../../engine/build/catalog.ts';
import {
  chooseBackground,
  chooseClass,
  chooseSpecies,
  newDraft,
} from '../../engine/build/wizard.ts';
import type { ContentIndex } from '../../engine/content/contentIndex.ts';
import { derive } from '../../engine/derive/derive.ts';
import type { Character, ContentEntity, Species } from '../../schema/index.ts';
import { fixtureContent } from '../../test/fixtureIndex.ts';
import { FIXTURE_FEATURE_EFFECTS } from '../../test/fixtureFeatureEffects.ts';
import { stepOf, variantLabel, variantsOf, wizardTodos } from './progress.ts';

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

const registry = FIXTURE_FEATURE_EFFECTS;
const brute = { kind: 'class', id: 'brute|tst' } as const;
const arenaHand = { kind: 'background', id: 'arena hand|tst' } as const;
const mossling = { kind: 'species', id: 'mossling|tst' } as const;

function ctxOf(character: Character): AutoContext {
  return { character, sheet: derive(character, index, { registry }), catalog, index };
}
const todos = (c: Character) => wizardTodos(c, c.log.length ? ctxOf(c) : undefined);

describe('what each wizard step still needs (plan §9.3b, step 4B.5)', () => {
  it('a new draft needs a class first', () => {
    expect(todos(newDraft(0))).toEqual([{ step: 'class', text: 'Choose a class' }]);
  });

  it('lists each step’s required picks, in step order', () => {
    const c = chooseClass(newDraft(0), brute, index);
    expect(todos(c)).toEqual([
      { step: 'class', text: 'Brute: Skills (2 more)' },
      { step: 'class', text: 'Brute: starting equipment' },
      { step: 'background', text: 'Choose a background' },
      { step: 'species', text: 'Choose a species' },
      { step: 'choices', text: 'Weapon Mastery: Weapon Mastery (2 more)' },
    ]);
  });

  it('a background’s picks, its Origin feat’s included, are made on the background step', () => {
    const c = chooseBackground(chooseClass(newDraft(0), brute, index), arenaHand);
    const ctx = ctxOf(c);
    const background = todos(c).filter((t) => t.step === 'background');
    expect(background.map((t) => t.text)).toEqual(
      expect.arrayContaining([
        'Arena Hand: Ability Scores',
        'Spark Initiate; Gladiator: Spells (2 more)',
        'Arena Hand: starting equipment',
      ]),
    );
    // The fixture has no artisan's tools: a pick nothing can fill never blocks.
    expect(background.some((t) => t.text.includes('Tools'))).toBe(false);
    const featSpells = ctx.sheet.choices.pending.find(
      (p) => p.offer.source.name === 'Spark Initiate; Gladiator' && p.offer.kind === 'spell',
    );
    expect(stepOf(featSpells!.offer, ctx.sheet)).toBe('background');
  });

  it('a species with versions needs one picked, named for what it calls them', () => {
    const c = chooseSpecies(chooseClass(newDraft(0), brute, index), mossling);
    const variants = variantsOf(index.get(mossling) as Species, ctxOf(c));
    expect(variants.map((v) => v.name)).toContain('Mossling; Deep Lineage');
    // "Mossling (red)" is not a lineage: the menu says Type.
    expect(variantLabel(variants)).toBe('Type');
    expect(variantLabel(variants.filter((v) => v.name.includes('Lineage')))).toBe('Lineage');
    // Its own picks wait for the version: only the version is asked for.
    expect(todos(c).filter((t) => t.step === 'species')).toEqual([
      { step: 'species', text: 'Choose a type' },
    ]);
  });

  it('point buy over 27 points, and rolling without rolls, hold the abilities step', () => {
    const c = chooseClass(newDraft(0), brute, index);
    const over: Character = {
      ...c,
      scoreMethod: 'pointBuy',
      baseScores: { str: 15, dex: 15, con: 15, int: 10, wis: 8, cha: 8 },
    };
    expect(todos(over)).toContainEqual({ step: 'abilities', text: 'Point buy: 2 points over' });
    const unrolled: Character = { ...c, scoreMethod: 'rolled' };
    expect(todos(unrolled)).toContainEqual({ step: 'abilities', text: 'Roll your scores' });
  });
});
