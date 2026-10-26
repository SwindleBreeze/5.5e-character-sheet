// SRD spells as 5etools spell records: level, school, casting time, range, components,
// duration, the classes that have them, how they land (attack or save), the damage types they
// deal and how a cantrip's damage grows, with the text.

import { TWIN, twinName, type Context } from './context.ts';
import type { Doc } from './foundry.ts';
import type { Entry } from './html.ts';

const SCHOOL: Record<string, string> = {
  abj: 'A',
  con: 'C',
  div: 'D',
  enc: 'E',
  evo: 'V',
  ill: 'I',
  nec: 'N',
  trs: 'T',
};

const ABILITY_NAME: Record<string, string> = {
  str: 'strength',
  dex: 'dexterity',
  con: 'constitution',
  int: 'intelligence',
  wis: 'wisdom',
  cha: 'charisma',
};

const TIME_UNIT: Record<string, string> = {
  action: 'action',
  bonus: 'bonus',
  reaction: 'reaction',
  minute: 'minute',
  hour: 'hour',
  day: 'day',
};

const DURATION_UNIT: Record<string, string> = {
  round: 'round',
  minute: 'minute',
  hour: 'hour',
  day: 'day',
  month: 'month',
  year: 'year',
};

function time(sys: Doc) {
  const a = sys.activation ?? {};
  const unit = TIME_UNIT[a.type] ?? 'action';
  return [
    {
      number: Number(a.value) || 1,
      unit,
      ...(unit === 'reaction' && a.condition ? { condition: String(a.condition) } : {}),
    },
  ];
}

function range(sys: Doc) {
  const r = sys.range ?? {};
  const tmpl = sys.target?.template ?? {};
  if (r.units === 'self' && tmpl.type) {
    const shape = tmpl.type === 'radius' ? 'radius' : tmpl.type;
    return { type: shape, distance: { type: 'feet', amount: Number(tmpl.size) || 0 } };
  }
  switch (r.units) {
    case 'self':
      return { type: 'point', distance: { type: 'self' } };
    case 'touch':
      return { type: 'point', distance: { type: 'touch' } };
    case 'ft':
      return { type: 'point', distance: { type: 'feet', amount: Number(r.value) || 0 } };
    case 'mi':
      return { type: 'point', distance: { type: 'miles', amount: Number(r.value) || 0 } };
    case 'any':
      return { type: 'point', distance: { type: 'unlimited' } };
    case 'spec':
    default:
      return { type: 'special' };
  }
}

function components(sys: Doc) {
  const props: string[] = sys.properties ?? [];
  const out: Record<string, unknown> = {};
  if (props.includes('vocal')) out.v = true;
  if (props.includes('somatic')) out.s = true;
  if (props.includes('material')) {
    const m = sys.materials ?? {};
    const cost = Number(m.cost) || 0;
    out.m =
      cost || m.consumed
        ? {
            text: String(m.value ?? ''),
            ...(cost ? { cost: cost * 100 } : {}),
            ...(m.consumed ? { consume: true } : {}),
          }
        : String(m.value ?? '');
  }
  return out;
}

function duration(sys: Doc) {
  const d = sys.duration ?? {};
  const concentration = (sys.properties ?? []).includes('concentration');
  if (d.units === 'inst') return [{ type: 'instant' }];
  if (d.units === 'perm') return [{ type: 'permanent', ends: ['dispel'] }];
  const unit = DURATION_UNIT[d.units];
  if (unit) {
    return [
      {
        type: 'timed',
        duration: { type: unit, amount: Number(d.value) || 1 },
        ...(concentration ? { concentration: true } : {}),
      },
    ];
  }
  return [{ type: 'special', ...(concentration ? { concentration: true } : {}) }];
}

/** `Each creature`, `Each object`: who a spell's area affects. */
function affectsText(sys: Doc): string {
  const type = String(sys.target?.affects?.type ?? 'creature');
  const what = type === 'creatureOrObject' ? 'creature or object' : type || 'creature';
  return `Each ${what}`;
}

/** `20-foot-radius Sphere`, `15-foot Cone`: a spell's area. */
function templateText(sys: Doc): string {
  const t = sys.target?.template ?? {};
  const shape = String(t.type ?? '');
  if (!shape) return 'area';
  const name = shape.charAt(0).toUpperCase() + shape.slice(1);
  return ['sphere', 'cylinder', 'radius'].includes(shape)
    ? `${t.size}-foot-radius ${name === 'Radius' ? 'Sphere' : name}`
    : `${t.size}-foot ${name}`;
}

function activities(sys: Doc): Doc[] {
  return Object.values(sys.activities ?? {}) as Doc[];
}

