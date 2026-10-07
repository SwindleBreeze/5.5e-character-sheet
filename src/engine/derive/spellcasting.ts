// Spellcasting (plan §9.2, step 3.7; P11): casters with their DC, attack, cantrips and spells,
// spell slots (multiclass table, Pact Magic apart), spells granted by other features, and
// cantrip attacks.

import {
  refKey,
  type Ability,
  type ClassDef,
  type ClassSpellcasting,
  type Effect,
  type Id,
  type Item,
  type Spell,
  type Subclass,
} from '../../schema/index.ts';
import { choiceKey } from '../collect/collect.ts';
import type { EffectSource } from '../collect/types.ts';
import { formatValue, isDice } from '../formula/dice.ts';
import { cellToValue } from '../formula/evaluate.ts';
import { casterLevelShare, MULTICLASS_SLOTS, pactSlots, slotRow } from '../rules/slots.ts';
import {
  cantripCount,
  casterList,
  maxSpellLevel,
  prepSwapLimit,
  preparedCount,
} from '../spells/casters.ts';
import { matchesSpellFilter } from '../spells/filter.ts';
import type { AttackTraits } from '../static/attackTraits.ts';
import { resolveBound } from '../static/bound.ts';
import {
  contribution,
  derived,
  effectsOfType,
  evalNumber,
  valuesOf,
  type DeriveContext,
} from './context.ts';
import { buildRoll } from './rolls.ts';
import { findResource, findResourceByName } from './resources.ts';
import type {
  Contribution,
  DerivedAttack,
  DerivedResource,
  DerivedCaster,
  DerivedGrantedSpell,
  DerivedSlot,
  DerivedSpellcasting,
} from './types.ts';

type Mods = Record<Ability, number>;
type GrantEffect = Extract<Effect, { type: 'grantSpells' }>;

const SPELL_TRAITS: AttackTraits = { range: 'ranged', source: 'spell', properties: [], tags: [] };

interface CasterInput {
  key: string;
  name: string;
  classId?: Id;
  level: number;
  ability: Ability;
  sc: ClassSpellcasting;
  owner?: ClassDef | Subclass;
  /** Which effect sources feed this caster's spells. */
  owns: (source: EffectSource) => boolean;
  listFilters: string[];
}

/** Items in use that improve spellcasting (a Wand of the War Mage, a Rod of the Pact Keeper). */
function itemSpellBonus(ctx: DeriveContext, bonus: 'spellAttack' | 'spellSaveDc'): Contribution[] {
  const out: Contribution[] = [];
  for (const row of ctx.character.inventory) {
    if (!row.equipped || !row.itemRef) continue;
    const item = ctx.index.get({ kind: 'item', id: row.itemRef.id });
    if (item?.attunement && !row.attuned) continue;
    const variant: Item | undefined = row.variantRef
      ? ctx.index.get({ kind: 'item', id: row.variantRef.id })
      : undefined;
    const value = (item?.bonuses?.[bonus] ?? 0) + (variant?.bonuses?.[bonus] ?? 0);
    if (value)
      out.push({ label: variant?.name ?? item?.name ?? row.name, value, source: row.itemRef });
  }
  return out;
}

function casterInputs(ctx: DeriveContext): CasterInput[] {
  const out: CasterInput[] = [];
  for (const c of ctx.st.classes) {
    const sc = c.cls?.spellcasting;
    if (c.cls && sc) {
      out.push({
        key: c.classId,
        name: c.cls.name,
        classId: c.classId,
        level: c.level,
        ability: sc.ability,
        sc,
        owner: c.cls,
        // A subclass that casts on its own keeps its spells (Eldritch Knight).
        owns: (s) => s.classId === c.classId && !(c.subclass?.spellcasting && s.subclassId),
        listFilters: [casterList(c.cls)],
      });
    }
    const subSc = c.subclass?.spellcasting;
    if (c.subclass && subSc) {
      const sub = c.subclass;
      out.push({
        key: sub.id,
        name: sub.name,
        classId: c.classId,
        level: c.level,
        ability: subSc.ability,
        sc: subSc,
        owner: sub,
        owns: (s) => s.subclassId === sub.id,
        listFilters: [casterList(sub)],
      });
    }
  }
  for (const { effect, source } of effectsOfType(ctx.collected, 'spellcasting')) {
    const ability = resolveBound(effect.ability, source, (k) => valuesOf(ctx.recon, k));
    if (!ability) continue;
    const ownerEntity = effect.tableOwner ? ctx.index.get(effect.tableOwner) : undefined;
    const owner =
      ownerEntity?.kind === 'class' || ownerEntity?.kind === 'subclass' ? ownerEntity : undefined;
    const level = source.classId ? (ctx.st.classLevels.get(source.classId) ?? 0) : ctx.st.charLevel;
    out.push({
      key: effect.casterKey,
      name: source.name,
      ...(source.classId ? { classId: source.classId } : {}),
      level,
      ability,
      sc: { ability, progression: effect.progression, ...(owner?.spellcasting ?? {}) },
      ...(owner ? { owner } : {}),
      owns: (s) => s.ref.kind === source.ref.kind && s.ref.id === source.ref.id,
      listFilters: [effect.list],
    });
  }
  return out;
}

