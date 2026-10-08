// The 2024 Player's Handbook feats (plan §10.2, step 6.15), checked against the text of each.
// Most ability increases, proficiencies and spells come from the data; these add what the data
// leaves out: Alert's initiative, Tough's hit points, Lucky's points, the fighting styles'
// bonuses, the Epic Boons' numbers. Situational benefits stay text.

import { refKey } from '../../../schema/index.ts';
import type { FeatureEffectsMap } from '../types.ts';
import { action, dc, numbers, text, uses, when } from './helpers.ts';

const F = (id: string) => refKey({ kind: 'feat', id: `${id}|xphb` });

export const FEATS: FeatureEffectsMap = {
  // ---- Origin feats ----
  [F('alert')]: numbers([{ type: 'initiativeBonus', value: 'pb' }]),
  [F('healer')]: text(),
  [F('lucky')]: numbers([
    uses('luck-points', 'Luck Points', 'pb', 'long'),
    action({
      id: 'luck-points',
      name: 'Lucky',
      actionType: 'other',
      costs: [{ resource: 'luck-points', amount: 1 }],
    }),
  ]),
  [F('savage attacker')]: text(),
  [F('tavern brawler')]: numbers([
    {
      type: 'attackMod',
      label: 'Tavern Brawler',
      filter: { source: ['unarmed'] },
      damageDie: '1d4',
    },
  ]),
  [F('tough')]: numbers([{ type: 'hpBonus', perLevel: 2 }]),

  // ---- Fighting styles ----
  [F('archery')]: numbers([
    {
      type: 'attackMod',
      label: 'Archery',
      filter: { range: 'ranged', source: ['weapon'] },
      toHit: 2,
    },
  ]),
  [F('defense')]: numbers([when({ armor: 'any' }, [{ type: 'acBonus', value: 1 }])]),
  [F('dueling')]: numbers([
    {
      type: 'attackMod',
      label: 'Dueling',
      filter: { range: 'melee', source: ['weapon'], notProperties: ['2H'], tags: ['onlyWeapon'] },
      damage: 2,
    },
  ]),
  [F('great weapon fighting')]: text(),
  [F('interception')]: numbers([
    action({ id: 'interception', name: 'Interception', actionType: 'reaction', roll: '1d10 + pb' }),
  ]),
  [F('protection')]: numbers([
    action({ id: 'protection', name: 'Protection', actionType: 'reaction' }),
  ]),
  [F('thrown weapon fighting')]: text(),
  [F('two-weapon fighting')]: numbers([
    {
      type: 'attackMod',
      label: 'Two-Weapon Fighting',
      filter: { tags: ['offHand'] },
      offHandAbility: true,
    },
  ]),
  [F('unarmed fighting')]: numbers([
    {
      type: 'attackMod',
      label: 'Unarmed Fighting',
      filter: { source: ['unarmed'] },
      damageDie: '1d6',
    },
    when({ freeHands: 2 }, [
      {
        type: 'attackMod',
        label: 'Unarmed Fighting',
        filter: { source: ['unarmed'] },
        damageDie: '1d8',
      },
    ]),
  ]),

  // ---- General feats ----
  [F('actor')]: text(),
  [F('athlete')]: numbers([{ type: 'speed', mode: 'climb', value: 'walk' }]),
  [F('charger')]: text(),
  [F('chef')]: text(),
  [F('crossbow expert')]: text(),
  [F('crusher')]: text(),
  [F('defensive duelist')]: numbers([
    action({ id: 'defensive-duelist', name: 'Parry', actionType: 'reaction' }),
  ]),
  [F('dual wielder')]: text(),
  [F('durable')]: numbers([
    { type: 'rollMode', target: 'save:death', mode: 'advantage' },
    action({
      id: 'speedy-recovery',
      name: 'Speedy Recovery',
      actionType: 'bonus',
      costs: [{ hitDice: 1 }],
    }),
  ]),
  [F('elemental adept')]: text({
    unoffered: 'Its damage type is noted at the table; the app doesn’t track spell damage types.',
  }),
  [F('grappler')]: text(),
  [F('great weapon master')]: numbers([
    {
      type: 'attackMod',
      label: 'Great Weapon Master',
      filter: { source: ['weapon'], properties: ['H'] },
      damage: 'pb',
    },
  ]),
  [F('heavy armor master')]: text(),
  [F('inspiring leader')]: numbers([
    action({
      id: 'inspiring-leader',
      name: 'Bolstering Performance',
      actionType: 'other',
      outcomes: [{ tempHp: 'level + max(mod.wis, mod.cha)' }],
    }),
  ]),
  [F('mage slayer')]: numbers([
    uses('mage-slayer', 'Guarded Mind', 1, 'short'),
    action({
      id: 'mage-slayer',
      name: 'Guarded Mind',
      actionType: 'other',
      costs: [{ resource: 'mage-slayer', amount: 1 }],
    }),
  ]),
  [F('medium armor master')]: text(),
  [F('mounted combatant')]: text(),
  [F('piercer')]: text(),
  [F('poisoner')]: text(),
  [F('polearm master')]: text(),
  [F('sentinel')]: text(),
  [F('sharpshooter')]: text(),
  [F('shield master')]: numbers([
    action({ id: 'shield-bash', name: 'Shield Bash', actionType: 'other', saveDc: dc('str') }),
  ]),
  [F('slasher')]: text(),
  [F('speedy')]: numbers([{ type: 'speedBonus', value: 10 }]),
  [F('spell sniper')]: text(),
  [F('war caster')]: numbers([
    { type: 'rollMode', target: 'save:concentration', mode: 'advantage' },
  ]),
  [F('weapon master')]: numbers([
    {
      type: 'weaponMasteryChoice',
      choice: {
        slot: 'mastery',
        count: 1,
        from: { query: 'proficientWeapons' },
        retrain: 'longRest',
      },
    },
  ]),

  // ---- Epic Boons ----
  [F('boon of combat prowess')]: text(),
  [F('boon of dimensional travel')]: text(),
  [F('boon of energy resistance')]: numbers([
    action({
      id: 'energy-redirection',
      name: 'Energy Redirection',
      actionType: 'reaction',
      roll: '2d12 + mod.con',
      saveDc: dc('con'),
    }),
  ]),
  [F('boon of fate')]: numbers([
    uses('boon-of-fate', 'Improve Fate', 1, 'short'),
    action({
      id: 'boon-of-fate',
      name: 'Improve Fate',
      actionType: 'other',
      costs: [{ resource: 'boon-of-fate', amount: 1 }],
      roll: '2d4',
    }),
  ]),
  [F('boon of fortitude')]: numbers([{ type: 'hpBonus', flat: 40 }]),
  [F('boon of irresistible offense')]: text(),
  [F('boon of recovery')]: numbers([
    uses('last-stand', 'Last Stand', 1, 'long'),
    uses('recover-vitality', 'Recover Vitality', 10, 'long', { die: 'd10', pool: true }),
    action({ id: 'recover-vitality', name: 'Recover Vitality', actionType: 'bonus' }),
  ]),
  [F('boon of speed')]: numbers([
    { type: 'speedBonus', value: 30 },
    action({ id: 'escape-artist', name: 'Escape Artist', actionType: 'bonus' }),
  ]),
  [F('boon of spell recall')]: text(),
  [F('boon of the night spirit')]: numbers([
    action({ id: 'merge-with-shadows', name: 'Merge with Shadows', actionType: 'bonus' }),
  ]),
};
