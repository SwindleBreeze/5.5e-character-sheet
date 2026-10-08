// 2024 supplement bard colleges (plan §10.2, step 6.16): College of the Moon (Heroes of
// Faerûn) and College of Spirits. Features that spend Bardic Inspiration are actions paid from
// the core counter (`bardic-inspiration`); the colleges' spells come from their own data.

import type { FeatureEffectsMap } from '../types.ts';
import { action, AT_TABLE, dc, numbers, TARGETS, text, uses } from '../core/helpers.ts';

const S = (sub: string, src: string, id: string, level: number) =>
  `subclassFeature:${id}|bard|xphb|${sub}|${src}|${level}|${src}` as const;
const MOON = (id: string, level: number) => S('moon', 'frhof', id, level);
const SPIRITS = (id: string, level: number) => S('spirits', 'rhw', id, level);

const inspiration = { resource: 'bardic-inspiration', amount: 1 };

export const SUP_BARD: FeatureEffectsMap = {
  // ---- College of the Moon ----
  [MOON('college of the moon', 3)]: text(),
  // Inspired Eclipse rides on the Bardic Inspiration bonus action; Lunar Vitality adds a die to
  // a healing spell.
  [MOON("moon's inspiration", 3)]: numbers(
    [
      action({
        id: 'lunar-vitality',
        name: 'Lunar Vitality',
        actionType: 'other',
        costs: [inspiration],
        roll: 'table.bardic-die',
      }),
    ],
    { unoffered: TARGETS },
  ),
  // The Druid cantrip comes from the college's data; Druidic and the skill are added here.
  [MOON('primal lore', 3)]: numbers([
    { type: 'proficiency', category: 'language', value: 'druidic' },
    {
      type: 'proficiencyChoice',
      category: 'skill',
      choice: {
        slot: 'skill',
        count: 1,
        from: ['animal handling', 'insight', 'medicine', 'nature', 'perception', 'survival'],
      },
    },
  ]),
  // Moonbeam and its once-per-Long-Rest counter come from the college's data; the counter
  // tracks the modified casting.
  [MOON('blessing of moonlight', 6)]: text({ unoffered: TARGETS }),
  // Vibrance of the Full Moon: Lunar Vitality with a d6 instead of a spent die.
  [MOON("eventide's splendor", 14)]: numbers(
    [
      action({
        id: 'vibrance-of-the-full-moon',
        name: 'Lunar Vitality (Full Moon)',
        actionType: 'other',
        roll: '1d6',
      }),
    ],
    { unoffered: TARGETS },
  ),

  // ---- College of Spirits ----
  [SPIRITS('college of spirits', 3)]: text(),
  [SPIRITS('channeler', 3)]: numbers([
    {
      type: 'grantSpells',
      spells: [{ mode: 'known', ability: 'cha', spell: { id: 'guidance|xphb' } }],
    },
    { type: 'proficiency', category: 'tool', value: 'playing cards|xphb' },
  ]),
  // The spirit is rolled (or picked with Controlled Channeling) at the table; unleashing it is
  // a Magic action against the Bard spell save DC.
  [SPIRITS('spirits from beyond', 3)]: numbers(
    [
      action({
        id: 'controlled-channeling',
        name: 'Controlled Channeling',
        actionType: 'bonus',
        costs: [inspiration],
      }),
      action({
        id: 'unleash-spirit',
        name: 'Unleash Spirit',
        actionType: 'action',
        roll: 'table.bardic-die + mod.cha',
        saveDc: dc('cha'),
      }),
    ],
    { unoffered: AT_TABLE },
  ),
  // Spirit Guardians and its free cast come from the college's data; the Cover rider is a
  // once-per-rest counter.
  [SPIRITS('empowered channeling', 6)]: numbers([
    action({
      id: 'power-from-beyond',
      name: 'Power from Beyond',
      actionType: 'other',
      roll: '1d6',
    }),
    uses('spiritual-manifestation', 'Spiritual Manifestation', 1, 'short'),
  ]),
  [SPIRITS('mystical connection', 14)]: text({ unoffered: AT_TABLE }),
};
