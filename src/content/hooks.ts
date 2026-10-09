// React hooks over imported content and source settings. Live: they update when an import or a
// settings change lands, including writes made by the import worker.

import { useLiveQuery } from 'dexie-react-hooks';
import { DEFAULT_SETTINGS } from '../db/settingsRepo.ts';
import { repos } from '../db/repos.ts';
import { createCatalog, type Catalog } from '../engine/build/catalog.ts';
import { createContentIndex, refsKey, type ContentIndex } from '../engine/content/contentIndex.ts';
import { characterRefs } from '../engine/content/refs.ts';
import {
  ENTITY_KINDS,
  ruleId,
  type Character,
  type ContentEntity,
  type EntityByKind,
  type EntityKind,
  type Ref,
  type Rule,
  type Skill,
  type SourceCode,
  type SourceInfo,
} from '../schema/index.ts';
import { availableOf } from '../sources/sourceFilter.ts';
import { loadContentIndex } from './loadIndex.ts';

/** `undefined` while loading, `null` when the entity is not imported. */
export function useEntity<K extends EntityKind>(
  ref: { kind: K; id: string } | Ref,
): EntityByKind[K] | null | undefined {
  return useLiveQuery(
    async () => ((await repos().content.get(ref.kind, ref.id)) ?? null) as EntityByKind[K] | null,
    [ref.kind, ref.id],
  );
}

export function useEntitiesOfKind<K extends EntityKind>(kind: K): EntityByKind[K][] | undefined {
  return useLiveQuery(() => repos().content.listByKind(kind), [kind]);
}

export function useSources(): SourceInfo[] | undefined {
  return useLiveQuery(() => repos().content.listSources(), []);
}

/**
 * The sources pickers offer: a character's own list when it has one (plan §6.7), else the
 * app's setting.
 */
export function useEnabledSources(character?: SourceCode[] | null): SourceCode[] {
  return useKnownSources(character) ?? DEFAULT_SETTINGS.enabledSources;
}

/** The same, but undefined until the app's setting has been read. */
function useKnownSources(character?: SourceCode[] | null): SourceCode[] | undefined {
  const global = useLiveQuery(() => repos().settings.get('enabledSources'), []);
  return character ?? global;
}

/**
 * The content a character uses (plan §9.2, step 3.1). Reloads when the set of refs the
 * character holds changes, or when that content is re-imported; not on play changes like HP.
 */
export function useContentIndex(character: Character | null | undefined): ContentIndex | undefined {
  const key = character ? refsKey(characterRefs(character)) : '';
  return useLiveQuery(
    () =>
      character ? loadContentIndex(character, (refs) => repos().content.getMany(refs)) : undefined,
    // The character is read through `key`: same refs, same content.
    [key],
  );
}

export interface AllContent {
  /** Every imported entity, whatever its source. */
  index: ContentIndex;
  /** What pickers may offer: the enabled sources only. */
  catalog: Catalog;
}

/**
 * All imported content at once, for building characters from scratch (the quick-builder now,
 * the creation wizard later). Heavier than `useContentIndex`; reloads after an import or a
 * source change.
 */
export function useAllContent(sources?: SourceCode[] | null): AllContent | undefined {
  // Wait for the setting: loading with the defaults first drew every list twice, and a tap in
  // between landed on the list being replaced.
  const enabled = useKnownSources(sources);
  return useLiveQuery(async () => {
    if (!enabled) return undefined;
    const lists = await Promise.all(ENTITY_KINDS.map((k) => repos().content.listByKind(k)));
    const all = lists.flat() as ContentEntity[];
    return { index: createContentIndex(all), catalog: createCatalog(all, new Set(enabled)) };
  }, [enabled?.join()]);
}

/** Conditions the enabled sources offer, by name, for the condition picker. */
export function useConditionOptions(): { id: string; name: string }[] | undefined {
  const enabled = useEnabledSources();
  return useLiveQuery(async () => {
    const rules = await repos().content.listByKind('rule');
    return availableOf(
      rules.filter((r) => r.ruleKind === 'condition'),
      new Set(enabled),
    )
      .map((r) => ({ id: r.id, name: r.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [enabled.join()]);
}

/** A skill's rule entry: the 2024 one first, else the 2014 one, else any source's. */
export function useSkillRule(skill: Skill): Rule | null | undefined {
  return useLiveQuery(async () => {
    const content = repos().content;
    for (const source of ['XPHB', 'PHB']) {
      const rule = await content.get('rule', ruleId('skill', skill, source));
      if (rule) return rule as Rule;
    }
    const prefix = ruleId('skill', skill, '');
    const rules = await content.listByKind('rule');
    return rules.find((r) => r.id.startsWith(prefix)) ?? null;
  }, [skill]);
}
