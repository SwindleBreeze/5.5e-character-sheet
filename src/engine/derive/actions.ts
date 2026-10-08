// Actions and toggles (plan §9.2, step 3.8; P7, P8): what features let the character do, the
// standard actions of the 2024 rules, and the stances and forms that switch on and off.

import { ruleId, type AttackFilter, type SelfOutcome } from '../../schema/index.ts';
import type { EffectSource } from '../collect/types.ts';
import { formatValue } from '../formula/dice.ts';
import { costOf, findResource, findResourceByName } from './resources.ts';
import { effectsOfType, evalNumber, evalValue, type DeriveContext } from './context.ts';
import type {
  DerivedAction,
  DerivedAttack,
  DerivedOutcome,
  DerivedResource,
  DerivedToggle,
} from './types.ts';

/** Outcomes with their formulas worked out for this character. */
function outcomesOf(
  ctx: DeriveContext,
  outcomes: readonly SelfOutcome[] | undefined,
  resources: readonly DerivedResource[],
  source: EffectSource,
): DerivedOutcome[] {
  return (outcomes ?? []).map((o): DerivedOutcome => {
    if ('heal' in o) return { heal: formatValue(evalValue(ctx, o.heal, source)) };
    if ('tempHp' in o) return { tempHp: formatValue(evalValue(ctx, o.tempHp, source)) };
    if ('toggleOn' in o) return o;
    if ('restore' in o) {
      const r = findResource(resources, o.restore.resource, source.ref);
      return {
        restore: {
          label: r?.name ?? o.restore.resource,
          amount: Math.max(0, Math.floor(evalNumber(ctx, o.restore.amount, source))),
          ...(r ? { resourceKey: r.key } : {}),
        },
      };
    }
    return {
      regainSlot: {
        maxLevel: Math.max(0, Math.floor(evalNumber(ctx, o.regainSlot.maxLevel, source))),
      },
    };
  });
}

/** The actions everyone has (2024 rules), linked to their rule text. */
export const STANDARD_ACTIONS: readonly { name: string; actionType: 'action' | 'reaction' }[] = [
  ...[
    'Attack',
    'Dash',
    'Disengage',
    'Dodge',
    'Help',
    'Hide',
    'Influence',
    'Magic',
    'Ready',
    'Search',
    'Study',
    'Utilize',
  ].map((name) => ({ name, actionType: 'action' as const })),
  { name: 'Opportunity Attack', actionType: 'reaction' },
];

/**
 * The attacks a standard action makes. Attack: every attack of the Attack action (a stowed
 * weapon is drawn as part of it), and a Nick weapon's Light extra attack. Opportunity Attack:
 * one melee attack with a weapon in hand or an Unarmed Strike.
 */
function standardAttacks(name: string, attacks: readonly DerivedAttack[]): string[] {
  if (name === 'Attack') {
    return attacks
      .filter((a) => a.use.kind === 'attackAction' || (a.use.kind === 'lightExtra' && a.use.nick))
      .map((a) => a.id);
  }
  if (name === 'Opportunity Attack') {
    return attacks
      .filter((a) => a.use.kind === 'attackAction' && a.range === 'melee' && a.ready)
      .map((a) => a.id);
  }
  return [];
}

/** Attacks an action makes: by kind and range; tags and properties are not known here. */
function attacksFor(filter: AttackFilter | undefined, attacks: readonly DerivedAttack[]): string[] {
  if (!filter) return [];
  return attacks
    .filter(
      (a) =>
        (!filter.source || filter.source.includes(a.kind)) &&
        (!filter.range || filter.range === a.range),
    )
    .map((a) => a.id);
}

export function deriveActions(
  ctx: DeriveContext,
  resources: readonly DerivedResource[],
  attacks: readonly DerivedAttack[],
): DerivedAction[] {
  const out: DerivedAction[] = [];
  for (const { effect, source } of effectsOfType(ctx.collected, 'grantAction')) {
    const a = effect.action;
    const action: DerivedAction = {
      id: `${source.ref.kind}:${source.ref.id}#${a.id}`,
      name: a.name,
      actionType: a.actionType,
      sourceName: source.name,
      source: source.ref,
      costs: (a.costs ?? []).map((c) => costOf(ctx, c, resources, source)),
      outcomes: outcomesOf(ctx, a.outcomes, resources, source),
      attackIds: attacksFor(a.attack, attacks),
    };
    if (a.resourceId)
      action.costs.push(costOf(ctx, { resource: a.resourceId, amount: 1 }, resources, source));
    if (a.roll !== undefined) action.roll = formatValue(evalValue(ctx, a.roll, source));
    if (a.saveDc !== undefined) action.saveDc = Math.floor(evalNumber(ctx, a.saveDc, source));
    if (a.description) action.description = a.description;
    out.push(action);
  }

  // Features that spend a named resource (5etools `consumes`, plan P14): maneuvers, metamagic.
  const switches = new Set(
    [
      ...effectsOfType(ctx.collected, 'toggle'),
      // A damage rider that pays it (Psionic Strike) is added on the attack instead.
      ...effectsOfType(ctx.collected, 'damageRider').filter(({ effect }) => effect.cost),
    ].map(({ source }) => `${source.ref.kind}:${source.ref.id}`),
  );
  for (const owner of ctx.collected.owners) {
    const entity = ctx.index.get(owner.ref);
    const consumes = entity && 'consumes' in entity ? entity.consumes : undefined;
    if (!consumes) continue;
    // A mapping that gives the feature its own action (with its roll or DC), or a switch or
    // damage rider that pays the cost, replaces this one.
    if (out.some((a) => a.source?.kind === owner.ref.kind && a.source.id === owner.ref.id))
      continue;
    if (switches.has(`${owner.ref.kind}:${owner.ref.id}`)) continue;
    const resource = findResourceByName(resources, consumes.name);
    const amount = consumes.amount ?? 1;
    out.push({
      id: `${owner.ref.kind}:${owner.ref.id}#consumes`,
      name: owner.name,
      actionType: 'other',
      sourceName: owner.name,
      source: owner.ref,
      costs: [
        {
          label: `${amount} ${resource?.name ?? consumes.name}`,
          amount,
          ...(resource ? { resourceKey: resource.key } : {}),
        },
      ],
      outcomes: [],
      attackIds: [],
    });
  }

  for (const { name, actionType } of STANDARD_ACTIONS) {
    const id = ruleId('action', name, 'XPHB');
    out.push({
      id,
      name,
      actionType,
      sourceName: 'Rules',
      source: { kind: 'rule', id },
      standard: true,
      costs: [],
      outcomes: [],
      attackIds: standardAttacks(name, attacks),
    });
  }
  return out;
}

export function deriveToggles(
  ctx: DeriveContext,
  resources: readonly DerivedResource[],
): DerivedToggle[] {
  return effectsOfType(ctx.collected, 'toggle').map(({ effect, source }) => {
    const active = ctx.character.state.activeToggles[effect.toggleId];
    const t: DerivedToggle = {
      toggleId: effect.toggleId,
      name: effect.name,
      source: source.ref,
      sourceName: source.name,
      active: !!active,
      options: (effect.options ?? []).map((o) => ({ id: o.id, name: o.name })),
      costs: (effect.cost ?? []).map((c) => costOf(ctx, c, resources, source)),
      onActivate: outcomesOf(ctx, effect.onActivate, resources, source),
      endsOn: effect.endsOn ?? [],
    };
    if (active?.option) t.option = active.option;
    if (effect.group) t.group = effect.group;
    return t;
  });
}
