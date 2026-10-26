// SRD classes as 5etools records: the class (its table, proficiencies, starting equipment,
// spellcasting and feature list), its features, the SRD subclass and its features, and the
// Eldritch Invocations and Metamagic options as optional features.
//
// Foundry builds a class from advancements (feature grants by level, scale values for the
// table, ability score improvements, choices); 5etools lists features by level and keeps the
// table as rows. Features the 2024 Player's Handbook gives an entry of their own (the choices
// of Divine Order, the parts of Martial Arts, "Ability Score Improvement" at each level) get one
// here too, filed under the same ids, so the app's mappings for them apply.

import { MULTICLASS_SLOTS } from '../../src/engine/rules/slots.ts';
import { itemSource, TWIN, twinName, type Context } from './context.ts';
import type { Doc } from './foundry.ts';
import { SKILL, type Entry } from './html.ts';

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const advancements = (doc: Doc): Doc[] => Object.values(doc.system?.advancement ?? {}) as Doc[];

const idOf = (uuid: string) => uuid.split('.').at(-1)!;

/** The class table columns: label, then the scale value it shows (identifier or title). */
const COLUMNS: Record<string, [string, string[]][]> = {
  barbarian: [
    ['Rages', ['rages']],
    ['Rage Damage', ['rage-damage']],
    ['Weapon Mastery', ['mastery', 'weapon-mastery']],
  ],
  bard: [
    ['Bardic Die', ['inspiration', 'bardic-die']],
    ['Cantrips', ['cantrips-known']],
    ['Prepared Spells', ['max-prepared']],
  ],
  cleric: [
    ['Channel Divinity', ['channel-divinity']],
    ['Cantrips', ['cantrips-known']],
    ['Prepared Spells', ['max-prepared']],
  ],
  druid: [
    ['Wild Shape', ['wild-shape-uses']],
    ['Cantrips', ['cantrips-known']],
    ['Prepared Spells', ['max-prepared']],
  ],
  fighter: [
    ['Second Wind', ['second-wind']],
    ['Weapon Mastery', ['mastery', 'weapon-mastery']],
  ],
  monk: [
    ['Martial Arts', ['die', 'martial-arts']],
    ['Focus Points', ['focus', 'focus-points']],
    ['Unarmored Movement', ['unarmored-movement', 'movement']],
  ],
  paladin: [
    ['Channel Divinity', ['channel-divinity']],
    ['Prepared Spells', ['max-prepared']],
  ],
  ranger: [
    ['Favored Enemy', ['favored-enemy']],
    ['Prepared Spells', ['max-prepared']],
  ],
  rogue: [['Sneak Attack', ['sneak-attack']]],
  sorcerer: [
    ['Sorcery Points', ['points', 'sorcery-points']],
    ['Cantrips', ['cantrips-known']],
    ['Prepared Spells', ['max-prepared']],
  ],
  warlock: [
    ['Invocations', ['invocations-known', 'invocations']],
    ['Cantrips', ['cantrips-known']],
    ['Prepared Spells', ['max-prepared']],
  ],
  wizard: [
    ['Cantrips', ['cantrips-known']],
    ['Prepared Spells', ['max-prepared']],
  ],
};

/** When a class can change its prepared spells (the 2024 class descriptions). */
const PREPARED_CHANGE: Record<string, 'level' | 'restLong'> = {
  bard: 'level',
  sorcerer: 'level',
  warlock: 'level',
  cleric: 'restLong',
  druid: 'restLong',
  ranger: 'restLong',
  paladin: 'restLong',
  wizard: 'restLong',
};

/** 5etools caster progressions; the 2024 half casters round up, as 5etools' `artificer`. */
const PROGRESSION: Record<string, string> = { full: 'full', half: 'artificer', pact: 'pact' };

/** Subclass short names as the 2024 Player's Handbook files them. */
const SHORT_NAME: Record<string, string> = {
  'path-berserker': 'Berserker',
  lore: 'Lore',
  'life-domain': 'Life',
  land: 'Land',
  champion: 'Champion',
  'warrior-open-hand': 'Open Hand',
  'oath-devotion': 'Devotion',
  hunter: 'Hunter',
  thief: 'Thief',
  'draconic-sorcery': 'Draconic',
  fiend: 'Fiend',
  evoker: 'Evoker',
};

