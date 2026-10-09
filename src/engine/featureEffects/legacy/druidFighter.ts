// 2014 druid circles and fighter archetypes on 2024 characters (plan step 8.3): Dreams,
// Shepherd, Spores and Wildfire; Cavalier, Samurai, Echo Knight and Rune Knight. The data puts
// their features at the 2024 subclass levels (a circle's level 2 features come at Druid 3), and
// their keys keep the 2014 levels. Wild Shape uses spend the 2024 `wild-shape` counter. Circle
// spells, and the runes a Rune Knight learns, are offered by the subclasses' own data; the runes
// are mapped here too (their passive benefits and once-per-rest invocations).

import type { ActionDef, Effect, Formula, Recharge } from '../../../schema/index.ts';
import type { FeatureEffectsMap } from '../types.ts';
import {
  action,
  AT_TABLE,
  dc,
  numbers,
  savesAgainst,
  TARGETS,
  text,
  toggled,
  uses,
  when,
} from '../core/helpers.ts';

const DRUID = (sub: string, src: string, id: string, level: number) =>
  `subclassFeature:${id}|druid|phb|${sub}|${src}|${level}|${src}` as const;
const FIGHTER = (sub: string, src: string, id: string, level: number) =>
  `subclassFeature:${id}|fighter|phb|${sub}|${src}|${level}|${src}` as const;
/** A circle's opening feature, keyed on the 2024 class at Druid 3. */
const CIRCLE = (sub: string, src: string, id: string) =>
  `subclassFeature:${id}|druid|xphb|${sub}|${src}|3|${src}` as const;
const DREAMS = (id: string, level: number) => DRUID('dreams', 'xge', id, level);
const SHEPHERD = (id: string, level: number) => DRUID('shepherd', 'xge', id, level);
const SPORES = (id: string, level: number) => DRUID('spores', 'tce', id, level);
const WILDFIRE = (id: string, level: number) => DRUID('wildfire', 'tce', id, level);
const CAVALIER = (id: string, level: number) => FIGHTER('cavalier', 'xge', id, level);
const SAMURAI = (id: string, level: number) => FIGHTER('samurai', 'xge', id, level);
const ECHO = (id: string, level: number) => FIGHTER('echo knight', 'egw', id, level);
const RUNE = (id: string, level: number) => FIGHTER('rune knight', 'tce', id, level);
const RUNE_OPTION = (id: string) => `optionalFeature:${id}|tce` as const;

const wildShape = { resource: 'wild-shape', amount: 1 };
const wisUses = 'max(1, mod.wis)';
const conUses = 'max(1, mod.con)';
/** Halo of Spores' die size by Druid level. */
const haloFaces = 'steps(level.druid, 1, 4, 6, 6, 10, 8, 14, 10)';
const giantsMightDie = 'steps(level.fighter, 3, 1d6, 10, 1d8, 18, 1d10)';

/** A counter and the action that spends one use of it. */
function limited(
  id: string,
  name: string,
  max: Formula,
  recharge: Recharge,
  actionType: ActionDef['actionType'],
  more: Partial<ActionDef> = {},
): Effect[] {
  return [
    uses(id, name, max, recharge),
    action({ id, name, actionType, costs: [{ resource: id, amount: 1 }], ...more }),
  ];
}

const advantage = (...targets: ('check:str' | 'save:str' | `skill:${string}`)[]): Effect[] =>
  targets.map((target) => ({ type: 'rollMode', target, mode: 'advantage' }) as Effect);

/** A rune's invocation: once per Short or Long Rest, twice from Fighter 15 (Master of Runes). */
const runeUses = (id: string, name: string) =>
  uses(id, name, 'steps(level.fighter, 1, 1, 15, 2)', 'short');

/** One proficiency from a list of skills, or a language instead. */
function skillOrLanguage(skills: string[]): Effect[] {
  return [
    {
      type: 'optionChoice',
      choice: { slot: 'kind', count: 1, from: ['skill', 'language'] },
      labels: ['A skill', 'A language'],
    },
    {
      type: 'ifChoice',
      slot: 'kind',
      value: 'skill',
      effects: [
        {
          type: 'proficiencyChoice',
          category: 'skill',
          choice: { slot: 'skill', count: 1, from: skills },
        },
      ],
    },
    {
      type: 'ifChoice',
      slot: 'kind',
      value: 'language',
      effects: [
        {
          type: 'proficiencyChoice',
          category: 'language',
          choice: { slot: 'language', count: 1, from: 'any' },
          filter: 'standard|rare',
        },
      ],
    },
  ];
}

