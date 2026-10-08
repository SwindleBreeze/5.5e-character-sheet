// A feature "at a glance" (plan §10.2, step 6.2): a line generated from structure, never from a
// hand-written summary. How it is used (found in its text's own words: "as a Bonus Action"),
// its uses and when they come back (from its counter, or "can't … again until you finish a
// Long Rest"), once per turn, a saving throw it calls for, and how long it lasts.
// Each part is a tagged string, so game terms link to the glossary. Pure.

import { ABILITIES, ABILITY_NAMES, type Entry, type Recharge } from '../../schema/index.ts';
import { stripTags } from '../../richtext/tagRegistry.ts';

export interface GlanceResource {
  name: string;
  max: number;
  recharge: Recharge;
  /** Spent any amount at once (Lay on Hands): the max is a total, not a number of uses. */
  pool?: boolean;
}

/** The feature's own text: features written in it and options under it have their own. */
export function ownText(entries: readonly Entry[]): string {
  const out: string[] = [];
  const visit = (v: unknown): void => {
    if (typeof v === 'string') out.push(stripTags(v));
    else if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === 'object') {
      const type = (v as { type?: unknown }).type;
      if (typeof type === 'string' && (type.startsWith('ref') || type === 'options')) return;
      for (const [k, x] of Object.entries(v)) if (k !== 'name' && k !== 'type') visit(x);
    }
  };
  visit(entries);
  return out.join(' ').replace(/\s+/g, ' ');
}

const ACTION_PATTERNS: { tag: string; re: RegExp }[] = [
  {
    tag: '{@variantrule Bonus Action|XPHB}',
    re: /\b(?:as|take|use|uses?|spend|spends) (?:a|your) Bonus Action\b/i,
  },
  { tag: '{@variantrule Reaction|XPHB}', re: /\b(?:as|take|use|uses?) (?:a|your) Reaction\b/i },
  { tag: '{@action Magic|XPHB} action', re: /\b(?:as a|take the|take a) Magic action\b/i },
  { tag: '{@variantrule Action|XPHB}', re: /\b(?:as an|take an|use an) action\b/i },
];

/** How it is used: the first of these its text names. */
function actionPart(text: string): string | undefined {
  let best: { at: number; tag: string } | undefined;
  for (const { tag, re } of ACTION_PATTERNS) {
    const m = re.exec(text);
    if (m && (!best || m.index < best.at)) best = { at: m.index, tag };
  }
  return best?.tag;
}

const REST: Record<Recharge, string> = {
  short: '{@variantrule Short Rest|XPHB} or {@variantrule Long Rest|XPHB}',
  long: '{@variantrule Long Rest|XPHB}',
  shortOne: '{@variantrule Short Rest|XPHB}',
  dawn: 'dawn',
  none: '',
};

const BACK: Record<Recharge, string> = {
  short: `back on a ${REST.short}`,
  long: `back on a ${REST.long}`,
  shortOne: `one back on a {@variantrule Short Rest|XPHB}, all on a {@variantrule Long Rest|XPHB}`,
  dawn: 'back at dawn',
  none: '',
};

function usesPart(r: GlanceResource): string {
  const amount = r.pool ? `${r.max} in its pool` : `${r.max} ${r.max === 1 ? 'use' : 'uses'}`;
  return r.recharge === 'none' ? amount : `${amount}, ${BACK[r.recharge]}`;
}

/** "can't do so again until you finish a Long Rest": once per that rest. */
function oncePart(text: string): string | undefined {
  const m =
    /(?:can't|cannot|must finish a) (?:do so|use (?:it|this feature|this ability)|cast it in this way|[^.]{0,40}?) ?again until you finish a (Short (?:Rest )?or Long Rest|Long Rest)/i.exec(
      text,
    ) ?? /you must finish a (Short or Long Rest|Long Rest) before you can [^.]* again/i.exec(text);
  if (!m) return undefined;
  return /Short/i.test(m[1]!) ? `Once per ${REST.short}` : `Once per ${REST.long}`;
}

function savePart(text: string): string | undefined {
  const m = /\bmake an? (\w+) saving throw/i.exec(text);
  const ability = ABILITIES.find((a) => ABILITY_NAMES[a].toLowerCase() === m?.[1]?.toLowerCase());
  return ability
    ? `${ABILITY_NAMES[ability]} {@variantrule Saving Throw|XPHB|saving throw}`
    : undefined;
}

function durationPart(text: string): string | undefined {
  const m = /\b(?:for|lasts for|lasts) (1 minute|10 minutes|1 hour|8 hours|24 hours)\b/i.exec(text);
  return m ? `Lasts ${m[1]}` : undefined;
}

export interface GlanceInput {
  entries: readonly Entry[];
  /** Its counters, when it has any. */
  resources?: readonly GlanceResource[];
  /** Its counters are shown next to it already: leave their uses out. */
  countersShown?: boolean;
}

/** The parts of the line, in order; empty when the text says none of these things. */
export function glance({ entries, resources = [], countersShown }: GlanceInput): string[] {
  const text = ownText(entries);
  const uses = resources.length ? (countersShown ? [] : resources.map(usesPart)) : [oncePart(text)];
  const parts = [
    actionPart(text),
    ...uses,
    /\bonce (?:per|on each of your) turns?\b/i.test(text) ? 'Once per turn' : undefined,
    savePart(text),
    durationPart(text),
  ];
  return parts.filter((p): p is string => !!p);
}
