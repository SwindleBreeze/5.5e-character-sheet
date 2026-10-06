// FileSource over a local folder, for the opt-in smoke tests only.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { FileSource } from '../../src/adapters/fivetools/fs/types.ts';

export function nodeFileSource(root: string): FileSource {
  return {
    async readText(path) {
      try {
        return await readFile(join(root, path), 'utf8');
      } catch {
        return null;
      }
    },
    async listDir(path) {
      try {
        const entries = await readdir(join(root, path), { withFileTypes: true });
        return entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name)).sort();
      } catch {
        return [];
      }
    },
  };
}
