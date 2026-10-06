// The hand-written 5etools-format fixture (tests/fixtures/fivetools/tree) as an in-memory file
// map. `prefix` places it inside a folder, the way a zip or repo checkout would.

import { memoryFileSource } from '../adapters/fivetools/fs/memory.ts';
import type { FileSource } from '../adapters/fivetools/fs/types.ts';

const files = import.meta.glob('../../tests/fixtures/fivetools/tree/**/*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const MARKER = '/fivetools/tree/';

export function fixtureFiles(prefix = 'data/'): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, text] of Object.entries(files)) {
    out[prefix + path.slice(path.indexOf(MARKER) + MARKER.length)] = text;
  }
  return out;
}

export function fixtureSource(prefix = 'data/', extra: Record<string, string> = {}): FileSource {
  return memoryFileSource({ ...fixtureFiles(prefix), ...extra });
}