/** Parts of a feature the 2024 Player's Handbook gives entries of their own. */
const PARTS = new Set([
  'Bonus Unarmed Strike',
  'Martial Arts Die',
  'Dexterous Attacks',
  'Flurry of Blows',
  'Patient Defense',
  'Step of the Wind',
  'Divine Spark',
  'Turn Undead',
  'Divine Sense',
]);

/** Features gained again at a later level, which the 2024 Player's Handbook lists again. */
const AGAIN: Record<string, [string, number][]> = {
  bard: [['Expertise', 9]],
  fighter: [
    ['Indomitable', 13],
    ['Action Surge', 17],
    ['Indomitable', 17],
  ],
  rogue: [['Expertise', 6]],
  sorcerer: [
    ['Metamagic', 10],
    ['Metamagic', 17],
  ],
  warlock: [
    ['Mystic Arcanum', 13],
    ['Mystic Arcanum', 15],
    ['Mystic Arcanum', 17],
  ],
};

/**
 * Rules the compendium leaves to Foundry's automation or to the player, as the 2024 Player's
 * Handbook data writes them: spells a feature adds or lets you pick (Magical Secrets, Wild
 * Companion's Find Familiar, Evocation Savant), the Wizard's spellbook, the Champion's second
 * Fighting Style.
 */
const CLASS_RULES: Record<
  string,
  {
    expanded?: Doc;
    prepared?: Record<string, string[]>;
    record?: Doc;
    equipment?: Doc[];
    first?: string;
  }
> = {
  bard: {
    expanded: {
      10: [{ all: 'level=1;2;3;4;5|class=Cleric;Druid;Wizard' }],
      ...Object.fromEntries(
        [6, 7, 8, 9].map((l) => [`s${l}`, [{ all: `level=${l}|class=Cleric;Druid;Wizard` }]]),
      ),
    },
  },
  druid: { prepared: { 2: ['find familiar|xphb'] } },
  // The compendium files the Greataxe after the Handaxes; the class lists it first.
  barbarian: { first: 'greataxe|xphb' },
  wizard: {
    record: { spellsKnownProgressionFixed: [6, ...Array.from({ length: 19 }, () => 2)] },
    equipment: [{ special: 'Spellbook' }],
  },
};

const pick = (levels: number) => ({
  choose: `level=${Array.from({ length: levels + 1 }, (_, i) => i).join(';')}|class=Wizard|school=V`,
});
const SUBCLASS_RULES: Record<string, Doc> = {
  Lore: {
    additionalSpells: [
      {
        prepared: {
          6: Array.from({ length: 2 }, () => ({
            choose: 'level=0;1;2;3|class=Cleric;Druid;Wizard',
          })),
        },
      },
    ],
  },
  Evoker: {
    additionalSpells: [
      {
        known: {
          3: [pick(2), pick(2)],
          ...Object.fromEntries([5, 7, 9, 11, 13, 15, 17].map((l) => [l, [pick((l + 1) / 2)]])),
        },
      },
    ],
  },
  Champion: {
    featProgression: [{ name: 'Fighting Style', category: ['FS'], progression: { 7: 1 } }],
  },
};

/** Fighting Style feats only one class can take (`FS:P`: Blessed Warrior). */
const STYLE_CATEGORY: Record<string, string> = { paladin: 'FS:P', ranger: 'FS:R' };

const ARMOR: Record<string, string> = { lgt: 'light', med: 'medium', hvy: 'heavy', shl: 'shield' };
const TOOL: Record<string, string> = { herb: 'Herbalism Kit', thief: "Thieves' Tools" };
const TOOL_KIND: Record<string, [string, string]> = {
  music: ['Musical Instrument', 'instrumentMusical'],
  art: ["Artisan's Tools", 'toolArtisan'],
  game: ['Gaming Set', 'setGaming'],
};
const FOCUS: Record<string, string> = {
  holy: 'holy symbol|xphb',
  arcane: 'arcane focus|xphb',
  druid: 'druidic focus|xphb',
};
const COUNT = ['zero', 'one', 'two', 'three', 'four', 'five'];
const CP: Record<string, number> = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 };

/** Pact Magic slots by Warlock level, and their level. */
const PACT_SLOTS = [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4];
const pactSlotLevel = (level: number) => Math.min(5, Math.ceil(level / 2));

const LEVELS = Array.from({ length: 20 }, (_, i) => i + 1);

