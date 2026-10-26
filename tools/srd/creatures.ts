// SRD Beasts as 5etools monster records: what Wild Shape, Find Familiar and Conjure Animals
// call on. A Foundry actor keeps its numbers and works the rest out at play time (an attack's
// bonus from the creature's ability and Proficiency Bonus, its damage from the weapon's dice);
// here they are worked out once and written into the stat block, as the book prints them.
// Summoned spirits whose numbers grow with the spell's level come with the books instead.

import { TWIN, type Context } from './context.ts';
import type { Doc } from './foundry.ts';
import type { ActorText, Entry } from './html.ts';

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
const SIZE: Record<string, string> = { tiny: 'T', sm: 'S', med: 'M', lg: 'L', huge: 'H', grg: 'G' };
const SKILL: Record<string, string> = {
  acr: 'acrobatics',
  ani: 'animal handling',
  arc: 'arcana',
  ath: 'athletics',
  dec: 'deception',
  his: 'history',
  ins: 'insight',
  itm: 'intimidation',
  inv: 'investigation',
  med: 'medicine',
  nat: 'nature',
  prc: 'perception',
  prf: 'performance',
  per: 'persuasion',
  rel: 'religion',
  slt: 'sleight of hand',
  ste: 'stealth',
  sur: 'survival',
};
const SECTION: Record<string, string> = {
  action: 'action',
  bonus: 'bonus',
  reaction: 'reaction',
  legendary: 'legendary',
};
const ABILITY_NAME: Record<string, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const signed = (n: number) => (n < 0 ? `${n}` : `+${n}`);
const mod = (score: number) => Math.floor((score - 10) / 2);

/** Proficiency Bonus by Challenge Rating. */
const pbOf = (cr: number) => Math.max(2, Math.floor((Math.max(cr, 1) - 1) / 4) + 2);

/** `0.125` → `1/8`. */
function crText(cr: number): string {
  return cr === 0.125 ? '1/8' : cr === 0.25 ? '1/4' : cr === 0.5 ? '1/2' : String(cr);
}

/** The book a creature's twin is in: the compendium's ids start with it. */
function creatureSource(doc: Doc): string {
  return String(doc._id).startsWith('mm') ? 'XMM' : TWIN;
}

function activities(item: Doc): Doc[] {
  return Object.values(item.system?.activities ?? {}) as Doc[];
}

