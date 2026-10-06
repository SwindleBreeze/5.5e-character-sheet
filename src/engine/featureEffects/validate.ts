// Checking mappings against loaded content (plan §4.3, §9.2 step 3.11): the mapped entity
// exists, `table.<key>` columns exist on the owning class or subclass, slots are unique per
// owner (data slots included), slots read by `fromChoice`/`ifChoice`/`choice.<slot>` are
// declared, and named entities resolve.

import {
  parseRefKey,
  type ContentEntity,
  type ClassDef,
  type RefKey,
  type Subclass,
  refKey,
} from '../../schema/index.ts';
import { effectSlots, entityOfferSlots } from '../collect/collect.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import { walkEffects } from '../effects/walk.ts';
import { formulaRefs } from '../formula/parse.ts';
import { classKey } from '../derive/scope.ts';
import { checkMapping } from './registry.ts';
import { effectFormulas, namedRefs, readSlots } from './inspect.ts';
import type { FeatureEffectsMap } from './types.ts';

export type MappingIssueCode =
  /** Broken without content: bad key, formula or repeated slot. */
  | 'invalid'
  /** The mapped entity is not in the content (not imported, or the id is wrong). */
  | 'ownerMissing'
  | 'tableKey'
  | 'duplicateSlot'
  | 'unknownSlot'
  | 'refMissing';

export interface MappingIssue {
  key: string;
  code: MappingIssueCode;
  message: string;
}

/** Tables a `table.<key>` in this entity's mapping reads: its subclass first, then its class. */
function ownTables(entity: ContentEntity, index: ContentIndex): (ClassDef | Subclass)[] {
  const out: (ClassDef | Subclass)[] = [];
  const add = (e: ClassDef | Subclass | undefined) => e && out.push(e);
  switch (entity.kind) {
    case 'class':
      add(entity);
      break;
    case 'subclass':
      add(entity);
      add(index.get({ kind: 'class', id: entity.classId }));
      break;
    case 'classFeature':
      add(index.get({ kind: 'class', id: entity.classId }));
      break;
    case 'subclassFeature':
      add(index.get({ kind: 'subclass', id: entity.subclassId }));
      add(index.get({ kind: 'class', id: entity.classId }));
      break;
    default:
      break;
  }
  return out;
}

const hasColumn = (owner: ClassDef | Subclass, key: string) =>
  (owner.table ?? []).some((c) => c.key === key);

export function validateFeatureEffects(
  map: FeatureEffectsMap,
  index: ContentIndex,
): MappingIssue[] {
  const issues: MappingIssue[] = [];
  const classesByKey = new Map<string, ClassDef[]>();
  for (const e of index.all()) {
    if (e.kind !== 'class') continue;
    const k = classKey(e.name);
    classesByKey.set(k, [...(classesByKey.get(k) ?? []), e]);
  }

  for (const [key, mapping] of Object.entries(map)) {
    const issue = (code: MappingIssueCode, message: string) => issues.push({ key, code, message });
    const problems = checkMapping(key, mapping);
    for (const p of problems) issue('invalid', p);
    if (problems.length) continue;

    const entity = index.get(parseRefKey(key as RefKey));
    if (!entity) {
      issue('ownerMissing', 'the mapped entity is not in the content');
      continue;
    }

    const mappedSlots = effectSlots(mapping.effects);
    const dataSlots = entityOfferSlots(entity);
    for (const slot of mappedSlots) {
      if (dataSlots.has(slot)) issue('duplicateSlot', `slot "${slot}" is also in the data`);
    }
    const declared = new Set([...dataSlots, ...mappedSlots]);
    const tables = ownTables(entity, index);

    for (const effect of walkEffects(mapping.effects)) {
      for (const slot of readSlots(effect)) {
        if (!declared.has(slot))
          issue('unknownSlot', `reads slot "${slot}", which is not declared`);
      }
      for (const ref of namedRefs(effect)) {
        if (!index.get(ref)) issue('refMissing', `${refKey(ref)} is not in the content`);
      }
      for (const formula of effectFormulas(effect)) {
        if (typeof formula !== 'string') continue;
        for (const path of formulaRefs(formula)) {
          const [head, a, b] = path.split('.');
          if (head === 'choice' && a && !declared.has(a)) {
            issue('unknownSlot', `"${formula}" reads slot "${a}", which is not declared`);
          }
          if (head !== 'table' || !a) continue;
          if (b === undefined) {
            if (!tables.length) {
              issue('tableKey', `"${formula}": table.${a} needs a class or subclass owner`);
            } else if (!tables.some((t) => hasColumn(t, a))) {
              issue('tableKey', `"${formula}": no "${a}" column on ${tables[0]!.name}`);
            }
          } else if (!(classesByKey.get(a) ?? []).some((c) => hasColumn(c, b))) {
            issue('tableKey', `"${formula}": no class "${a}" with a "${b}" column`);
          }
        }
      }
    }
  }
  return issues;
}