export const LEGACY_DRUID_FIGHTER: FeatureEffectsMap = {
  // ---- Circle of Dreams ----
  [CIRCLE('dreams', 'xge', 'circle of dreams')]: text(),
  // A pool of d6s; how many go into one use is decided at the table.
  [DREAMS('balm of the summer court', 2)]: numbers(
    [
      uses('balm-of-the-summer-court', 'Balm of the Summer Court', 'level.druid', 'long', {
        die: 'd6',
        pool: true,
      }),
      action({
        id: 'balm-of-the-summer-court',
        name: 'Balm of the Summer Court',
        actionType: 'bonus',
      }),
    ],
    {
      unoffered: TARGETS,
      notes:
        'Spend up to half your Druid level in dice per use; the target’s temporary HP is by hand.',
    },
  ),
  [DREAMS('hearth of moonlight and shadow', 6)]: toggled([
    {
      type: 'rollNote',
      target: 'skill:stealth',
      text: '+5 inside your Hearth sphere during a rest',
    },
    {
      type: 'rollNote',
      target: 'skill:perception',
      text: '+5 inside your Hearth sphere during a rest',
    },
  ]),
  [DREAMS('hidden paths', 10)]: numbers([
    ...limited('hidden-paths', 'Hidden Paths', wisUses, 'long', 'bonus'),
    action({
      id: 'hidden-paths-other',
      name: 'Hidden Paths (another creature)',
      actionType: 'action',
      costs: [{ resource: 'hidden-paths', amount: 1 }],
    }),
  ]),
  // One free cast of any of the three spells, shared, once per Long Rest.
  [DREAMS('walker in dreams', 14)]: numbers([
    uses('walker-in-dreams', 'Walker in Dreams', 1, 'long'),
    {
      type: 'grantSpells',
      spells: ['dream|xphb', 'scrying|xphb', 'teleportation circle|xphb'].map((id) => ({
        mode: 'innate' as const,
        ability: 'wis' as const,
        uses: { resource: 'walker-in-dreams', cost: 1 },
        spell: { id },
      })),
    },
  ]),

  // ---- Circle of the Shepherd ----
  [CIRCLE('shepherd', 'xge', 'circle of the shepherd')]: text(),
  [SHEPHERD('speech of the woods', 2)]: numbers([
    { type: 'proficiency', category: 'language', value: 'sylvan' },
  ]),
  // The spirit is picked each time it is summoned: switch the totem on with that spirit.
  [SHEPHERD('spirit totem', 2)]: toggled(
    [
      uses('spirit-totem', 'Spirit Totem', 1, 'short'),
      {
        type: 'toggle',
        toggleId: 'spirit-totem',
        name: 'Spirit Totem',
        cost: [{ resource: 'spirit-totem', amount: 1 }, { action: 'bonus' }],
        endsOn: ['shortRest', 'longRest'],
        effects: [],
        options: [
          {
            id: 'bear',
            name: 'Bear',
            effects: [
              ...advantage('check:str', 'save:str'),
              action({
                id: 'bear-spirit',
                name: 'Bear Spirit temporary HP',
                actionType: 'other',
                roll: '5 + level.druid',
              }),
            ],
          },
          {
            id: 'hawk',
            name: 'Hawk',
            effects: [
              ...advantage('skill:perception'),
              action({ id: 'hawk-spirit', name: 'Hawk Spirit', actionType: 'reaction' }),
            ],
          },
          {
            id: 'unicorn',
            name: 'Unicorn',
            effects: [
              action({
                id: 'unicorn-spirit',
                name: 'Unicorn Spirit healing',
                actionType: 'other',
                roll: 'level.druid',
              }),
            ],
          },
        ],
      },
    ],
    {
      unoffered: 'Picked each time: switch on Spirit Totem with that spirit.',
      notes: 'Advantage from the aura only applies inside it.',
    },
  ),
  [SHEPHERD('mighty summoner', 6)]: text(),
  [SHEPHERD('guardian spirit', 10)]: numbers([
    when({ toggle: 'spirit-totem' }, [
      action({
        id: 'guardian-spirit',
        name: 'Guardian Spirit',
        actionType: 'other',
        roll: 'floor(level.druid / 2)',
      }),
    ]),
  ]),
  // The beasts are picked when it happens.
  [SHEPHERD('faithful summons', 14)]: numbers(
    limited('faithful-summons', 'Faithful Summons', 1, 'long', 'other'),
    { unoffered: AT_TABLE },
  ),

  // ---- Circle of Spores ----
  [CIRCLE('spores', 'tce', 'circle of spores')]: text(),
  [SPORES('circle spells', 2)]: text(),
  [SPORES('halo of spores', 2)]: numbers([
    when({ not: { toggle: 'symbiotic-entity' } }, [
      action({
        id: 'halo-of-spores',
        name: 'Halo of Spores',
        actionType: 'reaction',
        roll: `dice(1, ${haloFaces})`,
        saveDc: dc('wis'),
      }),
    ]),
  ]),
  // Halo of Spores rolls its die twice while the entity is active (its action is swapped).
  [SPORES('symbiotic entity', 2)]: toggled([
    {
      type: 'toggle',
      toggleId: 'symbiotic-entity',
      name: 'Symbiotic Entity',
      cost: [wildShape, { action: 'action' }],
      onActivate: [{ tempHp: '4 * level.druid' }],
      endsOn: ['shortRest', 'longRest'],
      effects: [
        action({
          id: 'halo-of-spores',
          name: 'Halo of Spores',
          actionType: 'reaction',
          roll: `dice(2, ${haloFaces})`,
          saveDc: dc('wis'),
        }),
        {
          type: 'damageRider',
          id: 'symbiotic-entity',
          name: 'Symbiotic Entity',
          dice: '1d6',
          damageType: 'necrotic',
          filter: { range: 'melee', source: ['weapon'] },
          optIn: false,
        },
      ],
    },
  ]),
  [SPORES('fungal infestation', 6)]: numbers(
    limited('fungal-infestation', 'Fungal Infestation', wisUses, 'long', 'reaction'),
  ),
  [SPORES('spreading spores', 10)]: numbers([
    when({ toggle: 'symbiotic-entity' }, [
      action({
        id: 'spreading-spores',
        name: 'Spreading Spores',
        actionType: 'bonus',
        roll: `dice(2, ${haloFaces})`,
        saveDc: dc('wis'),
      }),
    ]),
  ]),
  [SPORES('fungal body', 14)]: numbers(
    ['blinded', 'deafened', 'frightened', 'poisoned'].map((value): Effect => ({
      type: 'conditionImmunity',
      value,
    })),
    {
      notes:
        'Critical hits against you count as normal hits unless you are Incapacitated: by hand.',
      needs: 'a defense that turns critical hits into normal hits',
    },
  ),

  // ---- Circle of Wildfire ----
  [CIRCLE('wildfire', 'tce', 'circle of wildfire')]: text(),
  [WILDFIRE('circle spells', 2)]: text(),
  // Switched on while the spirit is summoned; Enhanced Bond hangs off it.
  [WILDFIRE('summon wildfire spirit', 2)]: toggled(
    [
      {
        type: 'toggle',
        toggleId: 'wildfire-spirit',
        name: 'Wildfire Spirit',
        cost: [wildShape, { action: 'action' }],
        endsOn: ['shortRest', 'longRest'],
        effects: [],
      },
      action({
        id: 'summon-wildfire-spirit',
        name: 'Summon Wildfire Spirit',
        actionType: 'action',
        roll: '2d6',
        saveDc: dc('wis'),
      }),
    ],
    {
      unoffered: AT_TABLE,
      notes: "The spirit isn't tracked by the app: note its stat block (it uses your PB) and HP.",
    },
  ),
  [WILDFIRE('enhanced bond', 6)]: toggled(
    [
      when({ toggle: 'wildfire-spirit' }, [
        action({ id: 'enhanced-bond', name: 'Enhanced Bond', actionType: 'other', roll: '1d8' }),
      ]),
    ],
    { needs: 'a spell filter by damage type (or healing) for spellMod damage bonuses' },
  ),
  // Healing or damage is decided at the table each time.
  [WILDFIRE('cauterizing flames', 10)]: numbers(
    limited('cauterizing-flames', 'Cauterizing Flames', 'pb', 'long', 'reaction', {
      roll: '2d10 + mod.wis',
    }),
    { unoffered: AT_TABLE },
  ),
  [WILDFIRE('blazing revival', 14)]: numbers(
    limited('blazing-revival', 'Blazing Revival', 1, 'long', 'other'),
    {
      notes: 'Set your Hit Points to half your maximum by hand.',
      needs: 'a heal outcome based on the Hit Point maximum',
    },
  ),

  // ---- Cavalier ----
  [CAVALIER('cavalier', 3)]: text(),
  [CAVALIER('bonus proficiency', 3)]: numbers(
    skillOrLanguage(['animal handling', 'history', 'insight', 'performance', 'persuasion']),
  ),
  [CAVALIER('born to the saddle', 3)]: numbers([savesAgainst('falling off your mount')]),
  // The special attack's extra damage is its roll.
  [CAVALIER('unwavering mark', 3)]: numbers(
    limited('unwavering-mark', 'Unwavering Mark', 'max(1, mod.str)', 'long', 'bonus', {
      attack: { range: 'melee', source: ['weapon'] },
      roll: 'floor(level.fighter / 2)',
    }),
  ),
  [CAVALIER('warding maneuver', 7)]: numbers(
    limited('warding-maneuver', 'Warding Maneuver', conUses, 'long', 'reaction', { roll: '1d8' }),
  ),
  [CAVALIER('hold the line', 10)]: text(),
  [CAVALIER('ferocious charger', 15)]: numbers([
    action({
      id: 'ferocious-charger',
      name: 'Ferocious Charger',
      actionType: 'other',
      saveDc: dc('str'),
    }),
  ]),
  [CAVALIER('vigilant defender', 18)]: text(),

  // ---- Samurai ----
  [SAMURAI('samurai', 3)]: text(),
  [SAMURAI('bonus proficiency', 3)]: numbers(
    skillOrLanguage(['history', 'insight', 'performance', 'persuasion']),
  ),
  // Advantage lasts the turn: the player applies it.
  [SAMURAI('fighting spirit', 3)]: numbers(
    limited('fighting-spirit', 'Fighting Spirit', 3, 'long', 'bonus', {
      outcomes: [{ tempHp: 'steps(level.fighter, 1, 5, 10, 10, 15, 15)' }],
    }),
  ),
  [SAMURAI('elegant courtier', 7)]: numbers(
    [
      { type: 'rollBonus', target: 'skill:persuasion', value: 'mod.wis' },
      { type: 'proficiency', category: 'save', value: 'wis' },
    ],
    {
      notes:
        'Already proficient in Wisdom saves: pick Intelligence or Charisma saves and add it by hand.',
    },
  ),
  // One use back on rolling Initiative with none left (no cost to track).
  [SAMURAI('tireless spirit', 10)]: text(),
  [SAMURAI('rapid strike', 15)]: text(),
  [SAMURAI('strength before death', 18)]: numbers(
    limited('strength-before-death', 'Strength before Death', 1, 'long', 'reaction'),
  ),

  // ---- Echo Knight ----
  [ECHO('echo knight', 3)]: text(),
  [ECHO('manifest echo', 3)]: toggled(
    [action({ id: 'manifest-echo', name: 'Manifest Echo', actionType: 'bonus' })],
    {
      notes: "The echo isn't tracked by the app: its AC is 14 + your Proficiency Bonus, 1 HP.",
      needs: 'a companion stat line (the echo’s AC)',
    },
  ),
  [ECHO('unleash incarnation', 3)]: numbers(
    limited('unleash-incarnation', 'Unleash Incarnation', conUses, 'long', 'other', {
      attack: { range: 'melee' },
    }),
  ),
  [ECHO('echo avatar', 7)]: text(),
  [ECHO('shadow martyr', 10)]: numbers(
    limited('shadow-martyr', 'Shadow Martyr', 1, 'short', 'reaction'),
  ),
  [ECHO('reclaim potential', 15)]: numbers(
    limited('reclaim-potential', 'Reclaim Potential', conUses, 'long', 'other', {
      outcomes: [{ tempHp: '2d6 + mod.con' }],
    }),
  ),
  // One Unleash Incarnation use back on rolling Initiative with none left (no cost to track).
  [ECHO('legion of one', 18)]: text(),

  // ---- Rune Knight ----
  [RUNE('rune knight', 3)]: text(),
  [RUNE('bonus proficiencies', 3)]: numbers([
    { type: 'proficiency', category: 'tool', value: "smith's tools|xphb" },
    { type: 'proficiency', category: 'language', value: 'giant' },
  ]),
  // The runes are picked through the subclass's own choice; this is their save DC.
  [RUNE('rune carver', 3)]: numbers([
    action({ id: 'rune-dc', name: 'Rune Magic save DC', actionType: 'other', saveDc: dc('con') }),
  ]),
  // Large while on (Huge from Fighter 18): size and reach are the player's.
  [RUNE("giant's might", 3)]: toggled([
    uses('giants-might', "Giant's Might", 'pb', 'long'),
    {
      type: 'toggle',
      toggleId: 'giants-might',
      name: "Giant's Might",
      cost: [{ resource: 'giants-might', amount: 1 }, { action: 'bonus' }],
      endsOn: ['shortRest', 'longRest'],
      effects: [
        ...advantage('check:str', 'save:str'),
        {
          type: 'damageRider',
          id: 'giants-might',
          name: "Giant's Might",
          dice: giantsMightDie,
          filter: { source: ['weapon', 'unarmed'] },
          oncePerTurn: true,
          optIn: true,
        },
      ],
    },
  ]),
  [RUNE('runic shield', 7)]: numbers(
    limited('runic-shield', 'Runic Shield', 'pb', 'long', 'reaction'),
  ),
  [RUNE('additional rune known', 7)]: text(),
  // The larger die is in Giant's Might's rider.
  [RUNE('great stature', 10)]: text(),
  [RUNE('additional rune known', 10)]: text(),
  // The runes' counters double from Fighter 15.
  [RUNE('master of runes', 15)]: text(),
  [RUNE('additional rune known', 15)]: text(),
  [RUNE('runic juggernaut', 18)]: text(),

  // ---- Runes (not part of the class gate; mapped where numbers change) ----
  [RUNE_OPTION('cloud rune')]: numbers([
    ...advantage('skill:sleight of hand', 'skill:deception'),
    runeUses('cloud-rune', 'Cloud Rune'),
    action({
      id: 'cloud-rune',
      name: 'Cloud Rune',
      actionType: 'reaction',
      costs: [{ resource: 'cloud-rune', amount: 1 }],
    }),
  ]),
  [RUNE_OPTION('fire rune')]: numbers(
    [
      runeUses('fire-rune', 'Fire Rune'),
      action({
        id: 'fire-rune',
        name: 'Fire Rune',
        actionType: 'other',
        costs: [{ resource: 'fire-rune', amount: 1 }],
        roll: '2d6',
        saveDc: dc('con'),
      }),
    ],
    {
      notes: 'Double your Proficiency Bonus on tool checks by hand.',
      needs: 'expertise with tools',
    },
  ),
  [RUNE_OPTION('frost rune')]: toggled([
    ...advantage('skill:animal handling', 'skill:intimidation'),
    runeUses('frost-rune', 'Frost Rune'),
    {
      type: 'toggle',
      toggleId: 'frost-rune',
      name: 'Frost Rune',
      cost: [{ resource: 'frost-rune', amount: 1 }, { action: 'bonus' }],
      endsOn: ['shortRest', 'longRest'],
      effects: (['check:str', 'check:con', 'save:str', 'save:con'] as const).map(
        (target): Effect => ({ type: 'rollBonus', target, value: 2 }),
      ),
    },
  ]),
  [RUNE_OPTION('stone rune')]: numbers([
    ...advantage('skill:insight'),
    { type: 'sense', sense: 'darkvision', range: 120 },
    runeUses('stone-rune', 'Stone Rune'),
    action({
      id: 'stone-rune',
      name: 'Stone Rune',
      actionType: 'reaction',
      costs: [{ resource: 'stone-rune', amount: 1 }],
      saveDc: dc('con'),
    }),
  ]),
  [RUNE_OPTION('hill rune')]: toggled([
    savesAgainst('being Poisoned'),
    { type: 'resistance', value: 'poison' },
    runeUses('hill-rune', 'Hill Rune'),
    {
      type: 'toggle',
      toggleId: 'hill-rune',
      name: 'Hill Rune',
      cost: [{ resource: 'hill-rune', amount: 1 }, { action: 'bonus' }],
      endsOn: ['shortRest', 'longRest'],
      effects: ['bludgeoning', 'piercing', 'slashing'].map((value): Effect => ({
        type: 'resistance',
        value,
      })),
    },
  ]),
  [RUNE_OPTION('storm rune')]: numbers([
    ...advantage('skill:arcana'),
    { type: 'rollNote', target: 'initiative', text: "Can't be Surprised unless Incapacitated" },
    runeUses('storm-rune', 'Storm Rune'),
    action({
      id: 'storm-rune',
      name: 'Storm Rune',
      actionType: 'bonus',
      costs: [{ resource: 'storm-rune', amount: 1 }],
    }),
  ]),
};