function findScale(doc: Doc, keys: string[]): Doc | undefined {
  const scales = advancements(doc).filter((a) => a.type === 'ScaleValue');
  for (const key of keys) {
    const hit =
      scales.find((a) => slug(String(a.configuration?.identifier ?? '')) === key) ??
      scales.find((a) => slug(String(a.title ?? a.name ?? '')) === key);
    if (hit) return hit;
  }
  return undefined;
}

/** A scale value's table cell at each level, each level keeping the last value given. */
function scaleCells(a: Doc): unknown[] {
  const cfg = a.configuration ?? {};
  let current: Doc | undefined;
  return LEVELS.map((level) => {
    const at = cfg.scale?.[level];
    if (at) current = { ...current, ...at };
    if (cfg.type === 'dice') {
      return current?.faces
        ? {
            type: 'dice',
            toRoll: [{ number: current.number ?? 1, faces: current.faces }],
            rollable: true,
          }
        : 0;
    }
    if (cfg.type === 'distance') return { type: 'bonusSpeed', value: Number(current?.value ?? 0) };
    return Number(current?.value ?? 0);
  });
}

const numbers = (cells: unknown[]) => cells.map((c) => (typeof c === 'number' ? c : 0));

const ORDINAL = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

/** The spell slot rows of a full or half caster (the multiclass table, by caster level). */
function slotGroup(progression: string): Doc {
  const rows = LEVELS.map((level) => {
    const share = progression === 'full' ? level : Math.ceil(level / 2);
    return MULTICLASS_SLOTS[share - 1] ?? [];
  });
  const width = Math.max(...rows.map((r) => r.length));
  return {
    title: 'Spell Slots per Spell Level',
    colLabels: ORDINAL.slice(0, width),
    rowsSpellProgression: rows.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? 0)),
  };
}

function tableGroups(doc: Doc, identifier: string, progression: string | undefined) {
  const spec = COLUMNS[identifier] ?? [];
  const columns = spec.flatMap(([label, keys]) => {
    const a = findScale(doc, keys);
    return a ? [{ label, cells: scaleCells(a) }] : [];
  });
  if (progression === 'pact') {
    columns.push({ label: 'Spell Slots', cells: PACT_SLOTS });
    columns.push({ label: 'Slot Level', cells: LEVELS.map(pactSlotLevel) });
  }
  const groups: Doc[] = [];
  if (columns.length) {
    groups.push({
      colLabels: columns.map((c) => c.label),
      rows: LEVELS.map((_, i) => columns.map((c) => c.cells[i])),
    });
  }
  if (progression === 'full' || progression === 'artificer')
    groups.push(slotGroup(progression === 'full' ? 'full' : 'half'));
  return { groups, column: (label: string) => columns.find((c) => c.label === label)?.cells };
}

/** Level 1 proficiency traits of a class taken first (`primary`) or as a multiclass. */
function traits(doc: Doc, as: 'primary' | 'secondary'): Doc[] {
  return advancements(doc).filter((a) => {
    if (a.type !== 'Trait' || (a.level ?? 1) !== 1) return false;
    if ((a.configuration?.mode ?? 'default') !== 'default') return false;
    const r = String(a.classRestriction ?? '');
    if (r === as) return true;
    if (r !== '') return false;
    // Unrestricted traits apply to both, but a multiclass gains weapons only where marked.
    const grants: string[] = a.configuration?.grants ?? [];
    return (
      as === 'primary' || !grants.some((g) => g.startsWith('weapon:') || g.startsWith('saves:'))
    );
  });
}

function proficiencies(ctx: Context, list: Doc[]) {
  const out: Doc = {};
  const add = (key: string, value: unknown) => ((out[key] ??= []) as unknown[]).push(value);
  for (const t of list) {
    for (const g of (t.configuration?.grants ?? []) as string[]) {
      const [kind, a, b] = g.split(':');
      if (kind === 'weapon') {
        if (b) add('weapons', `{@item ${baseItemName(ctx, b)}|XPHB}`);
        else add('weapons', a === 'sim' ? 'simple' : 'martial');
      } else if (kind === 'armor' && ARMOR[a!]) add('armor', ARMOR[a!]);
      else if (kind === 'tool' && TOOL[a!]) add('tools', `{@item ${TOOL[a!]}|XPHB}`);
    }
    for (const c of (t.configuration?.choices ?? []) as Doc[]) {
      const pool: string[] = c.pool ?? [];
      const count = Number(c.count) || 1;
      if (pool[0]?.startsWith('skills:')) {
        add(
          'skills',
          pool[0] === 'skills:*'
            ? { any: count }
            : { choose: { from: pool.map((p) => SKILL[p.split(':')[1]!]!.toLowerCase()), count } },
        );
      } else if (pool[0]?.startsWith('tool:')) {
        const kinds = pool.map((p) => TOOL_KIND[p.split(':')[1]!]?.[0]).filter(Boolean);
        add('tools', toolChoiceText(kinds as string[], count));
      }
    }
  }
  return out;
}

