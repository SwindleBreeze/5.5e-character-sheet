// Effect collection (plan §9.2, step 3.3): walk everything that gives the character effects, in
// a fixed order, and flatten level gates, choice-dependent effects, predicates and active
// toggles. Along the way, every choice the content offers becomes an Offer keyed by its owner
// and slot (plan §4.4). Pure: no derived numbers are read here (plan §8.2 rule 1).

import {
  encodeChoiceKey,
  refKey,
  type Character,
  type ChoiceKey,
  type ClassDef,
  type ContentEntity,
  type Effect,
  type EquipmentOption,
  type Id,
  type LevelEntry,
  type Predicate,
  type ProficiencyCategory,
  type Ref,
  type Subclass,
} from '../../schema/index.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import { needsAttunement } from '../items/items.ts';
import { nestedFeatureRefs } from '../content/refs.ts';
import { childEffects } from '../effects/walk.ts';
import type { FeatureEffectsMap } from '../featureEffects/types.ts';
import { spellChoiceEffects } from '../spells/casters.ts';
import type { ClassLevel, Collected, EffectSource, Offer, RecordAt } from './types.ts';

/**
 * The slot of a record that grants its owner outright, outside any choice: a DM's gift, a
 * feat granted by the DM (plan §4.4, manual additions).
 */
export const GRANTED_SLOT = 'granted';

export interface CollectOptions {
  /** Hand-written feature effects, keyed by ref key (`classFeature:<id>`). */
  registry?: FeatureEffectsMap;
  /** P1: whether a predicate holds on the character's static state (step 3.4). */
  holds: (predicate: Predicate, source: EffectSource) => boolean;
}

/** Every record in the log by encoded key. A later record for the same key wins. */
export function indexRecords(log: readonly LevelEntry[]): Map<string, RecordAt> {
  const out = new Map<string, RecordAt>();
  log.forEach((entry, entryIndex) => {
    for (const record of entry.choices)
      out.set(encodeChoiceKey(record.key), { record, entryIndex });
  });
  return out;
}

export function choiceKey(owner: Ref, slot: string, n?: number): ChoiceKey {
  return n === undefined ? { owner, slot } : { owner, slot, n };
}

/** Class levels in the order the classes were first taken, with their subclasses. */
export function classLevels(character: Character, index: ContentIndex): ClassLevel[] {
  const byId = new Map<Id, ClassLevel>();
  character.log.forEach((entry, i) => {
    const id = entry.classRef.id;
    let info = byId.get(id);
    if (!info) {
      info = { classId: id, level: 0, isFirst: i === 0 };
      const cls = index.get({ kind: 'class', id });
      if (cls) info.cls = cls;
      byId.set(id, info);
    }
    info.level = Math.max(info.level, entry.classLevel);
    if (entry.subclassRef) {
      info.subclassId = entry.subclassRef.id;
      const sub = index.get({ kind: 'subclass', id: entry.subclassRef.id });
      if (sub) info.subclass = sub;
    }
  });
  return [...byId.values()];
}

function proficiencies(category: ProficiencyCategory, values: readonly string[]): Effect[] {
  return values.map((value) => ({ type: 'proficiency', category, value }));
}

const COUNT_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };

/** Tool kinds a class's tool text names, as `Item.toolType` values. */
const TOOL_KINDS: [RegExp, string][] = [
  [/artisan/, 'artisan'],
  [/musical instrument/, 'instrument'],
  [/gaming set/, 'gamingSet'],
];

/**
 * A class's tool proficiencies. Most are tool ids; a choice is text (2024 Bard: "choose three
 * musical instruments"; Monk: "choose one type of artisan's tools or musical instrument"),
 * which becomes a tool choice in `slot` (a second one in the same class gets `slot.2`).
 */
