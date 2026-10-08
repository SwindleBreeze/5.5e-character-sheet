// Where an action, switch, counter or rider comes from, in words (plan §9.2): a species trait or a
// feat says so, so a Goliath's Cloud's Jaunt reads as one; a class feature names its feature.

import type { Ref } from '../../../schema/index.ts';

/** `Species trait · Goliath (Cloud Giant Ancestry)`, `Feat · Alert`, or the source's name. */
export function sourceLabel(source: Ref | undefined, name: string): string {
  if (source?.kind === 'species') return `Species trait · ${speciesName(name)}`;
  if (source?.kind === 'feat') return `Feat · ${name}`;
  return name;
}

/** `Goliath; Cloud Giant Ancestry` → `Goliath (Cloud Giant Ancestry)`. */
export function speciesName(name: string): string {
  const [base, lineage] = name.split('; ');
  return lineage ? `${base} (${lineage})` : name;
}
