// Characters on 2014 rules (plan step 8.6): the 2014 Cleric's own features, and the features of
// its subclasses that a 2024 book reprints. Where a 2024 mapping fits the 2014 rule, the 2014 key
// reuses it.
//
// Channel Divinity is a counter (`channel-divinity`, 1/2/3 at 2/6/18, back on a Short or Long
// Rest), the same id the 2024 class uses, so the 2014 domains' options mapped in 8.3 (paid from
// it) are reused here for their 2014 keys. Domain spells, cantrips and Arcane Mastery's picks come
// from the subclasses' own data. Tasha's Blessed Strikes replaces a domain's level 8 feature: its
// row offers the pick, and Divine Strike or Potent Spellcasting applies only when it is kept.

import { refKey, type Effect, type Ref, type RefKey } from '../../../schema/index.ts';
import type { FeatureEffectsMap, FeatureMapping } from '../types.ts';
import { CLERIC } from '../core/cleric.ts';
import {
  action,
  AT_TABLE,
  dc,
  fromData,
  NO_CHOICE,
  numbers,
  TARGETS,
  text,
  uses,
} from '../core/helpers.ts';
import { LEGACY_CLERIC } from '../legacy/cleric.ts';
import { SUP_CLERIC } from '../supplements/cleric.ts';

const C = (id: string, level: number, src = 'phb') =>
  refKey({ kind: 'classFeature', id: `${id}|cleric|phb|${level}|${src}` });
const subRef = (sub: string, subSrc: string, id: string, level: number, src = subSrc): Ref => ({
  kind: 'subclassFeature',
  id: `${id}|cleric|phb|${sub}|${subSrc}|${level}|${src}`,
});
const S = (sub: string, subSrc: string, id: string, level: number, src = subSrc) =>
  refKey(subRef(sub, subSrc, id, level, src));

/** A mapping another file already holds, for a 2014 key whose rule is the same. */
function same(map: FeatureEffectsMap, key: RefKey): FeatureMapping {
  const mapping = map[key];
  if (!mapping) throw new Error(`No mapping to reuse at ${key}`);
  return mapping;
}
/** An 8.3 mapping of a 2014 domain on the 2024 Cleric (its first Channel Divinity sits at 3). */
const legacy = (sub: string, src: string, id: string, level: number) =>
  same(
    LEGACY_CLERIC,
    refKey({
      kind: 'subclassFeature',
      id: `${id}|cleric|${level === 3 ? 'xphb' : 'phb'}|${sub}|${src}|${level}|${src}`,
    }),
  );
const core = (key: string) => same(CLERIC, key as RefKey);

const divinity = { resource: 'channel-divinity', amount: 1 };
const wisUses = 'max(1, mod.wis)';
/** 1 use at 2nd level, 2 at 6th, 3 at 18th (Channel Divinity, Harness Divine Power). */
const byTier = 'steps(level.cleric, 2, 1, 6, 2, 18, 3)';
const heavyArmor: Effect = { type: 'proficiency', category: 'armor', value: 'heavy' };
const martialWeapons: Effect = { type: 'proficiency', category: 'weapon', value: 'martial' };
const NONMAGICAL = 'a resistance that applies only to nonmagical attacks';
/** The increases or a feat: the 2014 rules add that pick to the feature (`legacyEntityEffects`). */
const ASI: FeatureMapping = {
  ...fromData(),
  unoffered: 'Picked through the 2014 rules’ Ability Score Improvement choice.',
};

// ---- Blessed Strikes (Tasha's), in place of Divine Strike or Potent Spellcasting ----
const BLESSED_SLOT = 'blessed-strikes';
const blessedRef = (sub: string, subSrc: string) =>
  subRef(sub, subSrc, 'blessed strikes', 8, 'tce');
/** The optional feature's row: keep the domain's level 8 feature, or take Blessed Strikes. */
const blessedStrikes = (replaces: string): FeatureMapping =>
  numbers(
    [
      {
        type: 'optionChoice',
        choice: { slot: BLESSED_SLOT, count: 1, from: ['domain', 'blessed'] },
        labels: [replaces, 'Blessed Strikes'],
      },
      {
        type: 'ifChoice',
        slot: BLESSED_SLOT,
        value: 'blessed',
        effects: [
          {
            type: 'damageRider',
            id: 'blessed-strikes',
            name: 'Blessed Strikes (Radiant)',
            dice: '1d8',
            damageType: 'radiant',
            filter: { source: ['weapon', 'spell'] },
            oncePerTurn: true,
            optIn: true,
          },
        ],
      },
    ],
    {
      notes: 'Shown on weapon attacks; with a cantrip, add the die by hand.',
      needs: 'a damage rider on cantrip attacks',
    },
  );