/** Fixed and picked spell ids of a grant. */
function grantIds(
  ctx: DeriveContext,
  grant: GrantEffect['spells'][number],
  source: EffectSource,
): Id[] {
  if ('id' in grant.spell) return [grant.spell.id];
  if ('slot' in grant.spell)
    return valuesOf(ctx.recon, choiceKey(source.ref, grant.spell.slot, source.n));
  return [];
}

function slotsFor(
  ctx: DeriveContext,
  casters: CasterInput[],
): { slots: DerivedSlot[]; pact?: DerivedSlot } {
  const slotCasters = casters.filter((c) => c.sc.progression !== 'pact');
  let row: number[] = [];
  if (slotCasters.length === 1) {
    const c = slotCasters[0]!;
    row = c.owner?.slotTable?.length
      ? slotRow(c.owner.slotTable, c.level)
      : slotRow(MULTICLASS_SLOTS, casterLevelShare(c.sc.progression, c.level));
  } else if (slotCasters.length > 1) {
    const level = slotCasters.reduce(
      (sum, c) => sum + casterLevelShare(c.sc.progression, c.level),
      0,
    );
    row = slotRow(MULTICLASS_SLOTS, level);
  }
  const used = ctx.character.state.slotsUsed;
  const slots = row
    .map((max, i) => ({ level: i + 1, max, used: Math.min(max, used[i] ?? 0) }))
    .filter((s) => s.max > 0);
  const pactCaster = casters.find((c) => c.sc.progression === 'pact');
  const pact = pactCaster ? pactSlots(pactCaster.owner, pactCaster.level) : undefined;
  return pact
    ? {
        slots,
        pact: {
          level: pact.level,
          max: pact.count,
          used: Math.min(pact.count, ctx.character.state.pactSlotsUsed),
        },
      }
    : { slots };
}

