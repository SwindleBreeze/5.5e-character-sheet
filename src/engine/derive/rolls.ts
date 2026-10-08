// Proficiencies and d20 rolls (plan §9.2, step 3.5; P9): saves, checks, skills, initiative,
// passives, concentration and death saves, with roll modifiers and exhaustion.

import {
  ABILITIES,
  SKILL_ABILITY,
  SKILLS,
  type Ability,
  type Id,
  type ProficiencyCategory,
  type RollTarget,
  type Skill,
} from '../../schema/index.ts';
import { choiceKey } from '../collect/collect.ts';
import type { EffectSource } from '../collect/types.ts';
import { formatValue, isDice } from '../formula/dice.ts';
import type { AttackTraits } from '../static/attackTraits.ts';
import { resolveBound } from '../static/bound.ts';
import {
  contribution,
  derived,
  effectsOfType,
  evalValue,
  valuesOf,
  withOverride,
  type DeriveContext,
} from './context.ts';
import type { Contribution, DerivedRoll, DerivedSkill, SourcedValue } from './types.ts';

export interface Proficiencies {
  saves: Set<Ability>;
  skills: Map<Skill, 'proficient' | 'expertise'>;
  armor: Map<string, string[]>;
  weapons: Map<string, string[]>;
  tools: Map<string, string[]>;
  languages: Map<string, string[]>;
  /** Base weapon ids whose mastery property the character can use. */
  masteries: Map<Id, string[]>;
}

const SKILL_SET = new Set<string>(SKILLS);

function add(map: Map<string, string[]>, value: string, source: string) {
  const key = value.toLowerCase();
  const sources = map.get(key) ?? [];
  if (!sources.includes(source)) sources.push(source);
  map.set(key, sources);
}

export function collectProficiencies(ctx: DeriveContext): Proficiencies {
  const p: Proficiencies = {
    saves: new Set(),
    skills: new Map(),
    armor: new Map(),
    weapons: new Map(),
    tools: new Map(),
    languages: new Map(),
    masteries: new Map(),
  };
  const values = (source: EffectSource, slot: string) =>
    valuesOf(ctx.recon, choiceKey(source.ref, slot, source.n));
  const give = (category: ProficiencyCategory, value: string, source: EffectSource) => {
    switch (category) {
      case 'save':
        p.saves.add(value as Ability);
        break;
      case 'skill':
        if (!p.skills.has(value as Skill)) p.skills.set(value as Skill, 'proficient');
        break;
      case 'armor':
        add(p.armor, value, source.name);
        break;
      case 'weapon':
        add(p.weapons, value, source.name);
        break;
      case 'tool':
        add(p.tools, value, source.name);
        break;
      case 'language':
        add(p.languages, value, source.name);
        break;
    }
  };
  const expert = (skill: string) => p.skills.set(skill as Skill, 'expertise');

  for (const { effect, source } of ctx.collected.effects) {
    switch (effect.type) {
      case 'proficiency': {
        const value = resolveBound(effect.value, source, (k) => valuesOf(ctx.recon, k));
        if (value) give(effect.category, value, source);
        break;
      }
      case 'proficiencyChoice':
        for (const value of values(source, effect.choice.slot)) {
          const categories = Array.isArray(effect.category) ? effect.category : [effect.category];
          // A pick from several categories (skill or tool) goes where it belongs.
          const category =
            categories.length === 1
              ? categories[0]!
              : SKILL_SET.has(value) && categories.includes('skill')
                ? 'skill'
                : (categories.find((c) => c !== 'skill') ?? 'tool');
          give(category, value, source);
        }
        break;
      case 'expertise': {
        const skill = resolveBound(effect.skill, source, (k) => valuesOf(ctx.recon, k));
        if (skill) expert(skill);
        break;
      }
      case 'expertiseChoice':
        values(source, effect.choice.slot).forEach(expert);
        break;
      case 'weaponMasteryChoice':
        for (const id of values(source, effect.choice.slot)) add(p.masteries, id, source.name);
        break;
      default:
        break;
    }
  }
  return p;
}

