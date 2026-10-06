// What one effect reads and points at, for checking mappings (plan §4.3, §9.2 step 3.11):
// its formulas, the choice slots it reads, and the entities it names. Nested effects are not
// included; walk them with `walkEffects`.

import type {
  ActionDef,
  Cost,
  Effect,
  Formula,
  Predicate,
  Ref,
  SelfOutcome,
} from '../../schema/index.ts';

function costFormulas(costs: readonly Cost[] | undefined): Formula[] {
  return (costs ?? []).flatMap((c) =>
    'resource' in c ? [c.amount] : 'hitDice' in c ? [c.hitDice] : [],
  );
}

function outcomeFormulas(outcomes: readonly SelfOutcome[] | undefined): Formula[] {
  return (outcomes ?? []).flatMap((o) => {
    if ('heal' in o) return [o.heal];
    if ('tempHp' in o) return [o.tempHp];
    if ('restore' in o) return [o.restore.amount];
    if ('regainSlot' in o) return [o.regainSlot.maxLevel];
    return [];
  });
}

function actionFormulas(a: ActionDef): Formula[] {
  return [
    ...(a.roll !== undefined ? [a.roll] : []),
    ...(a.saveDc !== undefined ? [a.saveDc] : []),
    ...costFormulas(a.costs),
    ...outcomeFormulas(a.outcomes),
  ];
}

const defined = (...values: (Formula | undefined)[]): Formula[] =>
  values.filter((v): v is Formula => v !== undefined);

/** Every formula in an effect. */
export function effectFormulas(e: Effect): Formula[] {
  switch (e.type) {
    case 'abilityChoice':
    case 'proficiencyChoice':
    case 'expertiseChoice':
    case 'resistanceChoice':
    case 'weaponMasteryChoice':
    case 'featureOptions':
    case 'optionChoice':
      return [e.choice.count];
    case 'acBonus':
    case 'initiativeBonus':
    case 'rollBonus':
      return [e.value];
    case 'speed':
      return e.value === 'walk' ? [] : [e.value];
    case 'speedBonus':
      return [e.value];
    case 'resource':
      return defined(e.max, e.die);
    case 'resourceModify':
      return defined(e.max, e.die);
    case 'restoreWith':
      return [e.amount, ...costFormulas(e.costs)];
    case 'grantSpells':
      return e.spells.flatMap((g) => [
        ...('count' in g.spell ? [g.spell.count] : []),
        ...(typeof g.uses === 'object' && 'count' in g.uses ? [g.uses.count] : []),
      ]);
    case 'grantAction':
      return actionFormulas(e.action);
    case 'hpBonus':
      return defined(e.perLevel, e.flat);
    case 'featChoice':
      return defined(e.count);
    case 'optionalFeatureChoice':
      return [e.count];
    case 'toggle':
      return [...costFormulas(e.cost), ...outcomeFormulas(e.onActivate)];
    case 'attackMod':
      return defined(e.toHit, e.damage, e.damageDie);
    case 'damageRider':
      return [e.dice, ...costFormulas(e.cost ? [e.cost] : [])];
    case 'spellMod':
      return defined(e.dcBonus, e.attackBonus, e.damageBonus);
    case 'ward':
      return [e.max];
    default:
      return [];
  }
}

const boundSlot = (v: unknown): string[] =>
  typeof v === 'object' && v !== null && 'fromChoice' in v ? [String(v.fromChoice)] : [];

/** Choice slots of its owner that an effect reads (`fromChoice`, `ifChoice`). */
export function readSlots(e: Effect): string[] {
  switch (e.type) {
    case 'abilityBonus':
      return boundSlot(e.ability);
    case 'proficiency':
    case 'resistance':
    case 'immunity':
    case 'conditionImmunity':
      return boundSlot(e.value);
    case 'expertise':
      return boundSlot(e.skill);
    case 'damageRider':
      return boundSlot(e.damageType);
    case 'spellcasting':
      return boundSlot(e.ability);
    case 'ifChoice':
      return [e.slot];
    default:
      return [];
  }
}

function predicateRefs(p: Predicate): Ref[] {
  if ('condition' in p) return [{ kind: 'rule', id: p.condition }];
  if ('level' in p && p.classId) return [{ kind: 'class', id: p.classId }];
  if ('all' in p) return p.all.flatMap(predicateRefs);
  if ('any' in p) return p.any.flatMap(predicateRefs);
  if ('not' in p) return predicateRefs(p.not);
  return [];
}

/** Entities an effect names, which must exist in the content. */
export function namedRefs(e: Effect): Ref[] {
  switch (e.type) {
    case 'grantFeat':
      return [e.feat];
    case 'grantSpells':
      return e.spells.flatMap((g): Ref[] =>
        'id' in g.spell
          ? [{ kind: 'spell', id: g.spell.id }]
          : 'from' in g.spell
            ? (g.spell.from ?? []).map((id) => ({ kind: 'spell', id }))
            : [],
      );
    case 'featureOptions':
      return Array.isArray(e.choice.from)
        ? e.choice.from.map((id) => ({ kind: e.optionKind, id }))
        : [];
    case 'when':
      return predicateRefs(e.when);
    case 'spellcasting':
      return e.tableOwner ? [e.tableOwner] : [];
    case 'attackMod':
    case 'damageRider':
      return (e.filter.itemIds ?? []).map((id) => ({ kind: 'item', id }));
    default:
      return [];
  }
}
