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
}

export interface QuickBuildDeps {
  /** All content the build may use (a fixture index, or everything imported). */
  index: ContentIndex;
  catalog: Catalog;
  registry?: FeatureEffectsMap;
  now?: number;
}

/** Rounds of "derive, pick what is pending" per level; picks can reveal new choices. */
const MAX_ROUNDS = 8;

/** Make every pending pick, round after round, until nothing more can be filled. */
export function fillPending(
  c: Character,
  deps: QuickBuildDeps,
): { character: Character; sheet: DerivedSheet } {
  let character = c;
  let sheet = derive(character, deps.index, deps.registry ? { registry: deps.registry } : {});
  for (let round = 0; round < MAX_ROUNDS && sheet.choices.pending.length; round++) {
    let changed = false;
    for (const pending of sheet.choices.pending) {
      const need = pending.count - pending.have;
      const pick = autoChoose(pending.offer, need, {
        character,
        sheet,
        catalog: deps.catalog,
        index: deps.index,
      });
      if (!pick.values.length) continue;
      const existing = character.log
        .flatMap((e) => e.choices)
        .find((r) => encodeChoiceKey(r.key) === encodeChoiceKey(pending.offer.key));
      const values = [...(existing?.values ?? []), ...pick.values];
      const labels = [...(existing?.labels ?? []), ...(pick.labels ?? pick.values)];
      character = setChoice(character, pending.offer.key, values, {
        labels,
        ...(pick.valueKinds ? { valueKinds: pick.valueKinds } : {}),
        ...(deps.now !== undefined ? { now: deps.now } : {}),
      });
      changed = true;
    }
    if (!changed) break;
    sheet = derive(character, deps.index, deps.registry ? { registry: deps.registry } : {});
  }
  return { character, sheet };
}

function equip(c: Character, deps: QuickBuildDeps): Character {
  let character = c;
  const origin = c.log[0]?.origin;
  const owners: { ref: Ref; options: ClassDef['startingEquipment'] }[] = [];
  const cls = deps.index.get({ kind: 'class', id: c.log[0]?.classRef.id ?? '' });
  if (cls) owners.push({ ref: { kind: 'class', id: cls.id }, options: cls.startingEquipment });
  const bg = origin
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
  return c;
}
