// The formula scope for one effect source (plan §9.1, P5): what `pb`, `level.fighter`,
// `mod.wis`, `table.second-wind` and friends mean for this character.

import type { Ability, ChoiceKey } from '../../schema/index.ts';
import { choiceKey } from '../collect/collect.ts';
import type { ClassLevel, EffectSource } from '../collect/types.ts';
import { cellToValue, type FormulaScope } from '../formula/evaluate.ts';
import type { Value } from '../formula/dice.ts';

/** A class name as formulas spell it: `Fighter` → `fighter`, `Blood Hunter` → `blood-hunter`. */
export function classKey(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function classKeyOf(c: ClassLevel): string {
  return classKey(c.cls?.name ?? c.classId.split('|')[0] ?? c.classId);
}

export interface ScopeContext {
  charLevel: number;
  pb: number;
  classes: readonly ClassLevel[];
  /** Ability scores, once derived; until then `mod.*` and `score.*` are unknown. */
  scores?: Readonly<Record<Ability, number>>;
  valuesOf?: (key: ChoiceKey) => readonly string[];
  resourceMax?: (id: string) => number | undefined;
}

/** The value in a class's table at its current level; the subclass table is checked first. */
export function tableValue(c: ClassLevel, key: string): Value | undefined {
  const column =
    c.subclass?.table?.find((col) => col.key === key) ??
    c.cls?.table.find((col) => col.key === key);
  if (!column) return undefined;
  return c.level < 1 ? 0 : cellToValue(column.values[c.level - 1]);
}

export function makeScope(ctx: ScopeContext, source?: EffectSource): FormulaScope {
  const byKey = new Map(ctx.classes.map((c) => [classKeyOf(c), c]));
  const own = source?.classId ? ctx.classes.find((c) => c.classId === source.classId) : undefined;
  return {
    ref(path) {
      const [head, a, b, ...rest] = path.split('.');
      if (rest.length) return undefined;
      switch (head) {
        case 'pb':
          return a === undefined ? ctx.pb : undefined;
        case 'level':
          if (a === undefined) return ctx.charLevel;
          return b === undefined ? (byKey.get(a)?.level ?? 0) : undefined;
        case 'mod':
        case 'score': {
          const score = a && b === undefined ? ctx.scores?.[a as Ability] : undefined;
          if (score === undefined) return undefined;
          return head === 'score' ? score : Math.floor((score - 10) / 2);
        }
        case 'table': {
          if (a === undefined) return undefined;
          if (b === undefined) return own ? tableValue(own, a) : undefined;
          const cls = byKey.get(a);
          // A class the character doesn't have contributes nothing.
          return cls ? tableValue(cls, b) : 0;
        }
        case 'choice':
          if (!a || b !== undefined || !source || !ctx.valuesOf) return undefined;
          return ctx.valuesOf(choiceKey(source.ref, a, source.n)).length;
        case 'resource':
          return a && b === 'max' ? ctx.resourceMax?.(a) : undefined;
        default:
          return undefined;
      }
    },
  };
}
