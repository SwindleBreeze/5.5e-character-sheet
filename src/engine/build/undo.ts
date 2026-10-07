// Undo the last level (plan §9.4, step 5.3). The last log entry goes, with every pick made on
// it; what the lower level allows is then put right: picks left with more values than their
// slot now allows keep their first ones (Weapon Mastery back to two kinds), prepared lists are
// trimmed to the new limit, and spent slots, hit dice and uses are clamped to the new maximums.

import {
  encodeChoiceKey,
  type Character,
  type ChoiceRecord,
  type Id,
  type Ref,
} from '../../schema/index.ts';
import { valueKind } from '../content/refs.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import { derive } from '../derive/derive.ts';
import type { FeatureEffectsMap } from '../featureEffects/types.ts';

export interface UndoPreview {
  /** The level that goes. */
  charLevel: number;
  className: string;
  classLevel: number;
  /** The subclass chosen on it, which goes too. */
  subclass?: string;
  /** Every pick made on it: whose, and what. */
  picks: { owner: string; labels: string[]; manual: boolean }[];
}

function labelsOf(r: ChoiceRecord, index: ContentIndex): string[] {
  return r.values.map((v, i) => {
    const kind = valueKind(r.valueKinds, i);
    return (kind && index.get({ kind, id: v })?.name) || r.labels[i] || v;
  });
}

const nameOf = (index: ContentIndex, ref: Ref) => index.get(ref)?.name ?? ref.id;

/** What undoing the last level would remove; nothing for a level 1 character. */
export function undoPreview(c: Character, index: ContentIndex): UndoPreview | undefined {
  const last = c.log.at(-1);
  if (!last || c.log.length < 2) return undefined;
  return {
    charLevel: last.charLevel,
    className: nameOf(index, last.classRef),
    classLevel: last.classLevel,
    ...(last.subclassRef ? { subclass: nameOf(index, last.subclassRef) } : {}),
    picks: last.choices.map((r) => ({
      owner: nameOf(index, r.key.owner),
      labels: labelsOf(r, index),
      manual: r.via === 'manual',
    })),
  };
}

export interface UndoResult {
  character: Character;
  /** Picks cut to what their slot allows now: whose, and what was taken off. */
  trimmed: { owner: string; labels: string[] }[];
  /** Prepared spells that no longer fit, by caster name. */
  unprepared: { caster: string; spells: Id[] }[];
}

/** Remove the last level and put right what the lower level allows. */
export function undoLastLevel(
  c: Character,
  index: ContentIndex,
  registry?: FeatureEffectsMap,
): UndoResult {
  if (c.log.length < 2) return { character: c, trimmed: [], unprepared: [] };
  const opts = registry ? { registry } : {};
  const n = structuredClone(c);
  n.log.pop();

  // Picks now over their count keep their first values.
  const trimmed: UndoResult['trimmed'] = [];
  const before = derive(n, index, opts);
  for (const r of before.choices.attention) {
    if (r.status !== 'countMismatch' || r.expected === undefined) continue;
    const rec = r.at.record;
    if (rec.values.length <= r.expected) continue;
    const entry = n.log[r.at.entryIndex]!;
    const i = entry.choices.findIndex((x) => encodeChoiceKey(x.key) === r.key);
    if (i < 0) continue;
    const cut = { ...rec, values: rec.values.slice(r.expected) };
    trimmed.push({ owner: nameOf(index, rec.key.owner), labels: labelsOf(cut, index) });
    entry.choices[i] = {
      ...rec,
      values: rec.values.slice(0, r.expected),
      labels: rec.labels.slice(0, r.expected),
      ...(rec.valueKinds && rec.valueKinds.length > 1
        ? { valueKinds: rec.valueKinds.slice(0, r.expected) }
        : {}),
    };
  }

  const sheet = derive(n, index, opts);
  const state = n.state;

  // Prepared spells: none above the highest spell level now, and no more than the limit
  // (the ones prepared last go first).
  const unprepared: UndoResult['unprepared'] = [];
  for (const caster of sheet.spellcasting.casters) {
    const list = state.prepared[caster.key];
    if (!list) continue;
    const always = new Set(caster.alwaysPrepared);
    const level = (id: Id) => index.get({ kind: 'spell', id })?.level ?? 0;
    const fits = list.filter((id) => always.has(id) || level(id) <= caster.maxSpellLevel);
    let counted = 0;
    const kept = fits.filter((id) => always.has(id) || ++counted <= caster.preparedMax);
    const gone = list.filter((id) => !kept.includes(id));
    if (gone.length) {
      state.prepared[caster.key] = kept;
      unprepared.push({ caster: caster.name, spells: gone });
    }
  }

  // Spent slots, hit dice and uses: no more than there are now.
  const slotMax = new Map(sheet.spellcasting.slots.map((s) => [s.level, s.max]));
  state.slotsUsed = state.slotsUsed.map((used, i) => Math.min(used, slotMax.get(i + 1) ?? 0));
  state.pactSlotsUsed = Math.min(state.pactSlotsUsed, sheet.spellcasting.pact?.max ?? 0);
  for (const [faces, used] of Object.entries(state.hitDiceUsed)) {
    const total = sheet.hitDice.find((h) => h.faces === Number(faces))?.total ?? 0;
    if (used !== undefined) state.hitDiceUsed[Number(faces)] = Math.min(used, total);
  }
  const resourceMax = new Map(sheet.resources.map((r) => [r.key, r.max.value]));
  for (const [key, used] of Object.entries(state.resourcesUsed)) {
    const max = resourceMax.get(key);
    if (max !== undefined) state.resourcesUsed[key] = Math.min(used, max);
  }
  state.damage = Math.min(state.damage, sheet.hp.max.value);
  return { character: n, trimmed, unprepared };
}
