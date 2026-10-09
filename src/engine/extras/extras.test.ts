import { beforeAll, describe, expect, it } from 'vitest';
import type { Character, Creature } from '../../schema/index.ts';
import { testCharacter } from '../../test/characters.ts';
import { FIXTURE_FEATURE_EFFECTS } from '../../test/fixtureFeatureEffects.ts';
import { fixtureIndex } from '../../test/fixtureIndex.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import { characterRefs } from '../content/refs.ts';
import { derive } from '../derive/derive.ts';
import { toggle } from '../play/reducers.ts';
import {
  addExtra,
  damageExtra,
  extraHp,
  healExtra,
  removeExtra,
  resetExtra,
  scaleContext,
  setExtraHpMax,
  setExtraSpellLevel,
  setExtraTempHp,
} from './extras.ts';
import { scaledAc, scaledHp } from './scaling.ts';
import {
  activeForm,
  formIssue,
  setActiveForm,
  setWildShapeForms,
  wildShapeRules,
  type WildShapeRules,
} from './wildShape.ts';

let index: ContentIndex;
beforeAll(async () => {
  index = await fixtureIndex();
});

const creature = (id: string) => index.get({ kind: 'creature', id }) as Creature;
const sheetOf = (c: Character) => derive(c, index, { registry: FIXTURE_FEATURE_EFFECTS });

const lorekeeper = () =>
  testCharacter({
    classes: [{ classId: 'lorekeeper|tst', levels: 5 }],
    scores: { int: 16 },
  });
const wanderer = (levels: number) =>
  testCharacter({ classes: [{ classId: 'wanderer|tst', levels }], scores: { wis: 14 } });

describe('extras', () => {
  it('adds a summon at its spell level, tracks its HP and removes it', () => {
    let c = addExtra(lorekeeper(), { creature: creature('boom spirit (air)|tst') });
    const extra = c.extras?.[0];
    expect(extra).toMatchObject({
      name: 'Boom Spirit (Air)',
      creatureRef: { kind: 'creature', id: 'boom spirit (air)|tst' },
      spellLevel: 3,
      damage: 0,
      tempHp: 0,
    });
    const uid = extra?.uid ?? '';
    c = setExtraSpellLevel(c, uid, 5);
    const sheet = sheetOf(c);
    const ctx = scaleContext(sheet, creature('boom spirit (air)|tst'), c.extras?.[0]);
    expect(ctx).toMatchObject({ spellLevel: 5, pb: 3, spellAttack: 6, spellDc: 14 });
    expect(extraHp(c.extras![0]!, creature('boom spirit (air)|tst'), ctx)).toEqual({
      current: 40,
      max: 40,
      temp: 0,
      maxFrom: 'statBlock',
    });

    c = setExtraTempHp(c, uid, 5);
    c = setExtraTempHp(c, uid, 3);
    c = damageExtra(c, uid, 12, 40);
    expect(c.extras?.[0]).toMatchObject({ tempHp: 0, damage: 7 });
    c = damageExtra(c, uid, 100, 40);
    expect(c.extras?.[0]?.damage).toBe(40);
    c = healExtra(c, uid, 15);
    expect(c.extras?.[0]?.damage).toBe(25);
    c = resetExtra(c, uid);
    expect(c.extras?.[0]).toMatchObject({ damage: 0, tempHp: 0 });
    expect(removeExtra(c, uid).extras).toEqual([]);
  });

  it('takes the player’s own maximum when the stat block’s depends on a choice', () => {
    let c = addExtra(lorekeeper(), { creature: creature('boom spirit|tst') });
    const uid = c.extras?.[0]?.uid ?? '';
    const ctx = scaleContext(sheetOf(c), creature('boom spirit|tst'), c.extras?.[0]);
    expect(extraHp(c.extras![0]!, creature('boom spirit|tst'), ctx).maxFrom).toBe('unknown');
    c = setExtraHpMax(c, uid, 30);
    expect(extraHp(c.extras![0]!, creature('boom spirit|tst'), ctx)).toMatchObject({
      max: 30,
      maxFrom: 'player',
    });
    expect(setExtraHpMax(c, uid, undefined).extras?.[0]?.hpMax).toBeUndefined();
  });

  it('scales a class companion with the class level; no caster leaves its attack as text', () => {
    const c = addExtra(wanderer(5), { creature: creature('trail hound|tst') });
    expect(c.extras?.[0]?.spellLevel).toBeUndefined();
    const hound = creature('trail hound|tst');
    const ctx = scaleContext(sheetOf(c), hound, c.extras?.[0]);
    expect(ctx.spellAttack).toBeUndefined();
    expect(scaledAc(hound, ctx).value).toBe(15);
    expect(scaledHp(hound, ctx)).toMatchObject({ value: 30, hitDice: '5d8' });
  });

  it('loads the creatures a character has into its content', () => {
    let c = addExtra(lorekeeper(), { creature: creature('glimmer moth|tst') });
    c = setWildShapeForms(c, ['moss boar|tst', 'moss boar|tst']);
    expect(c.wildShapeForms).toEqual(['moss boar|tst']);
    expect(characterRefs(c)).toEqual(
      expect.arrayContaining([
        { kind: 'creature', id: 'glimmer moth|tst' },
        { kind: 'creature', id: 'moss boar|tst' },
      ]),
    );
  });
});

