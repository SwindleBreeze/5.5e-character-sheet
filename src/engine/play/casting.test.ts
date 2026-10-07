import { beforeAll, describe, expect, it } from 'vitest';
import type { Character, ContentEntity, Spell } from '../../schema/index.ts';
import { FIXTURE_FEATURE_EFFECTS } from '../../test/fixtureFeatureEffects.ts';
import { fixtureContent } from '../../test/fixtureIndex.ts';
import { createCatalog, type Catalog } from '../build/catalog.ts';
import { quickBuild } from '../build/quickBuild.ts';
import { createContentIndex, type ContentIndex } from '../content/contentIndex.ts';
import { derive } from '../derive/derive.ts';
import type { DerivedGrantedSpell, DerivedSheet } from '../derive/types.ts';
import { castWayLabel, castWays, isConcentration } from './casting.ts';
import { canPay, choicesNeeded, hitDieChoices, slotChoices } from './costs.ts';
import {
  castSpellAs,
  endTurn,
  longRest,
  payCost,
  setPrepared,
  spendHitDice,
  toggle,
  useAction,
} from './reducers.ts';

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

const sheetOf = (c: Character): DerivedSheet =>
  derive(c, index, { registry: FIXTURE_FEATURE_EFFECTS });
const spell = (id: string) => index.get({ kind: 'spell', id }) as Spell;

/** Lorekeeper 5 (full caster, spellbook) / Pactbinder 2 (Pact Magic): slots 4/2/1, pact 2 at 1. */
function duo(): Character {
  return quickBuild(
    {
      name: 'Test',
      speciesId: 'mossling|tst',
      backgroundId: 'arena hand|tst',
      classes: [
        { classId: 'lorekeeper|tst', levels: 5 },
        { classId: 'pactbinder|tst', levels: 2 },
      ],
    },
    { index, catalog, registry: FIXTURE_FEATURE_EFFECTS, now: 0 },
  );
}

/** Gladiator 6 (half caster, a Long Rest caster like a Paladin): slots 4/2. */
function gladiator(): Character {
  return quickBuild(
    {
      name: 'Test',
      speciesId: 'mossling|tst',
      backgroundId: 'arena hand|tst',
      classes: [{ classId: 'gladiator|tst', levels: 6 }],
    },
    { index, catalog, registry: FIXTURE_FEATURE_EFFECTS, now: 0 },
  );
}

describe('spell slots as payment', () => {
  it('offers every level at or above the minimum with a slot left, then Pact Magic', () => {
    const c = duo();
    c.state.slotsUsed = [0, 2, 0];
    const s = sheetOf(c);
    expect(slotChoices(s, 1)).toEqual([
      { level: 1, left: 4 },
      { level: 3, left: 1 },
      { level: 1, pact: true, left: 2 },
    ]);
    expect(slotChoices(s, 2)).toEqual([{ level: 3, left: 1 }]);
    expect(slotChoices(s, 4)).toEqual([]);
  });

  it('pays resource, slot and Hit Dice costs; an action cost is only a reminder', () => {
    const c = duo();
    const s = sheetOf(c);
    expect(canPay(s, { label: 'a level 3+ spell slot', slot: { minLevel: 3 } })).toBe(true);
    expect(canPay(s, { label: 'a level 4+ spell slot', slot: { minLevel: 4 } })).toBe(false);
    const slot = payCost(c, s, { label: 'slot', slot: { minLevel: 2 } }, { slot: { level: 3 } });
    expect(slot.state.slotsUsed).toEqual([0, 0, 1]);
    const pact = payCost(
      c,
      s,
      { label: 'slot', slot: { minLevel: 1 } },
      { slot: { level: 1, pact: true } },
    );
    expect(pact.state.pactSlotsUsed).toBe(1);
    // A slot cost with no slot picked is left unpaid.
    expect(payCost(c, s, { label: 'slot', slot: { minLevel: 1 } })).toBe(c);
    expect(payCost(c, s, { label: 'a Bonus Action' })).toBe(c);
  });

  it('Hit Dice: the size asked for first, then the largest; several sizes need a choice', () => {
    const c = duo();
    const s = sheetOf(c);
    expect(hitDieChoices(s).map((h) => h.faces)).toEqual(
      [...new Set(s.hitDice.map((h) => h.faces))].sort((a, b) => b - a),
    );
    const small = Math.min(...s.hitDice.map((h) => h.faces));
    const big = Math.max(...s.hitDice.map((h) => h.faces));
    const paid = spendHitDice(c, s, 1, small);
    expect(paid.state.hitDiceUsed).toEqual({ [small]: 1 });
    expect(spendHitDice(c, s, 1).state.hitDiceUsed).toEqual({ [big]: 1 });
    const cost = { label: '1 Hit Die', amount: 1, hitDice: true as const };
    expect(choicesNeeded(s, [cost])).toEqual(small === big ? {} : { hitDie: true });
    expect(canPay(s, { ...cost, amount: 99 })).toBe(false);
  });

  it('actions and toggles pay with the chosen slot', () => {
    const c = duo();
    const base = sheetOf(c);
    const s: DerivedSheet = {
      ...base,
      actions: [
        {
          id: 'smite',
          name: 'Smite',
          actionType: 'bonus',
          sourceName: 'Test',
          costs: [{ label: 'a level 1+ spell slot', slot: { minLevel: 1 } }],
          outcomes: [],
          attackIds: [],
        },
      ],
      toggles: [
        {
          toggleId: 'aura',
          name: 'Aura',
          source: { kind: 'feat', id: 'x' },
          sourceName: 'Test',
          active: false,
          options: [],
          costs: [{ label: '1 Hit Die', amount: 1, hitDice: true }],
          onActivate: [],
          endsOn: [],
        },
      ],
    };
    expect(useAction(c, s, 'smite', { choice: { slot: { level: 2 } } }).state.slotsUsed).toEqual([
      0, 1,
    ]);
    const on = toggle(c, s, 'aura', true);
    expect(Object.values(on.state.hitDiceUsed)).toEqual([1]);
  });
});