export type RollKind =
  | { type: 'save'; ability: Ability }
  | { type: 'check'; ability: Ability; skill?: Skill }
  | { type: 'initiative' }
  | { type: 'concentration' }
  | { type: 'death' }
  /** `attack:<x>` matches `all`, or the attack's source, range, ability or one of its tags. */
  | { type: 'attack'; traits: AttackTraits };

/** Whether a roll-modifier target applies to a roll. Initiative is a Dexterity check. */
export function targetMatches(target: RollTarget, kind: RollKind): boolean {
  switch (kind.type) {
    case 'save':
      return target === `save:${kind.ability}` || target === 'save:all';
    case 'concentration':
      return target === 'save:con' || target === 'save:all' || target === 'save:concentration';
    case 'death':
      return target === 'save:death' || target === 'save:all';
    case 'check':
      return (
        target === `check:${kind.ability}` || (!!kind.skill && target === `skill:${kind.skill}`)
      );
    case 'initiative':
      return target === 'initiative' || target === 'check:dex';
    case 'attack': {
      if (!target.startsWith('attack:')) return false;
      const what = target.slice('attack:'.length);
      const t = kind.traits;
      return (
        what === 'all' ||
        what === t.source ||
        what === t.range ||
        what === t.ability ||
        t.tags.includes(what)
      );
    }
  }
}

/** The ability a roll involves, when one does. Initiative is a Dexterity check. */
function rollAbility(kind: RollKind): Ability | undefined {
  switch (kind.type) {
    case 'save':
    case 'check':
      return kind.ability;
    case 'initiative':
      return 'dex';
    case 'concentration':
      return 'con';
    case 'attack':
      return kind.traits.ability;
    case 'death':
      return undefined;
  }
}

/** One d20 roll: base parts, proficiency, roll modifiers, exhaustion. */
export function buildRoll(
  ctx: DeriveContext,
  kind: RollKind,
  base: Contribution[],
  proficiency: 'none' | 'proficient' | 'expertise',
  pb: number,
): DerivedRoll {
  const parts = [...base];
  let level: DerivedRoll['proficiency'] = proficiency;
  if (proficiency === 'proficient') parts.push({ label: 'Proficiency', value: pb });
  else if (proficiency === 'expertise') parts.push({ label: 'Expertise', value: pb * 2 });
  else {
    const half = effectsOfType(ctx.collected, 'halfProficiency').find((a) =>
      a.effect.targets.some((t) => targetMatches(t, kind)),
    );
    if (half) {
      parts.push(
        contribution(`${half.source.name} (half proficiency)`, Math.floor(pb / 2), half.source),
      );
      level = 'half';
    }
  }

  const dice: DerivedRoll['dice'] = [];
  for (const { effect, source } of effectsOfType(ctx.collected, 'rollBonus')) {
    if (!targetMatches(effect.target, kind)) continue;
    const v = evalValue(ctx, effect.value, source);
    if (isDice(v)) dice.push({ label: source.name, dice: formatValue(v) });
    else parts.push(contribution(source.name, v, source));
  }

  const advantage: string[] = [];
  const disadvantage: string[] = [];
  for (const { effect, source } of effectsOfType(ctx.collected, 'rollMode')) {
    if (!targetMatches(effect.target, kind)) continue;
    (effect.mode === 'advantage' ? advantage : disadvantage).push(effect.note ?? source.name);
  }
  // Armor without training: Disadvantage on D20 Tests that involve Strength or Dexterity.
  const ability = rollAbility(kind);
  if (ctx.gear?.untrainedArmor && (ability === 'str' || ability === 'dex')) {
    disadvantage.push(`${ctx.gear.untrainedArmor} without armor training`);
  }
  if (ctx.gear?.stealthArmor && kind.type === 'check' && kind.skill === 'stealth') {
    disadvantage.push(ctx.gear.stealthArmor);
  }

  let floor: number | undefined;
  for (const { effect } of effectsOfType(ctx.collected, 'rollFloor')) {
    if (effect.proficientOnly && proficiency === 'none') continue;
    if (targetMatches(effect.target, kind)) floor = Math.max(floor ?? 0, effect.value);
  }

  const exhaustion = ctx.character.state.exhaustion;
  if (exhaustion > 0) parts.push({ label: `Exhaustion ${exhaustion}`, value: -2 * exhaustion });

  const roll: DerivedRoll = {
    bonus: derived(parts),
    dice,
    proficiency: level,
    mode:
      advantage.length && !disadvantage.length
        ? 'advantage'
        : disadvantage.length && !advantage.length
          ? 'disadvantage'
          : 'normal',
    advantage,
    disadvantage,
  };
  if (floor !== undefined) roll.floor = floor;
  return roll;
}