export function classToolEffects(tools: readonly string[], slot: string): Effect[] {
  const out: Effect[] = [];
  let choices = 0;
  for (const text of tools) {
    const m = /^(?:choose |any )?(one|two|three|four|five|\d+) (?:type of |kind of )?(.+)$/.exec(
      text,
    );
    const kinds = m ? TOOL_KINDS.filter(([re]) => re.test(m[2]!)).map(([, kind]) => kind) : [];
    if (!m || !kinds.length) {
      out.push({ type: 'proficiency', category: 'tool', value: text });
      continue;
    }
    choices++;
    out.push({
      type: 'proficiencyChoice',
      category: 'tool',
      choice: {
        slot: choices === 1 ? slot : `${slot}.${choices}`,
        count: COUNT_WORDS[m[1]!] ?? Number(m[1]),
        from: 'any',
      },
      filter: kinds.join('|'),
    });
  }
  return out;
}

/** Effects a class gives that its data stores as fields, not effects. */
function classFieldEffects(cls: ClassDef, isFirst: boolean): Effect[] {
  const out: Effect[] = [];
  if (isFirst) {
    out.push(...proficiencies('save', cls.saves));
    const start = cls.startingProficiencies;
    out.push(
      ...proficiencies('armor', start.armor),
      ...proficiencies('weapon', start.weapons),
      ...classToolEffects(start.tools, 'tools'),
    );
    if (start.skills)
      out.push({ type: 'proficiencyChoice', category: 'skill', choice: start.skills });
  } else {
    const gains = cls.multiclass.gains;
    out.push(
      ...proficiencies('armor', gains.armor),
      ...proficiencies('weapon', gains.weapons),
      ...classToolEffects(gains.tools, 'multiclassTools'),
    );
    if (gains.skills)
      out.push({ type: 'proficiencyChoice', category: 'skill', choice: gains.skills });
  }
  return out;
}

/** Starting equipment choices: one slot per option group (2024 content has one group). */
function equipmentGroups(options: readonly EquipmentOption[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const o of options) {
    const slot = o.group === undefined ? 'equipment' : `equipment.${o.group}`;
    groups.set(slot, [...(groups.get(slot) ?? []), o.key]);
  }
  return groups;
}

function equipmentOffers(
  owner: Ref,
  options: readonly EquipmentOption[],
  source: EffectSource,
): Offer[] {
  return [...equipmentGroups(options)].map(([slot, keys]) => ({
    key: choiceKey(owner, slot),
    kind: 'equipment' as const,
    count: 1,
    from: keys,
    source,
  }));
}

