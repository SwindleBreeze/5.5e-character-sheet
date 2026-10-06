// Which content is offered in pickers, the library and wizards (plan §6.7). Until phase 8 the
// app is 2024-only: 2014 content is hidden, and so is anything reprinted by content that is
// itself available. The filter never applies to refs a character already has.

import type {
  ContentEntity,
  EntityKind,
  Id,
  SourceCode,
  SourceGroup,
  SourceInfo,
} from '../schema/index.ts';

export interface FilterContext {
  enabled: ReadonlySet<SourceCode>;
  /** Whether an entity of the same kind with this id is available (for reprints). */
  isAvailableId: (id: Id) => boolean;
}

/** Character sources override the global list when set. */
export function effectiveSources(
  global: readonly SourceCode[],
  character?: { enabledSources: SourceCode[] | null } | null,
): Set<SourceCode> {
  return new Set(character?.enabledSources ?? global);
}

/** Basic availability: enabled source and not 2014. Ignores reprints. */
export function isOffered(entity: ContentEntity, enabled: ReadonlySet<SourceCode>): boolean {
  return enabled.has(entity.source) && entity.edition !== '2014';
}

/**
 * Whether a source can offer entities of `kind` right now: it has some, and it is not a locked
 * 2014 source. Used to hide library tabs with nothing to show.
 */
export function sourceOffersKind(source: SourceInfo, kind: EntityKind): boolean {
  if (!source.counts[kind]) return false;
  return isSelectable(source);
}

export function isAvailable(entity: ContentEntity, ctx: FilterContext): boolean {
  if (!isOffered(entity, ctx.enabled)) return false;
  return !(entity.supersededBy ?? []).some((id) => id !== entity.id && ctx.isAvailableId(id));
}

/** Filter a list of one kind, resolving reprints within the list. */
export function availableOf<T extends ContentEntity>(
  list: readonly T[],
  enabled: ReadonlySet<SourceCode>,
): T[] {
  const offered = new Set(list.filter((e) => isOffered(e, enabled)).map((e) => e.id));
  const ctx: FilterContext = { enabled, isAvailableId: (id) => offered.has(id) };
  return list.filter((e) => isAvailable(e, ctx));
}

/** Sources that can be switched on before phase 8 (2014 ones are listed but locked). */
export function isSelectable(source: SourceInfo): boolean {
  return source.edition !== '2014';
}

export const GROUP_ORDER: { group: SourceGroup; title: string }[] = [
  { group: 'core', title: 'Core 2024' },
  { group: 'supplement', title: 'Supplements' },
  { group: 'adventure', title: 'Adventures' },
  { group: 'other', title: 'Other' },
];

export function groupSources(sources: readonly SourceInfo[]) {
  return GROUP_ORDER.map(({ group, title }) => ({
    group,
    title,
    sources: sources
      .filter((s) => (s.group ?? 'other') === group)
      .sort(
        (a, b) => Number(isSelectable(b)) - Number(isSelectable(a)) || a.name.localeCompare(b.name),
      ),
  })).filter((g) => g.sources.length > 0);
}

export type Preset = 'core2024' | 'all2024';

export function presetSources(sources: readonly SourceInfo[], preset: Preset): SourceCode[] {
  return sources
    .filter((s) => s.edition === '2024' && (preset === 'all2024' || s.group === 'core'))
    .map((s) => s.code)
    .sort();
}