/** `Choose three Musical Instruments`, `Choose one type of Artisan's Tools or Musical Instrument`. */
function toolChoiceText(kinds: string[], count: number): string {
  const tag = (k: string, plural: boolean) =>
    plural ? `{@item ${k}|XPHB|${k.endsWith('s') ? k : `${k}s`}}` : `{@item ${k}|XPHB}`;
  if (kinds.length === 1) return `Choose ${COUNT[count] ?? count} ${tag(kinds[0]!, count > 1)}`;
  return `Choose ${COUNT[count] ?? count} type of ${kinds.map((k) => tag(k, false)).join(' or ')}`;
}

/** An item's name from its Foundry base item identifier (`handcrossbow` → Hand Crossbow). */
export function baseItemName(ctx: Context, identifier: string, type = 'weapon'): string {
  // The base item, not a magic one made from it (Scimitar of Speed).
  const names = [...ctx.byId.values()]
    .filter(
      ({ doc, pack }) =>
        pack === 'equipment24' && doc.type === type && doc.system?.type?.baseItem === identifier,
    )
    .map(({ doc }) => String(doc.name))
    .sort((a, b) => a.length - b.length);
  return names[0] ?? identifier;
}

/** `{item: 'greataxe|xphb'}` for a linked item, `(N)` bundles counted as one. */
function linkedItem(
  ctx: Context,
  uuid: string,
  count: number | null,
  label?: string,
): Doc | undefined {
  // A link into another compendium (the 2014 items) is found by the name the text gives it.
  const hit =
    ctx.byId.get(idOf(uuid)) ??
    (label
      ? [...ctx.byId.values()].find(
          (e) => e.pack === 'equipment24' && twinName('item', String(e.doc.name)) === label,
        )
      : undefined);
  if (!hit) return undefined;
  // The Staff focus of the Druid's and Wizard's equipment is a Quarterstaff.
  if (hit.doc.name === 'Staff' && /spellcasting-focuses/.test(String(hit.doc._path))) {
    return { item: 'quarterstaff|xphb' };
  }
  const name = twinName('item', String(hit.doc.name));
  const bundle = /\((\d+)\)$/.exec(name);
  const quantity = bundle && Number(bundle[1]) === count ? 1 : (count ?? 1);
  return {
    item: `${name.toLowerCase()}|${itemSource(hit.doc).toLowerCase()}`,
    ...(quantity > 1 ? { quantity } : {}),
  };
}

export function startingEquipment(ctx: Context, doc: Doc) {
  const all = (doc.system?.startingEquipment ?? []) as Doc[];
  const html = String(doc.system?.description?.value ?? '');
  const labels = new Map(
    [...html.matchAll(/@UUID\[([^\]]+)\]\{([^}]+)\}/g)].map((m) => [m[1]!, m[2]!]),
  );
  const children = (group: string) =>
    all.filter((e) => (e.group || '') === group).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  const flat = (e: Doc): Doc[] => {
    switch (e.type) {
      case 'AND':
        return children(e._id).flatMap(flat);
      case 'OR': {
        const kids = children(e._id);
        if (kids.length && kids.every((k) => k.type === 'tool')) {
          return [{ equipmentTypes: kids.map((k) => TOOL_KIND[k.key]?.[1]).filter(Boolean) }];
        }
        return kids[0] ? flat(kids[0]) : [];
      }
      case 'linked': {
        const item = linkedItem(ctx, String(e.key), e.count, labels.get(String(e.key)));
        return item ? [item] : [];
      }
      case 'currency':
        return [{ value: (Number(e.count) || 0) * (CP[e.key] ?? 100) }];
      case 'tool':
        return TOOL_KIND[e.key] ? [{ equipmentType: TOOL_KIND[e.key]![1] }] : [];
      case 'focus':
        return FOCUS[e.key] ? [{ item: FOCUS[e.key] }] : [];
      default:
        return [];
    }
  };
  const options: Doc[][] = [];
  for (const top of children('')) {
    if (top.type === 'OR') for (const kid of children(top._id)) options.push(flat(kid));
    else options.push(flat(top));
  }
  const wealth = Number(doc.system?.wealth);
  if (wealth) options.push([{ value: wealth * 100 }]);
  const data = Object.fromEntries(options.map((o, i) => [String.fromCharCode(65 + i), o]));
  return { defaultData: [data] };
}

