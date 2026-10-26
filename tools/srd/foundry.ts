// Reading the SRD compendium of the Foundry VTT dnd5e system (plan 9.1): one YAML document per
// entry, in folders per pack. The system ships only free-rules content in these packs, under
// CC-BY-4.0, and marks nearly every entry so; the few left unmarked are listed by the build
// (`untagged`) for a check against the SRD itself.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

export type Doc = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : name.endsWith('.yml') ? [path] : [];
  });
}

/** Every entry of a pack (`classes24`, `spells24`…), with the folder it sits in. */
export function readPack(root: string, pack: string): (Doc & { _path: string })[] {
  const dir = join(root, 'packs', '_source', pack);
  return walk(dir)
    .filter((p) => !p.endsWith('_folder.yml'))
    .map((p) => ({ ...(parse(readFileSync(p, 'utf8')) as Doc), _path: p.slice(dir.length + 1) }));
}

/** Entries not marked CC-BY-4.0, by path: to check against the SRD before shipping. */
export function untagged(docs: (Doc & { _path: string })[]): string[] {
  return docs.filter((d) => d.system?.source?.license !== 'CC-BY-4.0').map((d) => d._path);
}

/** The pages of a journal pack entry (the rules glossary, the class tables). */
export function readJournal(root: string, pack: string, file: string): Doc {
  return parse(readFileSync(join(root, 'packs', '_source', pack, file), 'utf8')) as Doc;
}
