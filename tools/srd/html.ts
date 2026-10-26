// Foundry's rich text (HTML with its own link and roll markup) as 5etools entries: paragraphs,
// named blocks ("Bold Name. Text…"), lists, tables and insets, with inline tags the app's rich
// text reads ({@b}, {@i}, {@spell …}, {@damage …}). An embedded activity (Divine Spark inside
// Channel Divinity) becomes a named block of its text; Foundry-only parts (secrets, other
// embeds, advice for Foundry users) are left out.

import { JSDOM } from 'jsdom';

export type Entry = string | { [key: string]: unknown };

/** A link to another entry (`@UUID[…]{label}`) as inline text: a tag, or just its label. */
export type LinkResolver = (uuid: string, label: string | undefined) => string;

const ABILITY: Record<string, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
};

export const SKILL: Record<string, string> = {
  acr: 'Acrobatics',
  ani: 'Animal Handling',
  arc: 'Arcana',
  ath: 'Athletics',
  dec: 'Deception',
  his: 'History',
  ins: 'Insight',
  itm: 'Intimidation',
  inv: 'Investigation',
  med: 'Medicine',
  nat: 'Nature',
  prc: 'Perception',
  prf: 'Performance',
  per: 'Persuasion',
  rel: 'Religion',
  slt: 'Sleight of Hand',
  ste: 'Stealth',
  sur: 'Survival',
};

/** `ability=str skill=ath dc=20 format=long` or `str 15` → its parts. */
function rollArgs(args: string) {
  const out: { ability?: string; skill?: string; dc?: string; long?: boolean } = {};
  for (const part of args.trim().split(/\s+/)) {
    const [k, v] = part.includes('=') ? part.split('=') : [undefined, part];
    if (!v) continue;
    if (k === 'format') out.long = v === 'long';
    else if (k === 'ability' || (!k && ABILITY[v])) out.ability = v;
    else if (k === 'skill' || (!k && SKILL[v])) out.skill = v;
    else if (k === 'dc' || (!k && /^\d+$/.test(v))) out.dc = v;
  }
  return out;
}

/**
 * A check or save as Foundry shows it: `Wisdom (Perception)` or `Dexterity`, the text going on
 * with "check" or "saving throw"; in the long format with that word, `DC 15` when fixed.
 */
function rollText(kind: 'check' | 'save', args: string): string {
  const { ability, skill, dc, long } = rollArgs(args);
  const ab = ability ? ABILITY[ability] : undefined;
  const sk = skill ? SKILL[skill] : undefined;
  const what = sk ? `${ab ? `${ab} ` : ''}({@skill ${sk}|XPHB})` : (ab ?? '');
  const full = long ? `${what} ${kind === 'save' ? 'saving throw' : 'check'}` : what;
  return dc && /^\d+$/.test(dc) ? `DC ${dc} ${full}` : full;
}

const CONDITIONS = new Set([
  'Blinded',
  'Charmed',
  'Deafened',
  'Exhaustion',
  'Frightened',
  'Grappled',
  'Incapacitated',
  'Invisible',
  'Paralyzed',
  'Petrified',
  'Poisoned',
  'Prone',
  'Restrained',
  'Stunned',
  'Unconscious',
]);

/** The standard actions and senses are their own kinds of rule, Bloodied is a status; other
 * terms are glossary rules. */
const ACTIONS = new Set([
  'Attack',
  'Dash',
  'Disengage',
  'Dodge',
  'Help',
  'Hide',
  'Influence',
  'Magic',
  'Ready',
  'Search',
  'Study',
  'Utilize',
]);
const SENSES = new Set(['Blindsight', 'Darkvision', 'Tremorsense', 'Truesight']);

export function glossaryTag(name: string): 'action' | 'sense' | 'status' | 'variantrule' {
  if (name === 'Bloodied') return 'status';
  return ACTIONS.has(name) ? 'action' : SENSES.has(name) ? 'sense' : 'variantrule';
}

