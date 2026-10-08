// Evaluating formulas against a character (plan §9.1, P5). Refs are looked up through a scope
// that the engine builds; an unknown ref is an error the caller turns into a rule issue.

import type { Formula } from '../../schema/index.ts';
import { addValues, averageOf, dice, isDice, negateValue, scaleValue, type Value } from './dice.ts';
import { FormulaError, parseFormula, type Node } from './parse.ts';

export interface FormulaScope {
  /** The value of a ref such as `pb` or `table.second-wind`; undefined when unknown. */
  ref(path: string): Value | undefined;
}

/** A scope over plain values, for tests and simple cases. */
export function mapScope(values: Record<string, Value>): FormulaScope {
  return { ref: (path) => values[path] };
}

function num(v: Value, what: string, formula: string): number {
  if (isDice(v)) throw new FormulaError(`${what} needs a number, not dice`, formula);
  return v;
}

function evalNode(node: Node, scope: FormulaScope, formula: string): Value {
  switch (node.type) {
    case 'num':
      return node.value;
    case 'dice':
      return dice(node.count, node.faces);
    case 'ref': {
      const v = scope.ref(node.path);
      if (v === undefined) throw new FormulaError(`Unknown value "${node.path}"`, formula);
      return v;
    }
    case 'neg':
      return negateValue(evalNode(node.arg, scope, formula));
    case 'bin': {
      const l = evalNode(node.left, scope, formula);
      const r = evalNode(node.right, scope, formula);
      switch (node.op) {
        case '+':
          return addValues(l, r);
        case '-':
          return addValues(l, negateValue(r));
        case '*':
          if (isDice(l) && isDice(r)) throw new FormulaError('Dice times dice', formula);
          return isDice(l) ? scaleValue(l, num(r, '*', formula)) : scaleValue(r, l);
        case '/': {
          const d = num(r, 'Division', formula);
          if (d === 0) throw new FormulaError('Division by zero', formula);
          return num(l, 'Division', formula) / d;
        }
      }
      break;
    }
    case 'call':
      return call(node.fn, node.args, scope, formula);
  }
  throw new FormulaError('Bad formula', formula);
}

function call(fn: string, argNodes: Node[], scope: FormulaScope, formula: string): Value {
  const args = argNodes.map((a) => evalNode(a, scope, formula));
  const nums = () => args.map((a) => num(a, fn, formula));
  switch (fn) {
    case 'min':
    case 'max': {
      if (!args.length) throw new FormulaError(`${fn} needs arguments`, formula);
      // Dice compare by their average: max(1d6, 1d8) is 1d8.
      const pick = fn === 'min' ? (a: number, b: number) => a < b : (a: number, b: number) => a > b;
      return args.reduce((best, v) => (pick(averageOf(v), averageOf(best)) ? v : best));
    }
    case 'floor':
    case 'ceil': {
      const [x] = nums();
      if (x === undefined || args.length !== 1)
        throw new FormulaError(`${fn} needs one argument`, formula);
      return fn === 'floor' ? Math.floor(x) : Math.ceil(x);
    }
    case 'dice': {
      const [count, faces] = nums();
      if (count === undefined || faces === undefined || args.length !== 2) {
        throw new FormulaError('dice needs a count and faces', formula);
      }
      return dice(Math.floor(count), faces);
    }
    case 'steps': {
      // steps(x, level1, value1, level2, value2, …): the value of the last level ≤ x, else 0.
      if (args.length < 3 || args.length % 2 === 0) {
        throw new FormulaError('steps needs x and level/value pairs', formula);
      }
      const x = num(args[0]!, 'steps', formula);
      let result: Value = 0;
      for (let i = 1; i < args.length; i += 2) {
        if (x >= num(args[i]!, 'steps', formula)) result = args[i + 1]!;
      }
      return result;
    }
    default:
      throw new FormulaError(`Unknown function "${fn}"`, formula);
  }
}

export function evaluateFormula(formula: Formula, scope: FormulaScope): Value {
  if (typeof formula === 'number') return formula;
  return evalNode(parseFormula(formula), scope, formula);
}

/** Evaluate where only a number makes sense (counts, bonuses). Dice count as their average. */
export function evaluateNumber(formula: Formula, scope: FormulaScope): number {
  const v = evaluateFormula(formula, scope);
  return isDice(v) ? averageOf(v) : v;
}

/**
 * A class table cell as a value: `1d6` → dice, `+10 ft.` → 10, `1st` → 1, `—` → 0. Numbers
 * stay numbers; anything else is 0.
 */
export function cellToValue(cell: string | number | undefined): Value {
  if (cell === undefined) return 0;
  if (typeof cell === 'number') return cell;
  // Tagged dice (`{@dice D6}`, Psi Warrior's table) read as their text.
  const text = cell
    .replace(/\{@\w+ ([^|}]*)[^}]*\}/g, '$1')
    .trim()
    .replace(/^(\d*)D(\d)/, '$1d$2');
  // Dice, possibly several: `1d6`, `2d6+1d4`, `1d8 + 2`.
  if (/d\d/.test(text) && /^[\dd\s+-]+$/.test(text)) return evaluateFormula(text, mapScope({}));
  const n = /^[+-]?\d+(?:\.\d+)?/.exec(text);
  return n ? Number(n[0]) : 0;
}
