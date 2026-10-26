// What every converter shares: the entries by Foundry id, links between them as tags, and the
// names they are filed under.
//
// SRD entries are filed under the ids of their 2024 Player's Handbook twins (`name|xphb`), so the
// rules the app already knows for those (feature mappings, standard actions, references between
// entries) work on the free rules as they are, and a book imported later simply replaces them
// (plan 9.4). Where the SRD names an entry differently, `RENAMES` gives the name its twin is
// filed under; the SRD's own name is what the app shows.

import type { Doc } from './foundry.ts';
import { glossaryTag, htmlToEntries, type EnrichOptions, type Entry } from './html.ts';

/** The source code the converted records carry until the build files them under `SRD52`. */
export const TWIN = 'XPHB';

/** SRD name → the name its twin is filed under, per 5etools record type. */
export const RENAMES: Record<string, Record<string, string>> = {
  // Spells the SRD names differently keep the SRD's name: their twins' names aren't free.
  spell: {},
  // Only where the names differ in style; names that aren't free stay the SRD's.
  item: {
    'Lantern, Bullseye': 'Bullseye Lantern',
    'Lantern, Hooded': 'Hooded Lantern',
    'Clothes, Fine': 'Fine Clothes',
    "Clothes, Traveler's": "Traveler's Clothes",
    'Pot, Iron': 'Iron Pot',
    'Spikes, Iron': 'Iron Spikes',
    'Ram, Portable': 'Portable Ram',
    'Case, Crossbow Bolt': 'Crossbow Bolt Case',
    'Case, Map or Scroll': 'Map or Scroll Case',
    'Bottle, Glass': 'Glass Bottle',
    'Poison, Basic': 'Basic Poison',
    Arrows: 'Arrows (20)',
    Bolts: 'Bolts (20)',
    'Bullets, Firearm': 'Firearm Bullets (10)',
    'Bullets, Sling': 'Sling Bullets (20)',
    Needles: 'Needles (50)',
    Dice: 'Dice Set',
    Dragonchess: 'Dragonchess Set',
    'Three-dragon ante': 'Three-Dragon Ante Set',
    'Arcane Focus (Varies)': 'Arcane Focus',
    'Druidic Focus (Varies)': 'Druidic Focus',
    'Holy Symbol (Varies)': 'Holy Symbol',
    'Potion of Healing (Greater)': 'Potion of Greater Healing',
    'Potion of Healing (Superior)': 'Potion of Superior Healing',
    'Potion of Healing (Supreme)': 'Potion of Supreme Healing',
    'Stone of Good Luck (Luckstone)': 'Stone of Good Luck',
    'Spell Scroll, Cantrip': 'Spell Scroll (Cantrip)',
    ...Object.fromEntries(
      ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'].map((o, i) => [
        `Spell Scroll, ${o} Level`,
        `Spell Scroll (Level ${i + 1})`,
      ]),
    ),
    'Spell Scroll, Level 1': 'Spell Scroll (Level 1)',
    ...Object.fromEntries(
      ['Hill', 'Stone', 'Frost', 'Fire', 'Cloud', 'Storm'].flatMap((g) => [
        [`Potion of Giant Strength (${g})`, `Potion of ${g} Giant Strength`],
        [`Belt of Giant Strength (${g})`, `Belt of ${g} Giant Strength`],
        [`Belt of Giant Strength (${g.toLowerCase()})`, `Belt of ${g} Giant Strength`],
      ]),
    ),
    ...Object.fromEntries(
      ['Air', 'Earth', 'Fire', 'Water'].map((e) => [
        `${e} Ring of Elemental Command`,
        `Ring of Elemental Command (${e})`,
      ]),
    ),
    ...Object.fromEntries(
      ['Blue Sapphire', 'Emerald', 'Red Corundum', 'Yellow Diamond'].map((g) => [
        `Elemental Gem (${g})`,
        `Elemental Gem, ${g}`,
      ]),
    ),
    ...Object.fromEntries(
      ['Brass', 'Bronze', 'Iron', 'Silver'].map((m) => [
        `${m} Horn of Valhalla`,
        `Horn of Valhalla, ${m}`,
      ]),
    ),
    ...Object.fromEntries(
      ['Gray', 'Rust', 'Tan'].map((c) => [`${c} Bag of Tricks`, `Bag of Tricks, ${c}`]),
    ),
    ...Object.fromEntries(
      [
        'Absorption',
        'Agility',
        'Awareness',
        'Fortitude',
        'Greater Absorption',
        'Insight',
        'Intellect',
        'Leadership',
        'Mastery',
        'Protection',
        'Regeneration',
        'Reserve',
        'Strength',
        'Sustenance',
      ].map((k) => [`Ioun Stone of ${k}`, `Ioun Stone, ${k}`]),
    ),
    ...Object.fromEntries(
      [
        'Bronze Griffon',
        'Ebony Fly',
        'Golden Lions',
        'Ivory Goats',
        'Marble Elephant',
        'Obsidian Steed',
        'Onyx Dog',
        'Serpentine Owl',
        'Silver Raven',
      ].map((f) => [f, `Figurine of Wondrous Power, ${f}`]),
    ),
  },
  feat: {},
  race: {},
  background: {},
  rule: {
    Emanation: 'Emanation [Area of Effect]',
    Friendly: 'Friendly [Attitude]',
    Hostile: 'Hostile [Attitude]',
    Indifferent: 'Indifferent [Attitude]',
    'Nonplayer Character (NPC)': 'Nonplayer Character',
  },
};