const titleCase = (s: string) =>
  s.replace(
    /(^|[\s-])(\w)/g,
    (_, a: string, b: string) => `${a === '-' ? ' ' : a}${b.toUpperCase()}`,
  );

/** What the entry being converted knows, for rolls and lookups that read it. */
export interface EnrichOptions {
  /** The damage of its first damage roll, for `[[/damage]]` with no formula. */
  damage?: string;
  /** Its damage type, `Force`. */
  damageType?: string;
  /** `Each creature`, for `@labels.description.affects`. */
  affects?: string;
  /** `20-foot-radius Sphere`, for `@labels.description.template`. */
  template?: string;
  /** An embedded activity's name and text, by its id. */
  embed?: (uuid: string) => { name: string; html: string } | undefined;
  /** A creature's own numbers, for the rolls and lookups of its stat block. */
  actor?: ActorText;
}

/** What a stat block's markup reads from its creature, as text with tags. */
export interface ActorText {
  /** `[[/attack]]`: `{@atkr m} {@hit 5}, reach 5 ft.` */
  attack: (args: string) => string;
  /** `[[/damage average]]`: `{@h}7 ({@damage 1d8 + 3}) Slashing damage`. */
  damage: (args: string) => string | undefined;
  /** `[[/check]]` that names no skill: the check its activity asks for. */
  check: (args: string) => string | undefined;
  /** `[[/item .id]]`: the name of another of its entries. */
  item: (ref: string) => string;
  /** `[[lookup @name]]`, `[[lookup @skills.ath.passive]]`. */
  lookup: (path: string, args: string) => string | undefined;
}

/** A lookup of the actor's numbers, as words. */
function lookupText(path: string, opts: EnrichOptions): string {
  const [, a, b, c] = path.split('.');
  if (path.startsWith('@abilities.')) return `your ${ABILITY[a ?? ''] ?? a} modifier`;
  if (path.startsWith('@classes.')) return `your ${titleCase(a ?? '')} level`;
  if (path.startsWith('@scale.'))
    return `the ${titleCase([b, c].filter(Boolean).join(' '))} shown in the ${titleCase(a ?? '')} table`;
  if (path === '@item.level') return 'the spell’s level';
  if (path.startsWith('@labels.description.affects')) return opts.affects ?? 'Each creature';
  if (path.startsWith('@labels.description.template')) return opts.template ?? 'area';
  return '';
}

/** A dice formula fit for a tag, or undefined when it reads the actor (`@item.level`). */
function formula(text: string): string | undefined {
  const f = text
    .replace(/\btype=\S+/g, '')
    .replace(
      /\b(acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder|healing|temphp)\b/gi,
      '',
    )
    .trim();
  return /^[\dd+\-× ]+$/i.test(f) && /\d/.test(f) ? f.replace(/\s+/g, ' ') : undefined;
}

