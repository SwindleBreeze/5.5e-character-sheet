// Player extras (plan §6.12): deities, supernatural gifts (rewards), Bastion facilities and
// 2014 character creation options.

import {
  DEFAULT_PANTHEON,
  deityId,
  nameSourceId,
  type CharOption,
  type Deity,
  type Facility,
  type FacilityHirelings,
  type Id,
  type Reward,
} from '../../../schema/index.ts';
import { effectsFromData } from '../effectsFromData.ts';
import type { SourceMeta } from '../manifest.ts';
import { asArray, isObject, num, strArray, type RawEntity } from '../raw.ts';
import { uidToId } from '../uid.ts';
import { baseFields, type ConvertContext } from './common.ts';
import { prerequisites } from './origin.ts';

const nameSource = (defaultSource: string) => (uid: string) =>
  uidToId.nameSource(uid, defaultSource);

function pantheonOf(raw: RawEntity): string {
  return typeof raw.pantheon === 'string' && raw.pantheon ? raw.pantheon : DEFAULT_PANTHEON;
}

/** The same pantheon under the names different books use. */
const PANTHEON_ALIASES: Record<string, string> = {
  'forgotten realms': 'faerunian',
  gnome: 'gnomish',
};

function pantheonKey(pantheon: string): string {
  const key = pantheon.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().trim();
  return PANTHEON_ALIASES[key] ?? key;
}

/**
 * Deities carry no `reprintedAs`; 5etools links them at load time instead, treating a god in a
 * later book as a reprint of the same god (by `reprintAlias` or name) in an earlier one. This
 * does the same, in place, but also requires the same pantheon: 5etools matches on name only,
 * which would make the Faerûnian Tyr a reprint of the Norse one.
 */
export function linkDeityReprints(deities: RawEntity[], books: Map<string, SourceMeta>): void {
  const groups = new Map<string, RawEntity[]>();
  for (const d of deities) {
    const name = typeof d.reprintAlias === 'string' ? d.reprintAlias : String(d.name);
    const key = `${name.toLowerCase()}|${pantheonKey(pantheonOf(d))}`;
    const list = groups.get(key) ?? [];
    list.push(d);
    groups.set(key, list);
  }
  const date = (d: RawEntity) => books.get(String(d.source))?.published ?? '';
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    for (const older of list) {
      if (older.reprintedAs !== undefined) continue;
      const newer = list.filter((d) => date(d) > date(older));
      if (newer.length) {
        older.reprintedAs = newer.map(
          (d) => `${String(d.name)}|${pantheonOf(d)}|${String(d.source)}`,
        );
      }
    }
  }
}

export function convertDeity(raw: RawEntity, ctx: ConvertContext): Deity {
  const pantheon = pantheonOf(raw);
  const deity: Deity = {
    ...baseFields(raw, 'deity', deityId(String(raw.name), pantheon, String(raw.source)), ctx, {
      reprintId: uidToId.deity,
    }),
    pantheon,
    alignment: strArray(raw.alignment),
    domains: strArray(raw.domains),
  };
  if (typeof raw.title === 'string') deity.title = raw.title;
  if (typeof raw.category === 'string') deity.category = raw.category;
  if (typeof raw.province === 'string') deity.province = raw.province;
  if (typeof raw.symbol === 'string') deity.symbol = raw.symbol;
  const altNames = strArray(raw.altNames);
  if (altNames.length) deity.altNames = altNames;
  return deity;
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

function countWord(word: string | undefined): number | undefined {
  return word === undefined ? undefined : (num(word) ?? NUMBER_WORDS[word.toLowerCase()]);
}

/** Phrases that make a gift single-use when no count is given. */
const SINGLE_USE =
  /once you (?:do so|use (?:it|this charm))|once used,|after it is used once|until you use it|expend the charm|activate this charm|after which its magic fades|only once/i;

/** "Once you do so, you can't do so again until you finish a Short Rest": not used up. */
const RECHARGES = /until you finish a (?:short|long) rest/i;

/** The `limited` counts in `additionalSpells`, e.g. `["3"]` or `["1e", "3e"]`. */
function limitedCounts(raw: RawEntity): string[] {
  const out: string[] = [];
  for (const block of asArray(raw.additionalSpells).filter(isObject)) {
    for (const byLevel of Object.values(block).filter(isObject)) {
      for (const uses of Object.values(byLevel).filter(isObject)) {
        if (isObject(uses.limited)) out.push(...Object.keys(uses.limited));
      }
    }
  }
  return out;
}

export interface RewardUses {
  max: number;
  label: 'Charges' | 'Uses';
  /** Spell id → charges one cast costs, from "(2 charges)" after the spell. */
  costs: Map<Id, number>;
}

/**
 * How many times a gift can be used before it is gone, from its text ("has 3 charges", "once
 * used three times", "until you use it") or its spell data. Gifts that last a set time or for
 * good have no count.
 */
export function rewardUses(raw: RawEntity): RewardUses | undefined {
  const tagged = JSON.stringify(raw.entries ?? []);
  const text = tagged.replace(/\{@\w+ ([^|}]*)[^}]*\}/g, '$1');
  const costs = new Map<Id, number>();
  for (const m of tagged.matchAll(/\{@spell ([^|}]+)\|?([^|}]*)[^}]*\}\s*\((\w+) charges?\)/gi)) {
    const cost = countWord(m[3]);
    if (cost !== undefined) costs.set(nameSourceId(m[1] ?? '', m[2] || 'PHB'), cost);
  }
  const charges = countWord(/\bhas (\w+) charges\b/i.exec(text)?.[1]);
  if (charges !== undefined) return { max: charges, label: 'Charges', costs };
  const label = asArray(raw.additionalSpells).some(
    (b) => isObject(b) && b.resourceName === 'Charges',
  )
    ? 'Charges'
    : 'Uses';
  const times = countWord(/\b(?:used|use it) (\w+) times\b/i.exec(text)?.[1]);
  if (times !== undefined) return { max: times, label, costs };
  const limited = [...new Set(limitedCounts(raw))];
  const fromData = limited.length === 1 ? num(limited[0]?.replace(/e$/, '')) : undefined;
  if (fromData !== undefined) return { max: fromData, label, costs };
  if (SINGLE_USE.test(text) && !RECHARGES.test(text)) return { max: 1, label, costs };
  return undefined;
}