export function collectEffects(
  character: Character,
  index: ContentIndex,
  opts: CollectOptions,
): Collected {
  const records = indexRecords(character.log);
  const classes = classLevels(character, index);
  const charLevel = character.log.length;
  const levelOf = new Map(classes.map((c) => [c.classId, c.level]));
  const out: Collected = {
    effects: [],
    offers: [],
    owners: [],
    classes,
    charLevel,
    records,
    missing: [],
  };
  const seenOwners = new Set<string>();
  const offerKeys = new Set<string>();
  const featInstances = new Map<Id, number>();
  /** P8: toggle groups with an active toggle applied; a second one in a group is ignored. */
  const activeGroups = new Set<string>();

  const recordFor = (owner: Ref, slot: string, n?: number) =>
    records.get(encodeChoiceKey(choiceKey(owner, slot, n)))?.record;

  function offer(o: Offer) {
    const key = encodeChoiceKey(o.key);
    if (offerKeys.has(key)) return;
    offerKeys.add(key);
    out.offers.push(o);
  }

  function offersOf(effect: Effect, source: EffectSource, level: number) {
    const key = (slot: string) => choiceKey(source.ref, slot, source.n);
    const base = { source, effect };
    switch (effect.type) {
      case 'abilityChoice':
      case 'proficiencyChoice':
      case 'expertiseChoice':
      case 'resistanceChoice':
      case 'weaponMasteryChoice':
      case 'featureOptions': {
        const kind = {
          abilityChoice: 'ability',
          proficiencyChoice: 'proficiency',
          expertiseChoice: 'expertise',
          resistanceChoice: 'resistance',
          weaponMasteryChoice: 'weaponMastery',
          featureOptions: 'featureOptions',
        } as const;
        const c = effect.choice;
        offer({
          ...base,
          key: key(c.slot),
          kind: kind[effect.type],
          count: c.count,
          from: c.from as Offer['from'],
          ...(c.retrain ? { retrain: c.retrain } : {}),
        });
        break;
      }
      case 'optionChoice':
        offer({
          ...base,
          key: key(effect.choice.slot),
          kind: 'option',
          count: effect.choice.count,
          from: effect.choice.from as Offer['from'],
          labels: effect.labels,
        });
        break;
      case 'featChoice':
        offer({
          ...base,
          key: key(effect.slot),
          kind: 'feat',
          count: effect.count ?? 1,
          from: 'any',
        });
        break;
      case 'optionalFeatureChoice':
        offer({
          ...base,
          key: key(effect.slot),
          kind: 'optionalFeature',
          count: effect.count,
          from: 'any',
        });
        break;
      case 'grantSpells':
        for (const grant of effect.spells) {
          if (grant.atLevel !== undefined && grant.atLevel > level) continue;
          if (typeof grant.ability === 'object') {
            offer({
              ...base,
              key: key(grant.ability.slot),
              kind: 'spellAbility',
              count: 1,
              from: grant.ability.from,
            });
          }
          if ('slot' in grant.spell) {
            offer({
              ...base,
              key: key(grant.spell.slot),
              kind: 'spell',
              count: grant.spell.count,
              from: grant.spell.from ?? 'any',
              ...(grant.spell.retrain ? { retrain: grant.spell.retrain } : {}),
            });
          }
        }
        break;
      default:
        break;
    }
  }

  /**
   * A repeatable feat taken again gets an instance number (plan §4.4): the first time has
   * none, so its keys never change; the second time is `@2`, the third `@3`.
   */
  function featOwner(id: Id): { ref: Ref; n?: number } {
    const ref: Ref = { kind: 'feat', id };
    const feat = index.get({ kind: 'feat', id });
    if (!feat?.repeatable) return { ref };
    const taken = (featInstances.get(id) ?? 0) + 1;
    featInstances.set(id, taken);
    return taken === 1 ? { ref } : { ref, n: taken };
  }

  /** Entities the character's picks for this effect bring in as owners. */
  function followPicks(effect: Effect, source: EffectSource) {
    const picked = (slot: string) => recordFor(source.ref, slot, source.n)?.values ?? [];
    switch (effect.type) {
      case 'grantFeat': {
        const owner = featOwner(effect.feat.id);
        addOwner(owner.ref, { n: owner.n });
        break;
      }
      case 'featChoice':
        for (const id of picked(effect.slot)) {
          const owner = featOwner(id);
          addOwner(owner.ref, { n: owner.n });
        }
        break;
      case 'optionalFeatureChoice':
        for (const id of picked(effect.slot)) addOwner({ kind: 'optionalFeature', id }, {});
        break;
      case 'featureOptions': {
        // Options of a class feature belong to the same class.
        const ctx =
          effect.optionKind === 'classFeature' || effect.optionKind === 'subclassFeature'
            ? { classId: source.classId, subclassId: source.subclassId }
            : {};
        for (const id of picked(effect.choice.slot)) addOwner({ kind: effect.optionKind, id }, ctx);
        break;
      }
      default:
        break;
    }
  }

  function apply(effects: readonly Effect[], source: EffectSource) {
    const level = source.classId ? (levelOf.get(source.classId) ?? 0) : charLevel;
    for (const effect of effects) {
      switch (effect.type) {
        case 'atLevel':
          if (effect.level <= level) apply(effect.effects, source);
          continue;
        case 'ifChoice':
          if (recordFor(source.ref, effect.slot, source.n)?.values.includes(effect.value)) {
            apply(effect.effects, source);
          }
          continue;
        case 'when':
          if (opts.holds(effect.when, source)) apply(effect.effects, source);
          continue;
        case 'toggle': {
          out.effects.push({ effect, source });
          const active = character.state.activeToggles[effect.toggleId];
          const blocked = effect.group !== undefined && activeGroups.has(effect.group);
          if (active && !blocked) {
            if (effect.group !== undefined) activeGroups.add(effect.group);
            apply(effect.effects, source);
            const form = effect.options?.find((o) => o.id === active.option);
            if (form) apply(form.effects, source);
          }
          continue;
        }
        default:
          out.effects.push({ effect, source });
          offersOf(effect, source, level);
          followPicks(effect, source);
      }
    }
  }

  interface OwnerCtx {
    classId?: Id | undefined;
    subclassId?: Id | undefined;
    n?: number | undefined;
  }

  function addOwner(
    ref: Ref,
    ctx: OwnerCtx,
    fieldEffects: (e: ContentEntity) => Effect[] = () => [],
  ) {
    const ownerKey = `${refKey(ref)}@${ctx.n ?? ''}`;
    if (seenOwners.has(ownerKey)) return;
    seenOwners.add(ownerKey);

    const entity = index.get(ref);
    const snapshot = entity ? undefined : character.snapshots[refKey(ref)];
    if (!entity && !snapshot) {
      out.missing.push(ref);
      return;
    }
    const source: EffectSource = { ref, name: entity?.name ?? snapshot?.name ?? ref.id };
    if (ctx.classId) source.classId = ctx.classId;
    if (ctx.subclassId) source.subclassId = ctx.subclassId;
    if (ctx.n !== undefined) source.n = ctx.n;
    if (!entity) source.fromSnapshot = true;
    out.owners.push(source);

    const mapped = opts.registry?.[refKey(ref)]?.effects ?? [];
    apply(
      [...(entity ? fieldEffects(entity) : []), ...(entity ?? snapshot!).effects, ...mapped],
      source,
    );
  }

  /** A class or subclass feature, and the features written inside it (plan §9.2, 3.11). */
  function addFeature(ref: Ref, ctx: OwnerCtx, classLevel: number) {
    addOwner(ref, ctx);
    const entity = index.get(ref);
    if (!entity) return;
    for (const nested of nestedFeatureRefs(entity)) {
      // Only loaded ones: a nested ref that doesn't resolve is text, not a lost feature.
      const feature = index.get(nested);
      if (
        (feature?.kind === 'classFeature' || feature?.kind === 'subclassFeature') &&
        feature.level <= classLevel
      )
        addFeature(nested, ctx, classLevel);
    }
  }

  // 1. Classes, each with its features and subclass, in the order they were taken.
  for (const c of classes) {
    const classRef: Ref = { kind: 'class', id: c.classId };
    addOwner(classRef, { classId: c.classId }, (e) =>
      e.kind === 'class'
        ? [
            ...classFieldEffects(e, c.isFirst),
            ...(e.spellcasting ? spellChoiceEffects(e.spellcasting, e) : []),
          ]
        : [],
    );
    if (c.cls) {
      for (const f of c.cls.features) {
        if (f.level <= c.level)
          addFeature({ kind: 'classFeature', id: f.featureId }, { classId: c.classId }, c.level);
      }
      if (c.isFirst) {
        const source = out.owners.find((o) => o.ref.kind === 'class' && o.ref.id === c.classId);
        if (source) equipmentOffers(classRef, c.cls.startingEquipment, source).forEach(offer);
      }
    }
    if (c.subclassId) {
      const ctx = { classId: c.classId, subclassId: c.subclassId };
      addOwner({ kind: 'subclass', id: c.subclassId }, ctx, (e) =>
        e.kind === 'subclass' && e.spellcasting ? spellChoiceEffects(e.spellcasting, e) : [],
      );
      for (const f of (c.subclass as Subclass | undefined)?.features ?? []) {
        if (f.level <= c.level)
          addFeature({ kind: 'subclassFeature', id: f.featureId }, ctx, c.level);
      }
    }
  }

  // 2. Species and background.
  const origin = character.log[0]?.origin;
  if (origin) {
    addOwner(origin.speciesRef, {});
    addOwner(origin.backgroundRef, {});
    const background = index.get({ kind: 'background', id: origin.backgroundRef.id });
    const source = out.owners.find((o) => refKey(o.ref) === refKey(origin.backgroundRef));
    if (background && source) {
      const from = [...new Set(background.abilityOptions.flatMap((o) => o.from))];
      const count = Math.max(
        0,
        ...background.abilityOptions.map((o) => o.weights.reduce((a, b) => a + b, 0)),
      );
      if (from.length && count) {
        offer({
          key: choiceKey(origin.backgroundRef, 'ability'),
          kind: 'backgroundAbility',
          count,
          from,
          source,
        });
      }
      equipmentOffers(origin.backgroundRef, background.equipment, source).forEach(offer);
    }
  }

  // 3. Things granted outright (gifts, DM-granted feats).
  for (const { record } of records.values()) {
    if (record.key.slot !== GRANTED_SLOT) continue;
    const owner = record.key.owner;
    addOwner(owner.kind === 'feat' ? featOwner(owner.id).ref : owner, {});
  }

  // 4. Items in use: equipped or worn, and attuned when they need it.
  for (const row of character.inventory) {
    if (!row.equipped || !row.itemRef) continue;
    const item = index.get({ kind: 'item', id: row.itemRef.id });
    const variant = row.variantRef ? index.get({ kind: 'item', id: row.variantRef.id }) : undefined;
    if (needsAttunement(item, variant) && !row.attuned) continue;
    addOwner(row.itemRef, {});
    if (row.variantRef) addOwner(row.variantRef, {});
  }

  return out;
}