/** A stat block's numbers and the text of its markup, for one creature. */
function actorText(doc: Doc, item: Doc, pb: number): ActorText {
  const sys = doc.system;
  const score = (a: string) => Number(sys.abilities?.[a]?.value) || 10;
  const weapon = item.system ?? {};
  const attackActivity = activities(item).find((a) => a.type === 'attack');
  const rangeOf = () => weapon.range ?? {};
  const isRanged = () => {
    const t = attackActivity?.attack?.type?.value;
    if (t) return t === 'ranged';
    return !!rangeOf().value && !rangeOf().reach;
  };
  const abilityOf = () => {
    const chosen = attackActivity?.attack?.ability;
    if (chosen && chosen !== 'none') return chosen as string;
    if ((weapon.properties ?? []).includes('fin'))
      return score('dex') > score('str') ? 'dex' : 'str';
    return isRanged() ? 'dex' : 'str';
  };
  const abilityMod = () => mod(score(abilityOf()));
  /** A bonus as Foundry writes it (`@mod`, `1`, `@mod + 2`), as a number. */
  const bonusOf = (raw: unknown) =>
    String(raw ?? '')
      .replace(/@mod/g, String(abilityMod()))
      .replace(/@prof/g, String(pb))
      .split(/(?=[+-])/)
      .reduce((sum, t) => sum + (Number(t.replace(/\s/g, '')) || 0), 0);
  /** `7 ({@damage 1d8 + 3}) Piercing`, or `1 Piercing` for a flat amount. */
  const part = (p: Doc, bonus: number) => {
    const types = ((p.types ?? []) as string[]).map(cap).join(' or ');
    const n = Number(p.number) || 1;
    const die = Number(p.denomination) || 0;
    const tail = types ? ` ${types}` : '';
    if (!die) return `${Math.max(1, bonus)}${tail}`;
    const formula = bonus
      ? `${n}d${die} ${bonus < 0 ? '-' : '+'} ${Math.abs(bonus)}`
      : `${n}d${die}`;
    return `${Math.max(1, Math.floor((n * (die + 1)) / 2) + bonus)} ({@damage ${formula}})${tail}`;
  };
  const activityOf = (args: string) => {
    const id = /activity=(\w+)/.exec(args)?.[1];
    return id ? item.system?.activities?.[id] : undefined;
  };

  return {
    attack: () => {
      const bonus = bonusOf(attackActivity?.attack?.bonus);
      const toHit = attackActivity?.attack?.flat ? bonus : abilityMod() + pb + bonus;
      const range = rangeOf();
      const reach = isRanged()
        ? `range ${range.value}${range.long ? `/${range.long}` : ''} ft`
        : `reach ${range.reach ?? 5} ft`;
      // A thrown weapon reaches and flies: `reach 5 ft or range 20/60 ft`.
      const both =
        !isRanged() && range.value
          ? ` or range ${range.value}${range.long ? `/${range.long}` : ''} ft`
          : '';
      const kind = isRanged() ? 'r' : both ? 'm,r' : 'm';
      return `{@atkr ${kind}} {@hit ${toHit}}, ${reach}${both}`;
    },
    // `extended` reads as a hit's damage (`{@h}7 (1d8 + 3) Piercing damage`); without it, the
    // amount and type the text goes on from (`6 (1d8 + 2) Piercing`).
    damage: (args) => {
      const extended = /\bextended\b/.test(args);
      const finish = (parts: string[]) =>
        parts.length
          ? extended
            ? `${attackActivity ? '{@h}' : ''}${parts.map((t) => `${t} damage`).join(' plus ')}`
            : parts.join(' plus ')
          : undefined;
      const given = /(\d+)d(\d+)(?:\s*([+-]\s*\d+))?/.exec(args);
      if (given) {
        const type = /type=(\w+)/.exec(args)?.[1];
        const [, n, d, b] = given;
        return finish([
          part(
            { number: Number(n), denomination: Number(d), types: type ? [type] : [] },
            b ? Number(b.replace(/\s/g, '')) : 0,
          ),
        ]);
      }
      const activity = activityOf(args) ?? attackActivity ?? activities(item).find((a) => a.damage);
      const parts: string[] = [];
      const base = weapon.damage?.base;
      if (base && (base.denomination || base.bonus) && (activity?.damage?.includeBase ?? true)) {
        parts.push(part(base, abilityMod() + bonusOf(base.bonus)));
      }
      for (const p of (activity?.damage?.parts ?? []) as Doc[]) {
        if (p.denomination || p.bonus) parts.push(part(p, bonusOf(p.bonus)));
      }
      return finish(parts);
    },
    check: (args) => {
      if (/\b(ability|skill)=/.test(args)) return undefined;
      const activity = activityOf(args) ?? activities(item).find((a) => a.type === 'check');
      const check = activity?.check;
      if (!check) return undefined;
      const key = String(check.associated?.[0] ?? '');
      const skill = SKILL[key];
      const ability = ABILITY_NAME[String(sys.skills?.[key]?.ability ?? check.ability ?? '')];
      const dc = Number(check.dc?.formula) || undefined;
      const what = skill
        ? `${ability ?? ''} ({@skill ${skill.replace(/\b\w/g, (c) => c.toUpperCase())}|XPHB})`
        : (ability ?? '');
      return `${dc ? `DC ${dc} ` : ''}${what.trim()} check`;
    },
    item: (ref) => {
      const id = ref.replace(/^\./, '');
      const found = ((doc.items ?? []) as Doc[]).find((i) => i._id === id || i.name === ref);
      return String(found?.name ?? ref);
    },
    lookup: (path, args) => {
      if (path === '@name') {
        const name = String(doc.name);
        return /lowercase/.test(args) ? name.toLowerCase() : name;
      }
      const skill = /^@skills\.(\w+)\.passive$/.exec(path);
      if (skill) return String(10 + skillBonus(doc, skill[1]!, pb));
      const activity = activityOf(args);
      if (path === '@save.dc.value') {
        const ability = activity?.save?.dc?.calculation || 'con';
        return String(8 + mod(score(ability)) + pb);
      }
      if (path === '@range.value')
        return String(activity?.range?.value ?? weapon.range?.value ?? 5);
      if (path === '@target.affects.special')
        return String(activity?.target?.affects?.special ?? '');
      if (path === '@target.template.size') return String(activity?.target?.template?.size ?? '');
      if (path === '@activation.condition') return String(activity?.activation?.condition ?? '');
      return undefined;
    },
  };
}

function skillBonus(doc: Doc, key: string, pb: number): number {
  const s = doc.system?.skills?.[key] ?? {};
  const score = Number(doc.system?.abilities?.[s.ability ?? 'wis']?.value) || 10;
  return mod(score) + Math.floor(Number(s.value) || 0) * pb + (Number(s.bonuses?.check) || 0);
}

/** `Rock {@recharge 6}`, `Web {@recharge 5}`, `Frightful Presence (1/Day)`. */
function nameWithUses(item: Doc): string {
  const uses = item.system?.uses ?? {};
  const recharge = (uses.recovery ?? []).find((r: Doc) => r.period === 'recharge');
  if (recharge)
    return `${item.name} {@recharge ${recharge.formula === '6' ? '' : recharge.formula}}`.replace(
      ' }',
      '}',
    );
  const day = (uses.recovery ?? []).find((r: Doc) => r.period === 'day' || r.period === 'lr');
  if (day && uses.max) return `${item.name} (${uses.max}/Day)`;
  return String(item.name);
}