/** Foundry's markup outside HTML: links, embeds and rolls, as text with tags. */
export function enrich(html: string, resolve: LinkResolver, opts: EnrichOptions = {}): string {
  return (
    html
      // An activity written into the text, as a named paragraph (`nameStyle=inline`).
      .replace(
        /<p>@Embed\[(\S+)[^\]]*\](?:\{([^}]*)\})?<\/p>/g,
        (_, uuid: string, label?: string) => {
          const found = opts.embed?.(uuid);
          if (!found) return '';
          const name = (label ?? found.name).replace(/"/g, '&quot;');
          return `<div data-embed="${name}">${found.html}</div>`;
        },
      )
      // Paragraphs that only work out a number for Foundry (`[[2 + @item.level]]{Darts}`).
      .replace(/<p[^>]*>(?:(?!<\/p>).)*?\[\[(?!\/|lookup)(?:(?!<\/p>).)*<\/p>/gs, '')
      .replace(
        /\[\[lookup ([^\]\s]+)[^\]]*\]\](?:\{([^}]*)\})?/g,
        (all: string, path: string, label?: string) =>
          opts.actor?.lookup(path, all) ?? label ?? lookupText(path, opts),
      )
      // Embedded pages and secrets: Foundry views of other entries.
      .replace(/@Embed\[[^\]]*\](\{[^}]*\})?/g, '')
      .replace(/@UUID\[([^\]]+)\](?:\{([^}]*)\})?/g, (_, uuid: string, label?: string) =>
        resolve(uuid, label),
      )
      .replace(
        /&(?:amp;)?Reference\[([^\]]+)\](?:\{([^}]*)\})?/g,
        (_, ref: string, label?: string) => {
          const name = ref.split(/\s+/)[0]!.replace(/^\w/, (c) => c.toUpperCase());
          const tag = CONDITIONS.has(name) ? 'condition' : glossaryTag(name);
          return `{@${tag} ${name}|XPHB${label && label !== name ? `|${label}` : ''}}`;
        },
      )
      .replace(
        /\[\[\/(\w+)\s*([^\]]*)\]\](?:\{([^}]*)\})?/g,
        (_, cmd: string, rawArgs: string, label?: string) => {
          const args = rawArgs.replace(/<[^>]*>/g, '');
          if (opts.actor) {
            if (cmd === 'attack') return opts.actor.attack(args);
            if (cmd === 'item') return label ?? opts.actor.item(args.trim());
            if (cmd === 'check' && !label) {
              const text = opts.actor.check(args);
              if (text !== undefined) return text;
            }
            if (cmd === 'damage' && !label) {
              const text = opts.actor.damage(args);
              if (text !== undefined) return text;
            }
          }
          switch (cmd) {
            case 'damage': {
              if (label) return label;
              const f = formula(args) ?? (args.trim() ? undefined : opts.damage);
              const type =
                /type=(\w+)|\b(acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder)\b/i.exec(
                  args,
                );
              const t = type?.[1] ?? type?.[2];
              const shown = t
                ? titleCase(t.toLowerCase())
                : args.trim()
                  ? undefined
                  : opts.damageType;
              return f ? `{@damage ${f}}${shown ? ` ${shown}` : ''}` : '';
            }
            case 'healing': {
              if (label) return label;
              const f = formula(args);
              if (!f) return '';
              return /\btemp/.test(args)
                ? `{@dice ${f}} Temporary Hit Points`
                : `{@dice ${f}} Hit Points`;
            }
            case 'r':
            case 'roll': {
              const f = formula(args);
              return f ? `{@dice ${f}}` : (label ?? args);
            }
            case 'check':
            case 'skill':
            case 'tool':
              return label ?? rollText('check', args);
            case 'save':
              return label ?? rollText('save', args);
            case 'award':
              return args.replace(
                /(\d+)\s*(gp|sp|cp|ep|pp)/gi,
                (_m, n: string, c: string) => `${n} ${c.toUpperCase()}`,
              );
            case 'item':
              return label ?? args;
            default:
              return label ?? '';
          }
        },
      )
  );
}

const BLOCK = new Set([
  'P',
  'UL',
  'OL',
  'TABLE',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'BLOCKQUOTE',
  'ASIDE',
  'DETAILS',
  'SECTION',
  'DIV',
  'ARTICLE',
  'FIGURE',
]);

function isDropped(el: Element): boolean {
  const cls = el.getAttribute('class') ?? '';
  return (
    /\bsecret\b|\bfvtt\b|\badvice\b|hide-in-embed/.test(cls) ||
    el.tagName === 'FIGURE' ||
    el.tagName === 'IMG'
  );
}

/** Inline content as one tagged string. */
function inline(node: Node): string {
  let out = '';
  node.childNodes.forEach((child) => {
    if (child.nodeType === 3) out += child.textContent ?? '';
    else if (child.nodeType === 1) {
      const el = child as Element;
      if (isDropped(el)) return;
      const text = inline(el);
      switch (el.tagName) {
        case 'STRONG':
        case 'B':
          out += text.trim() ? `{@b ${text.trim()}}` : text;
          break;
        case 'EM':
        case 'I':
          out += text.trim() ? `{@i ${text.trim()}}` : text;
          break;
        case 'BR':
          out += ' ';
          break;
        default:
          out += text;
      }
    }
  });
  return out.replace(/\s+/g, ' ');
}

