// The quick-builder (plan §9.2, step 3.10): a whole character from a few choices, with every
// other pick made automatically. For trying the sheet before the creation wizard exists, and
// for checking that real content builds without gaps.

import {
  encodeChoiceKey,
  type Character,
  type ClassDef,
  type Id,
  type Ref,
} from '../../schema/index.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import { derive } from '../derive/derive.ts';
import type { DerivedSheet } from '../derive/types.ts';
import type { FeatureEffectsMap } from '../featureEffects/types.ts';
import { matchesSpellFilter } from '../spells/filter.ts';
import { autoChoose } from './autoChoose.ts';
import {
  addLevel,
  applyEquipment,
  setChoice,
  setOrigin,
  setSubclass,
  standardArrayScores,
  startCharacter,
} from './build.ts';
import type { Catalog } from './catalog.ts';

export interface QuickBuildSpec {
  name: string;
  /** Classes in the order their levels are taken. */
  classes: { classId: Id; levels: number; subclassId?: Id }[];
  speciesId?: Id;
  backgroundId?: Id;
  /** Played by the 2014 rules (step 8.5). */
  ruleset?: '2014';
}

export interface QuickBuildDeps {
  /** All content the build may use (a fixture index, or everything imported). */
  index: ContentIndex;
  catalog: Catalog;
  registry?: FeatureEffectsMap;
  now?: number;
}

/** Picks per call, at most: picks can reveal new choices, but never this many. */
const MAX_PICKS = 200;

/**
 * Make every pending pick that can be filled. One pick at a time, deriving again after each,
 * so a pick sees the ones before it (a spell granted by one pick is not chosen again by the
 * next) and choices that picks reveal are filled too.
 */
export function fillPending(
  c: Character,
  deps: QuickBuildDeps,
): { character: Character; sheet: DerivedSheet } {
  const opts = deps.registry ? { registry: deps.registry } : {};
  let character = c;
  let sheet = derive(character, deps.index, opts);
  for (let step = 0; step < MAX_PICKS; step++) {
    let picked = false;
    for (const pending of sheet.choices.pending) {
      const pick = autoChoose(pending.offer, pending.count - pending.have, {
        character,
        sheet,
        catalog: deps.catalog,
        index: deps.index,
      });
      if (!pick.values.length) continue;
      const existing = character.log
        .flatMap((e) => e.choices)
        .find((r) => encodeChoiceKey(r.key) === encodeChoiceKey(pending.offer.key));
      character = setChoice(
        character,
        pending.offer.key,
        [...(existing?.values ?? []), ...pick.values],
        {
          labels: [...(existing?.labels ?? []), ...(pick.labels ?? pick.values)],
          ...(pick.valueKinds ? { valueKinds: pick.valueKinds } : {}),
          ...(deps.now !== undefined ? { now: deps.now } : {}),
        },
      );
      picked = true;
      break;
    }
    if (!picked) break;
    sheet = derive(character, deps.index, opts);
  }
  return { character, sheet };
}

/**
 * Prepare spells for casters that prepare after a Long Rest (plan §9.1), up to their limit:
 * the lowest-level spells first, from the spellbook when there is one, else from the list.
 * Expects nothing prepared yet (it replaces the list).
 */
export function prepareSpells(c: Character, sheet: DerivedSheet, catalog: Catalog): Character {
  const n = structuredClone(c);
  for (const caster of sheet.spellcasting.casters) {
    if (caster.preparedChange !== 'restLong') continue;
    const always = new Set(caster.alwaysPrepared);
    // Spells the caster's features grant already count toward the limit (plan §9.1).
    const already = caster.prepared.filter((id) => !always.has(id));
    const taken = new Set([...always, ...already]);
    const pool =
      caster.spellbook ??
      catalog
        .of('spell')
        .filter(
          (s) =>
            s.level >= 1 &&
            s.level <= caster.maxSpellLevel &&
            (caster.list.ids.includes(s.id) ||
              caster.list.filters.some((f) => matchesSpellFilter(s, f))),
        )
        .map((s) => s.id);
    const level = (id: string) => catalog.of('spell').find((s) => s.id === id)?.level ?? 0;
    n.state.prepared[caster.key] = pool
      .filter((id) => !taken.has(id) && level(id) <= caster.maxSpellLevel)
      .sort((a, b) => level(a) - level(b))
      .slice(0, Math.max(0, caster.preparedMax - already.length));
  }
  return n;
}

function equip(c: Character, deps: QuickBuildDeps): Character {
  let character = c;
  const origin = c.log[0]?.origin;
  const owners: { ref: Ref; options: ClassDef['startingEquipment'] }[] = [];
  const cls = deps.index.get({ kind: 'class', id: c.log[0]?.classRef.id ?? '' });
  if (cls) owners.push({ ref: { kind: 'class', id: cls.id }, options: cls.startingEquipment });
  const bg = origin?.backgroundRef
    ? deps.index.get({ kind: 'background', id: origin.backgroundRef.id })
    : undefined;
  if (bg) owners.push({ ref: { kind: 'background', id: bg.id }, options: bg.equipment });
  for (const { ref, options } of owners) {
    const record = c.log[0]?.choices.find(
      (r) => r.key.owner.id === ref.id && r.key.slot.startsWith('equipment'),
    );
    const option = options.find((o) => o.key === record?.values[0]);
    if (option) character = applyEquipment(character, option, deps.index, deps.now);
  }
  return character;
}

export function quickBuild(spec: QuickBuildSpec, deps: QuickBuildDeps): Character {
  const [first] = spec.classes;
  if (!first) throw new Error('A character needs a class');
  const firstClass = deps.index.get({ kind: 'class', id: first.classId });
  let c = startCharacter(spec.name, { kind: 'class', id: first.classId }, deps.now);
  if (spec.ruleset) c.ruleset = spec.ruleset;
  if (spec.speciesId && spec.backgroundId) {
    c = setOrigin(
      c,
      { kind: 'species', id: spec.speciesId },
      { kind: 'background', id: spec.backgroundId },
    );
  }
  c.baseScores = standardArrayScores(firstClass?.primaryAbility[0] ?? []);

  let levels = 0;
  for (const entry of spec.classes) {
    const cls = deps.index.get({ kind: 'class', id: entry.classId });
    for (let l = 1; l <= entry.levels; l++) {
      if (levels > 0) c = addLevel(c, { kind: 'class', id: entry.classId });
      levels++;
      if (cls && l === cls.subclassLevel) {
        const subclassId =
          entry.subclassId ?? deps.catalog.of('subclass').find((s) => s.classId === cls.id)?.id;
        if (subclassId) c = setSubclass(c, cls, { kind: 'subclass', id: subclassId });
      }
      c = fillPending(c, deps).character;
      if (levels === 1) c = equip(c, deps);
    }
  }
  const sheet = derive(c, deps.index, deps.registry ? { registry: deps.registry } : {});
  return prepareSpells(c, sheet, deps.catalog);
}