/** The resource id of a gift's uses. */
export const REWARD_USES = 'uses';

export function convertReward(raw: RawEntity, ctx: ConvertContext): Reward {
  const reward: Reward = {
    ...baseFields(raw, 'reward', nameSourceId(String(raw.name), String(raw.source)), ctx, {
      reprintId: nameSource('DMG'),
      reprintTag: 'reward',
    }),
    rewardType: typeof raw.type === 'string' ? raw.type : 'Other',
  };
  if (typeof raw.rarity === 'string') reward.rarity = raw.rarity;
  const facilityIds = strArray(raw.seeAlsoFacility).map(nameSource('XDMG'));
  if (facilityIds.length) reward.facilityIds = facilityIds;
  // A gift with a limited number of uses gets one counter; its spells are paid from it.
  const uses = rewardUses(raw);
  reward.effects = uses
    ? [
        {
          type: 'resource',
          resourceId: REWARD_USES,
          name: uses.label,
          max: uses.max,
          recharge: 'none',
        },
        ...effectsFromData(raw, {
          limited: { resourceId: REWARD_USES, cost: (id) => uses.costs.get(id) },
        }),
      ]
    : effectsFromData(raw);
  return reward;
}

function hirelings(raw: unknown): FacilityHirelings[] {
  return asArray(raw)
    .filter(isObject)
    .map((h) => {
      const out: FacilityHirelings = {};
      const exact = num(h.exact);
      const min = num(h.min);
      if (exact !== undefined) out.exact = exact;
      if (min !== undefined) out.min = min;
      if (typeof h.space === 'string') out.space = h.space;
      return out;
    });
}

export function convertFacility(raw: RawEntity, ctx: ConvertContext): Facility {
  const facility: Facility = {
    ...baseFields(raw, 'facility', nameSourceId(String(raw.name), String(raw.source)), ctx, {
      reprintId: nameSource('XDMG'),
      reprintTag: 'facility',
    }),
    facilityType: raw.facilityType === 'basic' ? 'basic' : 'special',
    prerequisites: prerequisites(raw),
    space: strArray(raw.space),
    hirelings: hirelings(raw.hirelings),
    orders: strArray(raw.orders),
  };
  const level = num(raw.level);
  if (level !== undefined) facility.level = level;
  return facility;
}

export function convertCharOption(raw: RawEntity, ctx: ConvertContext): CharOption {
  const option: CharOption = {
    ...baseFields(raw, 'charOption', nameSourceId(String(raw.name), String(raw.source)), ctx, {
      reprintId: nameSource('MOT'),
      reprintTag: 'charoption',
    }),
    optionTypes: strArray(raw.optionType),
    prerequisites: prerequisites(raw),
  };
  option.effects = effectsFromData(raw);
  return option;
}