describe('ways to cast', () => {
  it('a cantrip needs no slot', () => {
    const s = sheetOf(duo());
    expect(
      castWays(s, spell('spark bolt|tst'), {
        caster: { key: 'lorekeeper|tst', status: 'prepared' },
      }),
    ).toEqual([{ kind: 'cantrip' }]);
  });

  it('a prepared spell: slots of its level or higher, Pact Magic, and a Ritual when tagged', () => {
    const s = sheetOf(duo());
    const lantern = spell('dim lantern|tst');
    expect(lantern.ritual).toBe(true);
    const ways = castWays(s, lantern, { caster: { key: 'lorekeeper|tst', status: 'prepared' } });
    expect(ways.map(castWayLabel)).toEqual([
      'Level 1 slot (4 left)',
      'Level 2 slot (2 left)',
      'Level 3 slot (1 left)',
      'Pact Magic slot, level 1 (2 left)',
      'As a Ritual (10 minutes longer, no slot)',
    ]);
    // A level 2 spell can't go in a level 1 Pact Magic slot.
    expect(
      castWays(s, spell('mind ward|tst'), {
        caster: { key: 'lorekeeper|tst', status: 'prepared' },
      }).map((w) => (w.kind === 'slot' ? `${w.level}${w.pact ? 'p' : ''}` : w.kind)),
    ).toEqual(['2', '3']);
  });

  it('a Wizard casts a Ritual from the spellbook without preparing it; nothing else', () => {
    const s = sheetOf(duo());
    const book = { caster: { key: 'lorekeeper|tst', status: 'spellbook' as const } };
    expect(castWays(s, spell('dim lantern|tst'), book)).toEqual([{ kind: 'ritual' }]);
    expect(castWays(s, spell('ink cloud|tst'), book)).toEqual([]);
  });

  it('a granted spell: its free use, slots too unless an item pays for it', () => {
    const s = sheetOf(duo());
    const feat: DerivedGrantedSpell = {
      spellId: 'ink cloud|tst',
      source: { kind: 'feat', id: 'f' },
      sourceName: 'Feat',
      mode: 'known',
      uses: { count: 1, recharge: 'long' },
      usesMax: 1,
      usesUsed: 0,
      usesKey: 'feat:f#spell:ink cloud|tst',
    };
    expect(castWays(s, spell('ink cloud|tst'), { granted: feat }).map((w) => w.kind)).toEqual([
      'free',
      'slot',
      'slot',
      'slot',
      'slot',
    ]);
    expect(
      castWays(s, spell('ink cloud|tst'), { granted: { ...feat, usesUsed: 1 } })[0]?.kind,
    ).toBe('slot');
    const charm: DerivedGrantedSpell = {
      ...feat,
      usesKey: undefined as never,
      usesMax: undefined as never,
      uses: { resource: 'charges', cost: 1 },
      resourceKey: 'missing',
      cost: 1,
    };
    delete charm.usesKey;
    delete charm.usesMax;
    expect(castWays(s, spell('ink cloud|tst'), { granted: charm })).toEqual([]);
  });

  it('casting expends the slot once per turn and replaces Concentration', () => {
    const c = duo();
    const s = sheetOf(c);
    const lantern = spell('dim lantern|tst');
    expect(isConcentration(lantern)).toBe(true);
    const ref = { kind: 'spell' as const, id: lantern.id };
    const cast = castSpellAs(
      c,
      s,
      { ref, concentration: true },
      { kind: 'slot', level: 2, left: 2 },
    );
    expect(cast.state.slotsUsed).toEqual([0, 1]);
    expect(cast.state.turn.slotSpent).toBe(true);
    expect(cast.state.concentration).toEqual(ref);
    expect(endTurn(cast).state.turn.slotSpent).toBeUndefined();

    const ritual = castSpellAs(c, s, { ref, concentration: true }, { kind: 'ritual' });
    expect(ritual.state.slotsUsed).toEqual(c.state.slotsUsed);
    expect(ritual.state.turn.slotSpent).toBeUndefined();
    expect(ritual.state.concentration).toEqual(ref);

    const pact = castSpellAs(
      c,
      s,
      { ref, concentration: false },
      { kind: 'slot', level: 1, pact: true, left: 2 },
    );
    expect(pact.state.pactSlotsUsed).toBe(1);
    expect(pact.state.concentration).toBe(c.state.concentration);
  });
});

