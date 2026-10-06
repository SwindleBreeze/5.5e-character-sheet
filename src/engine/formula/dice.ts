// Dice values (P5): a formula can evaluate to dice, e.g. Sneak Attack `3d6` or `1d8 + 4`.

export interface DiceTerm {
  count: number;
  faces: number;
}

/** A sum of dice plus a flat number, e.g. `2d6 + 1d4 + 3`. Terms with equal faces merge. */
export interface Dice {
  terms: DiceTerm[];
  flat: number;
}

/** What a formula evaluates to. */
export type Value = number | Dice;

export function isDice(value: Value): value is Dice {
  return typeof value === 'object';
}

export function dice(count: number, faces: number, flat = 0): Dice {
  return normalizeDice({ terms: [{ count, faces }], flat });
}

/** Merge equal faces, drop zero counts, order by faces (largest first). */
export function normalizeDice(d: Dice): Dice {
  const byFaces = new Map<number, number>();
  for (const t of d.terms) byFaces.set(t.faces, (byFaces.get(t.faces) ?? 0) + t.count);
  const terms = [...byFaces]
    .filter(([, count]) => count !== 0)
    .sort(([a], [b]) => b - a)
    .map(([faces, count]) => ({ count, faces }));
  return { terms, flat: d.flat };
}

export function addValues(a: Value, b: Value): Value {
  if (!isDice(a) && !isDice(b)) return a + b;
  const da = isDice(a) ? a : { terms: [], flat: a };
  const db = isDice(b) ? b : { terms: [], flat: b };
  return normalizeDice({ terms: [...da.terms, ...db.terms], flat: da.flat + db.flat });
}

export function negateValue(a: Value): Value {
  if (!isDice(a)) return -a;
  return { terms: a.terms.map((t) => ({ count: -t.count, faces: t.faces })), flat: -a.flat };
}

/** Multiply by a plain number (`2 * 1d6` is `2d6`). */
export function scaleValue(a: Value, k: number): Value {
  if (!isDice(a)) return a * k;
  return normalizeDice({
    terms: a.terms.map((t) => ({ count: t.count * k, faces: t.faces })),
    flat: a.flat * k,
  });
}

/** Average result, for comparing dice (`max(1d6, 1d8)`) and for "take the average" HP. */
export function averageOf(v: Value): number {
  if (!isDice(v)) return v;
  return v.terms.reduce((sum, t) => sum + (t.count * (t.faces + 1)) / 2, v.flat);
}

/** The largest single die, for "the larger of the two dice" (Martial Arts). */
export function largestFaces(v: Value): number {
  return isDice(v) ? Math.max(0, ...v.terms.map((t) => t.faces)) : 0;
}

/** `2d6 + 1d4 + 3`, `1d8`, `-1`. */
export function formatValue(v: Value): string {
  if (!isDice(v)) return String(v);
  const signed: [negative: boolean, text: string][] = v.terms.map((t) => [
    t.count < 0,
    `${Math.abs(t.count)}d${t.faces}`,
  ]);
  if (v.flat !== 0) signed.push([v.flat < 0, String(Math.abs(v.flat))]);
  if (!signed.length) return '0';
  return signed
    .map(([negative, text], i) =>
      i === 0 ? (negative ? '-' : '') + text : `${negative ? '-' : '+'} ${text}`,
    )
    .join(' ');
}