export interface RollSet {
  saves: Record<Ability, DerivedRoll>;
  checks: Record<Ability, DerivedRoll>;
  skills: Record<Skill, DerivedSkill>;
  initiative: DerivedRoll;
  concentration: DerivedRoll;
  deathSave: DerivedRoll;
}

export function deriveRolls(
  ctx: DeriveContext,
  mods: Record<Ability, number>,
  profs: Proficiencies,
  pb: number,
): RollSet {
  const modPart = (a: Ability): Contribution => ({
    label: `${a.toUpperCase()} modifier`,
    value: mods[a],
  });
  const saves = {} as Record<Ability, DerivedRoll>;
  const checks = {} as Record<Ability, DerivedRoll>;
  for (const a of ABILITIES) {
    const save = buildRoll(
      ctx,
      { type: 'save', ability: a },
      [modPart(a)],
      profs.saves.has(a) ? 'proficient' : 'none',
      pb,
    );
    saves[a] = { ...save, bonus: withOverride(save.bonus, ctx.character, `save.${a}`) };
    checks[a] = buildRoll(ctx, { type: 'check', ability: a }, [modPart(a)], 'none', pb);
  }

  const skills = {} as Record<Skill, DerivedSkill>;
  for (const skill of SKILLS) {
    const ability = SKILL_ABILITY[skill];
    const roll = buildRoll(
      ctx,
      { type: 'check', ability, skill },
      [modPart(ability)],
      profs.skills.get(skill) ?? 'none',
      pb,
    );
    const bonus = withOverride(roll.bonus, ctx.character, `skill.${skill}`);
    // Passive scores are not d20 tests: no exhaustion; advantage is +5, disadvantage −5.
    const passiveParts: Contribution[] = [
      { label: 'Base', value: 10, kind: 'base' },
      ...bonus.parts.filter((p) => !p.label.startsWith('Exhaustion')),
    ];
    if (roll.mode === 'advantage') passiveParts.push({ label: 'Advantage', value: 5 });
    if (roll.mode === 'disadvantage') passiveParts.push({ label: 'Disadvantage', value: -5 });
    const passiveBase = derived(passiveParts.filter((p) => p.kind !== 'override'));
    const passive = bonus.parts.some((p) => p.kind === 'override')
      ? derived([
          { label: 'Base', value: 10, kind: 'base' },
          { label: 'Your skill override', value: bonus.value },
        ])
      : passiveBase;
    skills[skill] = { ...roll, bonus, skill, ability, passive };
  }

  const initRoll = buildRoll(ctx, { type: 'initiative' }, [modPart('dex')], 'none', pb);
  for (const { effect, source } of effectsOfType(ctx.collected, 'initiativeBonus')) {
    const v = evalValue(ctx, effect.value, source);
    if (!isDice(v)) initRoll.bonus.parts.push(contribution(source.name, v, source));
  }
  initRoll.bonus = withOverride(derived(initRoll.bonus.parts), ctx.character, 'initiative');

  const conProf = profs.saves.has('con') ? 'proficient' : 'none';
  return {
    saves,
    checks,
    skills,
    initiative: initRoll,
    concentration: buildRoll(ctx, { type: 'concentration' }, [modPart('con')], conProf, pb),
    deathSave: buildRoll(ctx, { type: 'death' }, [], 'none', pb),
  };
}

export function sourced(map: Map<string, string[]>): SourcedValue[] {
  return [...map].map(([value, sources]) => ({ value, sources }));
}
