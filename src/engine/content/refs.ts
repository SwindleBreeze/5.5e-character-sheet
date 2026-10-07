// Which content a character needs: the refs it holds directly, and the refs that loaded content
// leads to. The loader follows them to a fixed point (plan §9.2, step 3.1).

import type { Character, ContentEntity, EntityKind, Entry, Ref } from '../../schema/index.ts';
import { walkEffects } from '../effects/walk.ts';

/** The kind of the value at `index` of a choice record, when its values are entity ids. */
export function valueKind(kinds: readonly EntityKind[] | undefined, index: number) {
  if (!kinds?.length) return undefined;
  return kinds.length === 1 ? kinds[0] : kinds[index];
}

/** Refs held by the character: its build, picks, inventory and prepared spells. */
export function characterRefs(character: Character): Ref[] {
  const out: Ref[] = [];
  for (const entry of character.log) {
    out.push(entry.classRef);
    if (entry.subclassRef) out.push(entry.subclassRef);
    if (entry.origin) out.push(entry.origin.speciesRef, entry.origin.backgroundRef);
    for (const record of entry.choices) {
      out.push(record.key.owner);
      record.values.forEach((id, i) => {
        const kind = valueKind(record.valueKinds, i);
        if (kind) out.push({ kind, id });
      });
    }
  }
  for (const item of character.inventory) {
    if (item.itemRef) out.push(item.itemRef);
    if (item.variantRef) out.push(item.variantRef);
  }
  for (const ids of Object.values(character.state.prepared)) {
    for (const id of ids) out.push({ kind: 'spell', id });
  }
  // Reprints of snapshotted content, to alias a missing owner (plan §4.4).
  for (const snapshot of Object.values(character.snapshots)) {
    for (const id of snapshot.supersededBy ?? []) out.push({ kind: snapshot.ref.kind, id });
  }
  return out;
}

/**
 * Class and subclass features written inside another feature's text (5etools
 * `refSubclassFeature`: Frenzy inside Path of the Berserker). The character has them along
 * with the feature. Refs inside "choose one of these" option blocks are choices, not included.
 */
export function nestedFeatureRefs(entity: ContentEntity): Ref[] {
  if (entity.kind !== 'classFeature' && entity.kind !== 'subclassFeature') return [];
  const out: Ref[] = [];
  const visit = (entries: readonly Entry[]) => {
    for (const e of entries) {
      if (typeof e === 'string') continue;
      if (e.type === 'ref') {
        if (e.ref.kind === 'classFeature' || e.ref.kind === 'subclassFeature') out.push(e.ref);
      } else if (e.type === 'list') visit(e.items);
      else if ('entries' in e && e.type !== 'options') visit(e.entries);
    }
  };
  visit(entity.entries);
  return out;
}

/** Refs a loaded entity leads to that deriving a character may read. */
export function entityRefs(entity: ContentEntity): Ref[] {
  const out: Ref[] = [];
  switch (entity.kind) {
    case 'class':
      for (const f of entity.features) out.push({ kind: 'classFeature', id: f.featureId });
      break;
    case 'subclass':
      for (const f of entity.features) out.push({ kind: 'subclassFeature', id: f.featureId });
      break;
    case 'background':
      if (entity.featId) out.push({ kind: 'feat', id: entity.featId });
      break;
    case 'item':
      if (entity.baseItemId) out.push({ kind: 'item', id: entity.baseItemId });
      if (entity.weapon?.masteryId) out.push({ kind: 'rule', id: entity.weapon.masteryId });
      // What a pack holds, so it can be unpacked into the inventory.
      for (const p of entity.packContents ?? []) out.push({ kind: 'item', id: p.itemId });
      break;
    default:
      break;
  }
  out.push(...nestedFeatureRefs(entity));
  for (const effect of walkEffects(entity.effects)) {
    if (effect.type === 'grantFeat') out.push(effect.feat);
    if (effect.type === 'grantSpells') {
      for (const grant of effect.spells) {
        if ('id' in grant.spell) out.push({ kind: 'spell', id: grant.spell.id });
      }
    }
  }
  return out;
}