/** The domain's own level 8 feature, while its Blessed Strikes pick keeps it. */
const kept = (sub: string, subSrc: string, effects: Effect[]): Effect => ({
  type: 'ifChoice',
  owner: blessedRef(sub, subSrc),
  slot: BLESSED_SLOT,
  value: 'domain',
  effects,
});
/**
 * Divine Strike: once per turn, 1d8 (2d8 from 14th level) on a weapon hit, of the domain's
 * damage type (none given: the weapon's own type, or one picked each time).
 */
const divineStrike = (
  sub: string,
  subSrc: string,
  damage: { type?: string; label?: string } = {},
  extra: Partial<FeatureMapping> = {},
): FeatureMapping =>
  numbers(
    [
      kept(sub, subSrc, [
        {
          type: 'damageRider',
          id: 'divine-strike',
          name: `Divine Strike (${damage.label ?? damage.type ?? 'weapon type'})`,
          dice: 'steps(level.cleric, 8, 1d8, 14, 2d8)',
          ...(damage.type ? { damageType: damage.type.toLowerCase() } : {}),
          filter: { source: ['weapon'] },
          oncePerTurn: true,
          optIn: true,
        },
      ]),
    ],
    extra,
  );
/** Potent Spellcasting: the Wisdom modifier added to cleric cantrips' damage. */
const potentSpellcasting = (sub: string, subSrc: string): FeatureMapping =>
  numbers([
    kept(sub, subSrc, [
      {
        type: 'spellMod',
        filter: 'level=0|class=Cleric',
        casterKey: 'cleric|phb',
        damageBonus: 'mod.wis',
      },
    ]),
  ]);
/** Both level 8 rows of a domain: its own feature and the Blessed Strikes that may replace it. */
const level8 = (sub: string, subSrc: string, own: 'divine strike' | 'potent spellcasting') => ({
  [S(sub, subSrc, 'blessed strikes', 8, 'tce')]: blessedStrikes(
    own === 'divine strike' ? 'Divine Strike' : 'Potent Spellcasting',
  ),
  ...(own === 'potent spellcasting'
    ? { [S(sub, subSrc, own, 8)]: potentSpellcasting(sub, subSrc) }
    : {}),
});