/** Damage dice in the text as tags: `takes 1d10 Fire damage` → `{@damage 1d10}`. */
export function tagDice(entries: Entry[]): Entry[] {
  const tagText = (s: string) =>
    s
      .split(/(\{@[^}]*\})/)
      .map((part, i) =>
        i % 2
          ? part
          : part
              .replace(
                /\b(\d+d\d+(?:\s*\+\s*\d+)?)(?=\s+(?:[A-Z][a-z]+\s+)?(?:damage|Hit Points?))/g,
                (m) => `{@damage ${m}}`,
              )
              .replace(/\b(\d+d\d+)\b(?![^{]*\})/g, (m) => `{@dice ${m}}`),
      )
      .join('');
  const visit = (e: Entry): Entry => {
    if (typeof e === 'string') return tagText(e);
    const out: Record<string, unknown> = { ...e };
    for (const key of ['entries', 'items']) {
      if (Array.isArray(out[key])) out[key] = (out[key] as Entry[]).map(visit);
    }
    if (Array.isArray(out.rows)) out.rows = (out.rows as Entry[][]).map((r) => r.map(visit));
    return out;
  };
  return entries.map(visit);
}

const HIGHER = /^(Using a Higher-Level Spell Slot|Cantrip Upgrade)$/;

export function convertSpells(ctx: Context, docs: Doc[], lists: Map<string, string[]>) {
  return docs
    .filter((d) => d.type === 'spell')
    .map((d) => {
      const sys = d.system;
      const acts = activities(sys);
      const first = acts.flatMap((a) => a.damage?.parts ?? [])[0];
      const all = tagDice(
        ctx.entries(sys.description?.value, {
          ...(first?.number && first.denomination
            ? {
                damage: `${first.number}d${first.denomination}${first.bonus ? ` + ${first.bonus}` : ''}`,
                ...(first.types?.[0]
                  ? {
                      damageType: String(first.types[0]).replace(/^\w/, (c: string) =>
                        c.toUpperCase(),
                      ),
                    }
                  : {}),
              }
            : {}),
          affects: affectsText(sys),
          template: templateText(sys),
        }),
      );
      const entries = all.filter((e) => !(typeof e === 'object' && HIGHER.test(String(e.name))));
      const higher = all.filter((e) => typeof e === 'object' && HIGHER.test(String(e.name)));
      const damageTypes = [
        ...new Set(
          acts.flatMap((a) =>
            (a.damage?.parts ?? []).flatMap((p: Doc) => (p.types ?? []) as string[]),
          ),
        ),
      ].filter((t) => t !== 'healing' && t !== 'temphp');
      const saves = [
        ...new Set(
          acts
            .filter((a) => a.type === 'save')
            .flatMap((a) => [a.save?.ability ?? []].flat() as string[]),
        ),
      ]
        .map((a) => ABILITY_NAME[a])
        .filter(Boolean);
      const attack = acts.find((a) => a.type === 'attack')?.attack?.type?.value;
      const record: Doc = {
        name: twinName('spell', String(d.name)),
        source: TWIN,
        level: Number(sys.level) || 0,
        school: SCHOOL[sys.school] ?? 'V',
        time: time(sys),
        range: range(sys),
        components: components(sys),
        duration: duration(sys),
        entries,
        ...(higher.length ? { entriesHigherLevel: higher } : {}),
        ...((sys.properties ?? []).includes('ritual') ? { meta: { ritual: true } } : {}),
        ...(damageTypes.length ? { damageInflict: damageTypes } : {}),
        ...(saves.length ? { savingThrow: saves } : {}),
        ...(attack === 'melee'
          ? { spellAttack: ['M'] }
          : attack === 'ranged'
            ? { spellAttack: ['R'] }
            : {}),
        classes: {
          fromClassList: (lists.get(String(d._id)) ?? []).map((name) => ({ name, source: TWIN })),
        },
      };
      if (d.name !== record.name) record.srdName = d.name;
      // A cantrip's damage grows at levels 5, 11 and 17.
      const part = acts.flatMap((a) => a.damage?.parts ?? [])[0];
      if (
        record.level === 0 &&
        part?.number &&
        part.denomination &&
        part.scaling?.mode === 'whole'
      ) {
        const dice = (k: number) => `${Number(part.number) * k}d${part.denomination}`;
        record.scalingLevelDice = {
          label: damageTypes.length ? `${damageTypes[0]} damage` : 'damage',
          scaling: { 1: dice(1), 5: dice(2), 11: dice(3), 17: dice(4) },
        };
      }
      return record;
    });
}

/** Class spell lists (the SRD's "<Class> Spell List" pages): spell id → class names. */
export function spellLists(pages: Doc[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const page of pages) {
    const m = /^(\w+) Spell List$/.exec(String(page.name));
    if (!m || page.type !== 'spells') continue;
    for (const uuid of (page.system?.spells ?? []) as string[]) {
      const id = uuid.split('.').at(-1)!;
      out.set(id, [...(out.get(id) ?? []), m[1]!]);
    }
  }
  return out;
}