export function deriveSpellcasting(
  ctx: DeriveContext,
  mods: Mods,
  pb: number,
  resources: readonly DerivedResource[],
): { spellcasting: DerivedSpellcasting; spellAttacks: DerivedAttack[] } {
  const inputs = casterInputs(ctx);
  const grants = effectsOfType(ctx.collected, 'grantSpells');
  const spellMods = effectsOfType(ctx.collected, 'spellMod');
  const itemDc = itemSpellBonus(ctx, 'spellSaveDc');
  const itemAttack = itemSpellBonus(ctx, 'spellAttack');
  const spell = (id: Id): Spell | undefined => ctx.index.get({ kind: 'spell', id });

  const casters: DerivedCaster[] = inputs.map((c) => {
    const mod = mods[c.ability];
    const general = spellMods.filter(
      (m) => !m.effect.filter && (!m.effect.casterKey || m.effect.casterKey === c.key),
    );
    const dcParts: Contribution[] = [
      { label: 'Base', value: 8, kind: 'base' },
      { label: 'Proficiency', value: pb },
      { label: `${c.ability.toUpperCase()} modifier`, value: mod },
      ...itemDc,
      ...general.flatMap((m) =>
        m.effect.dcBonus === undefined
          ? []
          : [contribution(m.source.name, evalNumber(ctx, m.effect.dcBonus, m.source), m.source)],
      ),
    ];
    const attackParts: Contribution[] = [
      { label: `${c.ability.toUpperCase()} modifier`, value: mod },
      ...itemAttack,
      ...general.flatMap((m) =>
        m.effect.attackBonus === undefined
          ? []
          : [
              contribution(
                m.source.name,
                evalNumber(ctx, m.effect.attackBonus, m.source),
                m.source,
              ),
            ],
      ),
    ];

    const cantrips: Id[] = [];
    const known: Id[] = [];
    const book: Id[] = [];
    const always: Id[] = [];
    const listIds: Id[] = [];
    const listFilters = [...c.listFilters];
    for (const { effect, source } of grants) {
      if (!c.owns(source)) continue;
      for (const grant of effect.spells) {
        if (grant.uses !== undefined) continue; // free casts are listed with granted spells
        if ('all' in grant.spell) {
          if (grant.mode === 'expanded') listFilters.push(grant.spell.all);
          continue;
        }
        for (const id of grantIds(ctx, grant, source)) {
          if (grant.mode === 'spellbook') book.push(id);
          else if (grant.mode === 'alwaysPrepared') always.push(id);
          else if (grant.mode === 'expanded') listIds.push(id);
          else if (grant.mode === 'known') (spell(id)?.level === 0 ? cantrips : known).push(id);
        }
      }
    }

    const onList = (s: Spell, id: Id) =>
      listIds.includes(id) || listFilters.some((f) => matchesSpellFilter(s, f));
    const preparedChange = c.sc.preparedChange ?? 'restLong';
    const prepared =
      preparedChange === 'level'
        ? known
        : [...(ctx.character.state.prepared[c.key] ?? []), ...known];
    const owner = c.owner;
    const preparedMax = owner ? preparedCount(c.sc, owner, c.level) : known.length;
    const counted = prepared.filter((id) => !always.includes(id));
    if (counted.length > preparedMax) {
      ctx.issues.push({
        severity: 'warn',
        code: 'overPrepared',
        message: `${c.name}: ${counted.length} spells prepared, the limit is ${preparedMax}.`,
      });
    }

    const topLevel = owner ? maxSpellLevel(c.sc, owner, c.level) : 0;
    const spellbookCaster = !!c.sc.spellbookByLevel?.length;
    // Spells prepared as play state must be on the caster's list (a Wizard: in the spellbook)
    // and of a level it can prepare. Broken picks stay, with a warning (plan §9.1).
    if (preparedChange === 'restLong') {
      for (const id of ctx.character.state.prepared[c.key] ?? []) {
        const s = spell(id);
        if (!s) continue;
        if (s.level === 0 || s.level > topLevel) {
          ctx.issues.push({
            severity: 'warn',
            code: 'preparedLevel',
            message: `${c.name}: ${s.name} is a level ${s.level} spell; you can prepare spells of levels 1 to ${topLevel}.`,
            ref: { kind: 'spell', id },
          });
        } else if (spellbookCaster ? !book.includes(id) : !onList(s, id)) {
          ctx.issues.push({
            severity: 'warn',
            code: spellbookCaster ? 'notInSpellbook' : 'notOnList',
            message: spellbookCaster
              ? `${c.name}: ${s.name} isn't in your spellbook.`
              : `${c.name}: ${s.name} isn't on your spell list.`,
            ref: { kind: 'spell', id },
          });
        }
      }
    }
    const swapLimit = owner && preparedChange === 'restLong' ? prepSwapLimit(owner) : undefined;
    const swapsSinceRest = ctx.character.state.prepSwaps?.[c.key] ?? 0;
    if (swapLimit !== undefined && swapsSinceRest > swapLimit) {
      ctx.issues.push({
        severity: 'warn',
        code: 'prepSwaps',
        message: `${c.name}: ${swapsSinceRest} prepared spells replaced since your last Long Rest; you can replace ${swapLimit}.`,
      });
    }

    const out: DerivedCaster = {
      key: c.key,
      name: c.name,
      level: c.level,
      ability: c.ability,
      progression: c.sc.progression,
      preparedChange,
      dc: derived(dcParts),
      attack: buildRoll(
        ctx,
        { type: 'attack', traits: SPELL_TRAITS },
        attackParts,
        'proficient',
        pb,
      ),
      maxSpellLevel: topLevel,
      cantrips: [...new Set(cantrips)],
      cantripsMax: owner ? cantripCount(c.sc, owner, c.level) : cantrips.length,
      prepared: [...new Set(prepared)],
      preparedMax,
      ...(swapLimit !== undefined ? { swapLimit } : {}),
      swapsSinceRest,
      alwaysPrepared: [...new Set(always)],
      list: { filters: listFilters, ids: [...new Set(listIds)] },
    };
    if (c.classId) out.classId = c.classId;
    if (c.sc.spellbookByLevel?.length) out.spellbook = [...new Set(book)];
    return out;
  });

  // Spells from everything else: species, feats, gifts, items, and free casts.
  const granted: DerivedGrantedSpell[] = [];
  for (const { effect, source } of grants) {
    const caster = inputs.find((c) => c.owns(source));
    for (const grant of effect.spells) {
      if (caster && grant.uses === undefined) continue;
      if ('all' in grant.spell) continue;
      const ability = grantAbility(ctx, grant, source) ?? caster?.ability;
      for (const spellId of grantIds(ctx, grant, source)) {
        const g: DerivedGrantedSpell = {
          spellId,
          source: source.ref,
          sourceName: source.name,
          mode: grant.mode,
        };
        if (ability) {
          g.ability = ability;
          g.dc = 8 + pb + mods[ability];
          g.attackBonus = pb + mods[ability];
        }
        const uses = grant.uses;
        if (uses !== undefined) {
          g.uses = uses;
          if (typeof uses === 'object' && 'count' in uses) {
            g.usesMax = Math.max(0, Math.floor(evalNumber(ctx, uses.count, source)));
            g.usesKey = `${refKey(source.ref)}${source.n === undefined ? '' : `@${source.n}`}#spell:${spellId}`;
            g.usesUsed = Math.min(g.usesMax, ctx.character.state.resourcesUsed[g.usesKey] ?? 0);
          } else if (typeof uses === 'object') {
            const r =
              'resource' in uses
                ? findResource(resources, uses.resource, source.ref)
                : findResourceByName(resources, uses.resourceName);
            if (r) g.resourceKey = r.key;
            g.cost = uses.cost;
          }
        }
        if (grant.castAtLevel !== undefined) g.castAtLevel = grant.castAtLevel;
        granted.push(g);
      }
    }
  }

  // Cantrips that attack or force a save, as attacks.
  const spellAttacks: DerivedAttack[] = [];
  const cantripAttack = (
    id: Id,
    ability: Ability,
    key: string,
    dc: number,
    attack: DerivedCaster['attack'],
  ) => {
    const s = spell(id);
    if (!s || s.level !== 0 || (!s.attack && !s.saves?.length)) return;
    const scaling = s.scaling?.[0];
    const step = scaling
      ? Object.keys(scaling.byLevel)
          .map(Number)
          .filter((l) => l <= ctx.st.charLevel)
          .sort((a, b) => b - a)[0]
      : undefined;
    const dice = scaling && step !== undefined ? cellToValue(scaling.byLevel[step]) : 0;
    const damageParts: Contribution[] = [];
    for (const { effect, source } of spellMods) {
      if (
        effect.damageBonus === undefined ||
        !effect.filter ||
        !matchesSpellFilter(s, effect.filter)
      )
        continue;
      if (effect.casterKey && effect.casterKey !== key) continue;
      damageParts.push(
        contribution(source.name, evalNumber(ctx, effect.damageBonus, source), source),
      );
    }
    const unit = s.time[0]?.unit;
    const a: DerivedAttack = {
      id: `spell:${key}:${id}`,
      name: s.name,
      kind: 'spell',
      use: {
        kind: 'cast',
        time: unit === 'action' || unit === 'bonus' || unit === 'reaction' ? unit : 'other',
      },
      spellRef: { kind: 'spell', id },
      ready: true,
      range: s.attack === 'melee' ? 'melee' : 'ranged',
      distance: s.range.distance?.amount
        ? `${s.range.distance.amount} ft.`
        : (s.range.distance?.type ?? s.range.type),
      ability,
      proficient: true,
      damageDice: isDice(dice) ? formatValue(dice) : '',
      damageBonus: derived(damageParts),
      damageType: s.damageTypes?.[0] ?? '',
      critRange: 20,
      propertyIds: [],
      riders: [],
      notes: [],
    };
    if (s.attack) a.toHit = attack;
    else if (s.saves?.[0])
      a.save = {
        ability: s.saves[0],
        dc: { value: dc, parts: [{ label: 'Spell save DC', value: dc }] },
      };
    spellAttacks.push(a);
  };
  for (const c of casters) {
    for (const id of [...c.cantrips, ...c.alwaysPrepared])
      cantripAttack(id, c.ability, c.key, c.dc.value, c.attack);
  }
  for (const g of granted) {
    if (!g.ability) continue;
    const attack = buildRoll(
      ctx,
      { type: 'attack', traits: SPELL_TRAITS },
      [{ label: `${g.ability.toUpperCase()} modifier`, value: mods[g.ability] }],
      'proficient',
      pb,
    );
    cantripAttack(g.spellId, g.ability, `${g.source.kind}:${g.source.id}`, g.dc ?? 0, attack);
  }

  return { spellcasting: { casters, ...slotsFor(ctx, inputs), granted }, spellAttacks };
}

/** The ability a granted spell uses: fixed, picked, or the one the same feat increased. */
function grantAbility(
  ctx: DeriveContext,
  grant: GrantEffect['spells'][number],
  source: EffectSource,
): Ability | undefined {
  const a = grant.ability;
  if (!a) return undefined;
  if (typeof a === 'object') {
    return valuesOf(ctx.recon, choiceKey(source.ref, a.slot, source.n))[0] as Ability | undefined;
  }
  if (a === 'inherit') {
    const choice = ctx.collected.effects.find(
      (e) =>
        e.effect.type === 'abilityChoice' &&
        e.source.ref.id === source.ref.id &&
        e.source.n === source.n,
    );
    if (!choice || choice.effect.type !== 'abilityChoice') return undefined;
    return valuesOf(ctx.recon, choiceKey(source.ref, choice.effect.choice.slot, source.n))[0] as
      Ability | undefined;
  }
  return a;
}
