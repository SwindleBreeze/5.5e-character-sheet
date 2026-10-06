// Edition of each source and entity (plan §6.7). An entity's own `edition` wins
// (`one` = 2024, `classic` = 2014). Otherwise the source's edition applies: 2024 if any of its
// entities is marked `one` or the book was published on or after the 2024 Player's Handbook,
// 2014 if published earlier or any entity is marked `classic`, else unknown.

import type { Edition } from '../../schema/index.ts';
import type { SourceMeta } from './manifest.ts';
import type { RawEntity } from './raw.ts';

/** Release date of the 2024 Player's Handbook. */
export const EDITION_2024_DATE = '2024-09-17';

export function entityEdition(raw: RawEntity): Edition | undefined {
  if (raw.edition === 'one') return '2024';
  if (raw.edition === 'classic') return '2014';
  return undefined;
}

/** Edition per source code, from the records and the book list. */
export function sourceEditions(
  records: Iterable<RawEntity>,
  books: Map<string, SourceMeta>,
): Map<string, Edition> {
  const marks = new Map<string, { one: boolean; classic: boolean }>();
  for (const r of records) {
    if (typeof r.source !== 'string') continue;
    const m = marks.get(r.source) ?? { one: false, classic: false };
    if (r.edition === 'one') m.one = true;
    if (r.edition === 'classic') m.classic = true;
    marks.set(r.source, m);
  }

  const out = new Map<string, Edition>();
  const codes = new Set([...marks.keys(), ...books.keys()]);
  for (const code of codes) {
    const m = marks.get(code);
    const published = books.get(code)?.published;
    if (m?.one || (published !== undefined && published >= EDITION_2024_DATE))
      out.set(code, '2024');
    else if (published !== undefined || m?.classic) out.set(code, '2014');
    else out.set(code, 'unknown');
  }
  return out;
}
