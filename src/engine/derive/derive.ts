// derive(character, content) → DerivedSheet (plan §9.2). Pure. The stages follow §8.2: static
// state → effects and choices → abilities → proficiency bonus → rolls → AC → HP → speed,
// senses and defenses. Later steps add attacks, spellcasting, resources and actions.

import { proficiencyBonus, refKey, type Character } from '../../schema/index.ts';
import { reconcile } from '../choices/reconcile.ts';
import { collectEffects } from '../collect/collect.ts';
import type { Offer } from '../collect/types.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import { averageOf, isDice } from '../formula/dice.ts';
import { evaluateFormula } from '../formula/evaluate.ts';
import { FormulaError } from '../formula/parse.ts';
import type { FeatureEffectsMap } from '../featureEffects/types.ts';
import { buildStaticState, holds } from '../static/state.ts';
import { deriveAbilities } from './abilities.ts';
import { deriveAttacks } from './attacks.ts';
import { deriveActions, deriveToggles } from './actions.ts';
import { deriveFeatures } from './features.ts';
import { deriveInventory, gearState } from './inventory.ts';
import { deriveResources } from './resources.ts';
import { deriveSpellcasting } from './spellcasting.ts';
import {
  contribution,
  derived,
  effectsOfType,
  valuesOf,
  withOverride,
  type DeriveContext,
} from './context.ts';
import {
  deriveAc,
  deriveClasses,
  deriveDefenses,
  deriveHitDice,
  deriveHp,
  deriveSenses,
  deriveSize,
  deriveSpeed,
} from './defense.ts';
import { collectProficiencies, deriveRolls, sourced } from './rolls.ts';
import { makeScope, type ScopeContext } from './scope.ts';
import type { DerivedSheet, RuleIssue } from './types.ts';

export interface DeriveOptions {
  /** Hand-written feature effects (plan phase 6). */
  registry?: FeatureEffectsMap;
}

function countOf(scope: ScopeContext) {
  return (offer: Offer): number => {
    try {
      const v = evaluateFormula(offer.count, makeScope(scope, offer.source));
      return Math.max(0, Math.floor(isDice(v) ? averageOf(v) : v));
    } catch (err) {
      if (err instanceof FormulaError) return 0;
      throw err;
    }
  };
}