function defenses(trait: Doc | undefined): string[] {
  return [
    ...((trait?.value ?? []) as string[]),
    ...String(trait?.custom ?? '')
      .split(/;\s*/)
      .filter(Boolean),
  ];
}

export function convertCreatures(ctx: Context, docs: (Doc & { _path: string })[]): Doc[] {
  return docs
    .filter((d) => d.type === 'npc' && d._path.startsWith('beast/'))
    .map((d) => {
      const sys = d.system;
      const cr = Number(sys.details?.cr) || 0;
      const pb = pbOf(cr);
      const score = (a: string) => Number(sys.abilities?.[a]?.value) || 10;
      const attrs = sys.attributes ?? {};
      const ac = attrs.ac ?? {};
      const acValue = ac.calc === 'default' ? 10 + mod(score('dex')) : Number(ac.flat) || 10;
      const move = attrs.movement ?? {};
      const speed: Doc = {};
      for (const m of ['walk', 'burrow', 'climb', 'fly', 'swim'])
        if (Number(move[m])) speed[m] = Number(move[m]);
      if (move.hover) speed.canHover = true;
      const senses = Object.entries((attrs.senses?.ranges ?? {}) as Record<string, number | null>)
        .filter(([, v]) => v)
        .map(([k, v]) => `${cap(k)} ${v} ft.`);
      if (attrs.senses?.special) senses.push(String(attrs.senses.special));
      const saves = Object.fromEntries(
        ABILITIES.filter((a) => Number(sys.abilities?.[a]?.proficient)).map((a) => [
          a,
          signed(mod(score(a)) + pb),
        ]),
      );
      const skills = Object.fromEntries(
        Object.entries((sys.skills ?? {}) as Record<string, Doc>)
          .filter(([, s]) => Number(s.value) > 0)
          .map(([k]) => [SKILL[k] ?? k, signed(skillBonus(d, k, pb))]),
      );
      const traits = sys.traits ?? {};
      const type = sys.details?.type ?? {};

      const sections: Record<string, Doc[]> = {
        trait: [],
        action: [],
        bonus: [],
        reaction: [],
        legendary: [],
      };
      for (const item of (d.items ?? []) as Doc[]) {
        if (item.type !== 'feat' && item.type !== 'weapon') continue;
        // A check it lets others make (a Raven's Mimicry) is no action of its own.
        const own = activities(item).filter((a) => a.type !== 'check');
        const activation =
          own[0]?.activation?.type ?? (own.length ? item.system?.activation?.type : undefined);
        const section = item.type === 'weapon' ? 'action' : (SECTION[activation] ?? 'trait');
        const entries: Entry[] = ctx.entries(item.system?.description?.value, {
          actor: actorText(d, item, pb),
        });
        if (!entries.length) continue;
        sections[section]!.push({ name: nameWithUses(item), entries });
      }

      const record: Doc = {
        name: String(d.name),
        source: creatureSource(d),
        size: [SIZE[traits.size] ?? 'M'],
        type: type.swarm
          ? { type: type.value, swarmSize: SIZE[type.swarm] ?? 'T' }
          : type.subtype
            ? { type: type.value, tags: [String(type.subtype).toLowerCase()] }
            : type.value,
        alignment: /unaligned/i.test(String(sys.details?.alignment ?? ''))
          ? ['U']
          : [{ special: sys.details?.alignment }],
        ac: [acValue],
        hp: { average: Number(attrs.hp?.max) || 1, formula: String(attrs.hp?.formula ?? '') },
        speed,
        ...Object.fromEntries(ABILITIES.map((a) => [a, score(a)])),
        ...(Object.keys(saves).length ? { save: saves } : {}),
        ...(Object.keys(skills).length ? { skill: skills } : {}),
        ...(senses.length ? { senses } : {}),
        passive: 10 + skillBonus(d, 'prc', pb),
        ...(defenses(traits.dr).length ? { resist: defenses(traits.dr) } : {}),
        ...(defenses(traits.di).length ? { immune: defenses(traits.di) } : {}),
        ...(defenses(traits.dv).length ? { vulnerable: defenses(traits.dv) } : {}),
        ...(defenses(traits.ci).length ? { conditionImmune: defenses(traits.ci) } : {}),
        cr: crText(cr),
        // Find Familiar: a Beast of Challenge Rating 0 can be a familiar.
        ...(cr === 0 ? { familiar: true } : {}),
      };
      for (const [key, list] of Object.entries(sections)) if (list.length) record[key] = list;
      return record;
    });
}