/** Spells a grant hands out (`ItemGrant` of spells): `aid|xphb` by level. */
function spellGrants(ctx: Context, adv: Doc[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const a of adv) {
    if (a.type !== 'ItemGrant') continue;
    for (const it of (a.configuration?.items ?? []) as Doc[]) {
      const hit = ctx.byId.get(idOf(String(it.uuid)));
      if (hit?.pack !== 'spells24') continue;
      const name = twinName('spell', String(hit.doc.name)).toLowerCase();
      (out[String(a.level)] ??= []).push(`${name}|xphb`);
    }
  }
  return out;
}

/** Circle of the Land's spells: one table per land, `{name, prepared}` per table. */
function landSpells(ctx: Context, html: string): Doc[] {
  const out: Doc[] = [];
  for (const m of html.matchAll(/<table><caption>([^<]+)<\/caption>(.*?)<\/table>/gs)) {
    const prepared: Record<string, string[]> = {};
    for (const row of m[2]!.matchAll(/<tr><td>(\d+)<\/td><td>(.*?)<\/td><\/tr>/gs)) {
      prepared[row[1]!] = [...row[2]!.matchAll(/@UUID\[([^\]]+)\]/g)].flatMap((u) => {
        const hit = ctx.byId.get(idOf(u[1]!));
        return hit ? [`${twinName('spell', String(hit.doc.name)).toLowerCase()}|xphb`] : [];
      });
    }
    if (Object.keys(prepared).length) out.push({ name: m[1]!.trim(), prepared });
  }
  return out;
}

/** Granted features by level, in the order the class grants them. */
function granted(ctx: Context, doc: Doc): { level: number; doc: Doc }[] {
  return advancements(doc)
    .filter((a) => a.type === 'ItemGrant')
    .sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
    .flatMap((a) =>
      ((a.configuration?.items ?? []) as Doc[]).flatMap((it) => {
        const hit = ctx.byId.get(idOf(String(it.uuid)));
        return hit?.pack === 'classes24' && hit.doc.type === 'feat'
          ? [{ level: Number(a.level), doc: hit.doc }]
          : [];
      }),
    );
}

/** Entries without Foundry's "Prerequisite: …" box, shown by the app from the data. */
function withoutPrerequisite(entries: Entry[]): Entry[] {
  return entries.filter(
    (e) =>
      !(
        typeof e === 'object' &&
        e.type === 'inset' &&
        /^Prerequisite/i.test(String((e.entries as Entry[] | undefined)?.[0] ?? ''))
      ),
  );
}

export interface ClassRecords {
  class: Doc[];
  classFeature: Doc[];
  subclass: Doc[];
  subclassFeature: Doc[];
  optionalfeature: Doc[];
}