export function derive(
  character: Character,
  index: ContentIndex,
  opts: DeriveOptions = {},
): DerivedSheet {
  const st = buildStaticState(character, index);
  const collected = collectEffects(character, index, {
    ...(opts.registry ? { registry: opts.registry } : {}),
    holds: (p) => holds(p, st),
  });
  const issues: RuleIssue[] = [];

  const pbBase = proficiencyBonus(Math.max(1, st.charLevel));
  const pb = withOverride(
    derived([
      { label: `Level ${st.charLevel}`, value: pbBase, kind: 'base' },
      ...effectsOfType(collected, 'pbBonus').map(({ effect, source }) =>
        contribution(source.name, effect.value, source),
      ),
    ]),
    character,
    'pb',
  );
  const scope: ScopeContext = { charLevel: st.charLevel, pb: pb.value, classes: st.classes };

  // Choices first without ability scores: ability picks have plain counts.
  const early = reconcile(collected, character, index, countOf(scope));
  const ctx: DeriveContext = { character, index, collected, st, recon: early, scope, issues };
  const abilities = deriveAbilities(ctx);

  const scores = Object.fromEntries(
    Object.entries(abilities).map(([a, v]) => [a, v.score.value]),
  ) as Record<keyof typeof abilities, number>;
  ctx.scope = { ...scope, scores, valuesOf: (key) => valuesOf(ctx.recon, key) };
  ctx.recon = reconcile(collected, character, index, countOf(ctx.scope));
  const resources = deriveResources(ctx);
  ctx.scope = {
    ...ctx.scope,
    resourceMax: (id) => resources.find((r) => r.resourceId === id)?.max.value,
  };

  const mods = Object.fromEntries(Object.entries(abilities).map(([a, v]) => [a, v.mod])) as Record<
    keyof typeof abilities,
    number
  >;
  const profs = collectProficiencies(ctx);
  ctx.gear = gearState(ctx, profs);
  const rolls = deriveRolls(ctx, mods, profs, pb.value);
  const classes = deriveClasses(ctx);
  const { attacks, attacksPerAction } = deriveAttacks(
    ctx,
    scores,
    mods,
    profs,
    pb.value,
    resources,
  );
  const { spellcasting, spellAttacks } = deriveSpellcasting(ctx, mods, pb.value, resources);
  const allAttacks = [...attacks, ...spellAttacks];

  const size = deriveSize(ctx);
  const inventory = deriveInventory(ctx, scores.str, size, spellcasting);

  for (const c of st.classes) {
    if (c.cls && !c.subclassId && c.level >= c.cls.subclassLevel) {
      issues.push({
        severity: 'info',
        code: 'subclassMissing',
        message: `${c.cls.name} ${c.level}: choose a ${c.cls.subclassTitle}.`,
        ref: { kind: 'class', id: c.classId },
      });
    }
  }
  for (const row of st.wield.conflicts) {
    issues.push({
      severity: 'warn',
      code: 'equipConflict',
      message: `${row.name} can’t be equipped with what is already worn or held.`,
    });
  }
  for (const ref of collected.missing) {
    issues.push({
      severity: 'warn',
      code: 'contentMissing',
      message: `${ref.id} is not loaded.`,
      ref,
    });
  }

  const passive = (skill: 'perception' | 'insight' | 'investigation') =>
    withOverride(rolls.skills[skill].passive, character, `passive.${skill}`);

  const unbreakable = effectsOfType(collected, 'concentrationUnbreakable')[0];
  return {
    ...(unbreakable ? { concentrationUnbreakable: unbreakable.source.name } : {}),
    charLevel: st.charLevel,
    pb,
    classes,
    abilities,
    ...rolls,
    passives: {
      perception: passive('perception'),
      insight: passive('insight'),
      investigation: passive('investigation'),
    },
    ac: deriveAc(ctx, mods),
    hp: deriveHp(ctx, mods, classes),
    hitDice: deriveHitDice(ctx, classes),
    speed: deriveSpeed(
      ctx,
      scores.str,
      character.ignoreWeight
        ? undefined
        : {
            weight: inventory.weight.value,
            carry: inventory.carry.value,
            dragLiftPush: inventory.dragLiftPush,
          },
    ),
    senses: deriveSenses(ctx),
    defenses: deriveDefenses(ctx),
    proficiencies: {
      armor: sourced(profs.armor),
      weapons: sourced(profs.weapons),
      tools: sourced(profs.tools),
      languages: sourced(profs.languages),
    },
    size,
    inventory,
    attacks: allAttacks,
    attacksPerAction,
    spellcasting,
    resources,
    features: deriveFeatures(ctx, countOf(ctx.scope), resources),
    actions: deriveActions(ctx, resources, allAttacks),
    toggles: deriveToggles(ctx, resources),
    masteries: sourced(profs.masteries),
    conditions: character.state.conditions,
    exhaustion: character.state.exhaustion,
    choices: {
      pending: ctx.recon.pending,
      // A record with too few picks is an unfinished choice: it is listed under pending only.
      attention: ctx.recon.records.filter(
        (r) =>
          r.status !== 'ok' &&
          !(r.status === 'countMismatch' && r.at.record.values.length < (r.expected ?? 0)),
      ),
    },
    issues: dedupeIssues(issues),
  };
}

function dedupeIssues(issues: RuleIssue[]): RuleIssue[] {
  const seen = new Set<string>();
  return issues.filter((i) => {
    const key = `${i.code}|${i.message}|${i.ref ? refKey(i.ref) : ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