export const RULES_2014_CLERIC: FeatureEffectsMap = {
  // ---- Class features ----
  [C('spellcasting', 1)]: text(),
  [C('divine domain', 1)]: text(),
  [C('channel divinity', 2)]: numbers(
    [uses('channel-divinity', 'Channel Divinity', byTier, 'short')],
    { unoffered: AT_TABLE },
  ),
  // The 2024 Turn Undead's action: Wisdom save against the spell save DC, one use.
  [C('channel divinity: turn undead', 2)]: core('classFeature:turn undead|cleric|xphb|2|xphb'),
  [C('channel divinity: harness divine power', 2, 'tce')]: numbers([
    uses('harness-divine-power', 'Harness Divine Power', byTier, 'long'),
    action({
      id: 'harness-divine-power',
      name: 'Harness Divine Power',
      actionType: 'bonus',
      costs: [divinity, { resource: 'harness-divine-power', amount: 1 }],
      outcomes: [{ regainSlot: { maxLevel: 'ceil(pb / 2)' } }],
    }),
  ]),
  [C('divine domain feature', 2)]: text(),
  [C('divine domain feature', 6)]: text(),
  [C('divine domain feature', 8)]: text(),
  [C('divine domain feature', 17)]: text(),
  // The 2014 increases (or a feat) come from the 2014 rules themselves.
  [C('ability score improvement', 4)]: ASI,
  [C('ability score improvement', 8)]: ASI,
  [C('ability score improvement', 12)]: ASI,
  [C('ability score improvement', 16)]: ASI,
  [C('ability score improvement', 19)]: ASI,
  // Class cantrips can already be swapped on a level-up.
  [C('cantrip versatility', 4, 'tce')]: fromData(),
  // Destroy Undead: a CR limit for Turn Undead, read with the feature.
  [C('destroy undead (cr 1/2)', 5)]: text(),
  [C('destroy undead (cr 1)', 8)]: text(),
  [C('destroy undead (cr 2)', 11)]: text(),
  [C('destroy undead (cr 3)', 14)]: text(),
  [C('destroy undead (cr 4)', 17)]: text(),
  // More uses: the level 2 counter's maximum steps up at 6 and 18.
  [C('channel divinity', 6)]: numbers([]),
  [C('channel divinity', 18)]: numbers([]),
  // The percentile roll is shown; after a success the 7-day wait is tracked by hand.
  [C('divine intervention', 10)]: numbers(
    [
      uses('divine-intervention', 'Divine Intervention', 1, 'long'),
      action({
        id: 'divine-intervention',
        name: 'Divine Intervention',
        actionType: 'action',
        costs: [{ resource: 'divine-intervention', amount: 1 }],
        roll: '1d100',
      }),
    ],
    {
      notes: 'Succeeds on a roll at or under your cleric level. After a success, wait 7 days.',
      needs: 'a recharge of 7 days',
    },
  ),
  [C('divine intervention improvement', 20)]: text({
    notes: 'No roll needed: the call succeeds.',
  }),

  // ---- Knowledge Domain (PHB; Amonkhet's Knowledge uses the same features) ----
  [S('knowledge', 'phb', 'channel divinity: knowledge of the ages', 2)]: legacy(
    'knowledge',
    'phb',
    'channel divinity: knowledge of the ages',
    3,
  ),
  ...level8('knowledge', 'phb', 'potent spellcasting'),
  [S('knowledge (psa)', 'psa', 'knowledge domain (psa)', 1)]: text(),

  // ---- Life Domain (PHB) ----
  [S('life', 'phb', 'life domain', 1)]: text(),
  [S('life', 'phb', 'bonus proficiency', 1)]: numbers([heavyArmor], { unoffered: NO_CHOICE }),
  [S('life', 'phb', 'disciple of life', 1)]: text(),
  [S('life', 'phb', 'channel divinity: preserve life', 2)]: core(
    'subclassFeature:preserve life|cleric|xphb|life|xphb|3|xphb',
  ),
  [S('life', 'phb', 'blessed healer', 6)]: text(),
  [S('life', 'phb', 'divine strike', 8)]: divineStrike('life', 'phb', { type: 'Radiant' }),
  ...level8('life', 'phb', 'divine strike'),
  [S('life', 'phb', 'supreme healing', 17)]: text(),

  // ---- Light Domain (PHB) ----
  [S('light', 'phb', 'light domain', 1)]: text(),
  // The Light cantrip comes from the domain's data.
  [S('light', 'phb', 'bonus cantrip', 1)]: { ...fromData(), unoffered: NO_CHOICE },
  [S('light', 'phb', 'warding flare', 1)]: core(
    'subclassFeature:warding flare|cleric|xphb|light|xphb|3|xphb',
  ),
  [S('light', 'phb', 'channel divinity: radiance of the dawn', 2)]: core(
    'subclassFeature:radiance of the dawn|cleric|xphb|light|xphb|3|xphb',
  ),
  // Warding Flare for others too: the same reaction and counter.
  [S('light', 'phb', 'improved flare', 6)]: text(),
  ...level8('light', 'phb', 'potent spellcasting'),
  [S('light', 'phb', 'corona of light', 17)]: numbers([
    action({ id: 'corona-of-light', name: 'Corona of Light', actionType: 'action' }),
  ]),

  // ---- Nature Domain (PHB) ----
  [S('nature', 'phb', 'nature domain', 1)]: text(),
  [S('nature', 'phb', 'channel divinity: charm animals and plants', 2)]: legacy(
    'nature',
    'phb',
    'channel divinity: charm animals and plants',
    3,
  ),
  [S('nature', 'phb', 'divine strike', 8)]: divineStrike(
    'nature',
    'phb',
    { label: 'Cold, Fire or Lightning' },
    { unoffered: AT_TABLE },
  ),
  ...level8('nature', 'phb', 'divine strike'),

  // ---- Tempest Domain (PHB) ----
  [S('tempest', 'phb', 'tempest domain', 1)]: text(),
  [S('tempest', 'phb', 'channel divinity: destructive wrath', 2)]: legacy(
    'tempest',
    'phb',
    'channel divinity: destructive wrath',
    3,
  ),
  [S('tempest', 'phb', 'divine strike', 8)]: divineStrike('tempest', 'phb', { type: 'Thunder' }),
  ...level8('tempest', 'phb', 'divine strike'),

  // ---- Trickery Domain (PHB) ----
  [S('trickery', 'phb', 'trickery domain', 1)]: text(),
  [S('trickery', 'phb', 'blessing of the trickster', 1)]: numbers(
    [
      action({
        id: 'blessing-of-the-trickster',
        name: 'Blessing of the Trickster',
        actionType: 'action',
      }),
    ],
    { unoffered: NO_CHOICE },
  ),
  // The 2014 Invoke Duplicity and Cloak of Shadows, as Amonkhet's Ambition maps them.
  [S('trickery', 'phb', 'channel divinity: invoke duplicity', 2)]: legacy(
    'ambition (psa)',
    'psa',
    'channel divinity: invoke duplicity',
    3,
  ),
  [S('trickery', 'phb', 'channel divinity: cloak of shadows', 6)]: legacy(
    'ambition (psa)',
    'psa',
    'channel divinity: cloak of shadows',
    6,
  ),
  [S('trickery', 'phb', 'divine strike', 8)]: divineStrike('trickery', 'phb', { type: 'Poison' }),
  ...level8('trickery', 'phb', 'divine strike'),
  [S('trickery', 'phb', 'improved duplicity', 17)]: text(),

  // ---- War Domain (PHB) ----
  [S('war', 'phb', 'war domain', 1)]: text(),
  [S('war', 'phb', 'bonus proficiencies', 1)]: numbers([martialWeapons, heavyArmor]),
  [S('war', 'phb', 'war priest', 1)]: numbers([
    uses('war-priest', 'War Priest', wisUses, 'long'),
    action({
      id: 'war-priest',
      name: 'War Priest',
      actionType: 'bonus',
      costs: [{ resource: 'war-priest', amount: 1 }],
      attack: { source: ['weapon'] },
    }),
  ]),
  // +10 to an attack roll, one use.
  [S('war', 'phb', 'channel divinity: guided strike', 2)]: core(
    'subclassFeature:guided strike|cleric|xphb|war|xphb|3|xphb',
  ),
  [S('war', 'phb', "channel divinity: war god's blessing", 6)]: numbers(
    [
      action({
        id: 'war-gods-blessing',
        name: "War God's Blessing",
        actionType: 'reaction',
        costs: [divinity],
      }),
    ],
    { unoffered: TARGETS },
  ),
  [S('war', 'phb', 'divine strike', 8)]: divineStrike('war', 'phb'),
  ...level8('war', 'phb', 'divine strike'),
  [S('war', 'phb', 'avatar of battle', 17)]: text({
    notes: 'Not listed with the defenses: the resistances cover only some attacks.',
    needs: NONMAGICAL,
  }),

  // ---- Death Domain (DMG) ----
  [S('death', 'dmg', 'death domain', 1)]: text(),
  [S('death', 'dmg', 'channel divinity: touch of death', 2)]: legacy(
    'death',
    'dmg',
    'channel divinity: touch of death',
    3,
  ),
  [S('death', 'dmg', 'divine strike', 8)]: divineStrike('death', 'dmg', { type: 'Necrotic' }),
  ...level8('death', 'dmg', 'divine strike'),

  // ---- Arcana Domain (Sword Coast Adventurer's Guide) ----
  [S('arcana', 'scag', 'arcana domain', 1)]: text(),
  // The two Wizard cantrips are the domain's own pick; the skill is added here.
  [S('arcana', 'scag', 'arcane initiate', 1)]: numbers([
    { type: 'proficiency', category: 'skill', value: 'arcana' },
  ]),
  [S('arcana', 'scag', 'channel divinity: arcane abjuration', 2)]: numbers(
    [
      action({
        id: 'arcane-abjuration',
        name: 'Arcane Abjuration',
        actionType: 'action',
        costs: [divinity],
        saveDc: dc('wis'),
      }),
    ],
    { unoffered: TARGETS },
  ),
  [S('arcana', 'scag', 'spell breaker', 6)]: text({ unoffered: AT_TABLE }),
  ...level8('arcana', 'scag', 'potent spellcasting'),
  // Its four spells are picked through the domain's data.
  [S('arcana', 'scag', 'arcane mastery', 17)]: text(),

  // ---- Amonkhet domains (Plane Shift: Amonkhet) ----
  [S('ambition (psa)', 'psa', 'ambition domain (psa)', 1)]: text(),
  [S('ambition (psa)', 'psa', 'channel divinity: invoke duplicity', 2)]: legacy(
    'ambition (psa)',
    'psa',
    'channel divinity: invoke duplicity',
    3,
  ),
  ...level8('ambition (psa)', 'psa', 'potent spellcasting'),
  [S('solidarity (psa)', 'psa', 'solidarity domain (psa)', 1)]: text(),
  [S('solidarity (psa)', 'psa', 'channel divinity: preserve life', 2)]: legacy(
    'solidarity (psa)',
    'psa',
    'channel divinity: preserve life',
    3,
  ),
  [S('solidarity (psa)', 'psa', 'divine strike', 8)]: divineStrike('solidarity (psa)', 'psa'),
  ...level8('solidarity (psa)', 'psa', 'divine strike'),
  [S('strength (psa)', 'psa', 'strength domain (psa)', 1)]: text(),
  [S('strength (psa)', 'psa', 'channel divinity: feat of strength', 2)]: legacy(
    'strength (psa)',
    'psa',
    'channel divinity: feat of strength',
    3,
  ),
  [S('strength (psa)', 'psa', 'divine strike', 8)]: divineStrike('strength (psa)', 'psa'),
  ...level8('strength (psa)', 'psa', 'divine strike'),
  [S('zeal (psa)', 'psa', 'zeal domain (psa)', 1)]: text(),
  [S('zeal (psa)', 'psa', 'channel divinity: consuming fervor', 2)]: legacy(
    'zeal (psa)',
    'psa',
    'channel divinity: consuming fervor',
    3,
  ),
  [S('zeal (psa)', 'psa', 'divine strike', 8)]: divineStrike('zeal (psa)', 'psa'),
  ...level8('zeal (psa)', 'psa', 'divine strike'),

  // ---- Forge Domain (Xanathar's) ----
  [S('forge', 'xge', 'forge domain', 1)]: text(),
  [S('forge', 'xge', "channel divinity: artisan's blessing", 2)]: legacy(
    'forge',
    'xge',
    "channel divinity: artisan's blessing",
    3,
  ),
  [S('forge', 'xge', 'divine strike', 8)]: divineStrike('forge', 'xge', { type: 'Fire' }),
  ...level8('forge', 'xge', 'divine strike'),

  // ---- Grave Domain (Xanathar's) ----
  [S('grave', 'xge', 'grave domain', 1)]: text(),
  // Spare the Dying comes from the domain's data; the maximized healing is text.
  [S('grave', 'xge', 'circle of mortality', 1)]: text(),
  [S('grave', 'xge', 'eyes of the grave', 1)]: numbers([
    uses('eyes-of-the-grave', 'Eyes of the Grave', wisUses, 'long'),
    action({
      id: 'eyes-of-the-grave',
      name: 'Eyes of the Grave',
      actionType: 'action',
      costs: [{ resource: 'eyes-of-the-grave', amount: 1 }],
    }),
  ]),
  [S('grave', 'xge', 'channel divinity: path to the grave', 2)]: numbers(
    [
      action({
        id: 'path-to-the-grave',
        name: 'Path to the Grave',
        actionType: 'action',
        costs: [divinity],
      }),
    ],
    { unoffered: TARGETS },
  ),
  // A reaction, Wisdom modifier uses a Long Rest, as in the 2024 Grave Domain.
  [S('grave', 'xge', "sentinel at death's door", 6)]: same(
    SUP_CLERIC,
    "subclassFeature:sentinel at death's door|cleric|xphb|grave|rhw|6|rhw",
  ),
  ...level8('grave', 'xge', 'potent spellcasting'),
  [S('grave', 'xge', 'keeper of souls', 17)]: text({ unoffered: TARGETS }),

  // ---- Order Domain (Tasha's) ----
  [S('order', 'tce', 'order domain', 1)]: text(),
  [S('order', 'tce', "channel divinity: order's demand", 2)]: legacy(
    'order',
    'tce',
    "channel divinity: order's demand",
    3,
  ),
  [S('order', 'tce', 'divine strike', 8)]: divineStrike('order', 'tce', { type: 'Psychic' }),
  ...level8('order', 'tce', 'divine strike'),

  // ---- Peace Domain (Tasha's) ----
  [S('peace', 'tce', 'peace domain', 1)]: text(),
  [S('peace', 'tce', 'channel divinity: balm of peace', 2)]: legacy(
    'peace',
    'tce',
    'channel divinity: balm of peace',
    3,
  ),
  ...level8('peace', 'tce', 'potent spellcasting'),

  // ---- Twilight Domain (Tasha's) ----
  [S('twilight', 'tce', 'twilight domain', 1)]: text(),
  [S('twilight', 'tce', 'channel divinity: twilight sanctuary', 2)]: legacy(
    'twilight',
    'tce',
    'channel divinity: twilight sanctuary',
    3,
  ),
  [S('twilight', 'tce', 'divine strike', 8)]: divineStrike('twilight', 'tce', { type: 'Radiant' }),
  ...level8('twilight', 'tce', 'divine strike'),
};
