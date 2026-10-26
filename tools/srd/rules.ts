// SRD rules as 5etools rule records: the rules glossary (conditions, actions, senses and the
// other terms, as variant rules), skills, languages, weapon properties and mastery properties.
// They are what tags in other entries link to, and what the sheet explains a term with.

import { glossaryTag } from './html.ts';
import { TWIN, twinName, type Context } from './context.ts';
import type { Doc } from './foundry.ts';

const ABILITY: Record<string, string> = {
  Strength: 'str',
  Dexterity: 'dex',
  Constitution: 'con',
  Intelligence: 'int',
  Wisdom: 'wis',
  Charisma: 'cha',
};

/** Weapon property names → the codes items carry (`F` for Finesse). */
const PROPERTY_CODE: Record<string, string> = {
  Ammunition: 'A',
  Finesse: 'F',
  Heavy: 'H',
  Light: 'L',
  Loading: 'LD',
  Reach: 'R',
  Thrown: 'T',
  'Two-Handed': '2H',
  Versatile: 'V',
};

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/’/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

/** The rows of the table captioned `caption` in some HTML, as cell texts. */
function tableRows(html: string, caption: string): string[][] {
  for (const m of html.matchAll(/<table[^>]*>(.*?)<\/table>/gs)) {
    const cap = /<caption>(.*?)<\/caption>/s.exec(m[1]!)?.[1];
    if (!cap || text(cap) !== caption) continue;
    const body = /<tbody>(.*?)<\/tbody>/s.exec(m[1]!)?.[1] ?? '';
    return [...body.matchAll(/<tr>(.*?)<\/tr>/gs)].map((r) =>
      [...r[1]!.matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/gs)].map((c) => text(c[1]!)),
    );
  }
  return [];
}

/** `<h3>Name</h3>…` sections of a page: name → its HTML. */
function sections(html: string): [string, string][] {
  return [...html.matchAll(/<h3[^>]*>(.*?)<\/h3>(.*?)(?=<h3|$)/gs)].map((m) => [
    text(m[1]!),
    m[2]!,
  ]);
}

export interface RuleRecords {
  condition: Doc[];
  status: Doc[];
  action: Doc[];
  sense: Doc[];
  variantrule: Doc[];
  skill: Doc[];
  language: Doc[];
  itemProperty: Doc[];
  itemMastery: Doc[];
}

/**
 * `glossary`: the rules glossary pages. `pages`: every journal page by id, for the pages the
 * mastery properties embed. `creation`, `tests`, `equipment`: the chapter pages with the
 * language tables, the skills table and the weapon properties.
 */
export function convertRules(
  ctx: Context,
  glossary: Doc[],
  pages: Map<string, Doc>,
  html: { creation: string; tests: string; properties: string; mastery: string },
): RuleRecords {
  const out: RuleRecords = {
    condition: [],
    status: [],
    action: [],
    sense: [],
    variantrule: [],
    skill: [],
    language: [],
    itemProperty: [],
    itemMastery: [],
  };

  for (const page of glossary) {
    const type = page.system?.type;
    if (type !== 'rule' && type !== 'condition') continue;
    const name = String(page.name);
    const entries = ctx.entries(page.text?.content);
    if (!entries.length) continue;
    const tag = type === 'condition' ? 'condition' : glossaryTag(name);
    const record: Doc = { name: twinName('rule', name), source: TWIN, entries };
    if (record.name !== name) record.srdName = name;
    if (tag === 'action') record.time = [{ number: 1, unit: 'action' }];
    if (tag === 'variantrule') record.ruleType = 'C';
    out[tag].push(record);
  }

  for (const [name, ability, uses] of tableRows(html.tests, 'Skills')) {
    if (ABILITY[ability!])
      out.skill.push({ name, source: TWIN, ability: ABILITY[ability!], entries: [uses] });
  }

  for (const [type, caption] of [
    ['standard', 'Standard Languages'],
    ['rare', 'Rare Languages'],
  ] as const) {
    for (const row of tableRows(html.creation, caption)) {
      // Standard rows start with the roll (`3-4`); a `*` marks a footnote.
      const [name, origin] = (type === 'standard' ? row.slice(1) : row).map((c) =>
        c.replace(/\s*\*$/, ''),
      );
      if (name) out.language.push({ name, source: TWIN, type, ...(origin ? { origin } : {}) });
    }
  }

  for (const [name, body] of sections(html.properties)) {
    const abbreviation = PROPERTY_CODE[name];
    if (abbreviation) {
      out.itemProperty.push({
        abbreviation,
        source: TWIN,
        entries: [{ type: 'entries', name, entries: ctx.entries(body) }],
      });
    }
  }

  for (const [name, body] of sections(html.mastery)) {
    const id = /@Embed\[\.?([^\s\]]+)/.exec(body)?.[1];
    const page = id ? pages.get(id) : undefined;
    const entries = ctx.entries(page?.text?.content ?? body);
    if (entries.length) out.itemMastery.push({ name, source: TWIN, entries });
  }
  return out;
}
