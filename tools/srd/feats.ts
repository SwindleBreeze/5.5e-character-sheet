// SRD feats as 5etools feat records: category, prerequisites, the ability scores they raise,
// and what else they grant. Magic Initiate gets a version per spell list (`Magic Initiate;
// Cleric`), as backgrounds name it that way. The Fighting Style feats only a Paladin or a
// Ranger can take (Blessed Warrior, Druidic Warrior) are filed with the class features in the
// compendium and taken from there.

import { TWIN, type Context } from './context.ts';
import type { Doc } from './foundry.ts';
import type { Entry } from './html.ts';

const advancements = (doc: Doc): Doc[] => Object.values(doc.system?.advancement ?? {}) as Doc[];
const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const ABILITY_NAME: Record<string, string> = {
  strength: 'str',
  dexterity: 'dex',
  constitution: 'con',
  intelligence: 'int',
  wisdom: 'wis',
  charisma: 'cha',
};
const CATEGORY: Record<string, string> = {
  origin: 'O',
  general: 'G',
  fightingStyle: 'FS',
  epicBoon: 'EB',
};
const CLASS_STYLE: Record<string, string> = { Paladin: 'FS:P', Ranger: 'FS:R' };

const ASI_FEAT = [
  { choose: { from: ABILITIES, amount: 2 }, hidden: true },
  { choose: { from: ABILITIES, count: 2 }, hidden: true },
];

const SPELL_LISTS = ['Cleric', 'Druid', 'Wizard'];

/** What a feat's own records can't say (the senses an Epic Boon gives). */
const EXTRA: Record<string, Doc> = {
  'Boon of Truesight': { senses: [{ truesight: 60 }] },
  'Boon of Spell Recall': { prerequisite: [{ level: 19, spellcasting2020: true }] },
};
/** The spellcasting ability of a class's Fighting Style cantrips (its own). */
const STYLE_ABILITY: Record<string, string> = { Paladin: 'cha', Ranger: 'wis' };

function prerequisite(d: Doc, category: string): Doc[] | undefined {
  const sys = d.system;
  const level = Number(sys.prerequisites?.level) || (category === 'EB' ? 19 : 0);
  const req = String(sys.requirements ?? '');
  if (CLASS_STYLE[req]) {
    return [
      {
        otherSummary: {
          entry: `When Gaining the Level 2 ${req} "Fighting Style" Feature`,
          entrySummary: 'Special',
        },
      },
    ];
  }
  if (category === 'FS') return [{ feature: ['Fighting Style'] }];
  // `Strength or Dexterity 13+`: one prerequisite per ability.
  const m = /^([A-Za-z ]+?) (\d+)\+$/.exec(req);
  if (m) {
    return m[1]!
      .split(/ or /)
      .map((a) => ABILITY_NAME[a.trim().toLowerCase()])
      .filter(Boolean)
      .map((a) => ({ ...(level ? { level } : {}), ability: [{ [a!]: Number(m[2]) }] }));
  }
  return level ? [{ level }] : undefined;
}

function abilityIncrease(d: Doc): Doc[] | undefined {
  if (d.name === 'Ability Score Improvement') return ASI_FEAT;
  const asi = advancements(d).find((a) => a.type === 'AbilityScoreImprovement');
  if (!asi) return undefined;
  const from = ABILITIES.filter((a) => !(asi.configuration?.locked ?? []).includes(a));
  const max = Number(asi.configuration?.max) || 0;
  return [{ choose: { from }, ...(max && max !== 20 ? { max } : {}) }];
}

/** Cantrips chosen from a class list (Blessed Warrior: two Cleric cantrips). */
function cantripChoice(d: Doc): Doc[] | undefined {
  const a = advancements(d).find(
    (x) => x.type === 'ItemChoice' && x.configuration?.type === 'spell',
  );
  const cls = String(a?.configuration?.restriction?.list?.[0] ?? '').replace('class:', '');
  if (!a || !cls) return undefined;
  const count =
    Number((Object.values(a.configuration.choices ?? {})[0] as Doc | undefined)?.count) || 1;
  return [
    {
      ability:
        STYLE_ABILITY[String(d.system?.requirements)] ??
        a.configuration.spell?.ability?.[0] ??
        'wis',
      known: { _: [{ choose: `level=0|class=${cls}`, count }] },
    },
  ];
}

function magicInitiateSpells(list: string) {
  return {
    ability: { choose: ['int', 'wis', 'cha'] },
    innate: { _: { daily: { 1: [{ choose: `level=1|class=${list}` }] } } },
    known: { _: [{ choose: `level=0|class=${list}`, count: 2 }] },
  };
}

export function convertFeats(ctx: Context, docs: Doc[]): Doc[] {
  return docs
    .filter(
      (d) =>
        d.type === 'feat' &&
        (CATEGORY[d.system?.type?.subtype] || d.name === 'Ability Score Improvement'),
    )
    .map((d) => {
      const req = String(d.system?.requirements ?? '');
      const category =
        CLASS_STYLE[req] ??
        CATEGORY[d.system?.type?.subtype] ??
        (d.name === 'Ability Score Improvement' ? 'G' : 'G');
      const entries: Entry[] = ctx
        .entries(d.system?.description?.value)
        .filter(
          (e) =>
            !(
              typeof e === 'object' &&
              e.type === 'inset' &&
              /^Prerequisite/i.test(String((e.entries as Entry[])[0]))
            ),
        );
      const prereq = prerequisite(d, category.split(':')[0]!);
      const ability = abilityIncrease(d);
      const record: Doc = {
        name: String(d.name),
        source: TWIN,
        category,
        ...(prereq ? { prerequisite: prereq } : {}),
        ...(d.system?.prerequisites?.repeatable
          ? { repeatable: true, repeatableHidden: true }
          : {}),
        ...(ability ? { ability } : {}),
        entries,
        ...EXTRA[String(d.name)],
      };
      const cantrips = cantripChoice(d);
      if (cantrips) record.additionalSpells = cantrips;
      if (d.name === 'Skilled') {
        record.skillToolLanguageProficiencies = [
          { choose: [{ from: ['anySkill', 'anyTool'], count: 3 }] },
        ];
      }
      if (d.name === 'Magic Initiate') {
        record.additionalSpells = SPELL_LISTS.map((l) => ({
          name: `${l} Spells`,
          ...magicInitiateSpells(l),
        }));
        record._versions = SPELL_LISTS.map((l) => ({
          name: `Magic Initiate; ${l}`,
          source: TWIN,
          additionalSpells: [magicInitiateSpells(l)],
        }));
      }
      return record;
    });
}