describe('preparing spells', () => {
  it('a Paladin replacing more than one spell after a Long Rest gets a warning', async () => {
    // The fixture Gladiator, named Paladin: the 2024 table limits Paladins and Rangers to one.
    const { entities } = await fixtureContent();
    const paladin = createContentIndex(
      (Object.values(entities).flat() as ContentEntity[]).map((e) =>
        e.kind === 'class' && e.id === 'gladiator|tst' ? { ...e, name: 'Paladin' } : e,
      ),
    );
    const sheetOf = (c: Character) => derive(c, paladin, { registry: FIXTURE_FEATURE_EFFECTS });
    expect(sheetOf(gladiator()).spellcasting.casters[0]?.name).toBe('Paladin');
    // Any number for other Long Rest casters.
    expect(sheetOf(duo()).spellcasting.casters[0]?.swapLimit).toBeUndefined();

    let c = gladiator();
    const key = 'gladiator|tst';
    const before = sheetOf(c).spellcasting.casters[0]!;
    expect(before).toMatchObject({ swapLimit: 1, swapsSinceRest: 0 });
    // Adding to the list (it isn't full) is not a swap.
    c = setPrepared(c, key, [...before.prepared, 'ink cloud|tst']);
    expect(c.state.prepSwaps).toBeUndefined();
    c = setPrepared(c, key, ['ink cloud|tst', 'mind ward|tst']);
    const s = sheetOf(c);
    expect(s.spellcasting.casters[0]?.swapsSinceRest).toBe(1);
    expect(s.issues.some((i) => i.code === 'prepSwaps')).toBe(false);
    c = setPrepared(c, key, ['mind ward|tst']);
    expect(sheetOf(c).issues.find((i) => i.code === 'prepSwaps')?.message).toBe(
      'Paladin: 2 prepared spells replaced since your last Long Rest; you can replace 1.',
    );
    expect(longRest(c, sheetOf(c)).state.prepSwaps).toBeUndefined();
  });

  it('warns about prepared spells off the list, too high, or not in the spellbook', () => {
    const g = gladiator();
    const key = 'gladiator|tst';
    // Rolling Boom is level 3; the Gladiator 6 prepares up to level 2.
    const high = sheetOf(setPrepared(g, key, ['rolling boom|tst']));
    expect(high.issues.map((i) => i.code)).toContain('preparedLevel');

    const c = duo();
    const book = sheetOf(c).spellcasting.casters.find((x) => x.key === 'lorekeeper|tst')!;
    const outside = sheetOf(setPrepared(c, 'lorekeeper|tst', ['hex mark|tst']));
    expect(book.spellbook).not.toContain('hex mark|tst');
    expect(outside.issues.map((i) => i.code)).toContain('notInSpellbook');
  });
});
