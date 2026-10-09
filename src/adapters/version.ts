/** Bump when converted content changes shape or meaning, so packs and imports can be compared. */
export const ADAPTER_VERSION = 7;

/**
 * What a re-import gains, by the version that brought it: shown when content on the device was
 * imported by an older version (plan step 7.1).
 */
export const ADAPTER_CHANGES: Record<number, string> = {
  4: 'ammunition for ranged weapons',
  5: 'flavor text for classes, species, backgrounds and feats',
  6: 'spells that magic items cast with their charges',
  7: 'creatures: familiars, summons, companions and Beasts for Wild Shape',
};

/** What content imported at `version` misses, newest last. */
export function changesSince(version: number): string[] {
  return Object.entries(ADAPTER_CHANGES)
    .filter(([v]) => Number(v) > version && Number(v) <= ADAPTER_VERSION)
    .map(([, text]) => text);
}