export function convertClasses(ctx: Context, docs: Doc[]): ClassRecords {
  const out: ClassRecords = {
    class: [],
    classFeature: [],
    subclass: [],
    subclassFeature: [],
    optionalfeature: [],
  };
  const options = convertOptions(ctx, docs);
  out.optionalfeature.push(...options.records);

  for (const doc of docs.filter((d) => d.type === 'class')) {
    const sys = doc.system;
    const identifier = String(sys.identifier);
    const className = String(doc.name);
    const adv = advancements(doc);
    const progression = PROGRESSION[sys.spellcasting?.progression];
    const { groups, column } = tableGroups(doc, identifier, progression);
    const subDoc = docs.find(
      (d) => d.type === 'subclass' && d.system?.classIdentifier === identifier,
    );
    const subLevels = subDoc ? granted(ctx, subDoc).map((g) => g.level) : [];
    const subclassAt = adv.find((a) => a.type === 'Subclass')?.level ?? 3;

    const features: { name: string; level: number; entries: Entry[]; gain?: boolean }[] = [];
    const feature = (name: string, level: number, entries: Entry[], gain = false) => {
      features.push({ name, level, entries, ...(gain ? { gain } : {}) });
    };
    const uid = (name: string, level: number) => `${name}|${className}|${TWIN}|${level}`;

    // Choices of features, on the class or the feature (Divine Order: Protector or Thaumaturge).
    const choices = [...adv, ...granted(ctx, doc).flatMap(({ doc: f }) => advancements(f))].filter(
      (a) => a.type === 'ItemChoice' && a.configuration?.type === 'feat',
    );

    for (const { level, doc: f } of granted(ctx, doc)) {
      const name = String(f.name).replace(/ \(\d\)$/, '');
      const parent = { name, level, entries: [] as Entry[] };
      features.push(parent);
      // Named parts with entries of their own (Flurry of Blows in Monk's Focus).
      const entries = ctx.entries(f.system?.description?.value).map((e) => {
        // Only where the part is introduced, not where a later feature improves it.
        if (typeof e !== 'object' || !PARTS.has(String(e.name))) return e;
        if (features.some((x) => x.name === e.name)) return e;
        feature(String(e.name), level, e.entries as Entry[]);
        return { type: 'refClassFeature', classFeature: uid(String(e.name), level) };
      });
      const prefix = `${name}: `;
      for (const a of choices) {
        const pool = ((a.configuration.pool ?? []) as Doc[])
          .map((p) => ctx.byId.get(idOf(String(p.uuid)))?.doc)
          .filter((p): p is Doc => !!p && String(p.name).startsWith(prefix));
        if (!pool.length) continue;
        const at = Number(Object.keys(a.configuration.choices ?? {})[0] ?? level);
        const count =
          Number((Object.values(a.configuration.choices ?? {})[0] as Doc | undefined)?.count) || 1;
        entries.push({
          type: 'options',
          count,
          entries: pool.map((p) => {
            const option = String(p.name).slice(prefix.length);
            feature(option, at, ctx.entries(p.system?.description?.value));
            return { type: 'refClassFeature', classFeature: uid(option, at) };
          }),
        });
      }
      parent.entries = entries;
    }

    // The levels the class's own records leave to the class description.
    feature(
      `${className} Subclass`,
      subclassAt,
      ctx.entries(adv.find((a) => a.type === 'Subclass')?.hint),
      true,
    );
    for (const level of [...new Set(subLevels)].filter((l) => l > subclassAt)) {
      feature(
        'Subclass Feature',
        level,
        [`You gain a feature from your ${className} subclass.`],
        true,
      );
    }
    for (const a of adv.filter((a) => a.type === 'AbilityScoreImprovement')) {
      if (a.level === 19) {
        feature('Epic Boon', 19, [
          'You gain an Epic Boon feat or another feat of your choice for which you qualify.',
        ]);
      } else {
        feature('Ability Score Improvement', Number(a.level), [
          'You gain the {@feat Ability Score Improvement|XPHB} feat or another feat of your choice for which you qualify.',
        ]);
      }
    }
    for (const [name, level] of AGAIN[identifier] ?? []) {
      const first = features.find((f) => f.name === name);
      if (first) {
        feature(name, level, [
          `You gain this feature again; see {@classFeature ${name}|${className}|${TWIN}|${first.level}}.`,
        ]);
      }
    }
    if (options.byClass[identifier]) {
      const { featureName, level, names } = options.byClass[identifier];
      feature(featureName, level, [
        { type: 'list', items: names.map((n) => `{@optfeature ${n}|${TWIN}}`) },
      ]);
    }

    features.sort((a, b) => a.level - b.level);
    for (const f of features) {
      out.classFeature.push({
        name: f.name,
        source: TWIN,
        className,
        classSource: TWIN,
        level: f.level,
        entries: f.entries,
      });
    }

    const prepared = column('Prepared Spells');
    const cantrips = column('Cantrips');
    const invocations = column('Invocations');
    const classSpells = spellGrants(ctx, [
      ...adv,
      ...granted(ctx, doc).flatMap(({ doc: f }) => advancements(f)),
    ]);
    const styleAt = features.find((f) => f.name === 'Fighting Style')?.level;
    const metamagic = docs.find((d) => d.type === 'feat' && d.system?.identifier === 'metamagic')
      ?.system?.advancement;
    const record: Doc = {
      name: className,
      source: TWIN,
      edition: 'one',
      primaryAbility: sys.primaryAbility?.all
        ? [Object.fromEntries((sys.primaryAbility.value as string[]).map((a) => [a, true]))]
        : (sys.primaryAbility?.value as string[]).map((a) => ({ [a]: true })),
      hd: { number: 1, faces: Number(String(sys.hd?.denomination).slice(1)) || 8 },
      proficiency: traits(doc, 'primary').flatMap((t) =>
        ((t.configuration?.grants ?? []) as string[])
          .filter((g) => g.startsWith('saves:'))
          .map((g) => g.slice(6)),
      ),
      startingProficiencies: proficiencies(ctx, traits(doc, 'primary')),
      multiclassing: { proficienciesGained: proficiencies(ctx, traits(doc, 'secondary')) },
      startingEquipment: startingEquipment(ctx, doc),
      classTableGroups: groups,
      classFeatures: features.map((f) =>
        f.gain
          ? { classFeature: uid(f.name, f.level), gainSubclassFeature: true }
          : uid(f.name, f.level),
      ),
      subclassTitle: `${className} Subclass`,
      featProgression: [
        ...(styleAt
          ? [
              {
                name: 'Fighting Style',
                category: [
                  'FS',
                  ...(STYLE_CATEGORY[identifier] ? [STYLE_CATEGORY[identifier]] : []),
                ],
                progression: { [styleAt]: 1 },
              },
            ]
          : []),
        { name: 'Epic Boon', category: ['EB'], progression: { 19: 1 } },
      ],
    };
    if (progression) {
      record.spellcastingAbility = sys.spellcasting.ability;
      record.casterProgression = progression;
      if (prepared) record.preparedSpellsProgression = numbers(prepared);
      if (cantrips) record.cantripProgression = numbers(cantrips);
      if (PREPARED_CHANGE[identifier]) record.preparedSpellsChange = PREPARED_CHANGE[identifier];
    }
    if (identifier === 'warlock') {
      record.spellsKnownProgressionFixedByLevel = {
        11: { 6: 1 },
        13: { 7: 1 },
        15: { 8: 1 },
        17: { 9: 1 },
      };
    }
    if (invocations) {
      record.optionalfeatureProgression = [
        { name: 'Eldritch Invocations', featureType: ['EI'], progression: numbers(invocations) },
      ];
    }
    if (identifier === 'sorcerer' && metamagic) {
      record.optionalfeatureProgression = [
        { name: 'Metamagic', featureType: ['MM'], progression: metamagicProgression(metamagic) },
      ];
    }
    const rules = CLASS_RULES[identifier] ?? {};
    const spells = { ...classSpells, ...rules.prepared };
    if (Object.keys(spells).length || rules.expanded) {
      record.additionalSpells = [
        {
          ...(rules.expanded ? { expanded: rules.expanded } : {}),
          ...(Object.keys(spells).length ? { prepared: spells } : {}),
        },
      ];
    }
    Object.assign(record, rules.record);
    const optionA = record.startingEquipment.defaultData[0].A as Doc[];
    if (rules.equipment) optionA.splice(-1, 0, ...rules.equipment);
    const first = optionA.findIndex((e) => e.item === rules.first);
    if (first > 0) optionA.unshift(...optionA.splice(first, 1));
    out.class.push(record);

    if (subDoc) convertSubclass(ctx, subDoc, className, subclassAt, out);
  }
  return out;
}

