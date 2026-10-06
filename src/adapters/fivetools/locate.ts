// Find the 5etools `data/` folder inside whatever the user picked: the data folder itself, the
// repo root, or a zip whose top folder wraps either (plan §6.1 step 2).

import type { FileSource } from './fs/types.ts';

const MAX_DEPTH = 4;

function isDataRoot(children: string[]): boolean {
  return children.includes('class/') && children.includes('spells/');
}

/** Folder path (`''` or ending in `/`) of the data root, or null if none was found. */
export async function locateDataRoot(fs: FileSource): Promise<string | null> {
  let level = [''];
  for (let depth = 0; depth <= MAX_DEPTH && level.length > 0; depth++) {
    const next: string[] = [];
    for (const folder of level) {
      const children = await fs.listDir(folder);
      if (isDataRoot(children)) return folder;
      // Prefer `data/` when it exists; otherwise look through every subfolder.
      const folders = children.filter((c) => c.endsWith('/'));
      const preferred = folders.includes('data/') ? ['data/'] : folders;
      next.push(...preferred.map((c) => folder + c));
    }
    level = next;
  }
  return null;
}
