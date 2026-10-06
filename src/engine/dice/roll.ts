// The dice roller (plan §9.2, step 3.2): `NdM`, keep highest/lowest (`4d6kh3`), flat bonuses,
// several terms, and advantage/disadvantage on d20 rolls. The random source is injectable.

import { isDice, type Value } from '../formula/dice.ts';

export type Rng = () => number;

/** Uniform [0, 1) from the platform's cryptographic generator. */
export const cryptoRng: Rng = () => {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] ?? 0) / 2 ** 32;
};

export interface RollTerm {
  sign: 1 | -1;
  count: number;
  faces: number;
  keep?: { mode: 'h' | 'l'; n: number };
}

export interface RollExpr {
  terms: RollTerm[];
  flat: number;
}

export class RollError extends Error {}

const TERM = /^([+-])?\s*(?:(\d*)d(\d+)(?:k([hl])(\d+))?|(\d+))/i;

/** Parse `2d6+3`, `d20`, `4d6kh3`, `1d8 + 1d6 - 1`. */
export function parseRoll(text: string): RollExpr {
  const expr: RollExpr = { terms: [], flat: 0 };
  let rest = text.trim();
  if (!rest) throw new RollError('Nothing to roll');
  let first = true;
  while (rest.length) {
    const m = TERM.exec(rest);
    if (!m || (!first && !m[1])) throw new RollError(`Can't read "${text}"`);
    const sign = m[1] === '-' ? -1 : 1;
    if (m[3] !== undefined) {
      const count = m[2] ? Number(m[2]) : 1;
      const faces = Number(m[3]);
      if (count < 1 || count > 100 || faces < 1 || faces > 1000) {
        throw new RollError(`Too many or too odd dice in "${text}"`);
      }
      const term: RollTerm = { sign, count, faces };
      if (m[4] && m[5]) {
        const n = Number(m[5]);
        if (n < 1 || n > count) throw new RollError(`Can't keep ${n} of ${count} dice`);
        term.keep = { mode: m[4].toLowerCase() as 'h' | 'l', n };
      }
      expr.terms.push(term);
    } else {
      expr.flat += sign * Number(m[6]);
    }
    rest = rest.slice(m[0].length).trimStart();
    first = false;
  }
  return expr;
}

export interface RolledTerm extends RollTerm {
  rolls: number[];
  /** Indexes into `rolls` that count. */
  kept: number[];
}

export interface RollResult {
  expr: RollExpr;
  terms: RolledTerm[];
  flat: number;
  total: number;
  /** For a single d20 roll: the d20's kept value, to spot natural 1s and 20s. */
  natural?: number;
}

export type RollMode = 'normal' | 'advantage' | 'disadvantage';

function die(faces: number, rng: Rng): number {
  return Math.min(faces, Math.floor(rng() * faces) + 1);
}

/** Roll an expression. Advantage turns a lone `1d20` into `2d20kh1` (disadvantage: `kl1`). */
export function roll(
  expr: RollExpr | string,
  rng: Rng = cryptoRng,
  mode: RollMode = 'normal',
): RollResult {
  const parsed = typeof expr === 'string' ? parseRoll(expr) : expr;
  const d20s = parsed.terms.filter((t) => t.faces === 20);
  const single = d20s.length === 1 && d20s[0]!.count === 1 && !d20s[0]!.keep ? d20s[0] : undefined;
  const terms: RolledTerm[] = parsed.terms.map((t) => {
    const term: RollTerm =
      t === single && mode !== 'normal'
        ? { ...t, count: 2, keep: { mode: mode === 'advantage' ? 'h' : 'l', n: 1 } }
        : t;
    const rolls = Array.from({ length: term.count }, () => die(term.faces, rng));
    let kept = rolls.map((_, i) => i);
    if (term.keep) {
      const order = [...kept].sort((a, b) =>
        term.keep!.mode === 'h' ? rolls[b]! - rolls[a]! : rolls[a]! - rolls[b]!,
      );
      kept = order.slice(0, term.keep.n).sort((a, b) => a - b);
    }
    return { ...term, rolls, kept };
  });
  const total =
    parsed.flat +
    terms.reduce((sum, t) => sum + t.sign * t.kept.reduce((s, i) => s + t.rolls[i]!, 0), 0);
  const result: RollResult = { expr: parsed, terms, flat: parsed.flat, total };
  if (single) {
    const t = terms[parsed.terms.indexOf(single)]!;
    result.natural = t.rolls[t.kept[0]!];
  }
  return result;
}

/** `2d6 + 3`, as typed. */
export function formatRoll(expr: RollExpr): string {
  const parts = expr.terms.map((t, i) => {
    const text = `${t.count}d${t.faces}${t.keep ? `k${t.keep.mode}${t.keep.n}` : ''}`;
    if (i === 0) return t.sign < 0 ? `-${text}` : text;
    return `${t.sign < 0 ? '-' : '+'} ${text}`;
  });
  if (expr.flat || !parts.length) {
    parts.push(
      parts.length ? `${expr.flat < 0 ? '-' : '+'} ${Math.abs(expr.flat)}` : String(expr.flat),
    );
  }
  return parts.join(' ');
}

/** A formula's dice value as something to roll. */
export function rollExprOf(value: Value): RollExpr {
  if (!isDice(value)) return { terms: [], flat: value };
  return {
    terms: value.terms.map((t) => ({
      sign: t.count < 0 ? -1 : 1,
      count: Math.abs(t.count),
      faces: t.faces,
    })),
    flat: value.flat,
  };
}