/** Metamagic options known by level: the running total of the choices. */
function metamagicProgression(advancement: Doc): Record<string, number> {
  const choice = (Object.values(advancement) as Doc[]).find((a) => a.type === 'ItemChoice');
  const out: Record<string, number> = {};
  let total = 0;
  for (const [level, c] of Object.entries(
    (choice?.configuration?.choices ?? {}) as Record<string, Doc>,
  )) {
    if (!c.count) continue;
    total += Number(c.count);
    out[level] = total;
  }
  return out;
}

function convertSubclass(ctx: Context, doc: Doc, className: string, at: number, out: ClassRecords) {
  const shortName = SHORT_NAME[String(doc.system?.identifier)] ?? String(doc.name);
  const name = String(doc.name);
  const uid = (n: string, level: number) =>
    `${n}|${className}|${TWIN}|${shortName}|${TWIN}|${level}`;
  const record = (n: string, level: number, entries: Entry[]) => ({
    name: n,
    source: TWIN,
    className,
    classSource: TWIN,
    subclassShortName: shortName,
    subclassSource: TWIN,
    level,
    entries,
  });
  const features = granted(ctx, doc);
  const first = features.filter((f) => f.level === at);
  const list: string[] = [uid(name, at)];
  out.subclassFeature.push(
    record(name, at, [
      ...ctx.entries(doc.system?.description?.value),
      ...first.map((f) => ({
        type: 'refSubclassFeature',
        subclassFeature: uid(String(f.doc.name), at),
      })),
    ]),
  );
  for (const f of features) {
    out.subclassFeature.push(
      record(String(f.doc.name), f.level, ctx.entries(f.doc.system?.description?.value)),
    );
    if (f.level !== at) list.push(uid(String(f.doc.name), f.level));
  }

  const prepared = spellGrants(ctx, [
    ...advancements(doc),
    ...features.flatMap((f) => advancements(f.doc)),
  ]);
  const lands = features.flatMap((f) =>
    /Land Spells$/.test(String(f.doc.name))
      ? landSpells(ctx, String(f.doc.system?.description?.value ?? ''))
      : [],
  );
  out.subclass.push({
    name,
    shortName,
    source: TWIN,
    className,
    classSource: TWIN,
    edition: 'one',
    subclassFeatures: list,
    ...(lands.length
      ? { additionalSpells: lands }
      : Object.keys(prepared).length
        ? { additionalSpells: [{ prepared }] }
        : {}),
    ...SUBCLASS_RULES[shortName],
  });
}

