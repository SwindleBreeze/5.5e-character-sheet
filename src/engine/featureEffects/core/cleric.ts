// Cleric and its four XPHB domains (plan §10.2, step 6.5), checked against the 2024 Player's
// Handbook text of each feature. Channel Divinity is a counter; Divine Spark, Turn Undead and
// the domains' Channel Divinity options are actions paid from it. Domain spells come from the
// subclasses' own data. Blessed Strikes' pick is in `levels4to20.ts`.

import type { FeatureEffectsMap } from '../types.ts';
import {
  action,
  AT_TABLE,
  attacksAgainst,
  dc,
  fromData,
  NO_CHOICE,
  numbers,
  TARGETS,
  text,
  uses,
} from './helpers.ts';

const C = (id: string, level: number) => `classFeature:${id}|cleric|xphb|${level}|xphb` as const;
const S = (sub: string, id: string, level: number) =>
  `subclassFeature:${id}|cleric|xphb|${sub}|xphb|${level}|xphb` as const;

const divinity = { resource: 'channel-divinity', amount: 1 };
const wisUses = 'max(1, mod.wis)';

export const CLERIC: FeatureEffectsMap = {
  [C('spellcasting', 1)]: text(),
  [C('divine order', 1)]: fromData(),
  [C('protector', 1)]: numbers([
    { type: 'proficiency', category: 'weapon', value: 'martial' },
    { type: 'proficiency', category: 'armor', value: 'heavy' },
  ]),
  [C('thaumaturge', 1)]: numbers([
    {
      type: 'grantSpells',
      spells: [
        {
          mode: 'known',
          ability: 'wis',
          spell: { choose: 'level=0|class=Cleric', count: 1, slot: 'cantrip', retrain: 'levelUp' },
        },
      ],
    },
    { type: 'rollBonus', target: 'skill:arcana', value: wisUses },
    { type: 'rollBonus', target: 'skill:religion', value: wisUses },
  ]),
  [C('channel divinity', 2)]: numbers(
    [uses('channel-divinity', 'Channel Divinity', 'table.channel-divinity', 'shortOne')],
    {
      unoffered: AT_TABLE,
    },
  ),
  [C('divine spark', 2)]: numbers([
    action({
      id: 'divine-spark',
      name: 'Divine Spark',
      actionType: 'action',
      costs: [divinity],
      roll: 'dice(steps(level.cleric, 2, 1, 7, 2, 13, 3, 18, 4), 8) + mod.wis',
      saveDc: dc('wis'),
    }),
  ]),
  [C('turn undead', 2)]: numbers(
    [
      action({
        id: 'turn-undead',
        name: 'Turn Undead',
        actionType: 'action',
        costs: [divinity],
        saveDc: dc('wis'),
      }),
    ],
    { unoffered: TARGETS },
  ),
  [C('cleric subclass', 3)]: text(),
  [C('ability score improvement', 4)]: fromData(),
  [C('ability score improvement', 8)]: fromData(),
  [C('ability score improvement', 12)]: fromData(),
  [C('ability score improvement', 16)]: fromData(),
  [C('sear undead', 5)]: numbers([
    action({
      id: 'sear-undead',
      name: 'Sear Undead',
      actionType: 'other',
      roll: 'dice(max(1, mod.wis), 8)',
    }),
  ]),
  [C('subclass feature', 6)]: text(),
  [C('subclass feature', 17)]: text(),
  [C('divine strike', 7)]: numbers([
    {
      type: 'damageRider',
      id: 'divine-strike',
      name: 'Divine Strike (Necrotic or Radiant)',
      dice: 'steps(level.cleric, 7, 1d8, 14, 2d8)',
      filter: { source: ['weapon'] },
      oncePerTurn: true,
      optIn: true,
    },
  ]),
  [C('potent spellcasting', 7)]: numbers([
    {
      type: 'spellMod',
      filter: 'level=0|class=Cleric',
      casterKey: 'cleric|xphb',
      damageBonus: 'mod.wis',
    },
  ]),
  [C('divine intervention', 10)]: numbers([
    uses('divine-intervention', 'Divine Intervention', 1, 'long'),
    action({
      id: 'divine-intervention',
      name: 'Divine Intervention',
      actionType: 'action',
      costs: [{ resource: 'divine-intervention', amount: 1 }],
    }),
  ]),
  [C('improved blessed strikes', 14)]: text(),
  [C('epic boon', 19)]: text(),
  [C('greater divine intervention', 20)]: text({ unoffered: AT_TABLE }),

  // ---- Life Domain ----
  [S('life', 'life domain', 3)]: text({ unoffered: NO_CHOICE }),
  [S('life', 'life domain spells', 3)]: text(),
  [S('life', 'disciple of life', 3)]: text(),
  [S('life', 'preserve life', 3)]: numbers(
    [
      action({
        id: 'preserve-life',
        name: 'Preserve Life',
        actionType: 'action',
        costs: [divinity],
        roll: '5 * level.cleric',
      }),
    ],
    { unoffered: TARGETS },
  ),
  [S('life', 'blessed healer', 6)]: text(),
  [S('life', 'supreme healing', 17)]: text(),

  // ---- Light Domain ----
  [S('light', 'light domain', 3)]: text(),
  [S('light', 'light domain spells', 3)]: text(),
  [S('light', 'radiance of the dawn', 3)]: numbers(
    [
      action({
        id: 'radiance-of-the-dawn',
        name: 'Radiance of the Dawn',
        actionType: 'action',
        costs: [divinity],
        roll: '2d10 + level.cleric',
        saveDc: dc('wis'),
      }),
    ],
    { unoffered: TARGETS },
  ),
  [S('light', 'warding flare', 3)]: numbers([
    uses('warding-flare', 'Warding Flare', wisUses, 'long'),
    action({
      id: 'warding-flare',
      name: 'Warding Flare',
      actionType: 'reaction',
      costs: [{ resource: 'warding-flare', amount: 1 }],
    }),
  ]),
  [S('light', 'improved warding flare', 6)]: numbers([
    { type: 'resourceModify', resourceId: 'warding-flare', recharge: 'short' },
  ]),
  [S('light', 'corona of light', 17)]: numbers([
    uses('corona-of-light', 'Corona of Light', wisUses, 'long'),
    action({
      id: 'corona-of-light',
      name: 'Corona of Light',
      actionType: 'action',
      costs: [{ resource: 'corona-of-light', amount: 1 }],
    }),
  ]),

  // ---- Trickery Domain ----
  [S('trickery', 'trickery domain', 3)]: text(),
  [S('trickery', 'trickery domain spells', 3)]: text(),
  [S('trickery', 'blessing of the trickster', 3)]: numbers(
    [
      action({
        id: 'blessing-of-the-trickster',
        name: 'Blessing of the Trickster',
        actionType: 'action',
      }),
    ],
    { unoffered: TARGETS },
  ),
  [S('trickery', 'invoke duplicity', 3)]: numbers([
    action({
      id: 'invoke-duplicity',
      name: 'Invoke Duplicity',
      actionType: 'bonus',
      costs: [divinity],
    }),
    attacksAgainst('a creature within 5 feet of your illusion that can see it'),
  ]),
  [S('trickery', "trickster's transposition", 6)]: text(),
  [S('trickery', 'improved duplicity', 17)]: text({ unoffered: TARGETS }),

  // ---- War Domain ----
  [S('war', 'war domain', 3)]: text(),
  [S('war', 'war domain spells', 3)]: text(),
  [S('war', 'war priest', 3)]: numbers([
    uses('war-priest', 'War Priest', wisUses, 'short'),
    action({
      id: 'war-priest',
      name: 'War Priest',
      actionType: 'bonus',
      costs: [{ resource: 'war-priest', amount: 1 }],
      attack: { source: ['weapon', 'unarmed'] },
    }),
  ]),
  [S('war', 'guided strike', 3)]: numbers([
    action({ id: 'guided-strike', name: 'Guided Strike', actionType: 'other', costs: [divinity] }),
  ]),
  [S('war', "war god's blessing", 6)]: numbers([
    {
      type: 'grantSpells',
      spells: ['shield of faith|xphb', 'spiritual weapon|xphb'].map((id) => ({
        mode: 'innate' as const,
        ability: 'wis' as const,
        uses: { resourceName: 'Channel Divinity', cost: 1 },
        spell: { id },
      })),
    },
  ]),
  [S('war', 'avatar of battle', 17)]: numbers([
    { type: 'resistance', value: 'bludgeoning' },
    { type: 'resistance', value: 'piercing' },
    { type: 'resistance', value: 'slashing' },
  ]),
};
