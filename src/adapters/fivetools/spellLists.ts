// Class and subclass spell lists (plan §6.1 step 8). 5etools keeps them outside the spells, in
// `generated/gendata-spell-source-lookup.json`:
//   { [spellSource]: { [spellName]: { class: { [classSource]: { [className]: true } },
//       subclass: { [classSource]: { [className]: { [subclassSource]: { [shortName]: {…} } } } } } } }
// (keys lowercase at the top two levels), or the older `spells/sources.json`:
//   { [SPELL_SOURCE]: { [Spell Name]: { class: [{ name, source }] } } }

import { classId, subclassId, type Spell } from '../../schema/index.ts';
import type { SpellLookup } from './manifest.ts';
import { asArray, isObject, type RawObject } from './raw.ts';

function entryFor(data: RawObject, source: string, name: string, lower: boolean): RawObject | null {
  const bySource = data[lower ? source.toLowerCase() : source];
  if (!isObject(bySource)) return null;
  const entry = bySource[lower ? name.toLowerCase() : name];
  return isObject(entry) ? entry : null;
}

function fromGendata(entry: RawObject): { classIds: string[]; subclassIds: string[] } {
  const classIds: string[] = [];
  const subclassIds: string[] = [];
  if (isObject(entry.class)) {
    for (const [classSource, classes] of Object.entries(entry.class)) {
      if (!isObject(classes)) continue;
      for (const className of Object.keys(classes)) classIds.push(classId(className, classSource));
    }
  }
  if (isObject(entry.subclass)) {
    for (const [classSource, classes] of Object.entries(entry.subclass)) {
      if (!isObject(classes)) continue;
      for (const [className, bySubSource] of Object.entries(classes)) {
        if (!isObject(bySubSource)) continue;
        for (const [subSource, subs] of Object.entries(bySubSource)) {
          if (!isObject(subs)) continue;
          for (const shortName of Object.keys(subs)) {
            subclassIds.push(subclassId(shortName, className, classSource, subSource));
          }
        }
      }
    }
  }
  return { classIds, subclassIds };
}

function fromSources(entry: RawObject): { classIds: string[]; subclassIds: string[] } {
  const classIds = asArray(entry.class)
    .filter(isObject)
    .filter((c) => typeof c.name === 'string' && typeof c.source === 'string')
    .map((c) => classId(String(c.name), String(c.source)));
  return { classIds, subclassIds: [] };
}

/** Fill `classIds` and `subclassIds` of each spell from the lookup, in place. */
export function applySpellLists(spells: Spell[], lookup: SpellLookup | null): void {
  if (!lookup) return;
  const gendata = lookup.format === 'gendata';
  for (const spell of spells) {
    const entry = entryFor(lookup.data, spell.source, spell.name, gendata);
    if (!entry) continue;
    const lists = gendata ? fromGendata(entry) : fromSources(entry);
    spell.classIds = [...new Set(lists.classIds)].sort();
    spell.subclassIds = [...new Set(lists.subclassIds)].sort();
  }
}
