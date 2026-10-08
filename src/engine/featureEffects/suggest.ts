// A first draft of a feature's mapping (plan §10.2, step 6.1), found from patterns in its text,
// for the Coverage screen: uses and how they come back, resistances, advantage, senses, speed,
// Armor Class, a skill proficiency, a table column named like the feature. Never registered as
// is: a draft to read against the text, fix and copy into a mapping file.

import {
  ABILITIES,
  ABILITY_NAMES,
  SKILLS,
  type Ability,
  type ClassDef,
  type ClassFeature,
  type Effect,
  type Entry,
  type Recharge,
  type Subclass,
  type SubclassFeature,
} from '../../schema/index.ts';
import { stripTags } from '../../richtext/tagRegistry.ts';
import { classKey } from '../derive/scope.ts';
import type { FeatureMapping } from './types.ts';

function plainText(entries: readonly Entry[]): string {
  const out: string[] = [];
  const visit = (v: unknown): void => {
    if (typeof v === 'string') out.push(stripTags(v));
    else if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === 'object') Object.values(v).forEach(visit);
  };
  visit(entries);
  return out.join(' ').replace(/\s+/g, ' ');
}

const ABILITY_BY_NAME = Object.fromEntries(
  ABILITIES.map((a) => [ABILITY_NAMES[a].toLowerCase(), a]),
) as Record<string, Ability>;

const NUMBER_WORDS: Record<string, number> = { once: 1, twice: 2, one: 1, two: 2, three: 3 };

/** How many uses the text gives, as a formula. */
function usesOf(
  text: string,
  ownTable: (prefix: string) => string | undefined,
): string | undefined {
  if (/number of times equal to your Proficiency Bonus/i.test(text)) return 'pb';
  const mod = /number of times equal to your (\w+) modifier/i.exec(text);
  if (mod) {
    const a = ABILITY_BY_NAME[mod[1]!.toLowerCase()];
    if (a) return /minimum of once/i.test(text) ? `max(1, mod.${a})` : `mod.${a}`;
  }
  const table = /shown in the .*? column of the .*? table/i.test(text) ? ownTable('') : undefined;
  if (table) return table;
  const times = /(?:use (?:this feature|it)|can do so) (once|twice|(\d+) times)/i.exec(text);
  if (times) return String(times[2] ? Number(times[2]) : (NUMBER_WORDS[times[1]!] ?? 1));
  return undefined;
}

function rechargeOf(text: string): Recharge | undefined {
  if (/regain one expended use when you finish a Short Rest/i.test(text)) return 'shortOne';
  if (/finish a Short or Long Rest/i.test(text)) return 'short';
  if (/finish a Long Rest/i.test(text)) return 'long';
  return undefined;
}

export function slug(name: string): string {
  return classKey(name);
}

export function suggestMapping(
  feature: ClassFeature | SubclassFeature,
  owners: readonly (ClassDef | Subclass | undefined)[] = [],
): FeatureMapping {
  const text = plainText(feature.entries);
  const effects: Effect[] = [];
  const id = slug(feature.name);
  const columns = owners.flatMap((o) => o?.table?.map((c) => c.key) ?? []);
  const ownTable = () => {
    const key = columns.find((k) => k.startsWith(id.split('-')[0]!));
    return key ? `table.${key}` : undefined;
  };

  const max = usesOf(text, ownTable);
  const recharge = rechargeOf(text);
  if (max && recharge)
    effects.push({ type: 'resource', resourceId: id, name: feature.name, max, recharge });

  for (const m of text.matchAll(/Resistance to (\w+)(?:, (\w+),)?(?: and (\w+))? damage/gi)) {
    for (const type of [m[1], m[2], m[3]]) {
      if (type && !/that|the/i.test(type))
        effects.push({ type: 'resistance', value: type.toLowerCase() });
    }
  }
  for (const m of text.matchAll(/Advantage on (\w+) saving throws/gi)) {
    const a = ABILITY_BY_NAME[m[1]!.toLowerCase()];
    if (a) effects.push({ type: 'rollMode', target: `save:${a}`, mode: 'advantage' });
  }
  for (const m of text.matchAll(/Advantage on (\w+) checks/gi)) {
    const a = ABILITY_BY_NAME[m[1]!.toLowerCase()];
    if (a) effects.push({ type: 'rollMode', target: `check:${a}`, mode: 'advantage' });
  }
  const dark = /Darkvision with a range of (\d+) feet/i.exec(text);
  if (dark) effects.push({ type: 'sense', sense: 'darkvision', range: Number(dark[1]) });
  const speed = /Speed increases by (\d+) feet/i.exec(text);
  if (speed) effects.push({ type: 'speedBonus', value: Number(speed[1]) });
  const ac = /(?:\+(\d) bonus to (?:your )?Armor Class|Armor Class increases by (\d))/i.exec(text);
  if (ac) effects.push({ type: 'acBonus', value: Number(ac[1] ?? ac[2]) });
  for (const skill of SKILLS) {
    const name = skill.replace(/\b\w/g, (c) => c.toUpperCase()).replace(' Of ', ' of ');
    if (new RegExp(`proficiency in (?:the )?${name} skill`, 'i').test(text))
      effects.push({ type: 'proficiency', category: 'skill', value: skill });
  }
  const hp = /Hit Point maximum increases by (\d+)/i.exec(text);
  if (hp) effects.push({ type: 'hpBonus', flat: Number(hp[1]) });

  return { level: effects.length ? 'A' : 'C', effects };
}

/** The mapping as code to paste into a mapping file. */
export function mappingCode(key: string, mapping: FeatureMapping): string {
  return `${JSON.stringify(key)}: ${JSON.stringify(mapping, null, 2)},`;
}
