// The formula language (plan §9.1, P5). No eval: formulas are parsed into a small tree once
// and cached by their text.
//
//   expr   := term (('+' | '-') term)*
//   term   := factor (('*' | '/') factor)*
//   factor := number | dice | ref | fn '(' args ')' | '(' expr ')' | '-' factor
//   dice   := [count] 'd' faces            e.g. 2d6, d8
//   ref    := name ('.' segment)*           e.g. pb, mod.wis, table.second-wind, level.fighter
//
// Segments after the first dot may contain `-` (table keys like `rage-damage`), so subtracting
// from a dotted ref needs spaces: `table.furies - 1`.

export type Node =
  | { type: 'num'; value: number }
  | { type: 'dice'; count: number; faces: number }
  | { type: 'ref'; path: string }
  | { type: 'neg'; arg: Node }
  | { type: 'bin'; op: '+' | '-' | '*' | '/'; left: Node; right: Node }
  | { type: 'call'; fn: string; args: Node[] };

export class FormulaError extends Error {
  readonly formula: string;

  constructor(message: string, formula: string) {
    super(`${message} in "${formula}"`);
    this.formula = formula;
  }
}

type Token =
  | { type: 'num'; value: number }
  | { type: 'dice'; count: number; faces: number }
  | { type: 'name'; value: string }
  | { type: 'op'; value: string };

const DICE = /^(\d*)d(\d+)(?![\w.])/;
const NUMBER = /^\d+(?:\.\d+)?/;
const NAME = /^[a-z_][a-z0-9_]*(?:\.[a-z0-9_]+(?:-[a-z0-9_]+)*)*/i;

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let rest = text;
  while (rest.length) {
    const space = /^\s+/.exec(rest);
    if (space) {
      rest = rest.slice(space[0].length);
      continue;
    }
    const d = DICE.exec(rest);
    if (d) {
      tokens.push({ type: 'dice', count: d[1] ? Number(d[1]) : 1, faces: Number(d[2]) });
      rest = rest.slice(d[0].length);
      continue;
    }
    const n = NUMBER.exec(rest);
    if (n) {
      tokens.push({ type: 'num', value: Number(n[0]) });
      rest = rest.slice(n[0].length);
      continue;
    }
    const name = NAME.exec(rest);
    if (name) {
      tokens.push({ type: 'name', value: name[0].toLowerCase() });
      rest = rest.slice(name[0].length);
      continue;
    }
    const ch = rest[0] ?? '';
    if ('+-*/(),'.includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      rest = rest.slice(1);
      continue;
    }
    throw new FormulaError(`Unexpected "${ch}"`, text);
  }
  return tokens;
}

function parseTokens(tokens: Token[], text: string): Node {
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (value: string) => {
    const t = peek();
    return t?.type === 'op' && t.value === value;
  };
  const expect = (value: string) => {
    if (!isOp(value)) throw new FormulaError(`Expected "${value}"`, text);
    pos++;
  };

  function expr(): Node {
    let left = term();
    while (isOp('+') || isOp('-')) {
      const op = (tokens[pos++] as { value: '+' | '-' }).value;
      left = { type: 'bin', op, left, right: term() };
    }
    return left;
  }

  function term(): Node {
    let left = factor();
    while (isOp('*') || isOp('/')) {
      const op = (tokens[pos++] as { value: '*' | '/' }).value;
      left = { type: 'bin', op, left, right: factor() };
    }
    return left;
  }

  function factor(): Node {
    const t = peek();
    if (!t) throw new FormulaError('Unexpected end', text);
    pos++;
    if (t.type === 'num') return { type: 'num', value: t.value };
    if (t.type === 'dice') return { type: 'dice', count: t.count, faces: t.faces };
    if (t.type === 'name') {
      if (!isOp('(')) return { type: 'ref', path: t.value };
      pos++;
      const args: Node[] = [];
      if (!isOp(')')) {
        args.push(expr());
        while (isOp(',')) {
          pos++;
          args.push(expr());
        }
      }
      expect(')');
      return { type: 'call', fn: t.value, args };
    }
    if (t.value === '(') {
      const inner = expr();
      expect(')');
      return inner;
    }
    if (t.value === '-') return { type: 'neg', arg: factor() };
    if (t.value === '+') return factor();
    throw new FormulaError(`Unexpected "${t.value}"`, text);
  }

  const node = expr();
  if (pos < tokens.length) throw new FormulaError('Unexpected text after the formula', text);
  return node;
}

const cache = new Map<string, Node | FormulaError>();

/** Parse a formula, cached. Throws FormulaError for invalid text. */
export function parseFormula(text: string): Node {
  let hit = cache.get(text);
  if (hit === undefined) {
    try {
      hit = parseTokens(tokenize(text), text);
    } catch (err) {
      if (!(err instanceof FormulaError)) throw err;
      hit = err;
    }
    cache.set(text, hit);
  }
  if (hit instanceof FormulaError) throw hit;
  return hit;
}

/** Every ref path a formula reads, e.g. to validate table keys (plan §4.3). */
export function formulaRefs(text: string): string[] {
  const out: string[] = [];
  const visit = (n: Node) => {
    if (n.type === 'ref') out.push(n.path);
    else if (n.type === 'neg') visit(n.arg);
    else if (n.type === 'bin') {
      visit(n.left);
      visit(n.right);
    } else if (n.type === 'call') n.args.forEach(visit);
  };
  visit(parseFormula(text));
  return out;
}