/**
 * The book an item's twin is in: the compendium's ids start with it (`dmg…` for the 2024
 * Dungeon Master's Guide, `phb…` for the Player's Handbook).
 */
export function itemSource(doc: Doc): string {
  return String(doc._id).startsWith('dmg') ? 'XDMG' : TWIN;
}

export function twinName(type: string, name: string): string {
  return RENAMES[type]?.[name] ?? name;
}

export interface Indexed {
  doc: Doc;
  pack: string;
}

export class Context {
  readonly byId = new Map<string, Indexed>();
  /** Journal pages by id: rules glossary terms, for links to them. */
  readonly pages = new Map<string, { name: string; type: string }>();

  add(pack: string, docs: Doc[]) {
    for (const doc of docs) if (doc._id) this.byId.set(String(doc._id), { doc, pack });
  }

  /** A link as a tag the app follows, or its label when it points outside what is converted. */
  link = (uuid: string, label: string | undefined): string => {
    const parts = uuid.split('.');
    const pageAt = parts.indexOf('JournalEntryPage');
    if (pageAt >= 0) {
      const page = this.pages.get(parts[pageAt + 1]!.split('#')[0]!);
      const text = label ?? page?.name ?? '';
      if (!page) return text;
      const tag = page.type === 'condition' ? 'condition' : glossaryTag(page.name);
      const filed = twinName('rule', page.name);
      return `{@${tag} ${filed}|${TWIN}${text !== filed ? `|${text}` : ''}}`;
    }
    const id = parts.at(-1)!;
    const hit = this.byId.get(id);
    if (!hit) return label ?? '';
    const name = String(hit.doc.name);
    const text = label ?? name;
    const tag = tagFor(hit.pack, hit.doc);
    if (!tag) return text;
    const filed = twinName(tag, name);
    const source =
      tag === 'item'
        ? itemSource(hit.doc)
        : tag === 'creature' && String(hit.doc._id).startsWith('mm')
          ? 'XMM'
          : TWIN;
    return `{@${tag} ${filed}|${source}${text !== filed ? `|${text}` : ''}}`;
  };

  /** An entry or one of its activities written into another (`…Item.<id>[.Activity.<id>]`). */
  embed = (uuid: string): { name: string; html: string } | undefined => {
    const m = /Item\.([^.\s]+)(?:\.Activity\.([^.\s]+))?$/.exec(uuid);
    const doc = m ? this.byId.get(m[1]!)?.doc : undefined;
    const part = m?.[2] ? doc?.system?.activities?.[m[2]] : doc;
    const html = m?.[2] ? part?.description?.value : part?.system?.description?.value;
    return html ? { name: String(part.name ?? ''), html: String(html) } : undefined;
  };

  entries(html: string | undefined, opts: EnrichOptions = {}): Entry[] {
    return htmlToEntries(html, this.link, { embed: this.embed, ...opts });
  }
}

function tagFor(pack: string, doc: Doc): string | undefined {
  switch (pack) {
    case 'spells24':
      return 'spell';
    case 'equipment24':
      return 'item';
    case 'feats24':
      return 'feat';
    case 'origins24':
      return doc.type === 'race' ? 'race' : doc.type === 'background' ? 'background' : undefined;
    case 'classes24':
      return doc.type === 'class' ? 'class' : undefined;
    case 'actors24':
      return 'creature';
    default:
      return undefined;
  }
}