/** `{@b {@i Name.}} rest` or `{@b Name.} rest` → a named block, as 5etools writes features. */
function named(text: string): Entry {
  const m = /^\{@[bi] (?:\{@[bi] )?([^{}]+?)\.\}?\}\s*(.*)$/.exec(text);
  return m && m[1]!.length < 60
    ? { type: 'entries', name: m[1]!.trim(), entries: m[2] ? [m[2]] : [] }
    : text;
}

function table(el: Element): Entry {
  const rows = [...el.querySelectorAll('tr')];
  const head = el.querySelector('thead tr') ?? (rows[0]?.querySelector('th') ? rows[0] : null);
  const colLabels = head ? [...head.querySelectorAll('th,td')].map((c) => inline(c).trim()) : [];
  const body = rows
    .filter((r) => r !== head)
    .map((r) => [...r.querySelectorAll('th,td')].map((c) => inline(c).trim()));
  const caption = el.querySelector('caption');
  return {
    type: 'table',
    ...(caption ? { caption: inline(caption).trim() } : {}),
    colLabels,
    rows: body,
  };
}

function blocks(parent: Element): Entry[] {
  const out: Entry[] = [];
  let section: { type: 'entries'; name: string; entries: Entry[] } | null = null;
  const push = (e: Entry) => (section ? section.entries.push(e) : out.push(e));
  let loose = '';
  const flush = () => {
    if (loose.trim()) push(named(loose.trim()));
    loose = '';
  };
  parent.childNodes.forEach((child) => {
    if (child.nodeType === 3) {
      loose += child.textContent ?? '';
      return;
    }
    if (child.nodeType !== 1) return;
    const el = child as Element;
    if (isDropped(el)) return;
    if (!BLOCK.has(el.tagName)) {
      loose += inline({ childNodes: [el] } as unknown as Node);
      return;
    }
    flush();
    switch (el.tagName) {
      case 'P': {
        const text = inline(el).trim();
        // A tagline or cost line (`Channel Rage into Violent Fury`, `Cost: 1 Sorcery Point`).
        if (text && /\bitem-entry-tag\b/.test(el.getAttribute('class') ?? '')) push(`{@i ${text}}`);
        else if (text) push(named(text));
        break;
      }
      case 'UL':
      case 'OL': {
        const items = [...el.children]
          .filter((li) => li.tagName === 'LI')
          .map((li) => {
            const inner = blocks(li);
            return inner.length === 1 ? inner[0]! : { type: 'entries', entries: inner };
          });
        push({ type: 'list', items });
        break;
      }
      case 'TABLE':
        push(table(el));
        break;
      case 'H1':
      case 'H2':
      case 'H3':
      case 'H4':
      case 'H5':
      case 'H6': {
        if (section) out.push(section);
        section = { type: 'entries', name: inline(el).trim(), entries: [] };
        break;
      }
      case 'BLOCKQUOTE':
      case 'ASIDE':
      case 'DETAILS': {
        const summary = el.querySelector(':scope > summary');
        const name = summary ? inline(summary).trim() : undefined;
        summary?.remove();
        push({ type: 'inset', ...(name ? { name } : {}), entries: blocks(el) });
        break;
      }
      default: {
        const embedded = el.getAttribute('data-embed');
        if (embedded) push({ type: 'entries', name: embedded, entries: blocks(el) });
        else blocks(el).forEach(push);
      }
    }
  });
  flush();
  if (section) out.push(section);
  return out;
}

/** Foundry rich text as 5etools entries. */
export function htmlToEntries(
  html: string | undefined,
  resolve: LinkResolver,
  opts: EnrichOptions = {},
): Entry[] {
  if (!html?.trim()) return [];
  const { document } = new JSDOM(`<body>${enrich(html, resolve, opts)}</body>`).window;
  return blocks(document.body);
}