describe('Wild Shape', () => {
  const rulesAt = (level: number) => wildShapeRules(sheetOf(wanderer(level)), index);

  it('reads known forms, maximum CR and flying from the feature’s table', () => {
    expect(wildShapeRules(sheetOf(wanderer(1)), index)).toBeUndefined();
    expect(rulesAt(2)).toMatchObject({
      className: 'Wanderer',
      level: 2,
      known: 2,
      maxCr: 0.25,
      fly: false,
      tempHp: '2',
    });
    expect(rulesAt(5)).toMatchObject({ known: 3, maxCr: 0.5, fly: false });
    expect(rulesAt(6)).toMatchObject({ known: 4, maxCr: 1, fly: true });
  });

  it('says why a creature can’t be a known form', () => {
    const rules = rulesAt(2) as WildShapeRules;
    expect(formIssue(creature('moss boar|tst'), rules)).toBeUndefined();
    expect(formIssue(creature('cliff goat|tst'), rules)).toBe('CR 1/2 is over 1/4');
    expect(formIssue(creature('glimmer moth|tst'), rules)).toBe('Has a Fly Speed');
    expect(formIssue(creature('swarm of gnats|tst'), rules)).toBe('A swarm');
    expect(formIssue(creature('pebble crab|tst'), rules)).toBe('Not a Beast');
    expect(formIssue(creature('storm hawk|tst'), rulesAt(6) as WildShapeRules)).toBeUndefined();
  });

  it('taking a form pays the use, gives the temporary HP and remembers the form', () => {
    const c = setWildShapeForms(wanderer(4), ['moss boar|tst']);
    const sheet = sheetOf(c);
    const on = toggle(c, sheet, 'wild-shape', true, {
      option: 'moss boar|tst',
      rollAmount: (e) => Number(e),
    });
    expect(activeForm(on)).toBe('moss boar|tst');
    expect(on.state.tempHp).toBe(4);
    expect(sheetOf(on).resources.find((r) => r.resourceId === 'wild-shape')?.used).toBe(1);

    // Switched on from the Actions tab, without a form: the form is said afterwards.
    const bare = toggle(c, sheet, 'wild-shape', true, { rollAmount: (e) => Number(e) });
    expect(activeForm(bare)).toBeUndefined();
    expect(activeForm(setActiveForm(bare, 'moss boar|tst'))).toBe('moss boar|tst');
    expect(setActiveForm(c, 'moss boar|tst')).toBe(c);
  });
});
