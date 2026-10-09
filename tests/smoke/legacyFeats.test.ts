// Golden checks for the 2014 feats on 2024 characters (plan step 8.3) on real data: a human
// fighter, every book on and "Show 2014 content" with it, whose Ability Score Improvements are
// swapped for 2014 feats; its numbers read the way each feat's text gives them. Opt-in:
//   FIVETOOLS_DATA=./5etools-src-2.36.1 npx vitest run --config vitest.smoke.config.ts tests/smoke/legacyFeats.test.ts
// Checks numbers and names only; it never prints or stores content.

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
import type { Character, ContentEntity, InventoryItem } from '../../src/schema/index.ts';
import { SHOW_2014 } from '../../src/sources/sourceFilter.ts';
import { nodeFileSource } from './nodeFileSource.ts';

const root = process.env.FIVETOOLS_DATA;

describe.skipIf(!root)('2014 feat golden checks (local data)', () => {
  let index: ContentIndex;
  let catalog: Catalog;

  beforeAll(async () => {
    const result = await importFivetools(nodeFileSource(root!), { now: 1 });
    const all = Object.values(result.entities).flat() as ContentEntity[];
    index = createContentIndex(all);
    const books = result.sources.filter((s) => s.origin !== 'homebrew').map((s) => s.code);
    catalog = createCatalog(all, new Set([...books, SHOW_2014]));
  });

  interface Spec {
    level: number;
    /** Taken at the level 4 Ability Score Improvement, then at 6: the feat and its picks. */
    feats: { id: string; picks?: Record<string, string> }[];
    toggles?: { id: string; option?: string }[];
    /** Changes to the inventory before deriving (unequip armor, hold a weapon). */
    gear?: (rows: InventoryItem[]) => InventoryItem[];
  }

  const ASI = (level: number) =>
    `classFeature:ability score improvement|fighter|xphb|${level}|xphb#feat`;

  /** A human soldier fighter with these feats picked. */
  function build({ level, feats, toggles = [], gear }: Spec): DerivedSheet {
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
    if (gear) c = { ...c, inventory: gear(c.inventory) };
    let s = derive(c, index, { registry });
    const pick = (key: string, value: string, feat = false) => {
      const ch = s.features.flatMap((f) => f.choices).find((x) => x.key === key);
      if (!ch) throw new Error(`no choice ${key}`);
      c = setPick(c, decodeChoiceKey(ch.key), {
        values: [value],
        labels: [],
        ...(feat ? { valueKinds: ['feat' as const] } : {}),
        entryIndex: ch.entryIndex,
      });
      s = derive(c, index, { registry });
    };
    feats.forEach(({ id, picks = {} }, i) => {
      pick(ASI(i === 0 ? 4 : 6), id, true);
      for (const [slot, value] of Object.entries(picks)) pick(`feat:${id}#${slot}`, value);
    });
    for (const t of toggles) {
      c = toggle(c, s, t.id, true, { free: true, ...(t.option ? { option: t.option } : {}) });
      s = derive(c, index, { registry });
    }
    return s;
  }
  const resource = (s: DerivedSheet, name: string) => s.resources.find((r) => r.name === name);
  const act = (s: DerivedSheet, name: string) => s.actions.find((a) => a.name === name);
  const greatsword = (s: DerivedSheet) => s.attacks.find((a) => a.name === 'Greatsword');
  const riderOf = (s: DerivedSheet, name: string) =>
    greatsword(s)?.riders.find((r) => r.name === name);
  const values = (list: { value: string }[]) => list.map((v) => v.value).sort();
  /** A dice expression plus a flat number, the way the sheet writes it. */
  const plus = (d: string, n: number) => (n > 0 ? `${d} + ${n}` : n < 0 ? `${d} - ${-n}` : d);
  const dcOf = (s: DerivedSheet, a: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha') =>
    8 + s.pb.value + s.abilities[a].mod;

  it('Dragonlance: the robes, the knights and the squire', () => {
    const red = build({ level: 5, feats: [{ id: 'adept of the red robes|dsotdq' }] });
    expect(resource(red, 'Magical Balance')?.max.value).toBe(3);

    const white = build({
      level: 5,
      feats: [{ id: 'adept of the white robes|dsotdq', picks: { 'spells.0.ability': 'wis' } }],
    });
    expect(act(white, 'Protective Ward')?.roll).toBe(plus('1d6', white.abilities.wis.mod));

    const squire = build({ level: 5, feats: [{ id: 'squire of solamnia|dsotdq' }] });
    expect(resource(squire, 'Precise Strike')?.max.value).toBe(3);
    expect(riderOf(squire, 'Precise Strike')?.dice).toBe('1d8');

    const crown = build({
      level: 5,
      feats: [{ id: 'knight of the crown|dsotdq', picks: { ability: 'str' } }],
    });
    expect(act(crown, 'Commanding Rally')?.roll).toBe('1d8');

    const rose = build({
      level: 5,
      feats: [{ id: 'knight of the rose|dsotdq', picks: { ability: 'con' } }],
    });
    expect(resource(rose, 'Bolstering Rally')?.max.value).toBe(3);
    expect(act(rose, 'Bolstering Rally')?.roll).toBe(
      plus('1d8', rose.pb.value + rose.abilities.con.mod),
    );

    const sword = build({
      level: 5,
      feats: [{ id: 'knight of the sword|dsotdq', picks: { ability: 'wis' } }],
    });
    expect(act(sword, 'Demoralizing Strike')?.saveDc).toBe(dcOf(sword, 'wis'));
  });

  it('Planescape: the Scion’s ability sets Stasis Strike’s DC; riders and reactions', () => {
    const scion = { id: 'scion of the outer planes|sato', picks: { spellsSet: '3' } };
    const order = build({
      level: 6,
      feats: [
        { ...scion, picks: { ...scion.picks, 'spells.3.ability': 'wis' } },
        { id: 'agent of order|sato', picks: { ability: 'str' } },
      ],
    });
    expect(resource(order, 'Stasis Strike')?.max.value).toBe(3);
    expect(riderOf(order, 'Stasis Strike')).toMatchObject({ dice: '1d8' });
    expect(act(order, 'Stasis Strike save DC')?.saveDc).toBe(dcOf(order, 'wis'));

    const baleful = build({
      level: 5,
      feats: [{ id: 'baleful scion|sato', picks: { ability: 'str' } }],
    });
    expect(riderOf(baleful, 'Grasp of Avarice')?.dice).toBe('1d6 + 3');

    const wanderer = build({
      level: 5,
      feats: [{ id: 'planar wanderer|sato', picks: { 'planar-adaptation': 'fire' } }],
    });
    expect(values(wanderer.defenses.resistances)).toContain('fire');
    expect(resource(wanderer, 'Portal Sense')?.max.value).toBe(1);

    const heritor = build({
      level: 9,
      feats: [{ id: 'righteous heritor|sato', picks: { ability: 'str' } }],
    });
    expect(resource(heritor, 'Soothe Pain')?.max.value).toBe(4);
    expect(act(heritor, 'Soothe Pain')?.roll).toBe('1d10 + 4');
  });

  it('giants: Strike of the Giants, its versions, and the giant feats', () => {
    const fire = build({
      level: 5,
      feats: [{ id: 'strike of the giants|bgg', picks: { strike: 'fire' } }],
    });
    expect(resource(fire, 'Strike of the Giants')?.max.value).toBe(3);
    expect(riderOf(fire, 'Fire Strike')).toMatchObject({ dice: '1d10' });
    expect(riderOf(fire, 'Cloud Strike')).toBeUndefined();

    const storm = build({ level: 5, feats: [{ id: 'strike of the giants; storm|bgg' }] });
    expect(riderOf(storm, 'Storm Strike')?.dice).toBe('1d6');
    expect(act(storm, 'Storm Strike save DC')?.saveDc).toBe(
      8 + storm.pb.value + Math.max(storm.abilities.str.mod, storm.abilities.con.mod),
    );

    const ember = build({
      level: 5,
      feats: [{ id: 'ember of the fire giant|bgg', picks: { ability: 'con' } }],
    });
    expect(act(ember, 'Searing Ignition')).toMatchObject({
      roll: '1d8 + 3',
      saveDc: dcOf(ember, 'con'),
    });

    const frost = build({
      level: 5,
      feats: [{ id: 'fury of the frost giant|bgg', picks: { ability: 'str' } }],
    });
    expect(act(frost, 'Frigid Retaliation')).toMatchObject({
      actionType: 'reaction',
      roll: '1d8 + 3',
      saveDc: dcOf(frost, 'str'),
    });
    expect(
      resource(
        build({
          level: 5,
          feats: [{ id: 'guile of the cloud giant|bgg', picks: { ability: 'str' } }],
        }),
        'Cloudy Escape',
      )?.max.value,
    ).toBe(3);

    const stone = build({
      level: 5,
      feats: [{ id: 'keenness of the stone giant|bgg', picks: { ability: 'wis' } }],
    });
    expect(stone.senses.map((x) => x.value)).toContainEqual({ sense: 'darkvision', range: 60 });
    expect(stone.attacks.find((a) => a.name === 'Stone Throw')).toMatchObject({
      damageDice: '1d10',
      damageType: 'force',
      ability: 'wis',
    });
    expect(act(stone, 'Stone Throw')?.saveDc).toBe(dcOf(stone, 'wis'));

    const storm2 = build({
      level: 5,
      feats: [{ id: 'soul of the storm giant|bgg', picks: { ability: 'str' } }],
      toggles: [{ id: 'maelstrom-aura' }],
    });
    expect(values(storm2.defenses.resistances)).toEqual(
      expect.arrayContaining(['lightning', 'thunder']),
    );
    expect(storm2.defenses.attacked.map((x) => x.mode)).toContain('disadvantage');
    expect(act(storm2, 'Maelstrom Aura save DC')?.saveDc).toBe(dcOf(storm2, 'str'));

    const hill = build({
      level: 5,
      feats: [{ id: 'vigor of the hill giant|bgg', picks: { ability: 'con' } }],
    });
    expect(act(hill, 'Bulwark')?.actionType).toBe('reaction');
  });

  it('dragon gifts: Chromatic Infusion, Telekinetic Reprisal, Protective Wings', () => {
    const chromatic = build({
      level: 5,
      feats: [{ id: 'gift of the chromatic dragon|ftd' }],
      toggles: [{ id: 'chromatic-infusion', option: 'acid' }],
    });
    expect(riderOf(chromatic, 'Chromatic Infusion')?.dice).toBe('1d4');
    expect(resource(chromatic, 'Reactive Resistance')?.max.value).toBe(3);

    const gem = build({
      level: 5,
      feats: [{ id: 'gift of the gem dragon|ftd', picks: { ability: 'cha' } }],
    });
    expect(act(gem, 'Telekinetic Reprisal')).toMatchObject({
      roll: '2d8',
      saveDc: dcOf(gem, 'cha'),
    });

    const metallic = build({ level: 9, feats: [{ id: 'gift of the metallic dragon|ftd' }] });
    expect(act(metallic, 'Protective Wings')?.roll).toBe('4');
  });

  it('racial feats: Dragon Hide’s AC and claws, speed, uses and switches', () => {
    const hide = build({
      level: 5,
      feats: [{ id: 'dragon hide|xge', picks: { ability: 'str' } }],
      gear: (rows) => rows.map(({ equipped: _e, ...r }) => r),
    });
    expect(hide.ac.value).toBe(13 + hide.abilities.dex.mod);
    expect(hide.attacks.find((a) => a.name === 'Unarmed Strike')).toMatchObject({
      damageDice: '1d4',
      damageType: 'slashing',
    });

    const nimble = build({
      level: 5,
      feats: [{ id: 'squat nimbleness|xge', picks: { ability: 'dex', skills: 'athletics' } }],
    });
    expect(nimble.speed.walk?.value).toBe(35);

    const fade = build({ level: 5, feats: [{ id: 'fade away|xge', picks: { ability: 'dex' } }] });
    expect(resource(fade, 'Fade Away')).toMatchObject({ recharge: 'short' });
    const chance = build({
      level: 5,
      feats: [{ id: 'second chance|xge', picks: { ability: 'dex' } }],
    });
    expect(act(chance, 'Second Chance')?.actionType).toBe('reaction');
    const fury = build({ level: 5, feats: [{ id: 'orcish fury|xge', picks: { ability: 'str' } }] });
    expect(resource(fury, 'Orcish Fury')).toMatchObject({ recharge: 'short' });
    const fortitude = build({ level: 5, feats: [{ id: 'dwarven fortitude|xge' }] });
    expect(act(fortitude, 'Dwarven Fortitude')?.costs[0]?.hitDice).toBe(true);
    const fear = build({
      level: 5,
      feats: [{ id: 'dragon fear|xge', picks: { ability: 'cha' } }],
    });
    expect(act(fear, 'Dragon Fear')?.saveDc).toBe(dcOf(fear, 'cha'));

    // Holding a double-bladed scimitar in both hands, or carrying it: +1 AC.
    const holding = (held: boolean) =>
      build({
        level: 5,
        feats: [{ id: 'revenant blade|erlw', picks: { ability: 'dex' } }],
        gear: (rows) => [
          ...rows.map((r) => (r.equipped === 'armor' ? r : { ...r, equipped: undefined })),
          {
            uid: 'dbs',
            itemRef: { kind: 'item', id: 'double-bladed scimitar|erlw' },
            name: 'Double-Bladed Scimitar',
            quantity: 1,
            ...(held ? { equipped: 'bothHands' as const } : {}),
            attuned: false,
          },
        ],
      });
    expect(holding(true).ac.value - holding(false).ac.value).toBe(1);

    const vampire = build({
      level: 5,
      feats: [{ id: 'vampiric exultation|psx' }],
      toggles: [{ id: 'vampiric-exultation' }],
    });
    expect(vampire.speed.fly?.value).toBe(30);
  });

  it('general feats: superiority die, sorcery points, mascot, Hidden Ace', () => {
    const adept = build({ level: 5, feats: [{ id: 'martial adept|phb' }] });
    expect(resource(adept, 'Superiority Dice')).toMatchObject({ die: '1d6', recharge: 'short' });
    expect(resource(adept, 'Superiority Dice')?.max.value).toBe(1);
    expect(act(adept, 'Maneuver save DC')?.saveDc).toBe(
      8 + adept.pb.value + Math.max(adept.abilities.str.mod, adept.abilities.dex.mod),
    );
    const meta = build({ level: 5, feats: [{ id: 'metamagic adept|tce' }] });
    expect(resource(meta, 'Sorcery Points')?.max.value).toBe(2);
    const mascot = build({ level: 5, feats: [{ id: 'strixhaven mascot|scc' }] });
    expect(resource(mascot, 'Mascot Teleport')?.restoreWith).toHaveLength(1);
    const cards = build({ level: 5, feats: [{ id: 'cartomancer|bmt' }] });
    expect(act(cards, 'Hidden Ace')?.actionType).toBe('bonus');
  });
});