/** Choice slots an entity can offer at any level, for aliasing a missing owner (plan §4.4). */
/** Choice slots a list of effects declares, nested ones included, in order; repeats kept. */
export function effectSlots(effects: readonly Effect[]): string[] {
  const slots: string[] = [];
  const visit = (list: readonly Effect[]) => {
    for (const e of list) {
      switch (e.type) {
        case 'abilityChoice':
        case 'proficiencyChoice':
        case 'expertiseChoice':
        case 'resistanceChoice':
        case 'weaponMasteryChoice':
        case 'featureOptions':
        case 'optionChoice':
          slots.push(e.choice.slot);
          break;
        case 'featChoice':
        case 'optionalFeatureChoice':
          slots.push(e.slot);
          break;
        case 'grantSpells':
          for (const g of e.spells) {
            if (typeof g.ability === 'object') slots.push(g.ability.slot);
            if ('slot' in g.spell) slots.push(g.spell.slot);
          }
          break;
        default:
          break;
      }
      visit(childEffects(e));
    }
  };
  visit(effects);
  return slots;
}

export function entityOfferSlots(entity: ContentEntity): Set<string> {
  const slots = new Set<string>(effectSlots(entity.effects));
  if (entity.kind === 'class') {
    if (entity.startingProficiencies.skills) slots.add(entity.startingProficiencies.skills.slot);
    if (entity.multiclass.gains.skills) slots.add(entity.multiclass.gains.skills.slot);
    for (const slot of effectSlots([
      ...classToolEffects(entity.startingProficiencies.tools, 'tools'),
      ...classToolEffects(entity.multiclass.gains.tools, 'multiclassTools'),
    ]))
      slots.add(slot);
    for (const slot of equipmentGroups(entity.startingEquipment).keys()) slots.add(slot);
  }
  if (entity.kind === 'background') {
    if (entity.abilityOptions.length) slots.add('ability');
    for (const slot of equipmentGroups(entity.equipment).keys()) slots.add(slot);
  }
  return slots;
}