/** Eldritch Invocations and Metamagic options, and the feature that lists them per class. */
function convertOptions(ctx: Context, docs: Doc[]) {
  const KINDS: Record<string, { type: string; cls: string; feature: string; level: number }> = {
    eldritchInvocation: {
      type: 'EI',
      cls: 'warlock',
      feature: 'Eldritch Invocation Options',
      level: 1,
    },
    metamagic: { type: 'MM', cls: 'sorcerer', feature: 'Metamagic Options', level: 2 },
  };
  const records: Doc[] = [];
  const byClass: Record<string, { featureName: string; level: number; names: string[] }> = {};
  for (const d of docs) {
    const kind = KINDS[d.system?.type?.subtype];
    if (d.type !== 'feat' || !kind) continue;
    const html = String(d.system?.description?.value ?? '');
    const prereq = prerequisite(ctx, d, html);
    const cost = /Cost: (\d+) Sorcery Point/.exec(html);
    records.push({
      name: String(d.name),
      source: TWIN,
      featureType: [kind.type],
      ...(prereq ? { prerequisite: [prereq] } : {}),
      ...(cost
        ? {
            consumes: {
              name: 'Sorcery Point',
              ...(Number(cost[1]) > 1 ? { amount: Number(cost[1]) } : {}),
            },
          }
        : {}),
      entries: withoutPrerequisite(ctx.entries(html)),
    });
    const list = (byClass[kind.cls] ??= {
      featureName: kind.feature,
      level: kind.level,
      names: [],
    });
    list.names.push(String(d.name));
  }
  for (const list of Object.values(byClass)) list.names.sort();
  return { records, byClass };
}

/** An invocation's prerequisite: a Warlock level, other invocations, a damaging cantrip. */
function prerequisite(ctx: Context, d: Doc, html: string): Doc | undefined {
  const level = Number(d.system?.prerequisites?.level) || 0;
  const box = /<blockquote><p>Prerequisite:(.*?)<\/p><\/blockquote>/s.exec(html)?.[1] ?? '';
  const invocations = [...box.matchAll(/@UUID\[([^\]]+)\]/g)].flatMap((m) => {
    const hit = ctx.byId.get(idOf(m[1]!));
    return hit ? [`${String(hit.doc.name).toLowerCase()}|xphb`] : [];
  });
  const cantrip = /Warlock Cantrip That Deals Damage(?: via an Attack)?/.exec(
    String(d.system?.requirements ?? ''),
  );
  const out: Doc = {};
  if (level) out.level = { level, class: { name: 'Warlock', source: TWIN, visibleStats: true } };
  if (invocations.length) out.optionalfeature = invocations;
  if (cantrip) {
    out.spell = [
      { choose: 'level=0|class=Warlock', entry: `a ${cantrip[0]}`, entrySummary: cantrip[0] },
    ];
  }
  return Object.keys(out).length ? out : undefined;
}
