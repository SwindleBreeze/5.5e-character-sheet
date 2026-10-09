// Which content is offered in pickers, the library and wizards (plan §6.7): what the enabled
// sources hold, less anything reprinted by content that is itself available. 2014 content is
// offered only with "Show 2014 content" on (step 8.1): `offeredSources` then keeps 2014 books in
// the enabled list and adds the `SHOW_2014` mark, which also lets through a 2014 entry in a
// book that isn't (homebrew can mix them). Turning it off hides them again without losing the
// choice. The filter never applies to refs a character already has.

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

/** In an enabled list: 2014 content is offered. Never a real source code. */
export const SHOW_2014: SourceCode = '+2014';

/**
 * In an enabled list: a character on 2014 rules (step 8.5). 2014 content is offered, and a 2014
 * original is preferred to its 2024 reprint (the 2014 Fighter, not the 2024 one).
 */
export const PREFER_2014: SourceCode = '+prefer2014';

/** Marks in an enabled list (`SHOW_2014`, `PREFER_2014`): never real source codes. */
export function isMark(code: SourceCode): boolean {
  return code.startsWith('+');
}

/**
 * A character's book list for the source hooks: its own list, or only marks for "the app's
 * books"; `PREFER_2014` added when it plays by the 2014 rules.
 */
export function characterSources(character: {
  enabledSources: SourceCode[] | null;
  ruleset?: '2014';
}): SourceCode[] | null {
  if (character.ruleset !== '2014') return character.enabledSources;
  return [...(character.enabledSources ?? []).filter((c) => c !== PREFER_2014), PREFER_2014];
}

/** Basic availability: an enabled source, and 2014 only with `SHOW_2014`. Ignores reprints. */
export function isOffered(entity: ContentEntity, enabled: ReadonlySet<SourceCode>): boolean {
  return enabled.has(entity.source) && (entity.edition !== '2014' || enabled.has(SHOW_2014));
}

/**
 * Whether a source can offer entities of `kind` right now: it has some, and it is not a locked
 * 2014 source. Used to hide library tabs with nothing to show.
 */
export function sourceOffersKind(source: SourceInfo, kind: EntityKind, show2014 = false): boolean {
  if (!source.counts[kind]) return false;
  return isSelectable(source, show2014);
}

/**
 * The enabled list as pickers use it: with "Show 2014 content" on, the stored list and the
 * `SHOW_2014` mark; off, the stored list without 2014 books. Codes of sources that aren't
 * imported are kept (they offer nothing anyway).
 */
export function offeredSources(
  codes: readonly SourceCode[],
  sources: readonly SourceInfo[],
  show2014: boolean,
): SourceCode[] {
  // A character on 2014 rules sees 2014 books whatever the switch.
  if (show2014 || codes.includes(PREFER_2014))
    return [...codes.filter((c) => c !== SHOW_2014), SHOW_2014];
  const old = new Set(sources.filter((s) => s.edition === '2014').map((s) => s.code));
  return codes.filter((c) => !old.has(c) && c !== SHOW_2014);
}

export function isAvailable(entity: ContentEntity, ctx: FilterContext): boolean {
  if (!isOffered(entity, ctx.enabled)) return false;
  // On 2014 rules a 2014 original stays, and its reprints give way (`availableOf`).
  if (entity.edition === '2014' && ctx.enabled.has(PREFER_2014)) return true;
  return !(entity.supersededBy ?? []).some((id) => id !== entity.id && ctx.isAvailableId(id));
}

/** Filter a list of one kind, resolving reprints within the list. */
export function availableOf<T extends ContentEntity>(
  list: readonly T[],
  enabled: ReadonlySet<SourceCode>,
): T[] {
  const offeredList = list.filter((e) => isOffered(e, enabled));
  const offered = new Set(offeredList.map((e) => e.id));
  const ctx: FilterContext = { enabled, isAvailableId: (id) => offered.has(id) };
  // On 2014 rules: the reprints of offered 2014 originals are left out.
  const reprints = new Set(
    enabled.has(PREFER_2014)
      ? offeredList.filter((e) => e.edition === '2014').flatMap((e) => e.supersededBy ?? [])
      : [],
  );
  return list.filter((e) => !reprints.has(e.id) && isAvailable(e, ctx));
}

/** Sources that can be switched on: 2014 ones only with "Show 2014 content" (step 8.1). */
export function isSelectable(source: SourceInfo, show2014 = false): boolean {
  return show2014 || source.edition !== '2014';
}

/** Settings → Sources groups: the book groups, then homebrew on its own (plan step 7.3). */
export type SourceGroupKey = SourceGroup | 'homebrew';

export const GROUP_ORDER: { group: SourceGroupKey; title: string }[] = [
  { group: 'core', title: 'Core' },
  { group: 'supplement', title: 'Supplements' },
  { group: 'adventure', title: 'Adventures' },
  { group: 'other', title: 'Other' },
  { group: 'homebrew', title: 'Homebrew' },
];

export function isHomebrew(source: SourceInfo): boolean {
  return source.origin === 'homebrew';
}

function groupOf(source: SourceInfo): SourceGroupKey {
  return isHomebrew(source) ? 'homebrew' : (source.group ?? 'other');
}

/** Settings → Sources: by group, 2024 books before 2014 ones, then by name. */
export function groupSources(sources: readonly SourceInfo[]) {
  const old = (s: SourceInfo) => Number(s.edition === '2014');
  return GROUP_ORDER.map(({ group, title }) => ({
    group,
    title,
    sources: sources
      .filter((s) => groupOf(s) === group)
      .sort((a, b) => old(a) - old(b) || a.name.localeCompare(b.name)),
  })).filter((g) => g.sources.length > 0);
}

/** `all`: every official book, 2014 ones included (only offered with "Show 2014 content"). */
export type Preset = 'core2024' | 'all2024' | 'all';

/** The official sources a preset switches on; homebrew is never part of one. */
export function presetSources(sources: readonly SourceInfo[], preset: Preset): SourceCode[] {
  return sources
    .filter(
      (s) =>
        !isHomebrew(s) &&
        (preset === 'all' ||
          (s.edition === '2024' && (preset === 'all2024' || s.group === 'core'))),
    )
    .map((s) => s.code)
    .sort();
}
